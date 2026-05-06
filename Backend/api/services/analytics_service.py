"""Analytics service — DB-aggregated trend queries for coupon templates."""
import logging
from datetime import date

from django.db.models import Count
from django.db.models.functions import TruncDate

logger = logging.getLogger(__name__)


def get_template_redemption_trend(template_id: int, start_date: date, end_date: date) -> list[dict]:
    """
    Return daily redemption counts using DB aggregation instead of per-day queries.

    Args:
        template_id: Primary key of the CouponTemplate.
        start_date: Inclusive start date.
        end_date: Inclusive end date.

    Returns:
        List of dicts with keys 'date' (date object) and 'count' (int),
        ordered by date ascending. Days with zero redemptions are omitted
        (caller must fill gaps when building a continuous chart).
    """
    from api.models import CouponRedemption

    return list(
        CouponRedemption.objects
        .filter(
            coupon__template_id=template_id,
            redeemed_at__date__range=(start_date, end_date),
        )
        .annotate(date=TruncDate('redeemed_at'))
        .values('date')
        .annotate(count=Count('id'))
        .order_by('date')
    )


def get_template_view_trend(template_id: int, start_date: date, end_date: date) -> list[dict]:
    """
    Return daily view counts using DB aggregation instead of per-day queries.

    Args:
        template_id: Primary key of the CouponTemplate.
        start_date: Inclusive start date.
        end_date: Inclusive end date.

    Returns:
        List of dicts with keys 'date' (date object) and 'count' (int),
        ordered by date ascending. Days with zero views are omitted.
    """
    from api.models import Log

    return list(
        Log.objects
        .filter(
            template_id=template_id,
            action='template_view',
            timestamp__date__range=(start_date, end_date),
        )
        .annotate(date=TruncDate('timestamp'))
        .values('date')
        .annotate(count=Count('id'))
        .order_by('date')
    )
