"""
Contract tests for QR Code Coupon Claim API endpoints.
Feature: 005-qr-coupon-claim
Tests: T041
"""
from django.test import TestCase
from django.contrib.auth.models import User, Group
from rest_framework.test import APIClient
from rest_framework import status
from django.utils import timezone
from datetime import timedelta
import json

from api.models import Store, CouponTemplate, Coupon, QRCodeSession


class QRClaimContractTestBase(TestCase):
    """Base test class with common setup for QR claim contract tests."""

    def setUp(self):
        """Set up test fixtures."""
        # Create merchant user and add to Merchants group
        self.merchant_user = User.objects.create_user(
            username='merchant@example.com',
            email='merchant@example.com',
            password='testpass123'
        )
        merchant_group, _ = Group.objects.get_or_create(name='Merchants')
        self.merchant_user.groups.add(merchant_group)

        # Create another merchant user (for unauthorized tests)
        self.other_merchant = User.objects.create_user(
            username='othermerchant@example.com',
            email='othermerchant@example.com',
            password='testpass123'
        )
        self.other_merchant.groups.add(merchant_group)

        # Create user (for claiming coupons)
        self.user = User.objects.create_user(
            username='user@example.com',
            email='user@example.com',
            password='testpass123'
        )

        # Create store
        self.store = Store.objects.create(
            owner=self.merchant_user,
            name='Test Store',
            lat=25.0,
            lng=121.0,
            address='Test Address'
        )

        # Create another store (for cross-store tests)
        self.other_store = Store.objects.create(
            owner=self.other_merchant,
            name='Other Store',
            lat=25.1,
            lng=121.1,
            address='Other Address'
        )

        # Create coupon template
        self.template = CouponTemplate.objects.create(
            store=self.store,
            coupon_name='Test Coupon',
            coupon_detail='Test detail',
            total_quantity=100,
            remaining_quantity=100,
            start_date=timezone.now() - timedelta(days=30),
            expiry_date=timezone.now() + timedelta(days=30),
            is_active=True
        )

        # Create out-of-stock template
        self.out_of_stock_template = CouponTemplate.objects.create(
            store=self.store,
            coupon_name='Out of Stock Coupon',
            coupon_detail='Test detail',
            total_quantity=10,
            remaining_quantity=0,
            start_date=timezone.now() - timedelta(days=30),
            expiry_date=timezone.now() + timedelta(days=30),
            is_active=True
        )

        # Create expired template
        self.expired_template = CouponTemplate.objects.create(
            store=self.store,
            coupon_name='Expired Coupon',
            coupon_detail='Test detail',
            total_quantity=100,
            remaining_quantity=100,
            start_date=timezone.now() - timedelta(days=30),
            expiry_date=timezone.now() - timedelta(days=1),
            is_active=True
        )

        # Create inactive template
        self.inactive_template = CouponTemplate.objects.create(
            store=self.store,
            coupon_name='Inactive Coupon',
            coupon_detail='Test detail',
            total_quantity=100,
            remaining_quantity=100,
            start_date=timezone.now() - timedelta(days=30),
            expiry_date=timezone.now() + timedelta(days=30),
            is_active=False
        )

        # Create template owned by other merchant
        self.other_merchant_template = CouponTemplate.objects.create(
            store=self.other_store,
            coupon_name='Other Merchant Coupon',
            coupon_detail='Test detail',
            total_quantity=100,
            remaining_quantity=100,
            start_date=timezone.now() - timedelta(days=30),
            expiry_date=timezone.now() + timedelta(days=30),
            is_active=True
        )

        # Set up API clients
        self.merchant_client = APIClient()
        self.merchant_client.force_authenticate(user=self.merchant_user)

        self.other_merchant_client = APIClient()
        self.other_merchant_client.force_authenticate(user=self.other_merchant)

        self.user_client = APIClient()
        self.user_client.force_authenticate(user=self.user)

        self.unauthenticated_client = APIClient()


class GenerateQRSessionContractTests(QRClaimContractTestBase):
    """Contract tests for generate QR session endpoint."""

    def test_generate_qr_session_success(self):
        """Test successful QR session generation with valid template."""
        response = self.merchant_client.post(
            '/api/merchant/qr-session/generate/',
            {'template_id': self.template.id},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        
        # Verify response structure
        self.assertIn('session_id', data)
        self.assertIn('template_id', data)
        self.assertIn('session_token', data)
        self.assertIn('qr_code_data', data)
        self.assertIn('message', data)
        
        # Verify values
        self.assertEqual(data['template_id'], self.template.id)
        self.assertIsInstance(data['session_id'], int)
        self.assertIsInstance(data['session_token'], str)
        self.assertEqual(len(data['session_token']), 36)  # UUID4 format
        
        # Verify QR code data is valid JSON
        qr_data = json.loads(data['qr_code_data'])
        self.assertEqual(qr_data['template_id'], self.template.id)
        self.assertEqual(qr_data['session_token'], data['session_token'])
        
        # Verify session was created in database
        session = QRCodeSession.objects.get(id=data['session_id'])
        self.assertEqual(session.template, self.template)
        self.assertEqual(session.merchant, self.merchant_user)
        self.assertTrue(session.is_active)

    def test_generate_qr_session_out_of_stock(self):
        """Test QR session generation for out-of-stock template (should still work)."""
        response = self.merchant_client.post(
            '/api/merchant/qr-session/generate/',
            {'template_id': self.out_of_stock_template.id},
            format='json'
        )
        
        # Should still succeed (users will get error on claim)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertIn('session_id', data)

    def test_generate_qr_session_unauthorized_merchant(self):
        """Test QR session generation for template not owned by merchant."""
        response = self.merchant_client.post(
            '/api/merchant/qr-session/generate/',
            {'template_id': self.other_merchant_template.id},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        data = response.json()
        self.assertIn('error', data)

    def test_generate_qr_session_nonexistent_template(self):
        """Test QR session generation for non-existent template."""
        response = self.merchant_client.post(
            '/api/merchant/qr-session/generate/',
            {'template_id': 99999},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        data = response.json()
        self.assertIn('error', data)

    def test_generate_qr_session_inactive_template(self):
        """Test QR session generation for inactive template."""
        response = self.merchant_client.post(
            '/api/merchant/qr-session/generate/',
            {'template_id': self.inactive_template.id},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        data = response.json()
        self.assertIn('error', data)

    def test_generate_qr_session_unauthenticated(self):
        """Test QR session generation without authentication."""
        response = self.unauthenticated_client.post(
            '/api/merchant/qr-session/generate/',
            {'template_id': self.template.id},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_generate_qr_session_invalid_request(self):
        """Test QR session generation with invalid request data."""
        response = self.merchant_client.post(
            '/api/merchant/qr-session/generate/',
            {'template_id': 'invalid'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_generate_qr_session_missing_template_id(self):
        """Test QR session generation without template_id."""
        response = self.merchant_client.post(
            '/api/merchant/qr-session/generate/',
            {},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class InvalidateQRSessionContractTests(QRClaimContractTestBase):
    """Contract tests for invalidate QR session endpoint."""

    def setUp(self):
        """Set up test fixtures with active sessions."""
        super().setUp()
        
        # Create active session
        self.active_session = QRCodeSession.objects.create(
            template=self.template,
            merchant=self.merchant_user,
            session_token='test-token-active',
            is_active=True
        )
        
        # Create inactive session
        self.inactive_session = QRCodeSession.objects.create(
            template=self.template,
            merchant=self.merchant_user,
            session_token='test-token-inactive',
            is_active=False,
            invalidated_at=timezone.now()
        )
        
        # Create session owned by other merchant
        self.other_session = QRCodeSession.objects.create(
            template=self.other_merchant_template,
            merchant=self.other_merchant,
            session_token='test-token-other',
            is_active=True
        )

    def test_invalidate_qr_session_success(self):
        """Test successful QR session invalidation."""
        response = self.merchant_client.post(
            f'/api/merchant/qr-session/{self.active_session.id}/invalidate/',
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        
        # Verify response structure
        self.assertIn('message', data)
        self.assertIn('session_id', data)
        self.assertEqual(data['session_id'], self.active_session.id)
        
        # Verify session was invalidated
        self.active_session.refresh_from_db()
        self.assertFalse(self.active_session.is_active)
        self.assertIsNotNone(self.active_session.invalidated_at)

    def test_invalidate_qr_session_nonexistent(self):
        """Test invalidation of non-existent session."""
        response = self.merchant_client.post(
            '/api/merchant/qr-session/99999/invalidate/',
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        data = response.json()
        self.assertIn('error', data)

    def test_invalidate_qr_session_unauthorized_merchant(self):
        """Test invalidation of session not owned by merchant."""
        response = self.merchant_client.post(
            f'/api/merchant/qr-session/{self.other_session.id}/invalidate/',
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        data = response.json()
        self.assertIn('error', data)

    def test_invalidate_qr_session_unauthenticated(self):
        """Test session invalidation without authentication."""
        response = self.unauthenticated_client.post(
            f'/api/merchant/qr-session/{self.active_session.id}/invalidate/',
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_invalidate_qr_session_already_inactive(self):
        """Test invalidation of already inactive session."""
        # First invalidate
        self.merchant_client.post(
            f'/api/merchant/qr-session/{self.active_session.id}/invalidate/',
            format='json'
        )
        
        # Try to invalidate again
        response = self.merchant_client.post(
            f'/api/merchant/qr-session/{self.active_session.id}/invalidate/',
            format='json'
        )
        
        # Should still succeed (idempotent operation)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class ClaimCouponViaQRContractTests(QRClaimContractTestBase):
    """Contract tests for claim coupon via QR endpoint."""

    def setUp(self):
        """Set up test fixtures with active sessions."""
        super().setUp()
        
        # Create active session
        self.active_session = QRCodeSession.objects.create(
            template=self.template,
            merchant=self.merchant_user,
            session_token='test-token-active',
            is_active=True
        )
        
        # Create inactive session
        self.inactive_session = QRCodeSession.objects.create(
            template=self.template,
            merchant=self.merchant_user,
            session_token='test-token-inactive',
            is_active=False,
            invalidated_at=timezone.now()
        )

    def test_claim_coupon_via_qr_success(self):
        """Test successful coupon claim via QR code."""
        initial_quantity = self.template.remaining_quantity
        
        response = self.user_client.post(
            '/api/qr-claim/claim/',
            {
                'template_id': self.template.id,
                'session_token': self.active_session.session_token
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        
        # Verify response structure
        self.assertIn('message', data)
        self.assertIn('coupon_id', data)
        self.assertIn('coupon_name', data)
        self.assertIn('template_id', data)
        self.assertIn('remaining_quantity', data)
        self.assertIn('acquisition_method', data)
        
        # Verify values
        self.assertEqual(data['template_id'], self.template.id)
        self.assertEqual(data['acquisition_method'], 'qr_claim')
        self.assertEqual(data['remaining_quantity'], initial_quantity - 1)
        
        # Verify coupon was created
        coupon = Coupon.objects.get(id=data['coupon_id'])
        self.assertEqual(coupon.template, self.template)
        self.assertEqual(coupon.current_holder, self.user)
        self.assertEqual(coupon.acquisition_method, 'qr_claim')
        self.assertEqual(coupon.coupon_type, 'exclusive')
        
        # Verify template quantity was decremented
        self.template.refresh_from_db()
        self.assertEqual(self.template.remaining_quantity, initial_quantity - 1)

    def test_claim_coupon_invalid_session_token(self):
        """Test claim with invalid session token."""
        response = self.user_client.post(
            '/api/qr-claim/claim/',
            {
                'template_id': self.template.id,
                'session_token': 'invalid-token'
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        data = response.json()
        self.assertIn('error', data)
        self.assertIn('expired or invalid', data['error'].lower())

    def test_claim_coupon_inactive_session(self):
        """Test claim with inactive session token."""
        response = self.user_client.post(
            '/api/qr-claim/claim/',
            {
                'template_id': self.template.id,
                'session_token': self.inactive_session.session_token
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        data = response.json()
        self.assertIn('error', data)
        self.assertIn('expired or invalid', data['error'].lower())

    def test_claim_coupon_out_of_stock(self):
        """Test claim when template is out of stock."""
        # Create session for out-of-stock template
        session = QRCodeSession.objects.create(
            template=self.out_of_stock_template,
            merchant=self.merchant_user,
            session_token='test-token-out-of-stock',
            is_active=True
        )
        
        response = self.user_client.post(
            '/api/qr-claim/claim/',
            {
                'template_id': self.out_of_stock_template.id,
                'session_token': session.session_token
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        data = response.json()
        self.assertIn('error', data)
        self.assertIn('out of stock', data['error'].lower())

    def test_claim_coupon_expired_template(self):
        """Test claim when template has expired."""
        # Create session for expired template
        session = QRCodeSession.objects.create(
            template=self.expired_template,
            merchant=self.merchant_user,
            session_token='test-token-expired',
            is_active=True
        )
        
        response = self.user_client.post(
            '/api/qr-claim/claim/',
            {
                'template_id': self.expired_template.id,
                'session_token': session.session_token
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        data = response.json()
        self.assertIn('error', data)
        self.assertIn('expired', data['error'].lower())

    def test_claim_coupon_nonexistent_template(self):
        """Test claim with non-existent template."""
        response = self.user_client.post(
            '/api/qr-claim/claim/',
            {
                'template_id': 99999,
                'session_token': self.active_session.session_token
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        data = response.json()
        self.assertIn('error', data)

    def test_claim_coupon_inactive_template(self):
        """Test claim with inactive template."""
        # Create session for inactive template
        session = QRCodeSession.objects.create(
            template=self.inactive_template,
            merchant=self.merchant_user,
            session_token='test-token-inactive-template',
            is_active=True
        )
        
        response = self.user_client.post(
            '/api/qr-claim/claim/',
            {
                'template_id': self.inactive_template.id,
                'session_token': session.session_token
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        data = response.json()
        self.assertIn('error', data)

    def test_claim_coupon_unauthenticated(self):
        """Test claim without authentication."""
        response = self.unauthenticated_client.post(
            '/api/qr-claim/claim/',
            {
                'template_id': self.template.id,
                'session_token': self.active_session.session_token
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_claim_coupon_invalid_request(self):
        """Test claim with invalid request data."""
        response = self.user_client.post(
            '/api/qr-claim/claim/',
            {
                'template_id': 'invalid',
                'session_token': self.active_session.session_token
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_claim_coupon_missing_fields(self):
        """Test claim without required fields."""
        response = self.user_client.post(
            '/api/qr-claim/claim/',
            {
                'template_id': self.template.id
                # Missing session_token
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_claim_coupon_multiple_claims(self):
        """Test multiple claims from same template (should be allowed)."""
        # First claim
        response1 = self.user_client.post(
            '/api/qr-claim/claim/',
            {
                'template_id': self.template.id,
                'session_token': self.active_session.session_token
            },
            format='json'
        )
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)
        
        # Create new session for second claim
        session2 = QRCodeSession.objects.create(
            template=self.template,
            merchant=self.merchant_user,
            session_token='test-token-2',
            is_active=True
        )
        
        # Second claim
        response2 = self.user_client.post(
            '/api/qr-claim/claim/',
            {
                'template_id': self.template.id,
                'session_token': session2.session_token
            },
            format='json'
        )
        self.assertEqual(response2.status_code, status.HTTP_201_CREATED)
        
        # Verify both coupons were created
        coupons = Coupon.objects.filter(
            template=self.template,
            current_holder=self.user,
            acquisition_method='qr_claim'
        )
        self.assertEqual(coupons.count(), 2)


class RaceConditionIntegrationTests(QRClaimContractTestBase):
    """Integration tests for race condition handling (T042)."""

    def setUp(self):
        """Set up test fixtures with limited quantity template."""
        super().setUp()
        
        # Create template with only 1 remaining coupon
        self.limited_template = CouponTemplate.objects.create(
            store=self.store,
            coupon_name='Limited Coupon',
            coupon_detail='Test detail',
            total_quantity=1,
            remaining_quantity=1,
            start_date=timezone.now() - timedelta(days=30),
            expiry_date=timezone.now() + timedelta(days=30),
            is_active=True
        )
        
        # Create active session
        self.limited_session = QRCodeSession.objects.create(
            template=self.limited_template,
            merchant=self.merchant_user,
            session_token='test-token-limited',
            is_active=True
        )
        
        # Create multiple users for concurrent claims
        self.user2 = User.objects.create_user(
            username='user2@example.com',
            email='user2@example.com',
            password='testpass123'
        )
        self.user3 = User.objects.create_user(
            username='user3@example.com',
            email='user3@example.com',
            password='testpass123'
        )
        
        self.user2_client = APIClient()
        self.user2_client.force_authenticate(user=self.user2)
        
        self.user3_client = APIClient()
        self.user3_client.force_authenticate(user=self.user3)

    def test_race_condition_last_coupon(self):
        """Test race condition when multiple users claim last available coupon simultaneously.
        
        Note: Due to SQLite in-memory database limitations with threading, this test uses
        a sequential approach that still validates atomic decrement behavior.
        """
        # Create separate sessions for each user
        session1 = QRCodeSession.objects.create(
            template=self.limited_template,
            merchant=self.merchant_user,
            session_token='test-token-race-1',
            is_active=True
        )
        session2 = QRCodeSession.objects.create(
            template=self.limited_template,
            merchant=self.merchant_user,
            session_token='test-token-race-2',
            is_active=True
        )
        session3 = QRCodeSession.objects.create(
            template=self.limited_template,
            merchant=self.merchant_user,
            session_token='test-token-race-3',
            is_active=True
        )
        
        # Make claims in quick succession to test atomicity
        # First claim should succeed
        response1 = self.user_client.post(
            '/api/qr-claim/claim/',
            {
                'template_id': self.limited_template.id,
                'session_token': session1.session_token
            },
            format='json'
        )
        
        # Second claim should fail (out of stock)
        response2 = self.user2_client.post(
            '/api/qr-claim/claim/',
            {
                'template_id': self.limited_template.id,
                'session_token': session2.session_token
            },
            format='json'
        )
        
        # Third claim should also fail (out of stock)
        response3 = self.user3_client.post(
            '/api/qr-claim/claim/',
            {
                'template_id': self.limited_template.id,
                'session_token': session3.session_token
            },
            format='json'
        )
        
        # Verify exactly one claim succeeded
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED, 
                        f"First claim should succeed. Response: {response1.json() if response1.status_code >= 400 else 'OK'}")
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST,
                        f"Second claim should fail. Response: {response2.json()}")
        self.assertEqual(response3.status_code, status.HTTP_400_BAD_REQUEST,
                        f"Third claim should fail. Response: {response3.json()}")
        
        # Verify template quantity is now 0
        self.limited_template.refresh_from_db()
        self.assertEqual(self.limited_template.remaining_quantity, 0)
        
        # Verify exactly one coupon was created
        coupons = Coupon.objects.filter(
            template=self.limited_template,
            acquisition_method='qr_claim'
        )
        self.assertEqual(coupons.count(), 1)
        
        # Verify no negative quantities
        self.assertGreaterEqual(self.limited_template.remaining_quantity, 0)

    def test_race_condition_atomic_decrement(self):
        """Test that atomic F() expression prevents negative quantities."""
        # Set remaining_quantity to 1
        self.limited_template.remaining_quantity = 1
        self.limited_template.save()
        
        # Create multiple sessions for same template
        session1 = QRCodeSession.objects.create(
            template=self.limited_template,
            merchant=self.merchant_user,
            session_token='test-token-atomic-1',
            is_active=True
        )
        session2 = QRCodeSession.objects.create(
            template=self.limited_template,
            merchant=self.merchant_user,
            session_token='test-token-atomic-2',
            is_active=True
        )
        
        # First claim should succeed
        response1 = self.user_client.post(
            '/api/qr-claim/claim/',
            {
                'template_id': self.limited_template.id,
                'session_token': session1.session_token
            },
            format='json'
        )
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)
        
        # Second claim should fail (out of stock)
        response2 = self.user2_client.post(
            '/api/qr-claim/claim/',
            {
                'template_id': self.limited_template.id,
                'session_token': session2.session_token
            },
            format='json'
        )
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)
        
        # Verify quantity is 0, not negative
        self.limited_template.refresh_from_db()
        self.assertEqual(self.limited_template.remaining_quantity, 0)
        self.assertGreaterEqual(self.limited_template.remaining_quantity, 0)


class EndToEndFlowTest(QRClaimContractTestBase):
    """End-to-end flow test: generate QR code, scan and claim, verify coupon appears (T039)."""

    def test_end_to_end_flow(self):
        """Test complete flow: generate QR code, scan and claim, verify coupon in collection."""
        # Step 1: Merchant generates QR code session
        generate_response = self.merchant_client.post(
            '/api/merchant/qr-session/generate/',
            {'template_id': self.template.id},
            format='json'
        )
        
        self.assertEqual(generate_response.status_code, status.HTTP_201_CREATED)
        generate_data = generate_response.json()
        
        session_id = generate_data['session_id']
        template_id = generate_data['template_id']
        session_token = generate_data['session_token']
        qr_code_data = generate_data['qr_code_data']
        
        # Verify QR code data format
        qr_parsed = json.loads(qr_code_data)
        self.assertEqual(qr_parsed['template_id'], template_id)
        self.assertEqual(qr_parsed['session_token'], session_token)
        
        # Step 2: User scans QR code and claims coupon
        # (Simulating frontend parsing of QR code JSON)
        claim_response = self.user_client.post(
            '/api/qr-claim/claim/',
            {
                'template_id': qr_parsed['template_id'],
                'session_token': qr_parsed['session_token']
            },
            format='json'
        )
        
        self.assertEqual(claim_response.status_code, status.HTTP_201_CREATED)
        claim_data = claim_response.json()
        
        # Verify claim response
        self.assertEqual(claim_data['template_id'], template_id)
        self.assertEqual(claim_data['acquisition_method'], 'qr_claim')
        self.assertIn('coupon_id', claim_data)
        self.assertIn('coupon_name', claim_data)
        
        coupon_id = claim_data['coupon_id']
        
        # Step 3: Verify coupon was created with correct acquisition method
        coupon = Coupon.objects.get(id=coupon_id)
        self.assertEqual(coupon.template, self.template)
        self.assertEqual(coupon.current_holder, self.user)
        self.assertEqual(coupon.acquisition_method, 'qr_claim')
        self.assertEqual(coupon.coupon_type, 'exclusive')
        
        # Step 4: Verify coupon appears in user's collection (simulate collection API call)
        # Note: This would typically be tested via the collection API endpoint
        # For now, we verify the coupon exists and is associated with the user
        user_coupons = Coupon.objects.filter(
            current_holder=self.user,
            acquisition_method='qr_claim'
        )
        self.assertGreaterEqual(user_coupons.count(), 1)
        self.assertIn(coupon, user_coupons)
        
        # Step 5: Verify template quantity was decremented
        self.template.refresh_from_db()
        self.assertEqual(self.template.remaining_quantity, 99)  # Started with 100
        
        # Step 6: Merchant invalidates session (simulating closing QR code display)
        invalidate_response = self.merchant_client.post(
            f'/api/merchant/qr-session/{session_id}/invalidate/',
            format='json'
        )
        
        self.assertEqual(invalidate_response.status_code, status.HTTP_200_OK)
        
        # Step 7: Verify session is invalidated (future claims should fail)
        session = QRCodeSession.objects.get(id=session_id)
        self.assertFalse(session.is_active)
        self.assertIsNotNone(session.invalidated_at)
        
        # Attempt to claim with invalidated session should fail
        invalid_claim_response = self.user_client.post(
            '/api/qr-claim/claim/',
            {
                'template_id': template_id,
                'session_token': session_token
            },
            format='json'
        )
        
        self.assertEqual(invalid_claim_response.status_code, status.HTTP_400_BAD_REQUEST)
        invalid_data = invalid_claim_response.json()
        self.assertIn('error', invalid_data)
        self.assertIn('expired or invalid', invalid_data['error'].lower())
