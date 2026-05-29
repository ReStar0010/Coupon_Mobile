"""
Tests for the spinner co-op draw helper.

Covers:
  - floor_multiplier() across the (G, P) grid
  - roll_multiplier(): range respected, inverse-probability bias
  - multinomial_draw(): total preservation, weight bias, edge cases
  - compute_round(): payout invariant Σshare = G·M, floor/excess decomposition,
                     stake bias, input validation, deterministic with seeded RNG.

The payout invariant is checked across many seeds and stake configurations to
catch any future regression in the random distribution code.
"""

from __future__ import annotations

import random
import pytest

from api.services.spinner_coop_draw import (
    MAX_PLAYERS,
    MULTIPLIERS,
    PlayerStake,
    compute_round,
    floor_multiplier,
    multinomial_draw,
    roll_multiplier,
)


# ---------------------------------------------------------------------------
# floor_multiplier
# ---------------------------------------------------------------------------

class TestFloorMultiplier:
    @pytest.mark.parametrize(
        "G,P,expected",
        [
            (1, 1, 0),  # solo, low stake
            (2, 1, 0),
            (3, 1, 1),  # solo crosses G≥3 threshold
            (5, 1, 1),
            (2, 2, 2),  # 2 players: P term dominates
            (3, 2, 2),
            (10, 2, 2),
            (3, 3, 3),  # 3 players
            (15, 3, 3),
        ],
    )
    def test_grid(self, G, P, expected):
        assert floor_multiplier(G, P) == expected

    def test_invalid_inputs(self):
        with pytest.raises(ValueError):
            floor_multiplier(-1, 1)
        with pytest.raises(ValueError):
            floor_multiplier(5, 0)


# ---------------------------------------------------------------------------
# roll_multiplier
# ---------------------------------------------------------------------------

class TestRollMultiplier:
    def test_within_floor_range(self):
        rng = random.Random(42)
        for _ in range(200):
            assert 2 <= roll_multiplier(2, rng) <= 5

    def test_floor_zero_includes_zero(self):
        rng = random.Random(0)
        seen = {roll_multiplier(0, rng) for _ in range(500)}
        assert 0 in seen
        assert seen.issubset(set(MULTIPLIERS))

    def test_floor_three_excludes_low_values(self):
        rng = random.Random(0)
        for _ in range(200):
            assert roll_multiplier(3, rng) >= 3

    def test_inverse_probability_bias(self):
        """w(v) = 1/(v+1) → lower multipliers strictly more frequent over a large sample."""
        rng = random.Random(123)
        N = 50_000
        counts = {v: 0 for v in MULTIPLIERS}
        for _ in range(N):
            counts[roll_multiplier(0, rng)] += 1
        for v in range(MULTIPLIERS[-1]):
            assert counts[v] > counts[v + 1], (
                f"expected count({v})>count({v+1}); got {counts[v]} vs {counts[v+1]}"
            )

    def test_invalid_floor(self):
        with pytest.raises(ValueError):
            roll_multiplier(-1, random.Random(0))
        with pytest.raises(ValueError):
            roll_multiplier(99, random.Random(0))


# ---------------------------------------------------------------------------
# multinomial_draw
# ---------------------------------------------------------------------------

class TestMultinomialDraw:
    def test_total_preserved(self):
        rng = random.Random(7)
        for _ in range(100):
            total = rng.randint(0, 30)
            weights = [rng.randint(1, 5) for _ in range(rng.randint(1, 3))]
            assert sum(multinomial_draw(total, weights, rng)) == total

    def test_zero_total(self):
        assert multinomial_draw(0, [3, 1, 2], random.Random(0)) == [0, 0, 0]

    def test_single_bin(self):
        assert multinomial_draw(10, [5], random.Random(0)) == [10]

    def test_weight_bias(self):
        rng = random.Random(99)
        N = 5_000
        acc = [0, 0]
        for _ in range(N):
            counts = multinomial_draw(10, [9, 1], rng)
            acc[0] += counts[0]
            acc[1] += counts[1]
        ratio = acc[0] / sum(acc)
        # Heavily weighted bin should land ~90% of units
        assert 0.85 < ratio < 0.95, ratio

    def test_negative_total_rejected(self):
        with pytest.raises(ValueError):
            multinomial_draw(-1, [1], random.Random(0))

    def test_negative_weight_rejected(self):
        with pytest.raises(ValueError):
            multinomial_draw(5, [1, -1], random.Random(0))

    def test_zero_bins_with_zero_total(self):
        assert multinomial_draw(0, [], random.Random(0)) == []

    def test_zero_bins_with_nonzero_total_rejected(self):
        with pytest.raises(ValueError):
            multinomial_draw(5, [], random.Random(0))


# ---------------------------------------------------------------------------
# compute_round — invariants
# ---------------------------------------------------------------------------

class TestComputeRoundInvariants:
    """The most important section: Σshare == G·M must always hold."""

    @pytest.mark.parametrize("seed", range(50))
    def test_solo_invariant(self, seed):
        r = compute_round([PlayerStake("a", 0, 3)], rng=random.Random(seed))
        assert sum(s.share for s in r.shares) == r.G_total * r.M
        assert r.G_total == 3 and r.P == 1

    @pytest.mark.parametrize("seed", range(50))
    def test_two_player_invariant(self, seed):
        r = compute_round(
            [PlayerStake("a", 0, 3), PlayerStake("b", 1, 2)],
            rng=random.Random(seed),
        )
        assert sum(s.share for s in r.shares) == r.G_total * r.M
        assert r.G_total == 5 and r.P == 2

    @pytest.mark.parametrize("seed", range(50))
    def test_three_player_invariant(self, seed):
        r = compute_round(
            [
                PlayerStake("a", 0, 5),
                PlayerStake("b", 1, 3),
                PlayerStake("c", 2, 1),
            ],
            rng=random.Random(seed),
        )
        assert sum(s.share for s in r.shares) == r.G_total * r.M

    @pytest.mark.parametrize(
        "stakes",
        [
            [1, 1, 1],
            [5, 5, 5],
            [1, 5],
            [3, 3],
            [1, 1, 5],
            [2, 4, 3],
            [5],
        ],
    )
    @pytest.mark.parametrize("seed", range(15))
    def test_all_stake_combos(self, stakes, seed):
        players = [PlayerStake(f"u{i}", i, s) for i, s in enumerate(stakes)]
        r = compute_round(players, rng=random.Random(seed))
        # Σshare == G·M
        assert sum(s.share for s in r.shares) == r.G_total * r.M
        # share_i decomposition
        for s in r.shares:
            assert s.floor == s.stake * r.f
            assert s.excess >= 0
            assert s.share == s.floor + s.excess
        # excess sum
        assert sum(s.excess for s in r.shares) == r.G_total * (r.M - r.f)

    def test_floor_only_round_when_M_equals_f(self):
        """Force a roll where M == f → all excess should be zero."""
        # 3 players × stake 5 → G=15, P=3, f=3. If we engineer rng so M=3,
        # excess_total = 15·0 = 0 → every share == stake·f
        players = [PlayerStake(f"u{i}", i, 5) for i in range(3)]
        rng = random.Random(0)
        # find a seed/state where M == f deterministically
        for _ in range(2000):
            r = compute_round(players, rng=rng)
            if r.M == r.f:
                assert all(s.excess == 0 for s in r.shares)
                assert all(s.share == s.stake * r.f for s in r.shares)
                return
        pytest.skip("did not hit M == f within 2000 rolls; bump iterations or seed")


# ---------------------------------------------------------------------------
# compute_round — distribution properties
# ---------------------------------------------------------------------------

class TestComputeRoundDistribution:
    def test_stake_weighted_excess(self):
        """Player staking 5 should accumulate ~5x more excess than player staking 1."""
        rng = random.Random(2024)
        N = 2_000
        excess_a = excess_b = 0
        for _ in range(N):
            r = compute_round(
                [PlayerStake("a", 0, 5), PlayerStake("b", 1, 1)], rng=rng
            )
            ea, eb = (s.excess for s in r.shares)
            excess_a += ea
            excess_b += eb
        if excess_a + excess_b == 0:
            pytest.fail("no excess generated across 2000 rolls")
        ratio = excess_a / (excess_a + excess_b)
        # 5/(5+1) = 0.833 expected; allow generous tolerance
        assert 0.78 < ratio < 0.88, f"got ratio {ratio}"


# ---------------------------------------------------------------------------
# compute_round — input validation
# ---------------------------------------------------------------------------

class TestComputeRoundValidation:
    def test_no_players_rejected(self):
        with pytest.raises(ValueError, match="at least one"):
            compute_round([])

    def test_too_many_players_rejected(self):
        too_many = [PlayerStake(f"u{i}", i, 1) for i in range(MAX_PLAYERS + 1)]
        with pytest.raises(ValueError, match="too many"):
            compute_round(too_many)

    def test_stake_below_min_rejected(self):
        with pytest.raises(ValueError, match="stake"):
            compute_round([PlayerStake("a", 0, 0)])

    def test_stake_above_max_rejected(self):
        with pytest.raises(ValueError, match="stake"):
            compute_round([PlayerStake("a", 0, 6)])

    def test_duplicate_seats_rejected(self):
        with pytest.raises(ValueError, match="duplicate seats"):
            compute_round(
                [PlayerStake("a", 0, 1), PlayerStake("b", 0, 2)]
            )

    def test_tuple_input_accepted(self):
        r = compute_round([("a", 0, 3)], rng=random.Random(0))
        assert r.shares[0].user_id == "a"
        assert r.shares[0].stake == 3


# ---------------------------------------------------------------------------
# compute_round — determinism with seeded RNG
# ---------------------------------------------------------------------------

class TestComputeRoundDeterminism:
    def test_same_seed_same_outcome(self):
        players = [PlayerStake("a", 0, 3), PlayerStake("b", 1, 2)]
        r1 = compute_round(players, rng=random.Random(42))
        r2 = compute_round(players, rng=random.Random(42))
        assert r1 == r2

    def test_different_seed_can_differ(self):
        """Sanity: across many seeds at least two should differ; tests that we're not constant."""
        players = [PlayerStake("a", 0, 3), PlayerStake("b", 1, 2)]
        results = {compute_round(players, rng=random.Random(s)) for s in range(50)}
        assert len(results) > 1
