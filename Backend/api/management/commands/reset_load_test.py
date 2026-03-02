"""
Reset load test environment: clear all redemptions, then re-run seed.
Ensures each stage runs in a totally clean state.
"""
import os

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import CouponRedemption


class Command(BaseCommand):
    help = "Clear all redemption data and re-run seed_load_test for a clean stage."

    def handle(self, *args, **options):
        with transaction.atomic():
            count = CouponRedemption.objects.count()
            CouponRedemption.objects.all().delete()
            self.stdout.write(
                self.style.NOTICE(f"Deleted {count} redemption record(s).")
            )
        self.stdout.write("Re-running seed...")
        call_command("seed_load_test")
        self.stdout.write(self.style.SUCCESS("Reset complete."))
