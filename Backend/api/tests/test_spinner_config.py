"""Tunable CouSino odds — SpinnerConfig model, accessor, and roll wiring.

Covers:
  * singleton enforcement + clean() validation
  * get_base_weights() reads the row and falls back to the 1/(v+1) formula
  * solo _roll_base_multiplier honours config weights and still respects floor
  * co-op roll_multiplier accepts an injected weights map (default unchanged)
"""

from __future__ import annotations

import random

import pytest
from django.core.exceptions import ValidationError

from api.models import SpinnerConfig
from api.services.spinner_config import formula_weights, get_base_weights
from api.services.spinner_coop_draw import roll_multiplier
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
