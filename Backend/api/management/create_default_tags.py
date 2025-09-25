from django.core.management.base import BaseCommand
from api.models import Tag

class Command(BaseCommand):
    """
    Command to create default tags for coupons
    """
    help = 'Create default tags for coupons'

    def handle(self, *args, **kwargs):
        tags = [
            {'name': 'Food', 'display_name': 'Food'},
            {'name': 'Drink', 'display_name': 'Drink'},
            {'name': 'Entertainment', 'display_name': 'Entertainment'},
            {'name': 'Discount', 'display_name': 'Discount'},
        ]

        for tag_data in tags:
            tag, created = Tag.objects.get_or_create(name=tag_data['name'], defaults={'display_name': tag_data['display_name']})
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created tag: {tag.display_name}'))
            else:
                self.stdout.write(self.style.WARNING(f'Tag already exists: {tag.display_name}'))