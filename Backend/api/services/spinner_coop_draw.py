"""
Spinner Co-op — server-authoritative randomness.

Pure functions only. No DB, no IO, no Django dependencies. The WS consumer
(deliverable 3) wraps these calls in a single atomic transaction at the
CHARGING -> SPINNING transition.

Math (locked spec):
    G_i ∈ {1..5}              per-player gem stake
    G   = Σ G_i               total gems
    P                         number of players
    f   = max(𝟙[G≥3], P·𝟙[P≥2])    floor multiplier
    M   ∈ {f..5}              spinner multiplier (inverse-probability)
    floor_i  = G_i · f
    excess_i ≥ 0              from a multinomial draw, stake-weighted
    share_i  = floor_i + excess_i

Invariants enforced before returning:
    Σ share_i        == G · M
    share_i          == floor_i + excess_i
    floor_i          == G_i · f
    Σ excess_i       == G · (M − f)
    excess_i         ≥ 0

References:
- specs/spinner-coop/state-machine-and-events.md §2.3 (side effects), §3.3 (room.reveal)
- Mobile-Frontend/src/features/spinner/constants.ts (mirrors MULTIPLIERS, getFloor)
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Iterable, Sequence

# ---------------------------------------------------------------------------
# Domain constants — must mirror Mobile-Frontend/src/features/spinner/constants.ts
# ---------------------------------------------------------------------------

#: Allowed multiplier values on the spinner wheel.
MULTIPLIERS: tuple[int, ...] = (0, 1, 2, 3, 4, 5)

#: Allowed per-player stake range (inclusive).
STAKE_MIN: int = 1
STAKE_MAX: int = 5

#: Maximum players in a co-op room.
MAX_PLAYERS: int = 3


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------

def floor_multiplier(gems_total: int, num_players: int) -> int:
    """
    f = max(𝟙[G≥3], P·𝟙[P≥2]).

    Mirrors `getFloor(gems, players)` in Mobile-Frontend/src/features/spinner/constants.ts.
    """
    if gems_total < 0 or num_players < 1:
        raise ValueError(f"invalid inputs: G={gems_total}, P={num_players}")
    indicator_g = 1 if gems_total >= 3 else 0
    indicator_p = num_players if num_players >= 2 else 0
    return max(indicator_g, indicator_p)


def roll_multiplier(floor: int, rng: random.Random) -> int:
    """
    Draw M from {floor..5} weighted by w(v) = 1/(v+1) (inverse probability).

    Lower multipliers are more likely; the wheel never lands below the floor.
    """
    if floor < 0 or floor > MULTIPLIERS[-1]:
        raise ValueError(f"floor {floor} outside multiplier range")
    available = [v for v in MULTIPLIERS if v >= floor]
    weights = [1.0 / (v + 1) for v in available]
    [pick] = rng.choices(available, weights=weights, k=1)
    return pick


def multinomial_draw(
    total: int, weights: Sequence[int], rng: random.Random
) -> list[int]:
    """
    Distribute `total` indivisible units across len(weights) bins.

    Each unit independently lands in bin i with probability
    weights[i] / sum(weights). Sequential Bernoulli — O(total · n).

    Bounded by spec: total ≤ G·(M−f) ≤ 15·5 = 75; n ≤ 3.
    """
    n = len(weights)
    if total < 0:
        raise ValueError(f"total must be non-negative; got {total}")
    if n == 0:
        if total != 0:
            raise ValueError("cannot distribute non-zero total over zero bins")
        return []
    if any(w < 0 for w in weights):
        raise ValueError("weights must be non-negative")

    if total == 0:
        return [0] * n

    cumulative: list[float] = []
    s = 0.0
    for w in weights:
        s += w
        cumulative.append(s)
    if s == 0:
        # Degenerate (all zero weights). Spread uniformly as a last resort.
        cumulative = [i + 1 for i in range(n)]
        s = float(n)

    counts = [0] * n
    for _ in range(total):
        r = rng.random() * s
        for i, c in enumerate(cumulative):
            if r < c:
                counts[i] += 1
                break
    return counts


# ---------------------------------------------------------------------------
# Public dataclasses
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class PlayerStake:
    """Input row to compute_round."""
    user_id: str
    seat: int
    stake: int  # G_i ∈ {1..5}


@dataclass(frozen=True)
class PlayerShare:
    """Output row inside RoundResult.shares."""
    user_id: str
    seat: int
    stake: int
    floor: int  # G_i · f
    excess: int  # R_i, multinomial draw
    share: int  # floor + excess


@dataclass(frozen=True)
class RoundResult:
    """Authoritative outcome of one spin. Maps directly onto room.reveal payload."""
    M: int
    G_total: int
    f: int
    P: int
    total_payout: int  # G · M
    shares: tuple[PlayerShare, ...]


# ---------------------------------------------------------------------------
# Top-level entry point
# ---------------------------------------------------------------------------

def compute_round(
    players: Iterable[PlayerStake | tuple[str, int, int]],
    rng: random.Random | None = None,
) -> RoundResult:
    """
    Roll one co-op round and return the authoritative outcome.

    Args:
        players: 1..MAX_PLAYERS players. Each is either a PlayerStake or a
                 (user_id, seat, stake) tuple. Stakes must be in [STAKE_MIN, STAKE_MAX].
        rng:     Random source. Defaults to `random.SystemRandom()` for production
                 cryptographic-grade randomness; tests pass a seeded `random.Random`.

    Raises:
        ValueError on invalid inputs.
        AssertionError on internal invariant violation (should never happen).
    """
    if rng is None:
        rng = random.SystemRandom()

    normalized: list[PlayerStake] = []
    for p in players:
        if isinstance(p, PlayerStake):
            normalized.append(p)
        else:
            user_id, seat, stake = p
            normalized.append(PlayerStake(user_id=user_id, seat=seat, stake=stake))

    if not normalized:
        raise ValueError("compute_round requires at least one player")
    if len(normalized) > MAX_PLAYERS:
        raise ValueError(f"too many players ({len(normalized)} > {MAX_PLAYERS})")

    seats = [p.seat for p in normalized]
    if len(set(seats)) != len(seats):
        raise ValueError(f"duplicate seats: {seats}")

    for p in normalized:
        if not (STAKE_MIN <= p.stake <= STAKE_MAX):
            raise ValueError(
                f"player {p.user_id} stake {p.stake} outside [{STAKE_MIN},{STAKE_MAX}]"
            )

    P = len(normalized)
    G = sum(p.stake for p in normalized)
    f = floor_multiplier(G, P)
    M = roll_multiplier(f, rng)

    floors = [p.stake * f for p in normalized]
    excess_total = G * (M - f)
    excesses = multinomial_draw(
        excess_total, [p.stake for p in normalized], rng
    )

    shares = tuple(
        PlayerShare(
            user_id=p.user_id,
            seat=p.seat,
            stake=p.stake,
            floor=floor_val,
            excess=excess_val,
            share=floor_val + excess_val,
        )
        for p, floor_val, excess_val in zip(normalized, floors, excesses)
    )

    expected_total = G * M
    actual_total = sum(s.share for s in shares)
    if actual_total != expected_total:
        raise AssertionError(
            f"payout invariant violated: Σshare={actual_total}, expected G·M={expected_total} "
            f"(G={G}, M={M}, f={f})"
        )
    if any(s.excess < 0 for s in shares):
        raise AssertionError(f"negative excess in {shares}")
    if any(s.floor != s.stake * f for s in shares):
        raise AssertionError(f"floor != stake·f in {shares}")

    return RoundResult(
        M=M,
        G_total=G,
        f=f,
        P=P,
        total_payout=expected_total,
        shares=shares,
    )
