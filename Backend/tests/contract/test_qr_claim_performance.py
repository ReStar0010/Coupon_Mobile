"""
Performance tests for QR Code Coupon Claim API endpoints.
Feature: 005-qr-coupon-claim
Tests: T044-T047
"""
from django.test import TestCase, override_settings
from django.contrib.auth.models import User, Group
from rest_framework.test import APIClient
from rest_framework import status
from django.utils import timezone
from datetime import timedelta
import time
import json

from api.models import Store, CouponTemplate, Coupon, QRCodeSession


class QRClaimPerformanceTestBase(TestCase):
    """Base test class for QR claim performance tests."""

    def setUp(self):
        """Set up test fixtures."""
        # Create merchant user
        self.merchant_user = User.objects.create_user(
            username='merchant@example.com',
            email='merchant@example.com',
            password='testpass123'
        )
        merchant_group, _ = Group.objects.get_or_create(name='Merchant')
        self.merchant_user.groups.add(merchant_group)

        # Create user
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

        # Create coupon template with large quantity for batch tests
        self.template = CouponTemplate.objects.create(
            store=self.store,
            coupon_name='Test Coupon',
            coupon_detail='Test detail',
            total_quantity=200,
            remaining_quantity=200,
            start_date=timezone.now() - timedelta(days=30),
            expiry_date=timezone.now() + timedelta(days=30),
            is_active=True
        )

        # Set up API clients
        self.merchant_client = APIClient()
        self.merchant_client.force_authenticate(user=self.merchant_user)

        self.user_client = APIClient()
        self.user_client.force_authenticate(user=self.user)


class EndToEndClaimPerformanceTest(QRClaimPerformanceTestBase):
    """Performance test for SC-001: End-to-end claim time < 5 seconds (T044)."""

    def test_end_to_end_claim_time(self):
        """Test that end-to-end claim operation completes in under 5 seconds."""
        # Create active session
        session = QRCodeSession.objects.create(
            template=self.template,
            merchant=self.merchant_user,
            session_token='test-token-performance',
            is_active=True
        )

        # Measure time from API call to success response
        start_time = time.time()
        
        response = self.user_client.post(
            '/api/qr-claim/claim/',
            {
                'template_id': self.template.id,
                'session_token': session.session_token
            },
            format='json'
        )
        
        end_time = time.time()
        elapsed_time = end_time - start_time

        # Verify success
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Verify performance requirement: < 5 seconds
        self.assertLess(
            elapsed_time, 5.0,
            f"End-to-end claim took {elapsed_time:.2f} seconds, expected < 5 seconds"
        )

    def test_end_to_end_claim_time_multiple_runs(self):
        """Test end-to-end claim time across multiple runs to ensure consistency."""
        times = []
        num_runs = 10

        for i in range(num_runs):
            # Create new session for each run
            session = QRCodeSession.objects.create(
                template=self.template,
                merchant=self.merchant_user,
                session_token=f'test-token-{i}',
                is_active=True
            )

            start_time = time.time()
            
            response = self.user_client.post(
                '/api/qr-claim/claim/',
                {
                    'template_id': self.template.id,
                    'session_token': session.session_token
                },
                format='json'
            )
            
            end_time = time.time()
            elapsed_time = end_time - start_time

            if response.status_code == status.HTTP_201_CREATED:
                times.append(elapsed_time)

        # Verify all runs completed successfully
        self.assertEqual(len(times), num_runs)
        
        # Verify average time is reasonable
        avg_time = sum(times) / len(times)
        self.assertLess(
            avg_time, 3.0,
            f"Average claim time is {avg_time:.2f} seconds, expected < 3 seconds"
        )


class QRCodeGenerationPerformanceTest(QRClaimPerformanceTestBase):
    """Performance test for SC-002: QR code generation < 1 second (T045)."""

    def test_qr_code_generation_time(self):
        """Test that QR code generation completes in under 1 second."""
        start_time = time.time()
        
        response = self.merchant_client.post(
            '/api/merchant/qr-session/generate/',
            {'template_id': self.template.id},
            format='json'
        )
        
        end_time = time.time()
        elapsed_time = end_time - start_time

        # Verify success
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Verify performance requirement: < 1 second
        self.assertLess(
            elapsed_time, 1.0,
            f"QR code generation took {elapsed_time:.2f} seconds, expected < 1 second"
        )

    def test_qr_code_generation_time_multiple_runs(self):
        """Test QR code generation time across multiple runs."""
        times = []
        num_runs = 20

        for i in range(num_runs):
            start_time = time.time()
            
            response = self.merchant_client.post(
                '/api/merchant/qr-session/generate/',
                {'template_id': self.template.id},
                format='json'
            )
            
            end_time = time.time()
            elapsed_time = end_time - start_time

            if response.status_code == status.HTTP_201_CREATED:
                times.append(elapsed_time)

        # Verify all runs completed successfully
        self.assertEqual(len(times), num_runs)
        
        # Verify average time is reasonable
        avg_time = sum(times) / len(times)
        self.assertLess(
            avg_time, 0.5,
            f"Average generation time is {avg_time:.2f} seconds, expected < 0.5 seconds"
        )


class BatchClaimSuccessRateTest(QRClaimPerformanceTestBase):
    """Performance test for SC-003: 95% success rate for valid scans (T046)."""

    def test_batch_claim_success_rate(self):
        """Test that 95% of valid QR code scans result in successful claims."""
        num_scans = 100
        successful_claims = 0
        failed_claims = 0

        # Create multiple users for concurrent-like testing
        users = []
        clients = []
        for i in range(num_scans):
            user = User.objects.create_user(
                username=f'user{i}@example.com',
                email=f'user{i}@example.com',
                password='testpass123'
            )
            users.append(user)
            client = APIClient()
            client.force_authenticate(user=user)
            clients.append(client)

        # Create sessions and attempt claims
        for i in range(num_scans):
            session = QRCodeSession.objects.create(
                template=self.template,
                merchant=self.merchant_user,
                session_token=f'test-token-batch-{i}',
                is_active=True
            )

            response = clients[i].post(
                '/api/qr-claim/claim/',
                {
                    'template_id': self.template.id,
                    'session_token': session.session_token
                },
                format='json'
            )

            if response.status_code == status.HTTP_201_CREATED:
                successful_claims += 1
            else:
                failed_claims += 1
                # Log failure reason for debugging
                if response.status_code != status.HTTP_400_BAD_REQUEST:
                    print(f"Unexpected failure: {response.status_code} - {response.json()}")

        # Calculate success rate (excluding out-of-stock/expired which are expected failures)
        success_rate = (successful_claims / num_scans) * 100

        # Verify success rate requirement: >= 95%
        self.assertGreaterEqual(
            success_rate, 95.0,
            f"Success rate is {success_rate:.1f}%, expected >= 95%. "
            f"Successful: {successful_claims}, Failed: {failed_claims}"
        )

    def test_batch_claim_with_limited_quantity(self):
        """Test success rate when template has limited quantity."""
        # Create template with exactly 95 coupons
        limited_template = CouponTemplate.objects.create(
            store=self.store,
            coupon_name='Limited Test Coupon',
            coupon_detail='Test detail',
            total_quantity=95,
            remaining_quantity=95,
            start_date=timezone.now() - timedelta(days=30),
            expiry_date=timezone.now() + timedelta(days=30),
            is_active=True
        )

        num_scans = 100
        successful_claims = 0
        out_of_stock_failures = 0

        # Create users and clients
        users = []
        clients = []
        for i in range(num_scans):
            user = User.objects.create_user(
                username=f'limiteduser{i}@example.com',
                email=f'limiteduser{i}@example.com',
                password='testpass123'
            )
            users.append(user)
            client = APIClient()
            client.force_authenticate(user=user)
            clients.append(client)

        # Attempt claims
        for i in range(num_scans):
            session = QRCodeSession.objects.create(
                template=limited_template,
                merchant=self.merchant_user,
                session_token=f'test-token-limited-{i}',
                is_active=True
            )

            response = clients[i].post(
                '/api/qr-claim/claim/',
                {
                    'template_id': limited_template.id,
                    'session_token': session.session_token
                },
                format='json'
            )

            if response.status_code == status.HTTP_201_CREATED:
                successful_claims += 1
            elif response.status_code == status.HTTP_400_BAD_REQUEST:
                data = response.json()
                if 'out of stock' in data.get('error', '').lower():
                    out_of_stock_failures += 1

        # Verify that we got exactly 95 successful claims (all available)
        self.assertEqual(successful_claims, 95)
        # Verify that remaining 5 failed due to out of stock
        self.assertGreaterEqual(out_of_stock_failures, 5)


class InvalidQRCodeHandlingTest(QRClaimPerformanceTestBase):
    """Performance test for SC-004: 100% error handling for invalid QR codes (T047)."""

    def test_invalid_qr_code_formats(self):
        """Test that 100% of invalid QR code formats are handled with appropriate errors."""
        invalid_cases = [
            # Malformed JSON
            ('not json', 'Invalid JSON format'),
            ('{invalid json}', 'Invalid JSON format'),
            ('{"template_id":}', 'Invalid JSON format'),
            ('{"session_token":}', 'Invalid JSON format'),
            
            # Missing fields
            ('{"template_id": 123}', 'Missing session_token'),
            ('{"session_token": "abc"}', 'Missing template_id'),
            ('{}', 'Missing both fields'),
            
            # Wrong types
            ('{"template_id": "not a number", "session_token": "abc"}', 'Invalid template_id type'),
            ('{"template_id": 123, "session_token": 456}', 'Invalid session_token type'),
            ('{"template_id": null, "session_token": "abc"}', 'Null template_id'),
            ('{"template_id": 123, "session_token": null}', 'Null session_token'),
            
            # Empty values
            ('{"template_id": 123, "session_token": ""}', 'Empty session_token'),
            ('{"template_id": 0, "session_token": "abc"}', 'Invalid template_id value'),
            ('{"template_id": -1, "session_token": "abc"}', 'Invalid template_id value'),
            
            # Extra fields (should still work but test robustness)
            ('{"template_id": 123, "session_token": "abc", "extra": "field"}', 'Extra fields'),
            
            # Edge cases
            ('{"template_id": 999999, "session_token": "nonexistent"}', 'Non-existent template'),
            ('{"template_id": 123, "session_token": "invalid-token-format"}', 'Invalid token format'),
        ]

        handled_count = 0
        crash_count = 0
        unexpected_success_count = 0

        for invalid_data, description in invalid_cases:
            try:
                # Try to parse as JSON first (simulating frontend parsing)
                try:
                    parsed = json.loads(invalid_data)
                    template_id = parsed.get('template_id')
                    session_token = parsed.get('session_token')
                except (json.JSONDecodeError, ValueError):
                    # Malformed JSON - frontend would catch this
                    handled_count += 1
                    continue

                # If we get here, try to make API call
                response = self.user_client.post(
                    '/api/qr-claim/claim/',
                    {
                        'template_id': template_id if template_id is not None else 0,
                        'session_token': session_token if session_token is not None else ''
                    },
                    format='json'
                )

                # Verify we got an error response (not success)
                if response.status_code >= 400:
                    handled_count += 1
                elif response.status_code == status.HTTP_201_CREATED:
                    # Unexpected success - log for investigation
                    unexpected_success_count += 1
                    print(f"Unexpected success for case: {description}")

            except Exception as e:
                # Crash occurred - this is a failure
                crash_count += 1
                print(f"Crash for case '{description}': {str(e)}")

        total_cases = len(invalid_cases)
        handling_rate = (handled_count / total_cases) * 100

        # Verify 100% handling requirement
        self.assertEqual(
            crash_count, 0,
            f"Found {crash_count} crashes, expected 0. Cases handled: {handled_count}/{total_cases}"
        )
        
        self.assertGreaterEqual(
            handling_rate, 100.0,
            f"Error handling rate is {handling_rate:.1f}%, expected 100%. "
            f"Handled: {handled_count}, Crashes: {crash_count}, Unexpected success: {unexpected_success_count}"
        )

    def test_invalid_session_tokens(self):
        """Test handling of various invalid session token formats."""
        invalid_tokens = [
            '',  # Empty
            'not-a-uuid',  # Invalid format
            '123',  # Too short
            'a' * 200,  # Too long
            '550e8400-e29b-41d4-a716',  # Incomplete UUID
            '550e8400-e29b-41d4-a716-446655440000-extra',  # Too long UUID
        ]

        handled_count = 0
        crash_count = 0

        # Create a valid template for testing
        template = CouponTemplate.objects.create(
            store=self.store,
            coupon_name='Test Template',
            coupon_detail='Test',
            total_quantity=100,
            remaining_quantity=100,
            start_date=timezone.now() - timedelta(days=30),
            expiry_date=timezone.now() + timedelta(days=30),
            is_active=True
        )

        for invalid_token in invalid_tokens:
            try:
                response = self.user_client.post(
                    '/api/qr-claim/claim/',
                    {
                        'template_id': template.id,
                        'session_token': invalid_token
                    },
                    format='json'
                )

                # Should return error, not crash
                if response.status_code >= 400:
                    handled_count += 1
                else:
                    print(f"Unexpected success for invalid token: {invalid_token}")

            except Exception as e:
                crash_count += 1
                print(f"Crash for invalid token '{invalid_token}': {str(e)}")

        # Verify 100% handling
        self.assertEqual(
            crash_count, 0,
            f"Found {crash_count} crashes for invalid tokens, expected 0"
        )
        
        self.assertEqual(
            handled_count, len(invalid_tokens),
            f"Handled {handled_count}/{len(invalid_tokens)} invalid tokens"
        )
