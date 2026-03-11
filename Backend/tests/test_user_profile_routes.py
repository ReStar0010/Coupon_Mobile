"""
T010 [US3]: Tests for user profile and statistics routes.
Routes: api/user-info/, api/user-statistics/, api/set-savings-goal/,
api/reset-savings-goal/, api/completed-goals/, api/add-completed-goal/,
api/coupon-history/, api/coupon-history/<id>/,
api/email-settings/send-verification/ (009 optional email).
"""
from unittest.mock import patch
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status

from api.models import StudentProfile


class UserProfileRoutesTest(TestCase):
    """Coverage for user profile and statistics endpoints."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='user@test.com',
            email='user@test.com',
            password='testpass123',
        )
        StudentProfile.objects.create(user=self.user)

    def test_user_info_unauth_401(self):
        """GET api/user-info/ without auth returns 401."""
        response = self.client.get('/api/user-info/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_info_success(self):
        """GET api/user-info/ with auth returns 200."""
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/user-info/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_user_statistics_unauth_401(self):
        """GET api/user-statistics/ without auth returns 401."""
        response = self.client.get('/api/user-statistics/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_statistics_success(self):
        """GET api/user-statistics/ with auth returns 200."""
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/user-statistics/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_set_savings_goal_unauth_401(self):
        """POST api/set-savings-goal/ without auth returns 401."""
        response = self.client.post('/api/set-savings-goal/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_set_savings_goal_success(self):
        """POST api/set-savings-goal/ with auth returns 200 or 4xx."""
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/set-savings-goal/', {
            'savings_goal_name': 'Goal',
            'savings_goal_amount': 100,
        }, format='json')
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST))

    def test_reset_savings_goal_unauth_401(self):
        """POST api/reset-savings-goal/ without auth returns 401."""
        response = self.client.post('/api/reset-savings-goal/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_completed_goals_unauth_401(self):
        """GET api/completed-goals/ without auth returns 401."""
        response = self.client.get('/api/completed-goals/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_completed_goals_success(self):
        """GET api/completed-goals/ with auth returns 200."""
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/completed-goals/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_add_completed_goal_unauth_401(self):
        """POST api/add-completed-goal/ without auth returns 401."""
        response = self.client.post('/api/add-completed-goal/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_coupon_history_unauth_401(self):
        """GET api/coupon-history/ without auth returns 401."""
        response = self.client.get('/api/coupon-history/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_coupon_history_success(self):
        """GET api/coupon-history/ with auth returns 200."""
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/coupon-history/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_coupon_history_detail_unauth_401(self):
        """GET api/coupon-history/<id>/ without auth returns 401."""
        response = self.client.get('/api/coupon-history/1/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_coupon_history_detail_success_or_404(self):
        """GET api/coupon-history/<id>/ with auth returns 200 or 404."""
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/coupon-history/1/')
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_404_NOT_FOUND))

    def test_email_settings_send_verification_unauth_401(self):
        """POST api/email-settings/send-verification/ without auth returns 401."""
        response = self.client.post(
            '/api/email-settings/send-verification/',
            {'email': 'new@test.com'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch('api.views.authentication.send_verification_email')
    def test_email_settings_send_verification_success(self, mock_send):
        """POST api/email-settings/send-verification/ with auth sends email and returns 200."""
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            '/api/email-settings/send-verification/',
            {'email': 'newemail@test.com'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'newemail@test.com')
        profile = self.user.student_profile
        self.assertIsNotNone(profile.email_verification_token)
        self.assertFalse(profile.verified)
        mock_send.assert_called_once()

    def test_email_settings_send_verification_email_taken_4xx(self):
        """POST with email already used by another user returns 4xx."""
        other = User.objects.create_user(
            username='other',
            email='taken@test.com',
            password='pass',
        )
        StudentProfile.objects.create(user=other)
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            '/api/email-settings/send-verification/',
            {'email': 'taken@test.com'},
            format='json',
        )
        self.assertGreaterEqual(response.status_code, 400)
        self.assertLess(response.status_code, 500)
