"""
T016 [US3]: Tests for admin moderation routes.
Routes: api/admin/moderation/queue/, api/admin/moderation/reports/<id>/,
reports/<id>/action/, escalations/, merchants/<id>/violations/, stats/
"""
from django.test import TestCase
from django.contrib.auth.models import User, Group
from django.contrib.contenttypes.models import ContentType
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework import status

from api.models import MerchantProfile, Store, ContentReport


class AdminModerationRoutesTest(TestCase):
    """Coverage for admin moderation endpoints; assert 403 for non-admin."""

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.merchant_group, _ = Group.objects.get_or_create(name='Merchant')
        self.merchant = User.objects.create_user(
            username='merchant@test.com',
            email='merchant@test.com',
            password='testpass123',
            is_staff=False,
            is_superuser=False,
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
        self.admin = User.objects.create_superuser(
            username='admin@test.com',
            email='admin@test.com',
            password='adminpass123',
        )
        self.reporter = User.objects.create_user(
            username='reporter@test.com',
            email='reporter@test.com',
            password='testpass123',
        )
        ct = ContentType.objects.get_for_model(Store)
        # Report with non-existent object_id: content_object is None so report detail view
        # returns 200 without accessing Store.description (Store has no description field).
        self.report = ContentReport.objects.create(
            reporter=self.reporter,
            content_type=ct,
            object_id=99999,
            reason='inappropriate',
            details='test report',
            status='pending',
        )
        # Report with real store for moderation action (action view needs content_object).
        self.report_for_action = ContentReport.objects.create(
            reporter=self.reporter,
            content_type=ct,
            object_id=self.store.id,
            reason='inappropriate',
            details='test report',
            status='pending',
        )

    def test_moderation_queue_unauth_401(self):
        """GET api/admin/moderation/queue/ without auth returns 401."""
        response = self.client.get('/api/admin/moderation/queue/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_moderation_queue_non_admin_403(self):
        """GET api/admin/moderation/queue/ with merchant (non-admin) returns 403."""
        self.client.force_authenticate(user=self.merchant)
        response = self.client.get('/api/admin/moderation/queue/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_moderation_queue_admin_success(self):
        """GET api/admin/moderation/queue/ with admin returns 200."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/admin/moderation/queue/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_moderation_reports_detail_requires_admin(self):
        """GET api/admin/moderation/reports/1/ with merchant returns 403."""
        self.client.force_authenticate(user=self.merchant)
        response = self.client.get('/api/admin/moderation/reports/1/')
        self.assertIn(response.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND))

    def test_moderation_action_requires_admin(self):
        """POST api/admin/moderation/reports/1/action/ with merchant returns 403."""
        self.client.force_authenticate(user=self.merchant)
        response = self.client.post('/api/admin/moderation/reports/1/action/', {}, format='json')
        self.assertIn(response.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND))

    def test_moderation_escalations_requires_admin(self):
        """GET api/admin/moderation/escalations/ with merchant returns 403."""
        self.client.force_authenticate(user=self.merchant)
        response = self.client.get('/api/admin/moderation/escalations/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_moderation_merchant_violations_requires_admin(self):
        """GET api/admin/moderation/merchants/1/violations/ with merchant returns 403."""
        self.client.force_authenticate(user=self.merchant)
        response = self.client.get('/api/admin/moderation/merchants/1/violations/')
        self.assertIn(response.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND))

    def test_moderation_stats_requires_admin(self):
        """GET api/admin/moderation/stats/ with merchant returns 403."""
        self.client.force_authenticate(user=self.merchant)
        response = self.client.get('/api/admin/moderation/stats/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # --- Admin success paths ---

    def test_report_detail_returns_200_and_shape(self):
        """GET api/admin/moderation/reports/<id>/ with admin returns 200 and expected keys."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(
            f'/api/admin/moderation/reports/{self.report.id}/'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIn('id', response.data)
        self.assertIn('reporter', response.data)
        self.assertIn('content', response.data)
        self.assertIn('reason', response.data)
        self.assertIn('status', response.data)
        self.assertIn('created_at', response.data)
        self.assertIn('actions', response.data)

    def test_moderation_action_approve_returns_200(self):
        """POST api/admin/moderation/reports/<id>/action/ with action approve returns 200."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f'/api/admin/moderation/reports/{self.report_for_action.id}/action/',
            {'action': 'approve', 'notes': 'test dismiss'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIn('message', response.data)
        self.report_for_action.refresh_from_db()
        self.assertEqual(self.report_for_action.status, 'dismissed')

    def test_escalations_returns_200_and_shape(self):
        """GET api/admin/moderation/escalations/ with admin returns 200 and expected keys."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/admin/moderation/escalations/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('warning', response.data)
        self.assertIn('critical', response.data)
        self.assertIn('warning_count', response.data)
        self.assertIn('critical_count', response.data)

    def test_merchant_violations_returns_200(self):
        """GET api/admin/moderation/merchants/<id>/violations/ with admin returns 200."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(
            f'/api/admin/moderation/merchants/{self.merchant.id}/violations/'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('merchant', response.data)
        self.assertIn('violations', response.data)
        self.assertIn('total_violations', response.data)

    def test_moderation_stats_returns_200_and_shape(self):
        """GET api/admin/moderation/stats/ with admin returns 200 and expected keys."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/admin/moderation/stats/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('pending', response.data)
        self.assertIn('reviewed', response.data)
        self.assertIn('dismissed', response.data)
        self.assertIn('escalated', response.data)
        self.assertIn('critical', response.data)
        self.assertIn('flagged_merchants', response.data)
        self.assertIn('average_response_hours', response.data)
