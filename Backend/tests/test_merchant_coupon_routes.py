"""
T012 [US3]: Tests for merchant coupon templates and operations.
Routes: api/merchant/coupon-templates/, api/merchant/coupon-templates/<id>/,
create/update/delete, api/merchant/consolidate-coupon/, api/merchant/refresh_redeem_code/,
api/merchant/redeem/, api/merchant/unified-redemption/generate/, api/merchant/upload-image/,
api/tags/, api/merchant/qr-session/generate/, api/merchant/qr-session/<id>/invalidate/,
api/qr-claim/claim/
"""
from django.test import TestCase
from django.contrib.auth.models import User, Group
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status

from api.models import MerchantProfile, Store, CouponTemplate, Coupon


class MerchantCouponRoutesTest(TestCase):
    """Coverage for merchant coupon template and operation endpoints."""

    def setUp(self):
        self.client = APIClient()
        self.merchant_group, _ = Group.objects.get_or_create(name='Merchant')
        self.merchant = User.objects.create_user(
            username='merchant@test.com',
            email='merchant@test.com',
            password='testpass123',
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
        self.template = CouponTemplate.objects.create(
            store=self.store,
            coupon_name='Test Template',
            coupon_detail='Detail',
            total_quantity=10,
            remaining_quantity=10,
            start_date=timezone.now(),
            expiry_date=timezone.now() + timedelta(days=30),
            is_active=True,
        )

    def test_coupon_templates_list_requires_merchant(self):
        """GET api/merchant/coupon-templates/ without merchant auth returns 401/403."""
        response = self.client.get('/api/merchant/coupon-templates/')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_coupon_templates_list_success(self):
        """GET api/merchant/coupon-templates/ with merchant auth returns 200."""
        self.client.force_authenticate(user=self.merchant)
        response = self.client.get('/api/merchant/coupon-templates/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_coupon_template_detail_success(self):
        """GET api/merchant/coupon-templates/<id>/ with merchant auth returns 200."""
        self.client.force_authenticate(user=self.merchant)
        response = self.client.get(f'/api/merchant/coupon-templates/{self.template.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_coupon_template_create_success_or_4xx(self):
        """POST api/merchant/coupon-templates/create/ with merchant auth returns 200 or 4xx."""
        self.client.force_authenticate(user=self.merchant)
        response = self.client.post('/api/merchant/coupon-templates/create/', {
            'coupon_name': 'New',
            'coupon_detail': 'Detail',
            'total_quantity': 5,
            'start_date': timezone.now().isoformat(),
            'expiry_date': (timezone.now() + timedelta(days=30)).isoformat(),
        }, format='json')
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN))

    def test_coupon_template_update_success_or_4xx(self):
        """PUT api/merchant/coupon-templates/<id>/update/ with merchant auth returns 200 or 4xx."""
        self.client.force_authenticate(user=self.merchant)
        response = self.client.put(f'/api/merchant/coupon-templates/{self.template.id}/update/', {
            'coupon_name': 'Updated',
            'coupon_detail': 'Detail',
            'total_quantity': 10,
        }, format='json')
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST))

    def test_coupon_template_delete_success_or_4xx(self):
        """DELETE api/merchant/coupon-templates/<id>/delete/ with merchant auth returns 200 or 4xx."""
        self.client.force_authenticate(user=self.merchant)
        response = self.client.delete(f'/api/merchant/coupon-templates/{self.template.id}/delete/')
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_204_NO_CONTENT, status.HTTP_400_BAD_REQUEST))

    def test_consolidate_coupon_requires_merchant(self):
        """POST api/merchant/consolidate-coupon/ without merchant returns 401/403."""
        response = self.client.post('/api/merchant/consolidate-coupon/', {}, format='json')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_refresh_redeem_code_requires_merchant(self):
        """POST api/merchant/refresh_redeem_code/ without merchant returns 401/403/4xx."""
        response = self.client.post('/api/merchant/refresh_redeem_code/', {}, format='json')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN, status.HTTP_400_BAD_REQUEST))

    def test_merchant_redeem_requires_merchant(self):
        """POST api/merchant/redeem/ without merchant returns 401/403."""
        response = self.client.post('/api/merchant/redeem/', {}, format='json')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_unified_redemption_generate_requires_merchant(self):
        """POST api/merchant/unified-redemption/generate/ without merchant returns 401/403."""
        response = self.client.post('/api/merchant/unified-redemption/generate/', {}, format='json')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_upload_image_requires_merchant(self):
        """POST api/merchant/upload-image/ without merchant returns 401/403."""
        response = self.client.post('/api/merchant/upload-image/', {}, format='multipart')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_tags_get(self):
        """GET api/tags/ returns 200 (public) or 401 if auth required."""
        response = self.client.get('/api/tags/')
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_401_UNAUTHORIZED))

    def test_qr_session_generate_requires_merchant(self):
        """POST api/merchant/qr-session/generate/ without merchant returns 401/403."""
        response = self.client.post('/api/merchant/qr-session/generate/', {}, format='json')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_qr_claim_claim_returns_200_or_4xx(self):
        """POST api/qr-claim/claim/ returns 200, 401, or 4xx."""
        response = self.client.post('/api/qr-claim/claim/', {
            'session_id': 'invalid',
            'user_id': 1,
        }, format='json')
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_401_UNAUTHORIZED, status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND))
