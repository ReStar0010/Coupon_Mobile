"""
Management Command: cleanup_old_reports
UGC Compliance (Apple Guideline 1.2) - User Story 4

Cleans up resolved content reports older than 7 days.
Should be run daily via cron job.

Usage:
    python manage.py cleanup_old_reports
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from api.models import ContentReport


class Command(BaseCommand):
    help = 'Clean up resolved content reports older than 7 days'

    def handle(self, *args, **options):
        # Calculate cutoff date (7 days ago)
        cutoff_date = timezone.now() - timedelta(days=7)

        # Find reports to delete
        reports_to_delete = ContentReport.objects.filter(
            status__in=['reviewed', 'dismissed'],
            reviewed_at__lte=cutoff_date
        )

        count = reports_to_delete.count()

        if count == 0:
            self.stdout.write(
                self.style.SUCCESS('No old reports to clean up.')
            )
            return

        # Delete reports
        reports_to_delete.delete()

        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully deleted {count} old report(s).'
            )
        )

