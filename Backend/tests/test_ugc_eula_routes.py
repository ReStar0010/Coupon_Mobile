"""
T015 [US3]: Tests for UGC/content and EULA routes.
Routes: api/content/.../report/, api/content/.../report/status/, api/user/reports/,
api/user/blocked-merchants/, api/store/<id>/block-status/, api/merchant/eula/status/,
api/merchant/eula/accept/, api/merchant/eula/content/, api/content-guidelines/,
api/privacy-policy/
"""
from django.test import TestCase
from django.contrib.auth.models import User, Group
from django.contrib.contenttypes.models import ContentType
from django.core.cache import cache
from django.utils import timezone
from django.conf import settings
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status

from api.models import (
    MerchantProfile, Store, CouponTemplate,
    ContentReport, BlockedMerchant,
)


class UGCEulaRoutesTest(TestCase):
    """Coverage for content reporting, blocking, EULA and public legal content."""

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='user@test.com',
            email='user@test.com',
            password='testpass123',
        )
        self.merchant_group, _ = Group.objects.get_or_create(name='Merchant')
        self.merchant = User.objects.create_user(
            username='merchant@test.com',
            email='merchant@test.com',
            password='testpass123',
        )
        self.merchant.groups.add(self.merchant_group)
        MerchantProfile.objects.create(
            user=self.merchant,
            phone='0912345678',
            contact_person='Test',
            contact_info='line@test',
        )
        self.store = Store.objects.create(
            owner=self.merchant,
            name='Test Store',
            lat=25.0,
            lng=121.0,
            address='Test',
        )
        self.template = CouponTemplate.objects.create(
            store=self.store,
            coupon_name='Test',
            coupon_detail='Detail',
            total_quantity=10,
            remaining_quantity=10,
            start_date=timezone.now(),
            expiry_date=timezone.now() + timedelta(days=30),
        )

    def test_report_content_requires_auth(self):
        """POST api/content/<type>/<id>/report/ without auth returns 401."""
        response = self.client.post(
            f'/api/content/coupon_template/{self.template.id}/report/',
            {'reason': 'spam'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_report_status_requires_auth(self):
        """GET api/content/<type>/<id>/report/status/ without auth returns 401."""
        response = self.client.get(
            f'/api/content/coupon_template/{self.template.id}/report/status/',
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_reports_requires_auth(self):
        """GET api/user/reports/ without auth returns 401."""
        response = self.client.get('/api/user/reports/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_blocked_merchants_requires_auth(self):
        """GET api/user/blocked-merchants/ without auth returns 401."""
        response = self.client.get('/api/user/blocked-merchants/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_block_status_requires_auth(self):
        """GET api/store/<id>/block-status/ without auth returns 401."""
        response = self.client.get(f'/api/store/{self.store.id}/block-status/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_eula_status_requires_merchant(self):
        """GET api/merchant/eula/status/ without merchant returns 401/403."""
        response = self.client.get('/api/merchant/eula/status/')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_eula_accept_requires_merchant(self):
        """POST api/merchant/eula/accept/ without merchant returns 401/403."""
        response = self.client.post('/api/merchant/eula/accept/', {}, format='json')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_eula_content_requires_merchant(self):
        """GET api/merchant/eula/content/ without merchant returns 401/403."""
        response = self.client.get('/api/merchant/eula/content/')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_content_guidelines_public(self):
        """GET api/content-guidelines/ returns 200 (public)."""
        response = self.client.get('/api/content-guidelines/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_privacy_policy_public(self):
        """GET api/privacy-policy/ returns 200 (public)."""
        response = self.client.get('/api/privacy-policy/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    # --- UGC success paths (authenticated as self.user, reporting/blocking merchant content) ---

    def test_report_content_store_success(self):
        """POST api/content/store/<id>/report/ with auth and reason returns 201 and creates report."""
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            f'/api/content/store/{self.store.id}/report/',
            {'reason': 'inappropriate', 'details': 'test details'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertIn('message', response.data)
        self.assertIn('report', response.data)
        self.assertTrue(
            ContentReport.objects.filter(reporter=self.user, object_id=self.store.id).exists()
        )

    def test_report_status_after_report_success(self):
        """GET api/content/store/<id>/report/status/ after reporting returns 200 with has_reported."""
        self.client.force_authenticate(user=self.user)
        ct = ContentType.objects.get_for_model(Store)
        ContentReport.objects.create(
            reporter=self.user,
            content_type=ct,
            object_id=self.store.id,
            reason='inappropriate',
            details='',
        )
        response = self.client.get(
            f'/api/content/store/{self.store.id}/report/status/',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('has_reported', response.data)
        self.assertIn('can_report_again', response.data)

    def test_block_merchant_success(self):
        """POST api/user/blocked-merchants/add/ with store_id returns 201 and creates block."""
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            '/api/user/blocked-merchants/add/',
            {'store_id': self.store.id},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertIn('message', response.data)
        self.assertIn('blocked_merchant', response.data)
        self.assertTrue(
            BlockedMerchant.objects.filter(user=self.user, store=self.store).exists()
        )

    def test_blocked_merchants_list_success(self):
        """GET api/user/blocked-merchants/ returns 200 with results and total."""
        self.client.force_authenticate(user=self.user)
        BlockedMerchant.objects.create(user=self.user, store=self.store)
        response = self.client.get('/api/user/blocked-merchants/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)
        self.assertIn('total', response.data)

    def test_block_status_success(self):
        """GET api/store/<id>/block-status/ returns 200 with is_blocked and store_id."""
        self.client.force_authenticate(user=self.user)
        response = self.client.get(f'/api/store/{self.store.id}/block-status/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('is_blocked', response.data)
        self.assertEqual(response.data.get('store_id'), self.store.id)

    def test_unblock_merchant_success(self):
        """DELETE api/user/blocked-merchants/<id>/ after blocking returns 200; block-status then is_blocked false."""
        self.client.force_authenticate(user=self.user)
        BlockedMerchant.objects.create(user=self.user, store=self.store)
        response = self.client.delete(
            f'/api/user/blocked-merchants/{self.store.id}/',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(
            BlockedMerchant.objects.filter(user=self.user, store=self.store).exists()
        )
        status_response = self.client.get(f'/api/store/{self.store.id}/block-status/')
        self.assertEqual(status_response.data.get('is_blocked'), False)

    # --- EULA success paths (authenticated as merchant) ---

    def test_eula_status_success(self):
        """GET api/merchant/eula/status/ with merchant auth returns 200 and expected keys."""
        self.client.force_authenticate(user=self.merchant)
        response = self.client.get('/api/merchant/eula/status/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('has_accepted', response.data)
        self.assertIn('current_version', response.data)
        self.assertIn('needs_acceptance', response.data)

    def test_eula_accept_success(self):
        """POST api/merchant/eula/accept/ with version and agreed true returns 201."""
        self.client.force_authenticate(user=self.merchant)
        version = getattr(settings, 'CURRENT_EULA_VERSION', '1.0.0')
        response = self.client.post(
            '/api/merchant/eula/accept/',
            {'version': version, 'agreed': True},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertIn('id', response.data)
        self.assertIn('version', response.data)
        self.assertIn('accepted_at', response.data)
        self.assertIn('message', response.data)

    def test_eula_content_success(self):
        """GET api/merchant/eula/content/ with merchant auth returns 200 and content keys."""
        self.client.force_authenticate(user=self.merchant)
        response = self.client.get('/api/merchant/eula/content/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('version', response.data)
        self.assertIn('title', response.data)
        self.assertIn('content', response.data)
        self.assertIn('content_guidelines', response.data)
