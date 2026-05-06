"""
Tests for Phone OTP verification feature.
Feature: 002-phone-otp-verification
"""
from django.test import TestCase, override_settings
from django.contrib.auth.models import User
from django.core.cache import cache
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
        cache.clear()
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
            self.assertIn('error_code', response.data)

    def test_send_otp_phone_taken_by_another_user(self):
        """T024: Test OTP send fails if phone belongs to another user."""
        response = self.client.post('/api/phone-otp/send/', {
            'phone_number': '0911111111'  # other_user's phone
        })

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['error_code'], 'PHONE_ALREADY_USED_BY_OTHER')

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
        self.assertEqual(response.data['error_code'], 'OTP_INVALID')
        self.assertIn('attempts_remaining', response.data.get('context', {}))

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
        self.assertEqual(response.data['error_code'], 'OTP_EXPIRED')

    def test_verify_otp_no_pending_otp(self):
        """Test verification fails when no pending OTP exists."""
        # Delete the OTP record
        self.otp_record.delete()

        response = self.client.post('/api/phone-otp/verify/', {
            'phone_number': self.test_phone,
            'otp_code': '123456'
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error_code'], 'OTP_NOT_FOUND')


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

    def test_expired_pending_coupon_not_claimed_on_verification(self):
        """Expired pending coupons are skipped (aligned with assign_pending_coupons)."""
        expired = Coupon.objects.create(
            store=self.store,
            template=self.template,
            coupon_name='Expired Pending',
            coupon_detail='Test detail',
            start_date=timezone.now() - timedelta(days=60),
            expiry_date=timezone.now() - timedelta(days=1),
            coupon_type='exclusive',
            pending_phone_number=self.test_phone,
        )
        otp_record = PhoneOTPRecord.create_otp(self.user, self.test_phone)
        response = self.client.post('/api/phone-otp/verify/', {
            'phone_number': self.test_phone,
            'otp_code': otp_record.otp_code
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['pending_coupons_claimed'], 0)
        expired.refresh_from_db()
        self.assertIsNone(expired.current_holder)
        self.assertEqual(expired.pending_phone_number, self.test_phone)

    def test_pending_claim_preserves_non_empty_acquisition_method(self):
        """Claim does not overwrite acquisition_method when already set (e.g. qr_claim)."""
        coupon = Coupon.objects.create(
            store=self.store,
            template=self.template,
            coupon_name='QR Pending',
            coupon_detail='Test detail',
            start_date=timezone.now(),
            expiry_date=timezone.now() + timedelta(days=30),
            coupon_type='exclusive',
            pending_phone_number=self.test_phone,
            acquisition_method='qr_claim',
        )
        otp_record = PhoneOTPRecord.create_otp(self.user, self.test_phone)
        response = self.client.post('/api/phone-otp/verify/', {
            'phone_number': self.test_phone,
            'otp_code': otp_record.otp_code
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['pending_coupons_claimed'], 1)
        coupon.refresh_from_db()
        self.assertEqual(coupon.current_holder, self.user)
        self.assertIsNone(coupon.pending_phone_number)
        self.assertEqual(coupon.acquisition_method, 'qr_claim')


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
        self.assertEqual(response2.data['error_code'], 'OTP_RATE_LIMITED')
        self.assertIn('retry_after_seconds', response2.data.get('context', {}))

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
        self.assertEqual(response.data['error_code'], 'OTP_RATE_LIMITED')

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
                self.assertEqual(response.data.get('context', {}).get('attempts_remaining'), 4 - i)

        # 6th attempt should be locked
        response = self.client.post('/api/phone-otp/verify/', {
            'phone_number': self.test_phone,
            'otp_code': otp_record.otp_code  # Even correct code should fail
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error_code'], 'OTP_MAX_ATTEMPTS')

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
        self.assertEqual(response.data['error_code'], 'OTP_EXPIRED')


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


# =============================================================================
# Tests for Feature: 009-phone-registration
# =============================================================================


@override_settings(SMS_DEV_MODE=True)
class RegistrationPhoneLookupTests(TestCase):
    """Tests for POST /api/register/check-phone/ (lookup only, no SMS)."""

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.free_phone = "0912345678"
        self.registered_phone = "0911111111"

    def test_check_phone_invalid_format(self):
        response = self.client.post(
            "/api/register/check-phone/",
            {"phone_number": "08123456789"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error_code", response.data)

    def test_check_phone_empty_body_no_crash(self):
        response = self.client.post("/api/register/check-phone/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_check_phone_registered_false(self):
        response = self.client.post(
            "/api/register/check-phone/",
            {"phone_number": self.free_phone},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("registered", response.data)
        self.assertFalse(response.data["registered"])

    def test_check_phone_registered_true(self):
        user = User.objects.create_user(
            username=self.registered_phone,
            password="testpass123",
        )
        StudentProfile.objects.create(
            user=user,
            phone_number=self.registered_phone,
            phone_verified=True,
        )
        response = self.client.post(
            "/api/register/check-phone/",
            {"phone_number": self.registered_phone},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["registered"])

    def test_check_phone_throttle_21st_request_same_phone(self):
        throttle_phone = "0933333333"
        for i in range(20):
            response = self.client.post(
                "/api/register/check-phone/",
                {"phone_number": throttle_phone},
                format="json",
            )
            self.assertEqual(
                response.status_code,
                status.HTTP_200_OK,
                msg=f"Request {i + 1} should succeed",
            )
        response21 = self.client.post(
            "/api/register/check-phone/",
            {"phone_number": throttle_phone},
            format="json",
        )
        self.assertEqual(response21.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_check_phone_throttle_independent_per_phone(self):
        """After exhausting one phone, another phone still works (same client)."""
        phone_a = "0944444444"
        phone_b = "0955555555"
        for _ in range(20):
            r = self.client.post(
                "/api/register/check-phone/",
                {"phone_number": phone_a},
                format="json",
            )
            self.assertEqual(r.status_code, status.HTTP_200_OK)
        blocked = self.client.post(
            "/api/register/check-phone/",
            {"phone_number": phone_a},
            format="json",
        )
        self.assertEqual(blocked.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

        ok_b = self.client.post(
            "/api/register/check-phone/",
            {"phone_number": phone_b},
            format="json",
        )
        self.assertEqual(ok_b.status_code, status.HTTP_200_OK)
        self.assertFalse(ok_b.data["registered"])


@override_settings(SMS_DEV_MODE=True)
class RegistrationOTPSendTests(TestCase):
    """Tests for POST /api/register/send-otp/ endpoint (US1).
    T015: Contract test validating request/response schema.
    """

    def setUp(self):
        """Set up test fixtures."""
        cache.clear()
        self.client = APIClient()
        self.test_phone = '0912345678'

    def test_send_registration_otp_success(self):
        """T015: Test successful registration OTP send."""
        response = self.client.post('/api/register/send-otp/', {
            'phone_number': self.test_phone
        })

        # Validate 200 response schema
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)
        self.assertIn('驗證碼已發送', response.data['message'])
        self.assertIn('cooldown_seconds', response.data)
        self.assertEqual(response.data['cooldown_seconds'], 60)
        self.assertIn('expires_in_seconds', response.data)
        self.assertEqual(response.data['expires_in_seconds'], 600)
        
        # Dev mode fields
        self.assertTrue(response.data.get('dev_mode'))
        self.assertIn('otp_code', response.data)
        self.assertEqual(len(response.data['otp_code']), 6)

        # Verify OTP record created with correct purpose
        otp_record = PhoneOTPRecord.objects.filter(
            phone_number=self.test_phone,
            purpose='registration'
        ).first()
        self.assertIsNotNone(otp_record)
        self.assertIsNone(otp_record.user)  # user should be None for registration

    def test_send_registration_otp_invalid_format(self):
        """T015: Test 400 response for invalid phone format."""
        invalid_phones = [
            '08123456789',  # Wrong prefix
            '091234567',    # Too short
            '09123456789',  # Too long
            'abcdefghij',   # Not numeric
        ]

        for phone in invalid_phones:
            response = self.client.post('/api/register/send-otp/', {
                'phone_number': phone
            })
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn('error_code', response.data)

    def test_send_registration_otp_duplicate_phone(self):
        """T015: Test 409 response when phone already registered."""
        # Create existing user with this phone
        existing_user = User.objects.create_user(
            username='0911111111',
            password='testpass123'
        )
        StudentProfile.objects.create(
            user=existing_user,
            phone_number='0911111111',
            phone_verified=True
        )

        response = self.client.post('/api/register/send-otp/', {
            'phone_number': '0911111111'
        })

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['error_code'], 'PHONE_ALREADY_REGISTERED')

    def test_send_registration_otp_rate_limit(self):
        """T015: Test 429 response when rate limited."""
        # First request succeeds
        response1 = self.client.post('/api/register/send-otp/', {
            'phone_number': self.test_phone
        })
        self.assertEqual(response1.status_code, status.HTTP_200_OK)

        # Second request within cooldown fails
        response2 = self.client.post('/api/register/send-otp/', {
            'phone_number': self.test_phone
        })
        self.assertEqual(response2.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(response2.data['error_code'], 'OTP_RATE_LIMITED')
        self.assertIn('retry_after_seconds', response2.data.get('context', {}))


@override_settings(SMS_DEV_MODE=True)
class RegistrationOTPVerifyTests(TestCase):
    """Tests for POST /api/register/verify-otp/ endpoint (US1).
    T016: Contract test validating request/response schema.
    """

    def setUp(self):
        """Set up test fixtures."""
        cache.clear()
        self.client = APIClient()
        self.test_phone = '0912345678'
        self.test_password = 'testpass123'

    def test_verify_registration_otp_success(self):
        """T016: Test successful registration OTP verification (201 response)."""
        # Send OTP first
        send_response = self.client.post('/api/register/send-otp/', {
            'phone_number': self.test_phone
        })
        otp_code = send_response.data['otp_code']

        # Verify OTP and create account
        response = self.client.post('/api/register/verify-otp/', {
            'phone_number': self.test_phone,
            'otp_code': otp_code,
            'password': self.test_password
        })

        # Validate 201 response schema
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('message', response.data)
        self.assertIn('註冊成功', response.data['message'])
        self.assertIn('access_token', response.data)
        self.assertIn('refresh_token', response.data)
        # Backend returns 'user' object instead of 'user_id'
        self.assertIn('user', response.data)

        # Verify user was created
        user = User.objects.filter(username=self.test_phone).first()
        self.assertIsNotNone(user)
        self.assertTrue(user.check_password(self.test_password))

        # Verify profile was created with phone_verified=True
        profile = StudentProfile.objects.filter(user=user).first()
        self.assertIsNotNone(profile)
        self.assertEqual(profile.phone_number, self.test_phone)
        self.assertTrue(profile.phone_verified)
        self.assertFalse(profile.verified)  # Email not verified yet

    def test_verify_registration_otp_wrong_code(self):
        """T016: Test 400 response for wrong OTP code."""
        # Send OTP first
        self.client.post('/api/register/send-otp/', {
            'phone_number': self.test_phone
        })

        # Try with wrong code
        response = self.client.post('/api/register/verify-otp/', {
            'phone_number': self.test_phone,
            'otp_code': '000000',
            'password': self.test_password
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error_code'], 'OTP_INVALID')
        self.assertIn('attempts_remaining', response.data.get('context', {}))

    def test_verify_registration_otp_no_pending(self):
        """T016: Test 400 response when no pending OTP exists (OTP_NOT_FOUND)."""
        response = self.client.post('/api/register/verify-otp/', {
            'phone_number': self.test_phone,
            'otp_code': '123456',
            'password': self.test_password
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error_code'], 'OTP_NOT_FOUND')

    def test_verify_registration_otp_expired(self):
        """T016: Test 400 response for expired OTP (OTP_EXPIRED)."""
        # Create expired OTP
        otp_record = PhoneOTPRecord.objects.create(
            phone_number=self.test_phone,
            otp_code='123456',
            purpose='registration',
            user=None,
            expires_at=timezone.now() - timedelta(minutes=1)
        )

        response = self.client.post('/api/register/verify-otp/', {
            'phone_number': self.test_phone,
            'otp_code': otp_record.otp_code,
            'password': self.test_password
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error_code'], 'OTP_EXPIRED')


@override_settings(SMS_DEV_MODE=True)
class RegistrationIntegrationTests(TestCase):
    """Integration tests for registration flow (US1).
    T017-T018: Full flow and failure cases.
    """

    def setUp(self):
        """Set up test fixtures."""
        cache.clear()
        self.client = APIClient()
        self.test_phone = '0912345678'
        self.test_password = 'testpass123'

    def test_registration_success_flow(self):
        """T017: Integration test for complete registration flow."""
        # Step 1: Send OTP
        send_response = self.client.post('/api/register/send-otp/', {
            'phone_number': self.test_phone
        })
        self.assertEqual(send_response.status_code, status.HTTP_200_OK)
        otp_code = send_response.data['otp_code']

        # Step 2: Verify OTP and create account
        verify_response = self.client.post('/api/register/verify-otp/', {
            'phone_number': self.test_phone,
            'otp_code': otp_code,
            'password': self.test_password
        })
        self.assertEqual(verify_response.status_code, status.HTTP_201_CREATED)

        # Step 3: Verify user can log in with phone
        user = User.objects.get(username=self.test_phone)
        profile = user.student_profile
        
        self.assertEqual(profile.phone_number, self.test_phone)
        self.assertTrue(profile.phone_verified)
        self.assertTrue(user.check_password(self.test_password))

        # Step 4: Verify JWT tokens are valid
        access_token = verify_response.data['access_token']
        self.assertIsNotNone(access_token)

    def test_registration_claims_pending_coupons_and_sets_owner(self):
        """Pending coupons for the registering phone match assign_pending_coupons semantics."""
        merchant = User.objects.create_user(
            username='merchant_reg_pending@example.com',
            email='merchant_reg_pending@example.com',
            password=self.test_password,
        )
        store = Store.objects.create(
            owner=merchant,
            name='Reg Pending Store',
            lat=25.0,
            lng=121.0,
            address='Addr',
        )
        template = CouponTemplate.objects.create(
            store=store,
            coupon_name='Tpl',
            coupon_detail='D',
            total_quantity=5,
            remaining_quantity=5,
            start_date=timezone.now(),
            expiry_date=timezone.now() + timedelta(days=30),
        )
        pending = Coupon.objects.create(
            store=store,
            template=template,
            coupon_name='Pending For Reg',
            coupon_detail='D',
            start_date=timezone.now(),
            expiry_date=timezone.now() + timedelta(days=30),
            coupon_type='exclusive',
            pending_phone_number=self.test_phone,
        )

        send_response = self.client.post('/api/register/send-otp/', {
            'phone_number': self.test_phone
        })
        self.assertEqual(send_response.status_code, status.HTTP_200_OK)
        otp_code = send_response.data['otp_code']

        verify_response = self.client.post('/api/register/verify-otp/', {
            'phone_number': self.test_phone,
            'otp_code': otp_code,
            'password': self.test_password
        })
        self.assertEqual(verify_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(verify_response.data.get('coupons_claimed'), 1)

        user = User.objects.get(username=self.test_phone)
        pending.refresh_from_db()
        self.assertEqual(pending.current_holder, user)
        self.assertEqual(pending.original_owner, user)
        self.assertIsNone(pending.pending_phone_number)

    def test_registration_failure_duplicate_phone(self):
        """T018: Test registration fails for duplicate phone (409)."""
        # Create existing user
        existing_user = User.objects.create_user(
            username='0911111111',
            password=self.test_password
        )
        StudentProfile.objects.create(
            user=existing_user,
            phone_number='0911111111',
            phone_verified=True
        )

        # Try to register with same phone
        response = self.client.post('/api/register/send-otp/', {
            'phone_number': '0911111111'
        })
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_registration_failure_invalid_format(self):
        """T018: Test registration fails for invalid phone format (400)."""
        response = self.client.post('/api/register/send-otp/', {
            'phone_number': '12345'
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_registration_failure_wrong_otp(self):
        """T018: Test registration fails for wrong OTP with attempts tracking."""
        # Send OTP
        send_response = self.client.post('/api/register/send-otp/', {
            'phone_number': self.test_phone
        })
        
        # Try wrong OTP
        response = self.client.post('/api/register/verify-otp/', {
            'phone_number': self.test_phone,
            'otp_code': '000000',
            'password': self.test_password
        })
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('attempts_remaining', response.data.get('context', {}))
        
        # Verify user was NOT created
        self.assertFalse(User.objects.filter(username=self.test_phone).exists())

    def test_registration_failure_expired_otp(self):
        """T018: Test registration fails for expired OTP (400 OTP_EXPIRED)."""
        # Create expired OTP
        PhoneOTPRecord.objects.create(
            phone_number=self.test_phone,
            otp_code='123456',
            purpose='registration',
            user=None,
            expires_at=timezone.now() - timedelta(minutes=1)
        )

        response = self.client.post('/api/register/verify-otp/', {
            'phone_number': self.test_phone,
            'otp_code': '123456',
            'password': self.test_password
        })
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error_code'], 'OTP_EXPIRED')
        self.assertFalse(User.objects.filter(username=self.test_phone).exists())

    def test_registration_failure_max_attempts(self):
        """T018: Test registration fails after max attempts exceeded."""
        # Send OTP
        send_response = self.client.post('/api/register/send-otp/', {
            'phone_number': self.test_phone
        })
        otp_code = send_response.data['otp_code']

        # Make 5 wrong attempts
        for i in range(5):
            self.client.post('/api/register/verify-otp/', {
                'phone_number': self.test_phone,
                'otp_code': '000000',
                'password': self.test_password
            })

        # 6th attempt with correct code should still fail
        response = self.client.post('/api/register/verify-otp/', {
            'phone_number': self.test_phone,
            'otp_code': otp_code,
            'password': self.test_password
        })
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error_code'], 'OTP_MAX_ATTEMPTS')


# =============================================================================
# Tests for User Story 2: Phone Login
# =============================================================================


@override_settings(SMS_DEV_MODE=True)
class PhoneLoginTests(TestCase):
    """Tests for phone-based login (US2).
    T026-T027: Contract and integration tests for phone login.
    """

    def setUp(self):
        """Set up test fixtures."""
        cache.clear()
        self.client = APIClient()
        self.test_phone = '0912345678'
        self.test_password = 'testpass123'

        # Create a phone-registered user
        self.user = User.objects.create_user(
            username=self.test_phone,
            password=self.test_password
        )
        self.profile = StudentProfile.objects.create(
            user=self.user,
            phone_number=self.test_phone,
            phone_verified=True
        )

    def test_phone_login_success(self):
        """T026: Test successful phone login with correct credentials."""
        response = self.client.post('/api/login/', {
            'phone_number': self.test_phone,
            'password': self.test_password,
            'client_type': 'user'
        })

        # Validate 200 response schema
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access_token', response.data)
        self.assertIn('refresh_token', response.data)
        self.assertTrue(response.data['access_token'])
        self.assertTrue(response.data['refresh_token'])

    def test_phone_login_wrong_password(self):
        """T027: Test phone login fails with wrong password (401)."""
        response = self.client.post('/api/login/', {
            'phone_number': self.test_phone,
            'password': 'wrongpassword',
            'client_type': 'user'
        })

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data['error_code'], 'INVALID_CREDENTIALS')

    def test_phone_login_unregistered_phone(self):
        """T027: Test phone login fails for unregistered phone (404)."""
        response = self.client.post('/api/login/', {
            'phone_number': '0999999999',
            'password': self.test_password,
            'client_type': 'user'
        })

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data['error_code'], 'PHONE_NOT_REGISTERED')

    def test_phone_login_unverified_phone(self):
        """T027: Test phone login fails when phone_verified=False."""
        # Create user with unverified phone
        unverified_user = User.objects.create_user(
            username='0988888888',
            password='testpass123'
        )
        StudentProfile.objects.create(
            user=unverified_user,
            phone_number='0988888888',
            phone_verified=False  # Not verified
        )

        response = self.client.post('/api/login/', {
            'phone_number': '0988888888',
            'password': 'testpass123',
            'client_type': 'user'
        })

        # Should fail because phone not verified (403 or 4xx)
        self.assertIn(response.status_code, [status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])
        self.assertIn('error_code', response.data)

    def test_phone_and_email_mutually_exclusive(self):
        """T026: Test validation error when both phone and email provided (400)."""
        response = self.client.post('/api/login/', {
            'phone_number': self.test_phone,
            'email': 'test@example.com',
            'password': self.test_password,
            'client_type': 'user'
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # Validation errors can be in 'error' or 'non_field_errors'
        self.assertTrue('error' in response.data or 'non_field_errors' in response.data)

    def test_phone_or_email_required(self):
        """T026: Test validation error when neither phone nor email provided (400)."""
        response = self.client.post('/api/login/', {
            'password': self.test_password,
            'client_type': 'user'
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # Validation errors can be in 'error' or 'non_field_errors'
        self.assertTrue('error' in response.data or 'non_field_errors' in response.data)

    def test_email_login_still_works(self):
        """T027: Test email login backward compatibility."""
        # Create email-registered user
        email_user = User.objects.create_user(
            username='emailuser@example.com',
            email='emailuser@example.com',
            password='emailpass123'
        )
        StudentProfile.objects.create(
            user=email_user,
            verified=True  # Email verified
        )

        response = self.client.post('/api/login/', {
            'email': 'emailuser@example.com',
            'password': 'emailpass123',
            'client_type': 'user'
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access_token', response.data)
        self.assertIn('refresh_token', response.data)


# =============================================================================
# Tests for User Story 4: Password Reset via Phone OTP
# =============================================================================


@override_settings(SMS_DEV_MODE=True)
class PasswordResetPhoneTests(TestCase):
    """Tests for phone-based password reset (US4).
    T034-T036: Contract and integration tests for password reset via phone OTP.
    """

    def setUp(self):
        """Set up test fixtures."""
        cache.clear()
        self.client = APIClient()
        self.test_phone = '0912345678'
        self.test_password = 'oldpass123'
        self.new_password = 'newpass456'

        # Create a phone-registered user
        self.user = User.objects.create_user(
            username=self.test_phone,
            password=self.test_password
        )
        self.profile = StudentProfile.objects.create(
            user=self.user,
            phone_number=self.test_phone,
            phone_verified=True
        )

    def test_send_password_reset_otp_success(self):
        """T034: Test successful password reset OTP send."""
        response = self.client.post('/api/forgot-password/phone/send-otp/', {
            'phone_number': self.test_phone
        })

        # Validate 200 response schema
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)
        self.assertIn('驗證碼已發送', response.data['message'])
        self.assertIn('cooldown_seconds', response.data)
        self.assertEqual(response.data['cooldown_seconds'], 60)
        self.assertIn('expires_in_seconds', response.data)
        
        # Dev mode fields
        self.assertTrue(response.data.get('dev_mode'))
        self.assertIn('otp_code', response.data)

        # Verify OTP record created with correct purpose
        otp_record = PhoneOTPRecord.objects.filter(
            phone_number=self.test_phone,
            purpose='password_reset'
        ).first()
        self.assertIsNotNone(otp_record)
        self.assertEqual(otp_record.user, self.user)

    def test_send_password_reset_otp_unregistered_phone(self):
        """T034: Test 404 response when phone not registered."""
        response = self.client.post('/api/forgot-password/phone/send-otp/', {
            'phone_number': '0999999999'
        })

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data['error_code'], 'PHONE_NOT_REGISTERED')

    def test_send_password_reset_otp_invalid_format(self):
        """T034: Test 400 response for invalid phone format."""
        response = self.client.post('/api/forgot-password/phone/send-otp/', {
            'phone_number': '12345'
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_send_password_reset_otp_rate_limit(self):
        """T034: Test 429 response when rate limited."""
        # First request succeeds
        response1 = self.client.post('/api/forgot-password/phone/send-otp/', {
            'phone_number': self.test_phone
        })
        self.assertEqual(response1.status_code, status.HTTP_200_OK)

        # Second request within cooldown fails
        response2 = self.client.post('/api/forgot-password/phone/send-otp/', {
            'phone_number': self.test_phone
        })
        self.assertEqual(response2.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(response2.data['error_code'], 'OTP_RATE_LIMITED')
        self.assertIn('retry_after_seconds', response2.data.get('context', {}))

    def test_reset_password_with_otp_success(self):
        """T035: Test successful password reset with OTP."""
        # Send OTP first
        send_response = self.client.post('/api/forgot-password/phone/send-otp/', {
            'phone_number': self.test_phone
        })
        otp_code = send_response.data['otp_code']

        # Reset password
        response = self.client.post('/api/forgot-password/phone/reset/', {
            'phone_number': self.test_phone,
            'otp_code': otp_code,
            'new_password': self.new_password
        })

        # Validate 200 response schema
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)
        self.assertIn('重設成功', response.data['message'])

        # Verify password was changed
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.new_password))
        self.assertFalse(self.user.check_password(self.test_password))

    def test_reset_password_wrong_otp(self):
        """T035: Test 400 response for wrong OTP code."""
        # Send OTP first
        self.client.post('/api/forgot-password/phone/send-otp/', {
            'phone_number': self.test_phone
        })

        # Try with wrong code
        response = self.client.post('/api/forgot-password/phone/reset/', {
            'phone_number': self.test_phone,
            'otp_code': '000000',
            'new_password': self.new_password
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('attempts_remaining', response.data.get('context', {}))

        # Verify password was NOT changed
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.test_password))

    def test_reset_password_expired_otp(self):
        """T035: Test 410 response for expired OTP."""
        # Create expired OTP
        otp_record = PhoneOTPRecord.objects.create(
            phone_number=self.test_phone,
            otp_code='123456',
            purpose='password_reset',
            user=self.user,
            expires_at=timezone.now() - timedelta(minutes=1)
        )

        response = self.client.post('/api/forgot-password/phone/reset/', {
            'phone_number': self.test_phone,
            'otp_code': otp_record.otp_code,
            'new_password': self.new_password
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error_code'], 'OTP_EXPIRED')

    def test_reset_password_no_pending_otp(self):
        """T035: Test 400 response when no pending OTP exists (OTP_NOT_FOUND)."""
        response = self.client.post('/api/forgot-password/phone/reset/', {
            'phone_number': self.test_phone,
            'otp_code': '123456',
            'new_password': self.new_password
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error_code'], 'OTP_NOT_FOUND')

    def test_password_reset_full_flow(self):
        """T036: Integration test for complete password reset flow."""
        # Step 1: Send OTP
        send_response = self.client.post('/api/forgot-password/phone/send-otp/', {
            'phone_number': self.test_phone
        })
        self.assertEqual(send_response.status_code, status.HTTP_200_OK)
        otp_code = send_response.data['otp_code']

        # Step 2: Reset password
        reset_response = self.client.post('/api/forgot-password/phone/reset/', {
            'phone_number': self.test_phone,
            'otp_code': otp_code,
            'new_password': self.new_password
        })
        self.assertEqual(reset_response.status_code, status.HTTP_200_OK)

        # Step 3: Verify can login with new password
        login_response = self.client.post('/api/login/', {
            'phone_number': self.test_phone,
            'password': self.new_password,
            'client_type': 'user'
        })
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.assertIn('access_token', login_response.data)

        # Step 4: Verify cannot login with old password
        old_login_response = self.client.post('/api/login/', {
            'phone_number': self.test_phone,
            'password': self.test_password,
            'client_type': 'user'
        })
        self.assertEqual(old_login_response.status_code, status.HTTP_401_UNAUTHORIZED)
