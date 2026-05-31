from django.db import migrations

# "Subtle" tune: boost x4 above the 8% default and make x5 rarer (7% → 4%),
# while keeping the natural high=rarer ordering. Weights sum to 100, so each
# weight ≈ its solo floor-0 probability. Applied to both solo and co-op.
TUNED = {"0": 41, "1": 20, "2": 13, "3": 11, "4": 11, "5": 4}

# Reverse → the seeded 1/(v+1) baseline.
FORMULA = {str(v): 1.0 / (v + 1) for v in (0, 1, 2, 3, 4, 5)}


def set_tuned(apps, schema_editor):
    SpinnerConfig = apps.get_model('api', 'SpinnerConfig')
    SpinnerConfig.objects.update_or_create(
        pk=1,
        defaults={'base_weights': dict(TUNED), 'coop_base_weights': dict(TUNED)},
    )


def revert_to_formula(apps, schema_editor):
    SpinnerConfig = apps.get_model('api', 'SpinnerConfig')
    SpinnerConfig.objects.update_or_create(
        pk=1,
        defaults={'base_weights': dict(FORMULA), 'coop_base_weights': dict(FORMULA)},
    )


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0063_spinnerconfig_coop_base_weights'),
    ]

    operations = [
        migrations.RunPython(set_tuned, revert_to_formula),
    ]
