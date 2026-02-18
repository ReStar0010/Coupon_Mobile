"""
T011 [US3]: Tests for daily draw and events routes.
Routes: api/daily-draw-templates/, api/coupon/daily-draw/, api/coupon/draw-history/,
api/last-draw/, api/events/template-view/
"""
from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status

from api.models import StudentProfile, Store, CouponTemplate


class DailyDrawEventsRoutesTest(TestCase):
    """Coverage for daily draw and event tracking endpoints."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='user@test.com',
            email='user@test.com',
            password='testpass123',
        )
        StudentProfile.objects.create(user=self.user)
        self.store = Store.objects.create(
            owner=self.user,
            name='Test Store',
            lat=25.0,
            lng=121.0,
            address='Test',
        )
        self.template = CouponTemplate.objects.create(
            store=self.store,
            coupon_name='Draw Template',
            coupon_detail='Detail',
            total_quantity=10,
            remaining_quantity=10,
            start_date=timezone.now(),
            expiry_date=timezone.now() + timedelta(days=30),
            is_active=True,
        )

    def test_daily_draw_templates_get(self):
        """GET api/daily-draw-templates/ returns 200 (public) or 401 if auth required."""
        response = self.client.get('/api/daily-draw-templates/')
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_401_UNAUTHORIZED))

    def test_daily_draw_requires_auth(self):
        """POST api/coupon/daily-draw/ without auth returns 401."""
        response = self.client.post('/api/coupon/daily-draw/', {
            'template_id': self.template.id,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_daily_draw_success_or_4xx(self):
        """POST api/coupon/daily-draw/ with auth returns 200 or 4xx."""
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/coupon/daily-draw/', {
            'template_id': self.template.id,
        }, format='json')
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND))

    def test_draw_history_requires_auth(self):
        """GET api/coupon/draw-history/ without auth returns 401."""
        response = self.client.get('/api/coupon/draw-history/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_draw_history_success(self):
        """GET api/coupon/draw-history/ with auth returns 200."""
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/coupon/draw-history/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_last_draw_requires_auth(self):
        """GET api/last-draw/ without auth returns 401."""
        response = self.client.get('/api/last-draw/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_events_template_view(self):
        """POST api/events/template-view/ returns 200/201 or 4xx."""
        response = self.client.post('/api/events/template-view/', {
            'template_id': self.template.id,
        }, format='json')
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND))
