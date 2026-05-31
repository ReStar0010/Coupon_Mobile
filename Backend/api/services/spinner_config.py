"""Accessor for the tunable CouSino (solo spinner) odds.

Reads the ``SpinnerConfig`` singleton and returns a ``{value: weight}`` map for
the solo draw. Falls back to the legacy ``w(v) = 1/(v+1)`` formula whenever the
row is absent, empty, or invalid — which also covers the pre-migration and
DB-unavailable paths, so callers never have to special-case those.

No caching: it is a single-PK lookup and solo draws are rate-limited, so the
cost is negligible and we avoid per-worker LocMemCache staleness (the project
runs multiple Gunicorn workers with no shared cache backend configured).
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


def get_base_weights() -> dict[int, float]:
    """Return the active ``{multiplier: weight}`` map for the solo draw.

    Reads the ``SpinnerConfig`` singleton; falls back to :func:`formula_weights`
    when the row is missing, empty, malformed, or the DB is unavailable.
    """
    try:
        from api.models import SpinnerConfig

        cfg = SpinnerConfig.objects.filter(pk=SpinnerConfig.SINGLETON_ID).first()
    except Exception as exc:  # noqa: BLE001 — pre-migration / DB unavailable → safe default
        logger.warning("spinner_config.read_failed", extra={"error": str(exc)})
        return formula_weights()

    if not cfg or not cfg.base_weights:
        return formula_weights()

    weights: dict[int, float] = {}
    for key, raw in cfg.base_weights.items():
        try:
            value = int(key)
            weight = float(raw)
        except (TypeError, ValueError):
            continue
        if value in ALLOWED_VALUES and weight >= 0:
            weights[value] = weight

    if not weights or sum(weights.values()) <= 0:
        # Malformed or all-zero config — don't let it brick the spinner.
        return formula_weights()
    return weights
