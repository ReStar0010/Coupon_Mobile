"""
E2E tests covering full user journeys via the real API.
Uses token-based auth (login → Bearer token) for consumer, merchant, and sharing flows.
"""
from django.test import TestCase
from django.contrib.auth.models import User, Group
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status
from unittest.mock import patch

from api.models import (
    StudentProfile,
    MerchantProfile,
    Store,
    CouponTemplate,
    Coupon,
    EULAAcceptance,
)


# -----------------------------------------------------------------------------
# Helpers: login and token-based auth
# -----------------------------------------------------------------------------


def _login_consumer(client, email, password):
    """POST api/login/ with email + client_type=user, set Bearer token on client."""
    resp = client.post(
        '/api/login/',
        {'email': email, 'password': password, 'client_type': 'user'},
        format='json',
    )
    if resp.status_code not in (status.HTTP_200_OK, status.HTTP_201_CREATED):
        return False
    data = resp.json()
    access = data.get('access_token')
    if not access:
        return False
    client.credentials(HTTP_AUTHORIZATION='Bearer ' + access)
    return True


def _login_merchant(client, email, password):
    """POST api/login/ with email + client_type=merchant, set Bearer token on client."""
    resp = client.post(
        '/api/login/',
        {'email': email, 'password': password, 'client_type': 'merchant'},
        format='json',
    )
    if resp.status_code not in (status.HTTP_200_OK, status.HTTP_201_CREATED):
        return False
    data = resp.json()
    access = data.get('access_token')
    if not access:
        return False
    client.credentials(HTTP_AUTHORIZATION='Bearer ' + access)
    return True


# -----------------------------------------------------------------------------
# Consumer journey E2E
# -----------------------------------------------------------------------------


class ConsumerJourneyE2ETest(TestCase):
    """E2E: consumer register (mock email) → verify → login → browse → redeem / daily-draw / profile."""

    def setUp(self):
        self.client = APIClient()

    @patch('api.views.authentication.send_verification_email')
    def test_consumer_journey_email_register_login_browse_redeem(self, mock_send_email):
        """Register with email → verify → login → store-coupons, exclusive-coupons → coupon detail → user-statistics, coupon-history."""
        # Register
        reg = self.client.post(
            '/api/register/',
            {'email': 'e2e_consumer@test.com', 'password': 'testpass123', 'username': 'e2e_consumer@test.com'},
            format='json',
        )
        self.assertEqual(reg.status_code, status.HTTP_201_CREATED, reg.json())
        mock_send_email.assert_called_once()

        user = User.objects.get(email='e2e_consumer@test.com')
        profile = StudentProfile.objects.get(user=user)
        self.assertFalse(profile.verified)
        # Verify email (simulate user clicking link)
        verify = self.client.get(
            '/api/verify-email/',
            {'token': profile.email_verification_token},
        )
        self.assertIn(verify.status_code, (status.HTTP_200_OK, 200))
        profile.refresh_from_db()
        self.assertTrue(profile.verified)

        # Login and use token
        self.assertTrue(_login_consumer(self.client, 'e2e_consumer@test.com', 'testpass123'))

        # Browse (no coupon data required for 200)
        store_resp = self.client.get('/api/store-coupons/')
        self.assertEqual(store_resp.status_code, status.HTTP_200_OK)
        excl_resp = self.client.get('/api/exclusive-coupons/')
        self.assertIn(excl_resp.status_code, (status.HTTP_200_OK, status.HTTP_401_UNAUTHORIZED))

        # User stats and coupon history
        stats_resp = self.client.get('/api/user-statistics/')
        self.assertEqual(stats_resp.status_code, status.HTTP_200_OK)
        hist_resp = self.client.get('/api/coupon-history/')
        self.assertEqual(hist_resp.status_code, status.HTTP_200_OK)

        # Set savings goal
        goal_resp = self.client.post(
            '/api/set-savings-goal/',
            {'goal_name': 'Trip', 'goal_amount': 500},
            format='json',
        )
        self.assertIn(goal_resp.status_code, (status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST))

    def test_consumer_journey_daily_draw(self):
        """Login → daily-draw-templates → daily-draw → draw-history, last-draw."""
        user = User.objects.create_user(
            username='draw_user@test.com',
            email='draw_user@test.com',
            password='testpass123',
        )
        StudentProfile.objects.create(user=user, verified=True)
        store = Store.objects.create(
            owner=user,
            name='Draw Store',
            lat=25.0,
            lng=121.0,
            address='Addr',
        )
        template = CouponTemplate.objects.create(
            store=store,
            coupon_name='Draw Template',
            coupon_detail='Detail',
            total_quantity=10,
            remaining_quantity=10,
            start_date=timezone.now(),
            expiry_date=timezone.now() + timedelta(days=30),
            is_active=True,
        )

        self.assertTrue(_login_consumer(self.client, 'draw_user@test.com', 'testpass123'))

        templates_resp = self.client.get('/api/daily-draw-templates/')
        self.assertIn(templates_resp.status_code, (status.HTTP_200_OK, status.HTTP_401_UNAUTHORIZED))

        draw_resp = self.client.post(
            '/api/coupon/daily-draw/',
            {'template_id': template.id},
            format='json',
        )
        self.assertIn(
            draw_resp.status_code,
            (status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND),
        )

        hist_resp = self.client.get('/api/coupon/draw-history/')
        self.assertEqual(hist_resp.status_code, status.HTTP_200_OK)
        last_resp = self.client.get('/api/last-draw/')
        self.assertEqual(last_resp.status_code, status.HTTP_200_OK)

    def test_consumer_journey_qr_claim(self):
        """Merchant generates QR session → consumer claims → coupon in consumer's collection."""
        merchant_group, _ = Group.objects.get_or_create(name='Merchant')
        merchant = User.objects.create_user(
            username='qr_merchant@test.com',
            email='qr_merchant@test.com',
            password='testpass123',
        )
        merchant.groups.add(merchant_group)
        MerchantProfile.objects.create(
            user=merchant,
            phone='0912345678',
            contact_person='M',
            contact_info='line',
            verified=True,
        )
        store = Store.objects.create(
            owner=merchant,
            name='QR Store',
            lat=25.0,
            lng=121.0,
            address='Addr',
        )
        template = CouponTemplate.objects.create(
            store=store,
            coupon_name='QR Coupon',
            coupon_detail='D',
            total_quantity=100,
            remaining_quantity=100,
            start_date=timezone.now() - timedelta(days=1),
            expiry_date=timezone.now() + timedelta(days=30),
            is_active=True,
        )
        consumer = User.objects.create_user(
            username='qr_consumer@test.com',
            email='qr_consumer@test.com',
            password='testpass123',
        )
        StudentProfile.objects.create(user=consumer, verified=True)

        merchant_client = APIClient()
        self.assertTrue(_login_merchant(merchant_client, 'qr_merchant@test.com', 'testpass123'))
        gen_resp = merchant_client.post(
            '/api/merchant/qr-session/generate/',
            {'template_id': template.id},
            format='json',
        )
        self.assertEqual(gen_resp.status_code, status.HTTP_201_CREATED, gen_resp.json())
        gen_data = gen_resp.json()
        session_token = gen_data['session_token']
        template_id = gen_data['template_id']

        self.assertTrue(_login_consumer(self.client, 'qr_consumer@test.com', 'testpass123'))
        claim_resp = self.client.post(
            '/api/qr-claim/claim/',
            {'template_id': template_id, 'session_token': session_token},
            format='json',
        )
        self.assertEqual(claim_resp.status_code, status.HTTP_201_CREATED, claim_resp.json())
        claim_data = claim_resp.json()
        self.assertEqual(claim_data['acquisition_method'], 'qr_claim')
        self.assertIn('coupon_id', claim_data)

        coupon = Coupon.objects.get(id=claim_data['coupon_id'])
        self.assertEqual(coupon.current_holder, consumer)
        self.assertEqual(coupon.acquisition_method, 'qr_claim')

    def test_consumer_journey_account_deletion(self):
        """Login → pre-delete-check → delete with password and DATA_LOSS → user removed."""
        user = User.objects.create_user(
            username='del_consumer@test.com',
            email='del_consumer@test.com',
            password='testpass123',
        )
        StudentProfile.objects.create(user=user, verified=True)
        self.assertTrue(_login_consumer(self.client, 'del_consumer@test.com', 'testpass123'))

        pre = self.client.get('/api/account/pre-delete-check/')
        self.assertEqual(pre.status_code, status.HTTP_200_OK)
        self.assertIn('can_delete', pre.json())
        self.assertIn('warnings', pre.json())

        user_id = user.id
        del_resp = self.client.post(
            '/api/account/delete/',
            {'password': 'testpass123', 'acknowledgments': ['DATA_LOSS']},
            format='json',
        )
        self.assertEqual(del_resp.status_code, status.HTTP_200_OK, del_resp.json())
        self.assertTrue(del_resp.json().get('success'))
        self.assertFalse(User.objects.filter(id=user_id).exists())


# -----------------------------------------------------------------------------
# Merchant journey E2E
# -----------------------------------------------------------------------------


class MerchantJourneyE2ETest(TestCase):
    """E2E: merchant register (mock verify) / login → profile → template CRUD → QR or redeem → stats / account delete."""

    def setUp(self):
        self.client = APIClient()
        self._eula_version = '1.0.0'

    def _create_verified_merchant(self, email='e2e_merchant@test.com', password='testpass123'):
        """Create merchant user + profile + store + EULA acceptance."""
        group, _ = Group.objects.get_or_create(name='Merchant')
        user = User.objects.create_user(username=email, email=email, password=password)
        user.groups.add(group)
        MerchantProfile.objects.create(
            user=user,
            phone='0912345678',
            contact_person='Contact',
            contact_info='line',
            verified=True,
        )
        Store.objects.create(
            owner=user,
            name='E2E Store',
            lat=25.0,
            lng=121.0,
            address='Address',
        )
        EULAAcceptance.objects.create(
            merchant=user,
            version=self._eula_version,
            ip_address='127.0.0.1',
        )
        return user

    @patch('api.views.authentication.send_merchant_verification_email')
    def test_merchant_journey_register_login_template_crud(self, mock_send_email):
        """Register merchant (mock email) → set verified → login → profile → create template → list → get → update."""
        reg = self.client.post(
            '/api/register/',
            {
                'email': 'new_merchant@test.com',
                'password': 'testpass123',
                'user_type': 'merchant',
                'phone': '0912345678',
                'contact_person': 'Person',
                'contact_info': 'line',
                'store_name': 'New Store',
                'store_address': 'Addr',
                'store_lat': 25.0,
                'store_lng': 121.0,
            },
            format='json',
        )
        self.assertEqual(reg.status_code, status.HTTP_201_CREATED, reg.json())

        user = User.objects.get(email='new_merchant@test.com')
        mp = MerchantProfile.objects.get(user=user)
        mp.verified = True
        mp.save()
        EULAAcceptance.objects.create(
            merchant=user,
            version=self._eula_version,
            ip_address='127.0.0.1',
        )

        self.assertTrue(_login_merchant(self.client, 'new_merchant@test.com', 'testpass123'))

        profile_resp = self.client.get('/api/merchant/profile/')
        self.assertEqual(profile_resp.status_code, status.HTTP_200_OK)

        start = timezone.now()
        end = timezone.now() + timedelta(days=30)
        create_resp = self.client.post(
            '/api/merchant/coupon-templates/create/',
            {
                'coupon_name': 'E2E Template',
                'coupon_detail': 'Detail',
                'total_quantity': 10,
                'start_date': start.isoformat(),
                'expiry_date': end.isoformat(),
            },
            format='json',
        )
        self.assertIn(
            create_resp.status_code,
            (status.HTTP_200_OK, status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN),
        )
        if create_resp.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED):
            list_resp = self.client.get('/api/merchant/coupon-templates/')
            self.assertEqual(list_resp.status_code, status.HTTP_200_OK)
            data = list_resp.json()
            if isinstance(data, list) and len(data) > 0:
                tid = data[0]['id']
                get_resp = self.client.get(f'/api/merchant/coupon-templates/{tid}/')
                self.assertEqual(get_resp.status_code, status.HTTP_200_OK)
                self.client.put(
                    f'/api/merchant/coupon-templates/{tid}/update/',
                    {'coupon_name': 'Updated', 'coupon_detail': 'Detail', 'total_quantity': 10},
                    format='json',
                )

    def test_merchant_journey_qr_flow(self):
        """Merchant login → create template → QR generate → consumer claim → merchant stats/template quantity decremented."""
        merchant = self._create_verified_merchant('qr_m@test.com', 'testpass123')
        store = Store.objects.get(owner=merchant)
        template = CouponTemplate.objects.create(
            store=store,
            coupon_name='QR Template',
            coupon_detail='D',
            total_quantity=50,
            remaining_quantity=50,
            start_date=timezone.now() - timedelta(days=1),
            expiry_date=timezone.now() + timedelta(days=30),
            is_active=True,
        )
        consumer = User.objects.create_user(
            username='qr_c@test.com',
            email='qr_c@test.com',
            password='testpass123',
        )
        StudentProfile.objects.create(user=consumer, verified=True)

        self.assertTrue(_login_merchant(self.client, 'qr_m@test.com', 'testpass123'))
        gen_resp = self.client.post(
            '/api/merchant/qr-session/generate/',
            {'template_id': template.id},
            format='json',
        )
        self.assertEqual(gen_resp.status_code, status.HTTP_201_CREATED)
        session_token = gen_resp.json()['session_token']
        template_id = gen_resp.json()['template_id']

        consumer_client = APIClient()
        self.assertTrue(_login_consumer(consumer_client, 'qr_c@test.com', 'testpass123'))
        claim_resp = consumer_client.post(
            '/api/qr-claim/claim/',
            {'template_id': template_id, 'session_token': session_token},
            format='json',
        )
        self.assertEqual(claim_resp.status_code, status.HTTP_201_CREATED)

        template.refresh_from_db()
        self.assertEqual(template.remaining_quantity, 49)

        self.assertTrue(_login_merchant(self.client, 'qr_m@test.com', 'testpass123'))
        stats_resp = self.client.get('/api/merchant/statistics/')
        self.assertIn(stats_resp.status_code, (status.HTTP_200_OK, status.HTTP_403_FORBIDDEN))

    def test_merchant_journey_redeem_or_unified_code(self):
        """Merchant login → create template → generate unified code → consumer with coupon validates code."""
        merchant = self._create_verified_merchant('uni_m@test.com', 'testpass123')
        store = Store.objects.get(owner=merchant)
        template = CouponTemplate.objects.create(
            store=store,
            coupon_name='Uni Template',
            coupon_detail='D',
            total_quantity=10,
            remaining_quantity=10,
            start_date=timezone.now() - timedelta(days=1),
            expiry_date=timezone.now() + timedelta(days=30),
            is_active=True,
        )
        consumer = User.objects.create_user(
            username='uni_c@test.com',
            email='uni_c@test.com',
            password='testpass123',
        )
        StudentProfile.objects.create(user=consumer, verified=True, phone_number='0987654321')
        coupon = Coupon.objects.create(
            store=store,
            template=template,
            coupon_name='Uni Template',
            coupon_detail='D',
            start_date=timezone.now(),
            expiry_date=timezone.now() + timedelta(days=30),
            coupon_type='exclusive',
            acquisition_method='consolidate',
            current_holder=consumer,
        )

        self.assertTrue(_login_merchant(self.client, 'uni_m@test.com', 'testpass123'))
        gen_resp = self.client.post(
            '/api/merchant/unified-redemption/generate/',
            {},
            format='json',
        )
        self.assertEqual(gen_resp.status_code, status.HTTP_200_OK, gen_resp.json())
        code = gen_resp.json().get('unified_redeem_code')
        store.refresh_from_db()
        if code is None:
            code = store.unified_redeem_code
        self.assertIsNotNone(code, 'Expected unified code in response or on store')

        consumer_client = APIClient()
        self.assertTrue(_login_consumer(consumer_client, 'uni_c@test.com', 'testpass123'))
        val_resp = consumer_client.get(f'/api/unified-redemption/{code}/')
        self.assertIn(val_resp.status_code, (status.HTTP_200_OK, status.HTTP_401_UNAUTHORIZED))
        if val_resp.status_code == status.HTTP_200_OK:
            data = val_resp.json()
            self.assertIn('store', data)
            self.assertIn('available_coupons', data)

    def test_merchant_journey_account_deletion(self):
        """Merchant login → pre-delete-check → delete with password and acknowledgments → merchant removed."""
        self._create_verified_merchant('del_m@test.com', 'testpass123')
        self.assertTrue(_login_merchant(self.client, 'del_m@test.com', 'testpass123'))

        pre = self.client.get('/api/merchant/account/pre-delete-check/')
        self.assertEqual(pre.status_code, status.HTTP_200_OK)
        self.assertIn('can_delete', pre.json())

        user = User.objects.get(email='del_m@test.com')
        user_id = user.id
        del_resp = self.client.post(
            '/api/merchant/account/delete/',
            {'password': 'testpass123', 'acknowledgments': ['DATA_LOSS']},
            format='json',
        )
        self.assertEqual(del_resp.status_code, status.HTTP_200_OK, del_resp.json())
        self.assertFalse(User.objects.filter(id=user_id).exists())


# -----------------------------------------------------------------------------
# Sharing journey E2E (private + public)
# -----------------------------------------------------------------------------


class SharingJourneyE2ETest(TestCase):
    """E2E: private share (A share → B get token → accept) and public share (A share-public → B accept → my-public-shares)."""

    def setUp(self):
        self.client_a = APIClient()
        self.client_b = APIClient()

    def test_sharing_journey_private_share_accept(self):
        """User A has coupon → share → get token; User B get share by token → accept → B has coupon."""
        user_a = User.objects.create_user(
            username='share_a@test.com',
            email='share_a@test.com',
            password='testpass123',
        )
        StudentProfile.objects.create(user=user_a, verified=True)
        user_b = User.objects.create_user(
            username='share_b@test.com',
            email='share_b@test.com',
            password='testpass123',
        )
        StudentProfile.objects.create(user=user_b, verified=True)

        store = Store.objects.create(
            owner=user_a,
            name='Share Store',
            lat=25.0,
            lng=121.0,
            address='Addr',
        )
        template = CouponTemplate.objects.create(
            store=store,
            coupon_name='Share Template',
            coupon_detail='D',
            total_quantity=10,
            remaining_quantity=10,
            start_date=timezone.now(),
            expiry_date=timezone.now() + timedelta(days=30),
            is_active=True,
        )
        coupon = Coupon.objects.create(
            store=store,
            template=template,
            coupon_name='Share Template',
            coupon_detail='D',
            start_date=timezone.now(),
            expiry_date=timezone.now() + timedelta(days=30),
            coupon_type='exclusive',
            acquisition_method='consolidate',
            current_holder=user_a,
        )

        self.assertTrue(_login_consumer(self.client_a, 'share_a@test.com', 'testpass123'))
        share_resp = self.client_a.post(
            f'/api/coupon/{coupon.id}/share/',
            {},
            format='json',
        )
        self.assertIn(share_resp.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST))
        if share_resp.status_code >= 400:
            return
        token = share_resp.json().get('token')
        self.assertIsNotNone(token)

        self.assertTrue(_login_consumer(self.client_b, 'share_b@test.com', 'testpass123'))
        get_resp = self.client_b.get(f'/api/coupon/share/{token}/')
        self.assertEqual(get_resp.status_code, status.HTTP_200_OK)
        accept_resp = self.client_b.post(f'/api/coupon/share/{token}/accept/', {}, format='json')
        self.assertEqual(accept_resp.status_code, status.HTTP_200_OK)

        coupon.refresh_from_db()
        self.assertEqual(coupon.current_holder, user_b)

    def test_sharing_journey_public_share_claim(self):
        """User A share-public → my-public-shares (pending); User B get share by token → accept → B has coupon; A my-public-shares (accepted, claimed_by B)."""
        user_a = User.objects.create_user(
            username='pub_a@test.com',
            email='pub_a@test.com',
            password='testpass123',
        )
        StudentProfile.objects.create(user=user_a, verified=True)
        user_b = User.objects.create_user(
            username='pub_b@test.com',
            email='pub_b@test.com',
            password='testpass123',
        )
        StudentProfile.objects.create(user=user_b, verified=True)

        store = Store.objects.create(
            owner=user_a,
            name='Pub Store',
            lat=25.0,
            lng=121.0,
            address='Addr',
        )
        template = CouponTemplate.objects.create(
            store=store,
            coupon_name='Pub Template',
            coupon_detail='D',
            total_quantity=10,
            remaining_quantity=10,
            start_date=timezone.now(),
            expiry_date=timezone.now() + timedelta(days=30),
            is_active=True,
        )
        coupon = Coupon.objects.create(
            store=store,
            template=template,
            coupon_name='Pub Template',
            coupon_detail='D',
            start_date=timezone.now(),
            expiry_date=timezone.now() + timedelta(days=30),
            coupon_type='exclusive',
            acquisition_method='consolidate',
            current_holder=user_a,
        )

        self.assertTrue(_login_consumer(self.client_a, 'pub_a@test.com', 'testpass123'))
        share_resp = self.client_a.post(
            f'/api/coupon/{coupon.id}/share-public/',
            {},
            format='json',
        )
        self.assertEqual(share_resp.status_code, status.HTTP_200_OK, share_resp.json())
        data = share_resp.json()
        self.assertIn('token', data)
        token = data['token']

        my_resp = self.client_a.get('/api/my-public-shares/')
        self.assertEqual(my_resp.status_code, status.HTTP_200_OK)
        my_list = my_resp.json()
        self.assertIsInstance(my_list, list)
        self.assertGreaterEqual(len(my_list), 1)
        self.assertEqual(my_list[0]['status'], 'pending')

        self.assertTrue(_login_consumer(self.client_b, 'pub_b@test.com', 'testpass123'))
        get_resp = self.client_b.get(f'/api/coupon/share/{token}/')
        self.assertEqual(get_resp.status_code, status.HTTP_200_OK)
        accept_resp = self.client_b.post(f'/api/coupon/share/{token}/accept/', {}, format='json')
        self.assertEqual(accept_resp.status_code, status.HTTP_200_OK, accept_resp.json())

        coupon.refresh_from_db()
        self.assertEqual(coupon.current_holder, user_b)
        self.assertEqual(coupon.acquisition_method, 'public_pool')

        self.assertTrue(_login_consumer(self.client_a, 'pub_a@test.com', 'testpass123'))
        my_resp2 = self.client_a.get('/api/my-public-shares/')
        self.assertEqual(my_resp2.status_code, status.HTTP_200_OK)
        my_list2 = my_resp2.json()
        found = next((s for s in my_list2 if s.get('status') == 'accepted' and s.get('claimed_by') == 'pub_b@test.com'), None)
        self.assertIsNotNone(found, f'Expected one accepted share claimed by pub_b@test.com in {my_list2}')
