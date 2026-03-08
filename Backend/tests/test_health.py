"""
Tests for health check endpoint.
GET /api/health/ returns 200 when DB is ok, 503 when DB fails.
"""
from unittest.mock import patch

from django.test import TestCase, Client
from rest_framework import status


class HealthCheckTest(TestCase):
    """Coverage for GET /api/health/."""

    def setUp(self):
        self.client = Client()

    def test_health_returns_200_and_ok_when_db_ok(self):
        """GET /api/health/ returns 200 and JSON with status ok and db ok."""
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data.get('status'), 'ok')
        self.assertEqual(data.get('db'), 'ok')

    def test_health_returns_503_when_db_fails(self):
        """GET /api/health/ returns 503 when database query fails."""
        with patch('Backend.urls.connection') as mock_conn:
            mock_cursor = mock_conn.cursor.return_value.__enter__.return_value
            mock_cursor.execute.side_effect = Exception('connection refused')
            response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        data = response.json()
        self.assertEqual(data.get('status'), 'error')
        self.assertIn('db', data)
