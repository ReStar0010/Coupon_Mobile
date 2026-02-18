"""
T014 [US3]: Tests for well-known and ping routes.
Routes: api/ping/, .well-known/apple-app-site-association, .well-known/assetlinks.json
"""
from django.test import TestCase, Client
from rest_framework import status


class WellKnownPingTest(TestCase):
    """Coverage for ping and well-known endpoints."""

    def setUp(self):
        self.client = Client()

    def test_ping_returns_200_and_body(self):
        """GET api/ping/ returns 200 and expected body."""
        response = self.client.get('/api/ping/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(b'Pong', response.content)

    def test_apple_app_site_association_returns_200(self):
        """GET .well-known/apple-app-site-association returns 200."""
        response = self.client.get('/.well-known/apple-app-site-association')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.get('Content-Type', '').split(';')[0].strip(), 'application/json')

    def test_assetlinks_returns_200(self):
        """GET .well-known/assetlinks.json returns 200."""
        response = self.client.get('/.well-known/assetlinks.json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
