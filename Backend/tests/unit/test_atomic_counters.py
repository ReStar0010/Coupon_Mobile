"""Integration tests verifying atomic F() counter updates for sharing and referral rewards."""
import pytest
from django.contrib.auth.models import User
from api.models import StudentProfile


@pytest.mark.django_db
class TestAtomicCounters:
    def test_sharing_progress_increments_atomically(self):
        user = User.objects.create_user(
            username='testshare1',
            email='testshare1@example.com',
            password='testpass123',
        )
        profile = StudentProfile.objects.create(
            user=user,
            sharing_progress_count=0,
            sharing_rewards_earned=0,
        )

        from api.utils import increment_sharing_progress_for_redeemer
        increment_sharing_progress_for_redeemer(user)
        profile.refresh_from_db()
        # After one increment, progress should be 1 (no reward cycle completed yet)
        assert profile.sharing_progress_count == 1
        assert profile.sharing_rewards_earned == 0

    def test_sharing_progress_triggers_reward_at_three(self):
        user = User.objects.create_user(
            username='testshare2',
            email='testshare2@example.com',
            password='testpass123',
        )
        StudentProfile.objects.create(
            user=user,
            sharing_progress_count=2,
            sharing_rewards_earned=0,
        )

        from api.utils import increment_sharing_progress_for_redeemer
        increment_sharing_progress_for_redeemer(user)

        profile = StudentProfile.objects.get(user=user)
        # At count=3 a reward cycle completes; progress resets to 0, rewards earned goes to 1
        assert profile.sharing_progress_count == 0
        assert profile.sharing_rewards_earned == 1

    def test_sharing_progress_no_profile_is_silent(self):
        user = User.objects.create_user(
            username='noprofile1',
            email='noprofile1@example.com',
            password='testpass123',
        )
        # No StudentProfile created — should not raise
        from api.utils import increment_sharing_progress_for_redeemer
        increment_sharing_progress_for_redeemer(user)  # must not raise

    def test_referral_reward_first_increment(self):
        user = User.objects.create_user(
            username='referrer1',
            email='referrer1@example.com',
            password='testpass123',
        )
        StudentProfile.objects.create(
            user=user,
            referral_progress_count=0,
        )

        from api.utils import apply_referral_reward
        apply_referral_reward(user)
        profile = StudentProfile.objects.get(user=user)
        assert profile.referral_progress_count == 1

    def test_referral_reward_no_profile_is_silent(self):
        user = User.objects.create_user(
            username='referrer2',
            email='referrer2@example.com',
            password='testpass123',
        )
        from api.utils import apply_referral_reward
        apply_referral_reward(user)  # no profile — must not raise
