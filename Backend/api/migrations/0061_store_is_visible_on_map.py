# Generated to add Store.is_visible_on_map + backfill the 10 launch-partner stores.
#
# Why a literal ID list:
#   The 10 stores were identified by name match against prod (好好吃飯,
#   小姐姐麻辣食堂, 叮叮食堂, 匠豆咖啡, 和平一五號, 糧晨Get食, 搗飛豆花,
#   蘇格貓底, 原典鮮沏茶｜台大店, 七樂燒臘). On dev / fresh installs these
#   IDs won't exist, so the RunPython filters by id__in and a missing row
#   is a silent no-op rather than a crash — same migration runs cleanly
#   in every environment.

from django.db import migrations, models


# Hard-coded launch-partner store IDs. Confirmed against prod 2026-05-30.
LAUNCH_PARTNER_STORE_IDS = [
    74,   # 匠豆咖啡
    76,   # 糧晨Get食
    77,   # 小姐姐麻辣食堂
    81,   # 和平一五號
    83,   # 好好吃飯
    84,   # 搗飛豆花
    85,   # 叮叮食堂
    146,  # 蘇格貓底
    147,  # 七樂燒臘
    148,  # 原典鮮沏茶｜台大店
]


def backfill_launch_partners(apps, schema_editor):
    """Flip is_visible_on_map=True for the 10 launch-partner stores."""
    Store = apps.get_model('api', 'Store')
    Store.objects.filter(id__in=LAUNCH_PARTNER_STORE_IDS).update(is_visible_on_map=True)


def backfill_launch_partners_reverse(apps, schema_editor):
    """Reverse: flip them back to False so a `migrate api 0060` restores prior state."""
    Store = apps.get_model('api', 'Store')
    Store.objects.filter(id__in=LAUNCH_PARTNER_STORE_IDS).update(is_visible_on_map=False)


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0060_couponshare_message_field'),
    ]

    operations = [
        migrations.AddField(
            model_name='store',
            name='is_visible_on_map',
            field=models.BooleanField(
                default=False,
                help_text='Show this store as a pin on CouMap (requires signed partnership).',
            ),
        ),
        migrations.RunPython(backfill_launch_partners, backfill_launch_partners_reverse),
    ]
