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

from api.models import MerchantProfile, Store, CouponTemplate, Coupon, StudentProfile, WebRedemption


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

    def test_coupon_template_delete_succeeds_when_web_redemption_exists_preserves_legacy(self):
        """DELETE template clears FK on WebRedemption but keeps legacy template identity (SET_NULL + snapshot)."""
        wr = WebRedemption.objects.create(
            template=self.template,
            session_token='sess-test-delete-legacy',
        )
        tid = self.template.id
        tname = self.template.coupon_name
        self.client.force_authenticate(user=self.merchant)
        response = self.client.delete(f'/api/merchant/coupon-templates/{tid}/delete/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(CouponTemplate.objects.filter(id=tid).exists())
        wr.refresh_from_db()
        self.assertIsNone(wr.template_id)
        self.assertEqual(wr.legacy_template_id, tid)
        self.assertEqual(wr.legacy_template_coupon_name, tname)

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

    def test_consolidate_coupon_pending_branch_decrements_stock_consistently(self):
        """Unregistered flow should create pending coupons and decrement stock exactly once per success."""
        self.client.force_authenticate(user=self.merchant)
        self.template.remaining_quantity = 3
        self.template.total_quantity = 3
        self.template.is_active = True
        self.template.save(update_fields=['remaining_quantity', 'total_quantity', 'is_active'])

        phone_1 = '0911222333'
        phone_2 = '0911222444'
        self.assertFalse(StudentProfile.objects.filter(phone_number=phone_1).exists())
        self.assertFalse(StudentProfile.objects.filter(phone_number=phone_2).exists())

        response_1 = self.client.post(
            '/api/merchant/consolidate-coupon/',
            {'template_id': self.template.id, 'phone_number': phone_1},
            format='json',
        )
        response_2 = self.client.post(
            '/api/merchant/consolidate-coupon/',
            {'template_id': self.template.id, 'phone_number': phone_2},
            format='json',
        )

        self.assertEqual(response_1.status_code, status.HTTP_200_OK)
        self.assertEqual(response_2.status_code, status.HTTP_200_OK)
        self.assertEqual(response_1.data.get('recipient_status'), 'pending')
        self.assertEqual(response_2.data.get('recipient_status'), 'pending')

        self.template.refresh_from_db()
        pending_count = Coupon.objects.filter(template=self.template, pending_phone_number__isnull=False).count()
        self.assertEqual(pending_count, 2)
        self.assertEqual(self.template.remaining_quantity, 1)
        self.assertGreaterEqual(self.template.remaining_quantity, 0)

    def test_consolidate_coupon_pending_branch_second_request_fails_when_stock_is_one(self):
        """When stock is 1, only first pending consolidate succeeds and stock never goes negative."""
        self.client.force_authenticate(user=self.merchant)
        self.template.remaining_quantity = 1
        self.template.total_quantity = 1
        self.template.is_active = True
        self.template.save(update_fields=['remaining_quantity', 'total_quantity', 'is_active'])

        first_phone = '0911333444'
        second_phone = '0911333555'

        response_1 = self.client.post(
            '/api/merchant/consolidate-coupon/',
            {'template_id': self.template.id, 'phone_number': first_phone},
            format='json',
        )
        response_2 = self.client.post(
            '/api/merchant/consolidate-coupon/',
            {'template_id': self.template.id, 'phone_number': second_phone},
            format='json',
        )

        self.assertEqual(response_1.status_code, status.HTTP_200_OK)
        self.assertIn(
            response_2.status_code,
            (status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND, status.HTTP_409_CONFLICT),
        )

        self.template.refresh_from_db()
        pending_count = Coupon.objects.filter(template=self.template, pending_phone_number__isnull=False).count()
        self.assertEqual(pending_count, 1)
        self.assertEqual(self.template.remaining_quantity, 0)
        self.assertFalse(self.template.is_active)
        self.assertGreaterEqual(self.template.remaining_quantity, 0)
