"""
Tests for Phone OTP verification feature.
Feature: 002-phone-otp-verification
"""
from django.test import TestCase, override_settings
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from datetime import timedelta
from django.utils import timezone
from unittest.mock import patch

from api.models import PhoneOTPRecord, StudentProfile, Coupon, Store, CouponTemplate


class PhoneOTPTestBase(TestCase):
    """Base test class with common setup for phone OTP tests."""

    def setUp(self):
        """Set up test fixtures."""
        # Create test user
        self.user = User.objects.create_user(
            username='testuser@example.com',
            email='testuser@example.com',
            password='testpass123'
        )
        self.profile = StudentProfile.objects.create(user=self.user)

        # Create another user for uniqueness tests
        self.other_user = User.objects.create_user(
            username='other@example.com',
            email='other@example.com',
            password='testpass123'
        )
        self.other_profile = StudentProfile.objects.create(
            user=self.other_user,
            phone_number='0911111111'
        )

        # Create a merchant user for store ownership
        self.merchant_user = User.objects.create_user(
            username='merchant@example.com',
            email='merchant@example.com',
            password='testpass123'
        )

        # Create store and template for coupon tests
        self.store = Store.objects.create(
            owner=self.merchant_user,
            name='Test Store',
            lat=25.0,
            lng=121.0,
            address='Test Address'
        )

        self.template = CouponTemplate.objects.create(
            store=self.store,
            coupon_name='Test Coupon',
            coupon_detail='Test detail',
            total_quantity=10,
            remaining_quantity=10,
            start_date=timezone.now(),
            expiry_date=timezone.now() + timedelta(days=30)
        )

        # Set up API client
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        # Test phone number
        self.test_phone = '0912345678'


@override_settings(SMS_DEV_MODE=True)
class PhoneOTPSendTests(PhoneOTPTestBase):
    """Tests for POST /api/phone-otp/send/ endpoint."""

    def test_send_otp_success(self):
        """T010: Test successful OTP send with valid phone."""
        response = self.client.post('/api/phone-otp/send/', {
            'phone_number': self.test_phone
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)
        self.assertIn('cooldown_seconds', response.data)
        self.assertIn('expires_in_seconds', response.data)
        self.assertEqual(response.data['cooldown_seconds'], 60)
        self.assertEqual(response.data['expires_in_seconds'], 600)

        # Verify OTP record was created
        otp_record = PhoneOTPRecord.objects.filter(
            user=self.user,
            phone_number=self.test_phone
        ).first()
        self.assertIsNotNone(otp_record)
        self.assertEqual(len(otp_record.otp_code), 6)
        self.assertFalse(otp_record.is_verified)

    def test_send_otp_dev_mode_returns_code(self):
        """Test that dev mode includes OTP code in response."""
        response = self.client.post('/api/phone-otp/send/', {
            'phone_number': self.test_phone
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('dev_mode'))
        self.assertIn('otp_code', response.data)
        self.assertEqual(len(response.data['otp_code']), 6)

    def test_send_otp_invalid_phone_format(self):
        """Test OTP send fails with invalid phone format."""
        invalid_phones = [
            '08123456789',  # Wrong prefix
            '091234567',    # Too short
            '09123456789',  # Too long
            'abcdefghij',   # Not numeric
        ]

        for phone in invalid_phones:
            response = self.client.post('/api/phone-otp/send/', {
                'phone_number': phone
            })
            self.assertEqual(
                response.status_code,
                status.HTTP_400_BAD_REQUEST,
                f"Phone {phone} should be invalid"
            )
            self.assertIn('error', response.data)

    def test_send_otp_phone_taken_by_another_user(self):
        """T024: Test OTP send fails if phone belongs to another user."""
        response = self.client.post('/api/phone-otp/send/', {
            'phone_number': '0911111111'  # other_user's phone
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('此電話號碼已被其他帳號使用', response.data['error'])

    def test_send_otp_requires_authentication(self):
        """Test OTP send requires authenticated user."""
        self.client.logout()
        response = self.client.post('/api/phone-otp/send/', {
            'phone_number': self.test_phone
        })

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


@override_settings(SMS_DEV_MODE=True)
class PhoneOTPVerifyTests(PhoneOTPTestBase):
    """Tests for POST /api/phone-otp/verify/ endpoint."""

    def setUp(self):
        super().setUp()
        # Create a valid OTP record
        self.otp_record = PhoneOTPRecord.create_otp(self.user, self.test_phone)

    def test_verify_otp_success(self):
        """T011: Test successful OTP verification."""
        response = self.client.post('/api/phone-otp/verify/', {
            'phone_number': self.test_phone,
            'otp_code': self.otp_record.otp_code
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)
        self.assertEqual(response.data['phone_number'], self.test_phone)
        self.assertIn('masked_phone', response.data)
        self.assertIn('pending_coupons_claimed', response.data)

        # Verify phone was updated
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.phone_number, self.test_phone)

        # Verify OTP record was marked as verified
        self.otp_record.refresh_from_db()
        self.assertTrue(self.otp_record.is_verified)

    def test_verify_otp_wrong_code(self):
        """Test verification fails with wrong OTP code."""
        response = self.client.post('/api/phone-otp/verify/', {
            'phone_number': self.test_phone,
            'otp_code': '000000'  # Wrong code
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('驗證碼錯誤', response.data['error'])
        self.assertIn('attempts_remaining', response.data)

        # Verify attempt was counted
        self.otp_record.refresh_from_db()
        self.assertEqual(self.otp_record.attempt_count, 1)

    def test_verify_otp_expired(self):
        """Test verification fails with expired OTP."""
        # Make OTP expired
        self.otp_record.expires_at = timezone.now() - timedelta(minutes=1)
        self.otp_record.save()

        response = self.client.post('/api/phone-otp/verify/', {
            'phone_number': self.test_phone,
            'otp_code': self.otp_record.otp_code
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('已過期', response.data['error'])

    def test_verify_otp_no_pending_otp(self):
        """Test verification fails when no pending OTP exists."""
        # Delete the OTP record
        self.otp_record.delete()

        response = self.client.post('/api/phone-otp/verify/', {
            'phone_number': self.test_phone,
            'otp_code': '123456'
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('找不到待驗證的OTP', response.data['error'])


@override_settings(SMS_DEV_MODE=True)
class PhoneOTPCouponClaimTests(PhoneOTPTestBase):
    """Tests for coupon auto-claim on verification."""

    def test_coupon_auto_claim_on_verification(self):
        """T012: Test pending coupons are claimed when phone is verified."""
        # Create pending coupons for the test phone
        pending_coupons = []
        for i in range(3):
            coupon = Coupon.objects.create(
                store=self.store,
                template=self.template,
                coupon_name=f'Pending Coupon {i}',
                coupon_detail='Test detail',
                start_date=timezone.now(),
                expiry_date=timezone.now() + timedelta(days=30),
                coupon_type='exclusive',
                pending_phone_number=self.test_phone  # Pending for our test phone
            )
            pending_coupons.append(coupon)

        # Create OTP and verify
        otp_record = PhoneOTPRecord.create_otp(self.user, self.test_phone)

        response = self.client.post('/api/phone-otp/verify/', {
            'phone_number': self.test_phone,
            'otp_code': otp_record.otp_code
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['pending_coupons_claimed'], 3)

        # Verify coupons were transferred
        for coupon in pending_coupons:
            coupon.refresh_from_db()
            self.assertEqual(coupon.current_holder, self.user)
            self.assertIsNone(coupon.pending_phone_number)
            self.assertEqual(coupon.acquisition_method, 'consolidate')

    def test_no_pending_coupons(self):
        """Test verification succeeds with no pending coupons."""
        otp_record = PhoneOTPRecord.create_otp(self.user, self.test_phone)

        response = self.client.post('/api/phone-otp/verify/', {
            'phone_number': self.test_phone,
            'otp_code': otp_record.otp_code
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['pending_coupons_claimed'], 0)


@override_settings(SMS_DEV_MODE=True)
class UserPhoneEndpointTests(PhoneOTPTestBase):
    """Tests for PUT/DELETE /api/user/phone/ blocking (US2)."""

    def test_put_phone_blocked(self):
        """T022: Test that PUT /api/user/phone/ returns 405."""
        response = self.client.put('/api/user/phone/', {
            'phone_number': self.test_phone
        })

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertIn('error', response.data)
        self.assertIn('redirect', response.data)

    def test_delete_phone_blocked(self):
        """T023: Test that DELETE /api/user/phone/ returns 405."""
        # First set a phone
        self.profile.phone_number = self.test_phone
        self.profile.save()

        response = self.client.delete('/api/user/phone/')

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertIn('error', response.data)

    def test_get_phone_still_works(self):
        """Test that GET /api/user/phone/ still works."""
        self.profile.phone_number = self.test_phone
        self.profile.save()

        response = self.client.get('/api/user/phone/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['phone_number'], self.test_phone)


@override_settings(SMS_DEV_MODE=True)
class PhoneOTPRateLimitTests(PhoneOTPTestBase):
    """Tests for rate limiting (US5)."""

    def test_cooldown_enforcement(self):
        """T032: Test 60-second cooldown between OTP requests."""
        # First request should succeed
        response1 = self.client.post('/api/phone-otp/send/', {
            'phone_number': self.test_phone
        })
        self.assertEqual(response1.status_code, status.HTTP_200_OK)

        # Second request within 60 seconds should fail
        response2 = self.client.post('/api/phone-otp/send/', {
            'phone_number': self.test_phone
        })
        self.assertEqual(response2.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn('請等待60秒', response2.data['error'])
        self.assertIn('retry_after_seconds', response2.data)

    def test_hourly_rate_limit(self):
        """T036: Test hourly rate limit (3 OTPs/hour)."""
        # Create 3 OTP records within the hour
        for i in range(3):
            PhoneOTPRecord.objects.create(
                user=self.user,
                phone_number=self.test_phone,
                otp_code=f'{100000 + i}',
                expires_at=timezone.now() + timedelta(minutes=10),
                # Spread them out to avoid cooldown
                created_at=timezone.now() - timedelta(minutes=i * 2)
            )

        # Fourth request should fail
        response = self.client.post('/api/phone-otp/send/', {
            'phone_number': self.test_phone
        })

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn('已超過每小時OTP請求次數限制', response.data['error'])

    def test_max_attempts_enforcement(self):
        """T037: Test max attempts limit (5 attempts/OTP)."""
        otp_record = PhoneOTPRecord.create_otp(self.user, self.test_phone)

        # Make 5 wrong attempts
        for i in range(5):
            response = self.client.post('/api/phone-otp/verify/', {
                'phone_number': self.test_phone,
                'otp_code': '000000'
            })
            if i < 4:
                self.assertEqual(response.data.get('attempts_remaining'), 4 - i)

        # 6th attempt should be locked
        response = self.client.post('/api/phone-otp/verify/', {
            'phone_number': self.test_phone,
            'otp_code': otp_record.otp_code  # Even correct code should fail
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('錯誤次數過多', response.data['error'])

    def test_otp_expiration(self):
        """T038: Test OTP expiration after 10 minutes."""
        otp_record = PhoneOTPRecord.create_otp(self.user, self.test_phone)

        # Manually expire the OTP
        otp_record.expires_at = timezone.now() - timedelta(minutes=1)
        otp_record.save()

        response = self.client.post('/api/phone-otp/verify/', {
            'phone_number': self.test_phone,
            'otp_code': otp_record.otp_code
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('已過期', response.data['error'])


@override_settings(SMS_DEV_MODE=True)
class PhoneChangeTests(PhoneOTPTestBase):
    """Tests for phone change with coupon transfer (US3)."""

    def setUp(self):
        super().setUp()
        # Set up user with existing phone
        self.old_phone = '0922222222'
        self.profile.phone_number = self.old_phone
        self.profile.save()

        # Create pending coupons for old phone
        self.old_phone_coupon = Coupon.objects.create(
            store=self.store,
            template=self.template,
            coupon_name='Old Phone Coupon',
            coupon_detail='Test detail',
            start_date=timezone.now(),
            expiry_date=timezone.now() + timedelta(days=30),
            coupon_type='exclusive',
            pending_phone_number=self.old_phone
        )

    def test_old_phone_coupons_transferred_on_change(self):
        """T028: Test old phone's unclaimed coupons transfer on phone change."""
        new_phone = '0933333333'
        otp_record = PhoneOTPRecord.create_otp(self.user, new_phone)

        response = self.client.post('/api/phone-otp/verify/', {
            'phone_number': new_phone,
            'otp_code': otp_record.otp_code
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get('old_phone_coupons_transferred'), 1)

        # Verify coupon was transferred
        self.old_phone_coupon.refresh_from_db()
        self.assertEqual(self.old_phone_coupon.current_holder, self.user)
        self.assertIsNone(self.old_phone_coupon.pending_phone_number)

    def test_new_phone_coupons_claimed_on_change(self):
        """T029: Test new phone's pending coupons are claimed on change."""
        new_phone = '0933333333'

        # Create pending coupon for new phone
        new_phone_coupon = Coupon.objects.create(
            store=self.store,
            template=self.template,
            coupon_name='New Phone Coupon',
            coupon_detail='Test detail',
            start_date=timezone.now(),
            expiry_date=timezone.now() + timedelta(days=30),
            coupon_type='exclusive',
            pending_phone_number=new_phone
        )

        otp_record = PhoneOTPRecord.create_otp(self.user, new_phone)

        response = self.client.post('/api/phone-otp/verify/', {
            'phone_number': new_phone,
            'otp_code': otp_record.otp_code
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['pending_coupons_claimed'], 1)

        # Verify new phone coupon was claimed
        new_phone_coupon.refresh_from_db()
        self.assertEqual(new_phone_coupon.current_holder, self.user)
