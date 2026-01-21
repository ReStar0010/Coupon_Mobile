"""
Management Command: check_escalations
UGC Compliance (Apple Guideline 1.2) - User Story 4

Checks for pending reports approaching 24-hour SLA and sends escalation alerts.
Should be run hourly via cron job.

Usage:
    python manage.py check_escalations
"""

from django.core.management.base import BaseCommand
from api.services.moderation_service import check_escalations


class Command(BaseCommand):
    help = 'Check for reports approaching 24-hour SLA and send escalation alerts'

    def handle(self, *args, **options):
        self.stdout.write('Checking for escalated reports...')
        
        try:
            check_escalations()
            self.stdout.write(
                self.style.SUCCESS('Successfully checked escalations.')
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error checking escalations: {str(e)}')
            )

