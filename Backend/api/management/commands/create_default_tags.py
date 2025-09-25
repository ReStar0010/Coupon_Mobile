from django.core.management.base import BaseCommand
from api.models import Tag

class Command(BaseCommand):
    """
    Command to create default tags for coupons
    """
    help = 'Create default tags for coupons'

    def handle(self, *args, **kwargs):
        tags = [
            {'name': 'food', 'display_name': '食物'},
            {'name': 'drink', 'display_name': '飲品'},
            {'name': 'entertainment', 'display_name': '娛樂'},
            {'name': 'shopping', 'display_name': '購物'},
            {'name': 'travel', 'display_name': '旅遊'},
            {'name': 'health', 'display_name': '健康'},
            {'name': 'discount', 'display_name': '折扣'},
            {'name': 'other', 'display_name': '其他'},
        ]

        for tag_data in tags:
            tag, created = Tag.objects.get_or_create(name=tag_data['name'], defaults={'display_name': tag_data['display_name']})
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created tag: {tag.display_name}'))
            else:
                self.stdout.write(self.style.WARNING(f'Tag already exists: {tag.display_name}'))
