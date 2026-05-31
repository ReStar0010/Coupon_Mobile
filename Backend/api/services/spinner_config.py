"""Accessor for the tunable CouSino spinner odds (solo + co-op).

Reads the ``SpinnerConfig`` singleton and returns a ``{value: weight}`` map for
the draw. Falls back to the legacy ``w(v) = 1/(v+1)`` formula whenever the row
is absent, empty, or invalid — which also covers the pre-migration and
DB-unavailable paths, so callers never have to special-case those.

Solo uses ``base_weights``; co-op uses ``coop_base_weights`` and falls back to
the solo weights when its own value is blank/malformed.

No caching: it is a single-PK lookup and draws are infrequent / rate-limited,
so the cost is negligible and we avoid per-worker LocMemCache staleness (the
project runs multiple Gunicorn workers with no shared cache backend).
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

#: Multiplier values that may appear on the wheel. Mirrors
#: api.models.SpinnerConfig.ALLOWED_VALUES and the FE constants.ts MULTS.
ALLOWED_VALUES: tuple[int, ...] = (0, 1, 2, 3, 4, 5)


def formula_weights() -> dict[int, float]:
    """Legacy inverse-probability weights: ``w(v) = 1/(v+1)``."""
    return {v: 1.0 / (v + 1) for v in ALLOWED_VALUES}


def _parse_weights(raw: object) -> dict[int, float] | None:
    """Coerce a stored weights map to ``{int: float}``; ``None`` if unusable.

    Skips unknown keys, non-numeric values, and negative weights. Returns
    ``None`` for an empty / malformed / all-zero map so callers can fall back.
    """
    if not raw or not isinstance(raw, dict):
        return None
    weights: dict[int, float] = {}
    for key, val in raw.items():
        try:
            value = int(key)
            weight = float(val)
        except (TypeError, ValueError):
            continue
        if value in ALLOWED_VALUES and weight >= 0:
            weights[value] = weight
    if not weights or sum(weights.values()) <= 0:
        return None
    return weights


def _read_config():
    """Return the SpinnerConfig singleton, or ``None`` if unavailable."""
    try:
        from api.models import SpinnerConfig

        return SpinnerConfig.objects.filter(pk=SpinnerConfig.SINGLETON_ID).first()
    except Exception as exc:  # noqa: BLE001 — pre-migration / DB unavailable → safe default
        logger.warning("spinner_config.read_failed", extra={"error": str(exc)})
        return None


def get_base_weights() -> dict[int, float]:
    """Active ``{multiplier: weight}`` map for the SOLO draw.

    Falls back to :func:`formula_weights` when the row/field is missing,
    empty, malformed, or the DB is unavailable.
    """
    cfg = _read_config()
    parsed = _parse_weights(getattr(cfg, "base_weights", None)) if cfg else None
    return parsed if parsed is not None else formula_weights()


def get_coop_weights() -> dict[int, float]:
    """Active ``{multiplier: weight}`` map for the CO-OP draw.

    Uses ``coop_base_weights`` when set; when that is blank/malformed it falls
    back to the solo weights (which themselves fall back to the formula). Reads
    the singleton once.
    """
    cfg = _read_config()
    if cfg is not None:
        coop = _parse_weights(getattr(cfg, "coop_base_weights", None))
        if coop is not None:
            return coop
        base = _parse_weights(getattr(cfg, "base_weights", None))
        if base is not None:
            return base
    return formula_weights()
