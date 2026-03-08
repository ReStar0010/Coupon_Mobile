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

    def test_consumer_delete_success(self):
        """POST /api/account/delete/ with correct password and DATA_LOSS acknowledgment returns 200 and deletes user."""
        user_id = self.user.id
        response = self.client.post('/api/account/delete/', {
            'password': 'testpass123',
            'acknowledgments': ['DATA_LOSS'],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(response.data.get('success'))
        self.assertIn('message', response.data)
        self.assertIn('deleted_at', response.data)
        self.assertFalse(User.objects.filter(id=user_id).exists())

    def test_consumer_delete_missing_password(self):
        """POST /api/account/delete/ without password returns 400."""
        response = self.client.post('/api/account/delete/', {
            'acknowledgments': ['DATA_LOSS'],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertIn('密碼', response.data['error'])

    def test_consumer_delete_invalid_password(self):
        """POST /api/account/delete/ with wrong password returns 400 and INVALID_PASSWORD."""
        response = self.client.post('/api/account/delete/', {
            'password': 'wrongpassword',
            'acknowledgments': ['DATA_LOSS'],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertEqual(response.data.get('code'), 'INVALID_PASSWORD')
        self.assertTrue(User.objects.filter(id=self.user.id).exists())

    def test_consumer_delete_missing_acknowledgment(self):
        """POST /api/account/delete/ without DATA_LOSS in acknowledgments returns 400."""
        response = self.client.post('/api/account/delete/', {
            'password': 'testpass123',
            'acknowledgments': [],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertTrue(User.objects.filter(id=self.user.id).exists())
