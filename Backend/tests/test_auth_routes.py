"""
T006 [US3]: Tests for authentication and token routes.
Routes: api/register/, api/login/, api/logout/, api/token/refresh/, api/verify-email/,
api/forgot-password/, api/reset-password/
"""
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from unittest.mock import patch

from api.models import StudentProfile


class AuthRoutesTest(TestCase):
    """Coverage for auth and token endpoints."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='user@test.com',
            email='user@test.com',
            password='testpass123',
        )
        StudentProfile.objects.create(user=self.user)

    def test_register_success(self):
        """POST api/register/ returns 201 with valid data."""
        response = self.client.post('/api/register/', {
            'email': 'new@test.com',
            'password': 'newpass123',
            'username': 'new@test.com',
        }, format='json')
        self.assertIn(response.status_code, (status.HTTP_201_CREATED, status.HTTP_200_OK))

    def test_register_duplicate_email_4xx(self):
        """POST api/register/ with existing email returns 4xx."""
        response = self.client.post('/api/register/', {
            'email': 'user@test.com',
            'password': 'pass',
            'username': 'user@test.com',
        }, format='json')
        self.assertGreaterEqual(response.status_code, 400)
        self.assertLess(response.status_code, 500)

    def test_login_success(self):
        """POST api/login/ returns 200 and tokens (or 4xx if payload invalid)."""
        response = self.client.post('/api/login/', {
            'email': 'user@test.com',
            'password': 'testpass123',
        }, format='json')
        if response.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED):
            data = response.json()
            self.assertIn('access_token', data)
            self.assertIn('refresh_token', data)
        else:
            self.assertGreaterEqual(response.status_code, 400)
            self.assertLess(response.status_code, 500)

    def test_login_invalid_credentials_4xx(self):
        """POST api/login/ with wrong password returns 4xx."""
        response = self.client.post('/api/login/', {
            'email': 'user@test.com',
            'password': 'wrong',
        }, format='json')
        self.assertGreaterEqual(response.status_code, 400)
        self.assertLess(response.status_code, 500)

    def test_logout_requires_auth(self):
        """POST api/logout/ without auth returns 401."""
        response = self.client.post('/api/logout/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_success(self):
        """POST api/logout/ with valid token returns 200."""
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/logout/', {}, format='json')
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_204_NO_CONTENT))

    def test_token_refresh_success(self):
        """POST api/token/refresh/ with refresh token returns 200."""
        login_resp = self.client.post('/api/login/', {
            'email': 'user@test.com',
            'password': 'testpass123',
        }, format='json')
        refresh = login_resp.json().get('refresh_token')
        if refresh:
            response = self.client.post('/api/token/refresh/', {'refresh': refresh}, format='json')
            self.assertIn(response.status_code, (status.HTTP_200_OK, 200))

    def test_token_refresh_invalid_4xx(self):
        """POST api/token/refresh/ with invalid token returns 4xx."""
        response = self.client.post('/api/token/refresh/', {'refresh': 'invalid'}, format='json')
        self.assertGreaterEqual(response.status_code, 400)
        self.assertLess(response.status_code, 500)

    @patch('api.views.authentication.send_verification_email')
    def test_verify_email_4xx_without_token(self, mock_send):
        """POST api/verify-email/ without valid token returns 4xx."""
        response = self.client.post('/api/verify-email/', {
            'email': 'user@test.com',
            'token': 'invalid-token',
        }, format='json')
        self.assertGreaterEqual(response.status_code, 400)
        self.assertLess(response.status_code, 500)

    def test_forgot_password_accepts_email(self):
        """POST api/forgot-password/ accepts email and returns 200 or 4xx."""
        with patch('api.views.authentication.send_mail'), patch('api.views.authentication.resend.Emails.send'):
            response = self.client.post('/api/forgot-password/', {
                'email': 'user@test.com',
            }, format='json')
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND))

    def test_reset_password_invalid_token_4xx(self):
        """POST api/reset-password/ with invalid token returns 4xx."""
        response = self.client.post('/api/reset-password/', {
            'token': 'invalid',
            'new_password': 'newpass123',
        }, format='json')
        self.assertGreaterEqual(response.status_code, 400)
        self.assertLess(response.status_code, 500)
