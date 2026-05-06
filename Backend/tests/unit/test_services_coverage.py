"""
Additional unit tests for email_service and analytics_service.
Extends existing coverage with edge cases and data-driven scenarios.
"""
from datetime import date, timedelta
from unittest.mock import patch

import pytest


# ---------------------------------------------------------------------------
# EmailService edge cases
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class EmailServiceEdgeCases:
    """Edge-case coverage for send_verification_email."""

    def test_send_verification_email_with_plus_sign_in_email(self):
        """send_verification_email handles email addresses with a '+' character."""
        with patch('resend.Emails.send') as mock_send:
            mock_send.return_value = {'id': 'plus-test'}
            from api.services.email_service import send_verification_email
            result = send_verification_email('user+tag@example.com', 'token123')
            assert result is True
            call_args = mock_send.call_args[0][0]
            assert call_args['to'] == 'user+tag@example.com'

    def test_send_verification_email_resend_unavailable(self):
        """send_verification_email returns False when Resend raises (simulating no API key)."""
        with patch('resend.Emails.send', side_effect=Exception("API key not configured")):
            from api.services.email_service import send_verification_email
            result = send_verification_email('test@example.com', 'token')
            assert result is False

    def test_send_verification_email_empty_token(self):
        """send_verification_email still calls Resend with an empty token string."""
        with patch('resend.Emails.send') as mock_send:
            mock_send.return_value = {'id': 'empty-token-test'}
            from api.services.email_service import send_verification_email
            result = send_verification_email('test@example.com', '')
            assert result is True

    def test_send_verification_email_subject_present(self):
        """send_verification_email payload contains a non-empty 'subject' field."""
        with patch('resend.Emails.send') as mock_send:
            mock_send.return_value = {'id': 'subj-test'}
            from api.services.email_service import send_verification_email
            send_verification_email('test@example.com', 'tok')
            call_args = mock_send.call_args[0][0]
            assert 'subject' in call_args
            assert call_args['subject']

    def test_send_password_reset_student_calls_resend(self):
        """send_password_reset_email for a student calls Resend exactly once."""
        with patch('resend.Emails.send') as mock_send:
            mock_send.return_value = {'id': 'reset-student'}
            from api.services.email_service import send_password_reset_email
            send_password_reset_email('student@example.com', 'resettoken', is_merchant=False)
            mock_send.assert_called_once()

    def test_send_password_reset_merchant_calls_resend(self):
        """send_password_reset_email for a merchant calls Resend exactly once."""
        with patch('resend.Emails.send') as mock_send:
            mock_send.return_value = {'id': 'reset-merchant'}
            from api.services.email_service import send_password_reset_email
            send_password_reset_email('merchant@example.com', 'mtoken', is_merchant=True)
            mock_send.assert_called_once()


# ---------------------------------------------------------------------------
# AnalyticsService data-driven tests
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class AnalyticsServiceTests:
    """Tests for analytics_service with real DB records."""

    def _create_setup(self):
        """Create the minimum model objects needed for analytics tests."""
        from django.contrib.auth.models import User
        from django.utils import timezone

        from api.models import CouponRedemption, CouponTemplate, Coupon, Store

        merchant = User.objects.create_user(
            username='analytics_merchant@test.com',
            email='analytics_merchant@test.com',
            password='testpass123',
        )
        redeemer = User.objects.create_user(
            username='analytics_user@test.com',
            email='analytics_user@test.com',
            password='testpass123',
        )
        store = Store.objects.create(
            owner=merchant, name='Analytics Store', lat=25.0, lng=121.0, address='1 Analytics Rd'
        )
        template = CouponTemplate.objects.create(
            store=store,
            coupon_name='Analytics Coupon',
            coupon_detail='detail',
            total_quantity=10,
            remaining_quantity=10,
            start_date=timezone.now() - timedelta(days=10),
            expiry_date=timezone.now() + timedelta(days=30),
            is_active=True,
        )
        coupon = Coupon.objects.create(
            store=store,
            template=template,
            coupon_name='Analytics Coupon',
            coupon_detail='detail',
            start_date=timezone.now() - timedelta(days=10),
            expiry_date=timezone.now() + timedelta(days=30),
            coupon_type='exclusive',
            acquisition_method='consolidate',
            original_owner=redeemer,
            current_holder=redeemer,
        )
        redemption = CouponRedemption.objects.create(
            coupon=coupon,
            user=redeemer,
            savings_amount=10,
            coupon_type='exclusive',
        )
        return template, coupon, redemption

    def test_redemption_trend_with_data(self):
        """get_template_redemption_trend returns a non-empty list when redemptions exist."""
        template, _, _ = self._create_setup()
        from api.services.analytics_service import get_template_redemption_trend
        today = date.today()
        result = get_template_redemption_trend(
            template_id=template.id,
            start_date=today - timedelta(days=7),
            end_date=today,
        )
        assert isinstance(result, list)
        assert len(result) >= 1
        assert 'date' in result[0]
        assert 'count' in result[0]

    def test_redemption_trend_count_is_correct(self):
        """get_template_redemption_trend count equals the number of redemptions made today."""
        template, _, _ = self._create_setup()
        from api.services.analytics_service import get_template_redemption_trend
        today = date.today()
        result = get_template_redemption_trend(
            template_id=template.id,
            start_date=today,
            end_date=today,
        )
        total = sum(r['count'] for r in result)
        assert total == 1

    def test_view_trend_with_data(self):
        """get_template_view_trend returns a non-empty list when Log entries exist."""
        template, _, _ = self._create_setup()

        from django.utils import timezone as tz
        from api.models import Log
        from django.contrib.auth.models import User

        user = User.objects.get(username='analytics_user@test.com')
        Log.objects.create(
            action='template_view',
            user=user,
            template=template,
        )

        from api.services.analytics_service import get_template_view_trend
        today = date.today()
        result = get_template_view_trend(
            template_id=template.id,
            start_date=today - timedelta(days=1),
            end_date=today,
        )
        assert isinstance(result, list)
        assert len(result) >= 1

    def test_trend_correct_date_range_excludes_old_entries(self):
        """Entries outside the requested date range are not counted."""
        template, coupon, _ = self._create_setup()

        from django.contrib.auth.models import User
        from django.utils import timezone as tz
        import datetime
        from api.models import CouponRedemption

        # Create an extra redemption backdated 60 days (outside range)
        old_redeemer = User.objects.create_user(
            username='old_redeemer@test.com',
            email='old_redeemer@test.com',
            password='testpass123',
        )
        r = CouponRedemption(
            coupon=coupon,
            user=old_redeemer,
            savings_amount=0,
            coupon_type='exclusive',
        )
        # Bypass auto_now by direct DB update after save
        r.save()
        old_date = tz.now() - datetime.timedelta(days=60)
        CouponRedemption.objects.filter(pk=r.pk).update(redeemed_at=old_date)

        from api.services.analytics_service import get_template_redemption_trend
        today = date.today()
        # Query last 7 days — must not include the 60-day-old entry
        result = get_template_redemption_trend(
            template_id=template.id,
            start_date=today - timedelta(days=7),
            end_date=today,
        )
        total = sum(row['count'] for row in result)
        # Only the 1 redemption from setUp() should appear (created today)
        assert total == 1

    def test_empty_trend_for_nonexistent_template(self):
        """get_template_redemption_trend returns [] for a template id that does not exist."""
        from api.services.analytics_service import get_template_redemption_trend
        today = date.today()
        result = get_template_redemption_trend(
            template_id=9999999,
            start_date=today - timedelta(days=7),
            end_date=today,
        )
        assert result == []

    def test_view_trend_empty_for_nonexistent_template(self):
        """get_template_view_trend returns [] for a template id that does not exist."""
        from api.services.analytics_service import get_template_view_trend
        today = date.today()
        result = get_template_view_trend(
            template_id=9999999,
            start_date=today - timedelta(days=7),
            end_date=today,
        )
        assert result == []
