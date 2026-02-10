"""
Tests for consumer (student) account deletion API.
Verifies GET /api/account/pre-delete-check/ and POST /api/account/delete/.
"""
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from api.models import StudentProfile


class ConsumerAccountDeletionTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='consumer@test.com',
            email='consumer@test.com',
            password='testpass123'
        )
        StudentProfile.objects.get_or_create(user=self.user)
        self.client.force_authenticate(user=self.user)

    def test_pre_delete_check_returns_200(self):
        """GET /api/account/pre-delete-check/ must return 200 and expected shape."""
        response = self.client.get('/api/account/pre-delete-check/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIn('can_delete', response.data)
        self.assertIn('warnings', response.data)
        self.assertIn('data_summary', response.data)
        self.assertIn('held_coupons_count', response.data['data_summary'])
        self.assertIn('total_redemptions', response.data['data_summary'])
