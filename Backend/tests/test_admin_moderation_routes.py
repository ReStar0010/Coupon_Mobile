"""
T016 [US3]: Tests for admin moderation routes.
Routes: api/admin/moderation/queue/, api/admin/moderation/reports/<id>/,
reports/<id>/action/, escalations/, merchants/<id>/violations/, stats/
"""
from django.test import TestCase
from django.contrib.auth.models import User, Group
from rest_framework.test import APIClient
from rest_framework import status

from api.models import MerchantProfile, Store


class AdminModerationRoutesTest(TestCase):
    """Coverage for admin moderation endpoints; assert 403 for non-admin."""

    def setUp(self):
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
        Store.objects.create(
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
