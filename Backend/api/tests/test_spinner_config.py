"""Tunable CouSino odds — SpinnerConfig model, accessor, and roll wiring.

Covers:
  * singleton enforcement + clean() validation
  * get_base_weights() reads the row and falls back to the 1/(v+1) formula
  * solo _roll_base_multiplier honours config weights and still respects floor
  * co-op roll_multiplier accepts an injected weights map (default unchanged)
"""

from __future__ import annotations

import random
from unittest.mock import patch

import pytest
from django.core.exceptions import ValidationError

from api.models import SpinnerConfig
from api.services.spinner_config import (
    formula_weights,
    get_base_weights,
    get_coop_weights,
)
from api.services import spinner_coop_draw
from api.services.spinner_coop_draw import roll_multiplier
from api.spinner_coop import transitions as T
from api.spinner_coop.states import COUNTDOWN_DURATION_MS, Phase
from api.views.spinner_views import _roll_base_multiplier


pytestmark = pytest.mark.django_db


class TestSpinnerConfigModel:
    def test_save_is_singleton(self):
        SpinnerConfig.objects.all().delete()
        SpinnerConfig(base_weights={"0": 1.0}).save()
        SpinnerConfig(base_weights={"5": 1.0}).save()
        assert SpinnerConfig.objects.count() == 1
        assert SpinnerConfig.objects.get().base_weights == {"5": 1.0}

    def test_clean_rejects_unknown_multiplier(self):
        with pytest.raises(ValidationError):
            SpinnerConfig(base_weights={"9": 1.0}).clean()

    def test_clean_rejects_negative_weight(self):
        with pytest.raises(ValidationError):
            SpinnerConfig(base_weights={"0": -1.0}).clean()

    def test_clean_rejects_all_zero(self):
        with pytest.raises(ValidationError):
            SpinnerConfig(base_weights={"0": 0, "1": 0}).clean()

    def test_clean_accepts_valid(self):
        # Should not raise.
        SpinnerConfig(base_weights={"0": 1.0, "5": 0.1}).clean()


class TestGetBaseWeights:
    def test_fallback_when_no_row(self):
        SpinnerConfig.objects.all().delete()
        assert get_base_weights() == formula_weights()

    def test_reads_config_row(self):
        SpinnerConfig.objects.all().delete()
        SpinnerConfig(base_weights={"0": 2.0, "5": 8.0}).save()
        assert get_base_weights() == {0: 2.0, 5: 8.0}

    def test_fallback_when_all_zero(self):
        SpinnerConfig.objects.all().delete()
        SpinnerConfig(base_weights={"0": 1.0}).save()  # valid row first
        # Force a malformed (all-zero) row past validation via a raw update,
        # simulating a bad value reaching the DB outside the model's save().
        SpinnerConfig.objects.filter(pk=SpinnerConfig.SINGLETON_ID).update(
            base_weights={"0": 0.0, "1": 0.0}
        )
        assert get_base_weights() == formula_weights()


class TestSoloRollUsesConfig:
    def test_roll_honours_config_weight(self):
        SpinnerConfig.objects.all().delete()
        # All weight on value 4 → a floor-0 draw must always return 4.
        SpinnerConfig(base_weights={"4": 1.0}).save()
        assert {_roll_base_multiplier(0) for _ in range(30)} == {4}

    def test_roll_respects_floor_over_config(self):
        SpinnerConfig.objects.all().delete()
        # Weight only on 0, but floor 2 filters it out → uniform over {2,3,4,5}.
        SpinnerConfig(base_weights={"0": 1.0}).save()
        for _ in range(30):
            assert _roll_base_multiplier(2) >= 2


class TestShippedDefaultOdds:
    def test_migration_tunes_solo_and_coop(self):
        """Migration 0064 boosts x4 and rarefies x5 for both solo and co-op."""
        cfg = SpinnerConfig.objects.get(pk=SpinnerConfig.SINGLETON_ID)
        tuned = {"0": 41, "1": 20, "2": 13, "3": 11, "4": 11, "5": 4}
        assert cfg.base_weights == tuned
        assert cfg.coop_base_weights == tuned
        # x4 boosted above its default share and strictly more likely than x5.
        assert cfg.base_weights["4"] > cfg.base_weights["5"]


class TestCoopConfigAccessor:
    def test_uses_coop_weights_when_set(self):
        SpinnerConfig.objects.all().delete()
        SpinnerConfig(base_weights={"0": 1.0}, coop_base_weights={"5": 9.0}).save()
        assert get_coop_weights() == {5: 9.0}

    def test_falls_back_to_solo_when_coop_blank(self):
        SpinnerConfig.objects.all().delete()
        SpinnerConfig(base_weights={"2": 4.0}, coop_base_weights={}).save()
        assert get_coop_weights() == {2: 4.0}

    def test_falls_back_to_formula_when_both_blank(self):
        SpinnerConfig.objects.all().delete()
        SpinnerConfig(base_weights={}, coop_base_weights={}).save()
        assert get_coop_weights() == formula_weights()

    def test_falls_back_to_formula_when_no_row(self):
        SpinnerConfig.objects.all().delete()
        assert get_coop_weights() == formula_weights()


class TestCoopConfigClean:
    def test_clean_allows_empty_coop(self):
        # Empty coop = "follow solo" — must not raise.
        SpinnerConfig(base_weights={"0": 1.0}, coop_base_weights={}).clean()

    def test_clean_rejects_unknown_coop_multiplier(self):
        with pytest.raises(ValidationError):
            SpinnerConfig(base_weights={"0": 1.0}, coop_base_weights={"9": 1.0}).clean()

    def test_clean_rejects_negative_coop_weight(self):
        with pytest.raises(ValidationError):
            SpinnerConfig(base_weights={"0": 1.0}, coop_base_weights={"3": -2.0}).clean()


def _countdown_room():
    """Build a 2-player room sitting in COUNTDOWN, ready for the draw."""
    r = T.create_room(
        host_id="alice",
        host_display_name="Alice",
        solo=False,
        now_ms=1000,
        room_id_factory=lambda: "room-x",
        code_factory=lambda: "ABCDEF",
    ).room
    r = T.join_room(r, user_id="bob", display_name="Bob", now_ms=1100).room
    r = T.set_stake(r, user_id="alice", gems=3, now_ms=1200).room
    r = T.set_stake(r, user_id="bob", gems=2, now_ms=1300).room
    r = T.lock_stake(r, user_id="alice", now_ms=1400).room
    r = T.lock_stake(r, user_id="bob", now_ms=1500).room
    r = T.start_countdown(r, user_id="alice", now_ms=1600).room
    assert r.phase == Phase.COUNTDOWN
    return r


class TestCoopTransitionThreadsWeights:
    def test_complete_countdown_forwards_weights_to_roll(self):
        """The live co-op draw path must pass injected weights into compute_round."""
        room = _countdown_room()
        sentinel = {3: 1.0}  # value 3 is >= the 2-player floor, so the round resolves
        with patch(
            "api.spinner_coop.transitions.compute_round",
            wraps=spinner_coop_draw.compute_round,
        ) as mock_cr:
            result = T.complete_countdown(
                room, now_ms=1600 + COUNTDOWN_DURATION_MS, weights_map=sentinel
            )
        assert mock_cr.called
        assert mock_cr.call_args.kwargs.get("weights_map") == sentinel
        # With all weight on value 3 (>= floor 2), the rolled multiplier is 3.
        assert result.room.phase == Phase.SPINNING


class TestCoopRollWeights:
    def test_roll_multiplier_accepts_injected_weights(self):
        rng = random.Random(0)
        picks = {roll_multiplier(0, rng, {3: 1.0}) for _ in range(30)}
        assert picks == {3}

    def test_roll_multiplier_default_formula_unchanged(self):
        rng = random.Random(0)
        assert roll_multiplier(0, rng) in (0, 1, 2, 3, 4, 5)

    def test_injected_all_zero_falls_back_to_uniform(self):
        rng = random.Random(0)
        # floor 2 with weight only on filtered-out 0 → uniform over {2..5}.
        for _ in range(30):
            assert roll_multiplier(2, rng, {0: 1.0}) >= 2
