from django.db import migrations, models


def seed_coop_weights(apps, schema_editor):
    """Seed co-op weights with today's odds so the admin opens with both knobs
    populated and independently editable."""
    SpinnerConfig = apps.get_model('api', 'SpinnerConfig')
    formula = {str(v): 1.0 / (v + 1) for v in (0, 1, 2, 3, 4, 5)}
    SpinnerConfig.objects.update_or_create(
        pk=1,
        defaults={'coop_base_weights': formula},
    )


def unseed(apps, schema_editor):
    SpinnerConfig = apps.get_model('api', 'SpinnerConfig')
    SpinnerConfig.objects.filter(pk=1).update(coop_base_weights={})


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0062_spinnerconfig'),
    ]

    operations = [
        migrations.AlterField(
            model_name='spinnerconfig',
            name='base_weights',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text=(
                    '單人 CouSino 每個倍率的相對權重，例如 {"0":1.0,"1":0.5,...,"5":0.1667}。'
                    '數字越大越容易抽中。留空則回退為 1/(v+1) 公式（不可全部設為 0）。'
                ),
            ),
        ),
        migrations.AddField(
            model_name='spinnerconfig',
            name='coop_base_weights',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text=(
                    '共玩 CouSino 的倍率權重（格式同上）。'
                    '留空則沿用單人權重（不可全部設為 0）。注意：共玩的 floor 會隨人數提高，'
                    '低於 floor 的倍率（如 2 人時的 x0/x1）無論權重都不會出現。'
                ),
            ),
        ),
        migrations.RunPython(seed_coop_weights, unseed),
    ]
