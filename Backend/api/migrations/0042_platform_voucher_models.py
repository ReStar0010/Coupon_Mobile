# Generated manually for Platform Cash Voucher (011)

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from django.utils import timezone


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0041_store_timezone_currency'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='store',
            name='accepts_platform_vouchers',
            field=models.BooleanField(default=False),
        ),
        migrations.CreateModel(
            name='PlatformVoucher',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('face_value', models.DecimalField(decimal_places=2, max_digits=10)),
                ('currency_code', models.CharField(default='TWD', max_length=10)),
                ('start_date', models.DateTimeField()),
                ('expiry_date', models.DateTimeField()),
                ('redeem_code', models.CharField(max_length=6, unique=True)),
                ('batch_name', models.CharField(blank=True, max_length=255)),
                ('acquisition_method', models.CharField(blank=True, choices=[('platform_issue', 'Platform Issue'), ('transfer', 'Transfer'), ('public_pool', 'Public Pool')], max_length=20, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('current_holder', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='held_platform_vouchers', to=settings.AUTH_USER_MODEL)),
                ('last_holder', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='last_platform_vouchers', to=settings.AUTH_USER_MODEL)),
                ('original_owner', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='owned_platform_vouchers', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='PlatformVoucherRedemption',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('redeemed_at', models.DateTimeField(default=timezone.now)),
                ('amount_used', models.DecimalField(decimal_places=2, max_digits=10)),
                ('store', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='platform_voucher_redemptions', to='api.store')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='platform_voucher_redemptions', to=settings.AUTH_USER_MODEL)),
                ('voucher', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='redemption', to='api.platformvoucher')),
            ],
            options={
                'constraints': [
                    models.UniqueConstraint(fields=['voucher'], name='unique_platform_voucher_redemption'),
                ],
            },
        ),
        migrations.CreateModel(
            name='PlatformVoucherShareRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token', models.CharField(max_length=64, unique=True)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('accepted', 'Accepted'), ('declined', 'Declined')], default='pending', max_length=16)),
                ('is_public', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(default=timezone.now)),
                ('responded_at', models.DateTimeField(blank=True, null=True)),
                ('from_user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='platform_voucher_share_requests_sent', to=settings.AUTH_USER_MODEL)),
                ('to_user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='platform_voucher_share_requests_received', to=settings.AUTH_USER_MODEL)),
                ('voucher', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='share_requests', to='api.platformvoucher')),
            ],
            options={
                'constraints': [
                    models.UniqueConstraint(condition=models.Q(is_public=True, status='pending'), fields=['voucher'], name='unique_pending_public_share_per_platform_voucher'),
                ],
            },
        ),
    ]
