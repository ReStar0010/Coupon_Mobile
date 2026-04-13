from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from api.models import CouponTemplate, Store


class WebV1MerchantCouponsVisibilityTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        owner = User.objects.create_user(
            username='merchant_web_v1@test.com',
            email='merchant_web_v1@test.com',
            password='testpass123',
        )
        self.store = Store.objects.create(
            owner=owner,
            name='Visibility Store',
            lat=25.0,
            lng=121.0,
            address='Addr',
        )
        self.now = timezone.now()

    def _create_template(self, **overrides):
        payload = {
            'store': self.store,
            'coupon_name': 'Visible Coupon',
            'coupon_detail': 'Detail',
            'total_quantity': 10,
            'remaining_quantity': 10,
            'start_date': self.now - timedelta(days=1),
            'expiry_date': self.now + timedelta(days=3),
            'is_active': True,
        }
        payload.update(overrides)
        return CouponTemplate.objects.create(**payload)

    def test_merchant_coupons_only_returns_templates_enabled_for_desk_qr(self):
        visible = self._create_template(coupon_name='Visible', show_in_desk_qrcode=True)
        self._create_template(coupon_name='Hidden', show_in_desk_qrcode=False)

        response = self.client.get(f'/api/web/v1/merchants/{self.store.id}/coupons/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.json())

        coupons = response.json()['coupons']
        returned_ids = [item['id'] for item in coupons]
        self.assertEqual(returned_ids, [visible.id])

    def test_merchant_coupons_keeps_existing_filters_along_with_visibility(self):
        included = self._create_template(coupon_name='Included', show_in_desk_qrcode=True)
        self._create_template(
            coupon_name='Inactive',
            show_in_desk_qrcode=True,
            is_active=False,
        )
        self._create_template(
            coupon_name='NoRemaining',
            show_in_desk_qrcode=True,
            remaining_quantity=0,
        )
        self._create_template(
            coupon_name='Expired',
            show_in_desk_qrcode=True,
            expiry_date=self.now - timedelta(minutes=1),
        )

        response = self.client.get(f'/api/web/v1/merchants/{self.store.id}/coupons/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.json())

        coupons = response.json()['coupons']
        self.assertEqual([item['id'] for item in coupons], [included.id])

    def test_show_in_desk_qrcode_defaults_to_true_for_backward_compatibility(self):
        template = self._create_template(coupon_name='DefaultVisible')
        template.refresh_from_db()
        self.assertTrue(template.show_in_desk_qrcode)

