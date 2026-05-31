from django.db import migrations, models


def seed_default_weights(apps, schema_editor):
    """Seed the singleton with today's odds (w(v)=1/(v+1)) so the admin opens
    showing the current values to tune."""
    SpinnerConfig = apps.get_model('api', 'SpinnerConfig')
    SpinnerConfig.objects.update_or_create(
        pk=1,
        defaults={'base_weights': {str(v): 1.0 / (v + 1) for v in (0, 1, 2, 3, 4, 5)}},
    )


def unseed(apps, schema_editor):
    SpinnerConfig = apps.get_model('api', 'SpinnerConfig')
    SpinnerConfig.objects.filter(pk=1).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0061_store_is_visible_on_map'),
    ]

    operations = [
        migrations.CreateModel(
            name='SpinnerConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('base_weights', models.JSONField(
                    default=dict,
                    help_text=(
                        '每個倍率的相對權重，例如 {"0":1.0,"1":0.5,...,"5":0.1667}。'
                        '數字越大越容易抽中。留空則回退為 1/(v+1) 公式。'
                    ),
                )),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'CouSino 機率設定',
                'verbose_name_plural': 'CouSino 機率設定',
                'db_table': 'spinner_config',
            },
        ),
        migrations.RunPython(seed_default_weights, unseed),
    ]
