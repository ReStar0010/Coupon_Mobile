"""
Reset load test environment: clear all redemptions, then re-run seed.
When load_tests/config/test_users.json exists, seeds from that config (single shared dataset).
Otherwise runs seed_load_test for current STAGE.
"""
import json
import os
from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import CouponRedemption


def _config_dir():
    return Path(settings.BASE_DIR).parent / "load_tests" / "config"


def _load_repo_config():
    config_dir = _config_dir()
    test_users_file = config_dir / "test_users.json"
    if not test_users_file.exists():
        return None
    config = {}
    try:
        with open(test_users_file, encoding="utf-8") as f:
            config["test_users"] = json.load(f)
    except (json.JSONDecodeError, OSError):
        return None
    stores_file = config_dir / "stores.json"
    if stores_file.exists():
        try:
            with open(stores_file, encoding="utf-8") as f:
                config["stores"] = json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    if not config.get("stores"):
        return None
    task_weights_file = config_dir / "task_weights.json"
    if task_weights_file.exists():
        try:
            with open(task_weights_file, encoding="utf-8") as f:
                config["task_weights"] = json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    tokens_file = config_dir / "private_share_tokens.json"
    if tokens_file.exists():
        try:
            with open(tokens_file, encoding="utf-8") as f:
                config["private_share_tokens"] = json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return config


class Command(BaseCommand):
    help = "Clear all redemption data and re-run seed. Uses repo config if load_tests/config/test_users.json exists."

    def handle(self, *args, **options):
        with transaction.atomic():
            count = CouponRedemption.objects.count()
            CouponRedemption.objects.all().delete()
            self.stdout.write(
                self.style.NOTICE(f"Deleted {count} redemption record(s).")
            )
        config = _load_repo_config()
        stage = int(os.environ.get("STAGE", "1"))
        if config is not None:
            self.stdout.write("Seeding from repo config (stage=%s)..." % stage)
            from api.management.commands.seed_load_test import seed_from_config
            _credentials, store_codes, _tokens = seed_from_config(config, stage)
            config_dir = _config_dir()
            config_dir.mkdir(parents=True, exist_ok=True)
            with open(config_dir / "stores.json", "w", encoding="utf-8") as f:
                json.dump(store_codes, f, indent=2)
            self.stdout.write(self.style.SUCCESS("Reset complete (from config)."))
        else:
            self.stdout.write("Re-running seed...")
            call_command("seed_load_test")
            self.stdout.write(self.style.SUCCESS("Reset complete."))
