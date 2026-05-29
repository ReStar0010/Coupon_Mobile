"""
Integration tests for merchant coupon template CRUD endpoints.
Routes: api/merchant/coupon-templates/, api/merchant/coupon-templates/<id>/,
api/merchant/coupon-templates/create/, api/merchant/coupon-templates/<id>/update/,
api/merchant/coupon-templates/<id>/delete/
"""
from datetime import timedelta

from django.contrib.auth.models import Group, User
from django.conf import settings
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from api.models import (
    CouponTemplate,
    EULAAcceptance,
    MerchantProfile,
    Store,
    StudentProfile,
)


def _create_approved_merchant(email: str) -> User:
    """Helper: create a merchant user with an approved MerchantProfile and a Store."""
    group, _ = Group.objects.get_or_create(name='Merchant')
    user = User.objects.create_user(username=email, email=email, password='testpass123')
    user.groups.add(group)
    MerchantProfile.objects.create(
        user=user,
        phone='0912345678',
        contact_person='Test Person',
        contact_info='line@test',
        application_status='approved',
        verified=True,
    )
    Store.objects.create(
        owner=user,
        name='Merchant Store',
        lat=25.0,
        lng=121.0,
        address='1 Merchant Street',
    )
    return user


def _accept_eula(user: User) -> None:
    """Helper: record EULA acceptance for a merchant user."""
    version = getattr(settings, 'CURRENT_EULA_VERSION', '1.0.0')
    EULAAcceptance.objects.get_or_create(
        merchant=user,
        version=version,
        defaults={'ip_address': '127.0.0.1'},
    )


class MerchantTemplateListTests(TestCase):
    """Tests for listing and reading coupon templates."""

    def setUp(self):
        self.client = APIClient()
        self.merchant = _create_approved_merchant('merchant_list@test.com')
        self.store = Store.objects.get(owner=self.merchant)
        self.template = CouponTemplate.objects.create(
            store=self.store,
            coupon_name='Existing Template',
            coupon_detail='detail',
            total_quantity=5,
            remaining_quantity=5,
            start_date=timezone.now(),
            expiry_date=timezone.now() + timedelta(days=30),
            is_active=True,
        )

    def test_list_templates_requires_auth(self):
        """GET api/merchant/coupon-templates/ without auth returns 401."""
        response = self.client.get('/api/merchant/coupon-templates/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_templates_authenticated(self):
        """GET api/merchant/coupon-templates/ returns 200 with a list for the merchant."""
        self.client.force_authenticate(user=self.merchant)
        response = self.client.get('/api/merchant/coupon-templates/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIsInstance(data, list)

    def test_list_templates_contains_own_template(self):
        """GET api/merchant/coupon-templates/ includes templates belonging to this merchant."""
        self.client.force_authenticate(user=self.merchant)
        response = self.client.get('/api/merchant/coupon-templates/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [t['id'] for t in response.json()]
        self.assertIn(self.template.id, ids)

    def test_get_template_detail_success(self):
        """GET api/merchant/coupon-templates/<id>/ returns 200 with template data."""
        self.client.force_authenticate(user=self.merchant)
        response = self.client.get(f'/api/merchant/coupon-templates/{self.template.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['id'], self.template.id)
        self.assertEqual(data['coupon_name'], 'Existing Template')

    def test_get_template_detail_not_found(self):
        """GET api/merchant/coupon-templates/<id>/ for a non-existent id returns 4xx."""
        self.client.force_authenticate(user=self.merchant)
        response = self.client.get('/api/merchant/coupon-templates/999999/')
        self.assertGreaterEqual(response.status_code, 400)
        self.assertLess(response.status_code, 500)


class MerchantTemplateCreateTests(TestCase):
    """Tests for creating coupon templates."""

    def setUp(self):
        self.client = APIClient()
        self.merchant = _create_approved_merchant('merchant_create@test.com')
        _accept_eula(self.merchant)
        self.store = Store.objects.get(owner=self.merchant)

    def _valid_payload(self, quantity: int = 10) -> dict:
        return {
            'coupon_name': 'New Template',
            'coupon_detail': 'Get 20% off',
            'total_quantity': quantity,
            'start_date': timezone.now().isoformat(),
            'expiry_date': (timezone.now() + timedelta(days=30)).isoformat(),
            'is_active': True,
        }

    def test_create_template_success(self):
        """POST api/merchant/coupon-templates/create/ returns 201 for valid data."""
        self.client.force_authenticate(user=self.merchant)
        response = self.client.post(
            '/api/merchant/coupon-templates/create/',
            self._valid_payload(),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            CouponTemplate.objects.filter(
                store=self.store, coupon_name='New Template'
            ).exists()
        )

    def test_create_template_missing_required_fields(self):
        """POST api/merchant/coupon-templates/create/ with missing fields returns 400."""
        self.client.force_authenticate(user=self.merchant)
        response = self.client.post(
            '/api/merchant/coupon-templates/create/',
            {'coupon_name': 'Incomplete'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_template_requires_eula(self):
        """POST api/merchant/coupon-templates/create/ without EULA acceptance returns 4xx."""
        merchant_no_eula = _create_approved_merchant('no_eula@test.com')
        self.client.force_authenticate(user=merchant_no_eula)
        response = self.client.post(
            '/api/merchant/coupon-templates/create/',
            self._valid_payload(),
            format='json',
        )
        self.assertGreaterEqual(response.status_code, 400)
        self.assertLess(response.status_code, 500)

    def test_create_template_requires_auth(self):
        """POST api/merchant/coupon-templates/create/ without auth returns 401."""
        response = self.client.post(
            '/api/merchant/coupon-templates/create/',
            self._valid_payload(),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_store_type_template_zero_quantity(self):
        """POST with total_quantity=0 creates a store-type coupon template and coupon."""
        self.client.force_authenticate(user=self.merchant)
        response = self.client.post(
            '/api/merchant/coupon-templates/create/',
            self._valid_payload(quantity=0),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class MerchantTemplateUpdateTests(TestCase):
    """Tests for updating coupon templates."""

    def setUp(self):
        self.client = APIClient()
        self.merchant = _create_approved_merchant('merchant_update@test.com')
        self.store = Store.objects.get(owner=self.merchant)
        self.template = CouponTemplate.objects.create(
            store=self.store,
            coupon_name='Original Name',
            coupon_detail='original detail',
            total_quantity=5,
            remaining_quantity=5,
            start_date=timezone.now(),
            expiry_date=timezone.now() + timedelta(days=30),
            is_active=True,
        )

    def test_update_template_success(self):
        """PUT api/merchant/coupon-templates/<id>/update/ changes the template name."""
        self.client.force_authenticate(user=self.merchant)
        response = self.client.put(
            f'/api/merchant/coupon-templates/{self.template.id}/update/',
            {
                'coupon_name': 'Updated Name',
                'coupon_detail': 'updated detail',
                'total_quantity': 5,
                'start_date': timezone.now().isoformat(),
                'expiry_date': (timezone.now() + timedelta(days=30)).isoformat(),
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.template.refresh_from_db()
        self.assertEqual(self.template.coupon_name, 'Updated Name')

    def test_update_template_requires_auth(self):
        """PUT api/merchant/coupon-templates/<id>/update/ without auth returns 401."""
        response = self.client.put(
            f'/api/merchant/coupon-templates/{self.template.id}/update/',
            {'coupon_name': 'Attempt'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_update_template_not_found(self):
        """PUT api/merchant/coupon-templates/999999/update/ returns 4xx."""
        self.client.force_authenticate(user=self.merchant)
        response = self.client.put(
            '/api/merchant/coupon-templates/999999/update/',
            {'coupon_name': 'Ghost'},
            format='json',
        )
        self.assertGreaterEqual(response.status_code, 400)
        self.assertLess(response.status_code, 500)


class MerchantTemplateDeleteTests(TestCase):
    """Tests for deleting coupon templates."""

    def setUp(self):
        self.client = APIClient()
        self.merchant = _create_approved_merchant('merchant_delete@test.com')
        self.store = Store.objects.get(owner=self.merchant)
        self.template = CouponTemplate.objects.create(
            store=self.store,
            coupon_name='To Be Deleted',
            coupon_detail='detail',
            total_quantity=2,
            remaining_quantity=2,
            start_date=timezone.now(),
            expiry_date=timezone.now() + timedelta(days=30),
            is_active=True,
        )

    def test_delete_template_success(self):
        """DELETE api/merchant/coupon-templates/<id>/delete/ returns 200 and removes record."""
        self.client.force_authenticate(user=self.merchant)
        response = self.client.delete(
            f'/api/merchant/coupon-templates/{self.template.id}/delete/'
        )
        self.assertIn(
            response.status_code,
            (status.HTTP_200_OK, status.HTTP_204_NO_CONTENT),
        )
        self.assertFalse(CouponTemplate.objects.filter(id=self.template.id).exists())

    def test_delete_template_requires_auth(self):
        """DELETE api/merchant/coupon-templates/<id>/delete/ without auth returns 401."""
        response = self.client.delete(
            f'/api/merchant/coupon-templates/{self.template.id}/delete/'
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_delete_nonexistent_template(self):
        """DELETE api/merchant/coupon-templates/999999/delete/ returns 4xx."""
        self.client.force_authenticate(user=self.merchant)
        response = self.client.delete('/api/merchant/coupon-templates/999999/delete/')
        self.assertGreaterEqual(response.status_code, 400)
        self.assertLess(response.status_code, 500)


class ConsumerCannotAccessMerchantRoutesTests(TestCase):
    """Verify that a student user is rejected from merchant-only endpoints."""

    def setUp(self):
        self.client = APIClient()
        self.student = User.objects.create_user(
            username='student_attempt@test.com',
            email='student_attempt@test.com',
            password='testpass123',
        )
        StudentProfile.objects.create(user=self.student, verified=True)

        # Build a template ID to try accessing
        merchant = _create_approved_merchant('template_owner@test.com')
        store = Store.objects.get(owner=merchant)
        self.template = CouponTemplate.objects.create(
            store=store,
            coupon_name='Merchant Only',
            coupon_detail='detail',
            total_quantity=5,
            remaining_quantity=5,
            start_date=timezone.now(),
            expiry_date=timezone.now() + timedelta(days=30),
            is_active=True,
        )

    def test_student_cannot_list_merchant_templates(self):
        """GET api/merchant/coupon-templates/ as a student returns 403 or 404."""
        self.client.force_authenticate(user=self.student)
        response = self.client.get('/api/merchant/coupon-templates/')
        # Endpoint raises NoStoreForMerchant (no store for this user) → 4xx
        self.assertGreaterEqual(response.status_code, 400)
        self.assertLess(response.status_code, 500)

    def test_student_cannot_get_merchant_template_detail(self):
        """GET api/merchant/coupon-templates/<id>/ as a student returns 4xx."""
        self.client.force_authenticate(user=self.student)
        response = self.client.get(
            f'/api/merchant/coupon-templates/{self.template.id}/'
        )
        self.assertGreaterEqual(response.status_code, 400)
        self.assertLess(response.status_code, 500)

    def test_student_cannot_delete_merchant_template(self):
        """DELETE api/merchant/coupon-templates/<id>/delete/ as a student returns 4xx."""
        self.client.force_authenticate(user=self.student)
        response = self.client.delete(
            f'/api/merchant/coupon-templates/{self.template.id}/delete/'
        )
        self.assertGreaterEqual(response.status_code, 400)
        self.assertLess(response.status_code, 500)
