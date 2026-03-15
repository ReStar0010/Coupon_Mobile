from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from django.conf import settings
from django.core.files.base import File
from django.core.files.storage import FileSystemStorage, default_storage
from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import Coupon, CouponTemplate, Store, StudentProfile


@dataclass(frozen=True)
class _TargetField:
    model: type
    field_name: str


def _extract_storage_key(image_url: str) -> Optional[str]:
    """
    Convert various stored url formats to a storage key (filename / path).

    Supported formats (existing codebase):
    - "/media/<filename>"
    - "https://domain/media/<filename>"
    - "<filename>"
    - "https://pub-xxx.r2.dev/<filename>" (fallback: last path segment)
    """
    if not image_url:
        return None

    media_url = (getattr(settings, "MEDIA_URL", "") or "").rstrip("/") + "/"
    url = image_url.strip()

    if media_url and url.startswith(media_url):
        return url.replace(media_url, "", 1).lstrip("/")

    if media_url and media_url in url:
        # full URL containing MEDIA_URL
        parts = url.split(media_url, 1)
        if len(parts) == 2 and parts[1]:
            return parts[1].split("?", 1)[0].lstrip("/")

    if not (url.startswith("http://") or url.startswith("https://")):
        return url.split("/")[-1].split("?", 1)[0].lstrip("/")

    # external URL: best-effort
    return url.rstrip("/").split("/")[-1].split("?", 1)[0].lstrip("/")


class Command(BaseCommand):
    help = "Migrate local MEDIA_ROOT images to default storage (e.g. Cloudflare R2), and update DB image_url fields."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print actions without uploading or updating DB.",
        )
        parser.add_argument(
            "--overwrite",
            action="store_true",
            help="Overwrite destination object if it already exists.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Stop after migrating N files (0 = no limit).",
        )

    def handle(self, *args, **options):
        dry_run: bool = bool(options["dry_run"])
        overwrite: bool = bool(options["overwrite"])
        limit: int = int(options["limit"] or 0)

        # Source is always local disk at MEDIA_ROOT (Render disk / local dev)
        src_storage = FileSystemStorage(location=str(settings.MEDIA_ROOT), base_url=settings.MEDIA_URL)

        targets = [
            _TargetField(Store, "image_url"),
            _TargetField(CouponTemplate, "image_url"),
            _TargetField(Coupon, "image_url"),
            _TargetField(StudentProfile, "savings_goal_image"),
        ]

        migrated = 0
        skipped_missing = 0
        skipped_exists = 0
        updated_rows = 0

        self.stdout.write("開始遷移圖片到預設 Storage（若已設定 R2，則會上傳到 R2）...")
        self.stdout.write(f"- MEDIA_ROOT: {settings.MEDIA_ROOT}")
        self.stdout.write(f"- MEDIA_URL: {settings.MEDIA_URL}")
        self.stdout.write(f"- default_storage: {default_storage.__class__.__module__}.{default_storage.__class__.__name__}")
        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN：不會上傳也不會更新資料庫"))

        for target in targets:
            qs = target.model.objects.exclude(**{f"{target.field_name}__isnull": True}).exclude(**{target.field_name: ""})
            self.stdout.write(f"\n掃描 {target.model.__name__}.{target.field_name}（{qs.count()} 筆）...")

            for obj in qs.iterator(chunk_size=200):
                if limit and migrated >= limit:
                    break

                url_val = getattr(obj, target.field_name, "") or ""
                key = _extract_storage_key(url_val)
                if not key:
                    continue

                # Only migrate if the file exists on local disk (source)
                if not src_storage.exists(key):
                    skipped_missing += 1
                    continue

                # Upload to destination
                if default_storage.exists(key) and not overwrite:
                    skipped_exists += 1
                    # Still ensure DB points at the destination URL (useful when URL used to be /media/...)
                    dest_url = default_storage.url(key)
                    if dest_url and dest_url != url_val:
                        if dry_run:
                            self.stdout.write(f"[DRY] update {target.model.__name__}#{obj.pk} {target.field_name}: {url_val} -> {dest_url}")
                        else:
                            setattr(obj, target.field_name, dest_url)
                            obj.save(update_fields=[target.field_name])
                            updated_rows += 1
                    continue

                dest_url = default_storage.url(key)
                if dry_run:
                    self.stdout.write(f"[DRY] upload {key}  (current={url_val}, dest={dest_url})")
                    migrated += 1
                    continue

                with src_storage.open(key, mode="rb") as f:
                    default_storage.save(key, File(f))

                # Update DB to new URL (R2 public domain) / keep consistent
                new_url = default_storage.url(key)
                with transaction.atomic():
                    obj = target.model.objects.select_for_update().get(pk=obj.pk)
                    setattr(obj, target.field_name, new_url)
                    obj.save(update_fields=[target.field_name])
                updated_rows += 1
                migrated += 1

            if limit and migrated >= limit:
                break

        self.stdout.write("\n完成。")
        self.stdout.write(f"- migrated: {migrated}")
        self.stdout.write(f"- updated_rows: {updated_rows}")
        self.stdout.write(f"- skipped_missing_on_disk: {skipped_missing}")
        self.stdout.write(f"- skipped_already_exists: {skipped_exists}")
