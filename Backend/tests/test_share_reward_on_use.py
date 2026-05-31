"""
Regression tests for the coupon share-reward timing rule:

    A shares -> B collects -> B *uses* -> A earns a CouGem
                                       -> B earns the coupon's linked gem_reward

The sharer (A) must NOT be credited when B merely collects the coupon; the
SHARE_REWARD gem is granted only when B actually redeems it. The redeemer (B)
earns the coupon's `template.gem_reward`, not a hardcoded +1.
"""
from datetime import timedelta

from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from api.models import StudentProfile, Store, CouponTemplate, Coupon
from api.spinner_coop.models import WalletTransaction
from api.spinner_coop.wallet_service import WalletService


def _login_consumer(client, email, password):
    resp = client.post(
        '/api/login/',
        {'email': email, 'password': password, 'client_type': 'user'},
        format='json',
    )
    if resp.status_code not in (status.HTTP_200_OK, status.HTTP_201_CREATED):
        return False
    access = resp.json().get('access_token')
    if not access:
        return False
    client.credentials(HTTP_AUTHORIZATION='Bearer ' + access)
    return True


REDEEM_CODE = 'SECRET-USE-CODE'


class ShareRewardOnUseTest(TestCase):
    def setUp(self):
        self.client_a = APIClient()
        self.client_b = APIClient()

        self.user_a = User.objects.create_user(
            username='reward_a@test.com', email='reward_a@test.com', password='testpass123',
        )
        StudentProfile.objects.create(user=self.user_a, verified=True)
        self.user_b = User.objects.create_user(
            username='reward_b@test.com', email='reward_b@test.com', password='testpass123',
        )
        StudentProfile.objects.create(user=self.user_b, verified=True)

        # Wallets start empty so balance deltas are unambiguous.
        WalletService.ensure_wallet(self.user_a.id, initial_gems=0)
        WalletService.ensure_wallet(self.user_b.id, initial_gems=0)

        self.store = Store.objects.create(
            owner=self.user_a, name='Reward Store', lat=25.0, lng=121.0, address='Addr',
        )

    def _make_template(self, *, gem_reward=1):
        return CouponTemplate.objects.create(
            store=self.store,
            coupon_name='Reward Template',
            coupon_detail='D',
            total_quantity=10,
            remaining_quantity=10,
            start_date=timezone.now(),
            expiry_date=timezone.now() + timedelta(days=30),
            is_active=True,
            gem_reward=gem_reward,
            template_redeem_code=REDEEM_CODE,
        )

    def _make_coupon(self, holder, template):
        return Coupon.objects.create(
            store=self.store,
            template=template,
            coupon_name='Reward Template',
            coupon_detail='D',
            start_date=timezone.now(),
            expiry_date=timezone.now() + timedelta(days=30),
            coupon_type='exclusive',
            acquisition_method='consolidate',
            current_holder=holder,
            redeem_code=REDEEM_CODE,
        )

    def _share_and_collect(self, template):
        """A shares a coupon privately; B accepts it. Returns the coupon."""
        coupon = self._make_coupon(self.user_a, template)
        self.assertTrue(_login_consumer(self.client_a, 'reward_a@test.com', 'testpass123'))
        share_resp = self.client_a.post(f'/api/coupon/{coupon.id}/share/', {}, format='json')
        self.assertIn(share_resp.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED), share_resp.json())
        token = share_resp.json().get('token')
        self.assertIsNotNone(token)

        self.assertTrue(_login_consumer(self.client_b, 'reward_b@test.com', 'testpass123'))
        accept_resp = self.client_b.post(f'/api/coupon/share/{token}/accept/', {}, format='json')
        self.assertEqual(accept_resp.status_code, status.HTTP_200_OK, accept_resp.json())
        coupon.refresh_from_db()
        self.assertEqual(coupon.current_holder, self.user_b)
        return coupon

    def _redeem(self, client, coupon):
        return client.post(
            f'/api/redeem/{coupon.id}/', {'redeem_code': REDEEM_CODE}, format='json',
        )

    # ------------------------------------------------------------------ #

    def test_sharer_not_credited_on_collect(self):
        """A earns nothing when B merely collects the shared coupon."""
        template = self._make_template(gem_reward=1)
        self._share_and_collect(template)

        gems_a, _ = WalletService.get_balance(self.user_a.id)
        self.assertEqual(gems_a, 0)
        self.assertFalse(
            WalletTransaction.objects.filter(
                user=self.user_a, kind=WalletTransaction.Kind.SHARE_REWARD,
            ).exists()
        )

    def test_sharer_credited_on_redeem(self):
        """A earns +1 SHARE_REWARD gem once B redeems the shared coupon."""
        template = self._make_template(gem_reward=1)
        coupon = self._share_and_collect(template)

        redeem_resp = self._redeem(self.client_b, coupon)
        self.assertIn(redeem_resp.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED), redeem_resp.json())

        gems_a, _ = WalletService.get_balance(self.user_a.id)
        self.assertEqual(gems_a, 1)
        tx = WalletTransaction.objects.get(
            user=self.user_a, kind=WalletTransaction.Kind.SHARE_REWARD,
        )
        self.assertEqual(tx.delta_gems, 1)
        self.assertEqual(tx.related_coupon_id, coupon.id)

    def test_redeemer_earns_linked_gem_reward(self):
        """B earns the coupon's linked gem_reward (not a flat +1) on redeem."""
        template = self._make_template(gem_reward=3)
        coupon = self._share_and_collect(template)

        redeem_resp = self._redeem(self.client_b, coupon)
        self.assertIn(redeem_resp.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED), redeem_resp.json())

        gems_b, _ = WalletService.get_balance(self.user_b.id)
        self.assertEqual(gems_b, 3)
        tx = WalletTransaction.objects.get(
            user=self.user_b, kind=WalletTransaction.Kind.COUPON_REDEEM,
        )
        self.assertEqual(tx.delta_gems, 3)

    def test_zero_gem_reward_credits_redeemer_nothing(self):
        """A template with gem_reward=0 grants the redeemer no gems and no error."""
        template = self._make_template(gem_reward=0)
        coupon = self._share_and_collect(template)

        redeem_resp = self._redeem(self.client_b, coupon)
        self.assertIn(redeem_resp.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED), redeem_resp.json())

        gems_b, _ = WalletService.get_balance(self.user_b.id)
        self.assertEqual(gems_b, 0)
        self.assertFalse(
            WalletTransaction.objects.filter(
                user=self.user_b, kind=WalletTransaction.Kind.COUPON_REDEEM,
            ).exists()
        )
        # The sharer is still rewarded — the share reward is independent of gem_reward.
        gems_a, _ = WalletService.get_balance(self.user_a.id)
        self.assertEqual(gems_a, 1)

    def test_self_redeem_grants_no_share_reward(self):
        """Redeeming a coupon you were never given (no sharer) grants no SHARE_REWARD."""
        template = self._make_template(gem_reward=2)
        coupon = self._make_coupon(self.user_a, template)  # last_holder stays None

        self.assertTrue(_login_consumer(self.client_a, 'reward_a@test.com', 'testpass123'))
        redeem_resp = self._redeem(self.client_a, coupon)
        self.assertIn(redeem_resp.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED), redeem_resp.json())

        self.assertFalse(
            WalletTransaction.objects.filter(
                user=self.user_a, kind=WalletTransaction.Kind.SHARE_REWARD,
            ).exists()
        )
        # Redeemer still earns the linked gem_reward for their own redemption.
        gems_a, _ = WalletService.get_balance(self.user_a.id)
        self.assertEqual(gems_a, 2)
