import logging
from datetime import timedelta, datetime, date as date_type
from zoneinfo import ZoneInfo

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from django.db.models import Sum, Value, DecimalField
from django.db.models.functions import Coalesce
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi

from ...models import Coupon, CouponRedemption, Log, CouponTemplate
from ...utils import get_store_today, get_store_currency_code
from ...exceptions import (
    NoStoreForMerchant,
    NotAMerchant,
    CouponTemplateNotFound,
    InvalidDateFormat,
    InvalidDateRange,
    DateRangeFuture,
    DateRangeTooLong,
)
from ...services.analytics_service import get_template_redemption_trend, get_template_view_trend
from .helpers import get_merchant_store

logger = logging.getLogger(__name__)


@swagger_auto_schema(
    method='get',
    operation_description="Get comprehensive analytics for a specific coupon template. For exclusive templates, includes count fields (retention_count, stranger_acquisition_count, redemption_count, circulation_count, circulation_redemption_count) alongside rate fields.",
    manual_parameters=[
        openapi.Parameter('days', openapi.IN_QUERY, description="Time range in days (3, 7, 30, or 90)", type=openapi.TYPE_INTEGER, default=30),
    ],
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_template_analytics(request, id):
    """
    Get comprehensive analytics for a specific coupon template.

    For EasyUse (store) templates:
    - 曝光次數 (exposure_count): Template view count
    - 轉換率 (conversion_rate): Redemptions / Exposures

    For Exclusive templates:
    - 曝光次數 (exposure_count): Template view count
    - 轉換率 (conversion_rate): Redemptions / Exposures
    - 留客率 (retention_rate): (Consolidate + QR-claim) redemptions / (Consolidate + QR-claim) issued
    - 陌生獲客率 (stranger_acquisition_rate): Non-(Consolidate + QR-claim) redemptions / Total redemptions
    - 流動率 (circulation_rate): (Transfer + Public pool) / Total coupons
    - 流動核銷率 (circulation_redemption_rate): (Transfer + Public pool redeemed) / (Transfer + Public pool)
    - 核銷率 (redemption_rate): Total redemptions / Issued count (已核銷數 / 已發出數)
    """
    user = request.user

    # Check if user is a merchant
    is_merchant = user.groups.filter(name='Merchant').exists()
    if not is_merchant:
        raise NotAMerchant(developer_message="User is not a merchant.")

    store = get_merchant_store(user)
    if not store:
        raise NoStoreForMerchant(developer_message="No store found for this merchant.")

    # Get template and verify ownership
    try:
        template = CouponTemplate.objects.get(id=id, store=store)
    except CouponTemplate.DoesNotExist:
        raise CouponTemplateNotFound(developer_message="Template not found or you do not have permission to access it.")

    # Time range: either date_from/date_to (ISO YYYY-MM-DD) or days fallback
    date_from_param = request.query_params.get('date_from')
    date_to_param = request.query_params.get('date_to')
    store_today = get_store_today(store)
    use_date_range = date_from_param and date_to_param

    if use_date_range:
        try:
            date_from = date_type.fromisoformat(date_from_param)
            date_to = date_type.fromisoformat(date_to_param)
        except (ValueError, TypeError):
            raise InvalidDateFormat(developer_message="Invalid date format. Use ISO date YYYY-MM-DD for date_from and date_to.")
        if date_to < date_from:
            raise InvalidDateRange(developer_message="End date must be on or after start date.")
        if date_to > store_today:
            raise DateRangeFuture(developer_message="End date must be on or before today (store timezone).")
        if (date_to - date_from).days > 730:
            raise DateRangeTooLong(developer_message="Date range cannot exceed 730 days (2 years).", context={"max_days": 730})
        tz_name = getattr(store, 'timezone', None) or 'Asia/Taipei'
        try:
            store_zone = ZoneInfo(tz_name)
        except Exception:
            store_zone = ZoneInfo('Asia/Taipei')
        range_start_naive = datetime.combine(date_from, datetime.min.time())
        range_end_naive = datetime.combine(date_to, datetime.max.time())
        time_threshold = timezone.make_aware(range_start_naive, store_zone)
        range_end_dt = timezone.make_aware(range_end_naive, store_zone)
        end_date_for_loop = date_to
        start_date_for_loop = date_from
    else:
        days = int(request.query_params.get('days', 30))
        if days not in [3, 7, 30, 90]:
            days = 30
        now = timezone.now()
        time_threshold = now - timedelta(days=days)
        range_end_dt = now
        end_date_for_loop = now.date()
        start_date_for_loop = time_threshold.date()

    now = timezone.now()

    # Base querysets filtered by template
    template_coupons = Coupon.objects.filter(template=template)
    template_redemptions = CouponRedemption.objects.filter(coupon__template=template)
    template_logs = Log.objects.filter(template=template)

    # Check if this is a store type template (EasyUse - total_quantity == 0)
    is_store_template = template.total_quantity == 0

    # For store templates (EasyUse), return exposure and conversion statistics
    if is_store_template:
        # 曝光次數 (Exposure Count): Template view count within selected time range
        template_view_logs = template_logs.filter(action='template_view')
        template_view_logs_in_range = template_view_logs.filter(
            timestamp__gte=time_threshold, timestamp__lte=range_end_dt
        )
        exposure_count = template_view_logs_in_range.count()

        # 轉換率 (Conversion Rate): Redemptions / Exposures within selected time range
        total_redemptions = CouponRedemption.objects.filter(
            coupon__template=template,
            coupon__coupon_type='store',
            redeemed_at__gte=time_threshold,
            redeemed_at__lte=range_end_dt,
        ).count()
        conversion_rate = total_redemptions / exposure_count if exposure_count > 0 else 0

        # Calculate trends (daily data) — use service for DB-aggregated queries (zero per-day hits)
        exposure_trend_data = []
        conversion_trend_data = []
        current_date = start_date_for_loop
        end_date = end_date_for_loop

        redemption_by_date = {
            row['date']: row['count']
            for row in get_template_redemption_trend(template.id, start_date_for_loop, end_date_for_loop)
        }
        view_by_date = {
            row['date']: row['count']
            for row in get_template_view_trend(template.id, start_date_for_loop, end_date_for_loop)
        }

        while current_date <= end_date:
            day_date = current_date.date() if hasattr(current_date, 'date') else current_date
            day_exposure_count = view_by_date.get(day_date, 0)
            day_redemptions = redemption_by_date.get(day_date, 0)

            # Daily conversion rate
            day_conversion_rate = day_redemptions / day_exposure_count if day_exposure_count > 0 else 0

            exposure_trend_data.append({
                'date': current_date.isoformat(),
                'value': day_exposure_count
            })

            conversion_trend_data.append({
                'date': current_date.isoformat(),
                'value': day_conversion_rate,  # Rate value for percentage view
                'count': day_redemptions  # Count value for count view (redemptions count)
            })

            current_date += timedelta(days=1)

        # Calculate averages
        exposure_avg = sum([d['value'] for d in exposure_trend_data]) / len(exposure_trend_data) if exposure_trend_data else 0
        conversion_avg = sum([d['value'] for d in conversion_trend_data]) / len(conversion_trend_data) if conversion_trend_data else 0

        # Store (EasyUse) templates: return only exposure_count and conversion_rate;
        # do not include redemption_count or other exclusive-only count fields per contract.
        return Response({
            'exposure_count': exposure_count,
            'conversion_rate': conversion_rate,
            'trends': {
                'exposure_count': {
                    'current': exposure_count,
                    'average': exposure_avg,
                    'daily_data': exposure_trend_data
                },
                'conversion_rate': {
                    'current': conversion_rate,
                    'average': conversion_avg,
                    'daily_data': conversion_trend_data
                }
            }
        }, status=status.HTTP_200_OK)

    # Calculate metrics for exclusive templates (aggregates within selected time range)
    exclusive_coupons = template_coupons.filter(coupon_type='exclusive')
    exclusive_redemptions = template_redemptions.filter(
        coupon__coupon_type='exclusive',
        redeemed_at__gte=time_threshold,
        redeemed_at__lte=range_end_dt,
    )
    exclusive_redemptions_count = exclusive_redemptions.count()

    # 1. 曝光次數 (Exposure Count): Template view count within selected time range
    template_view_logs = template_logs.filter(
        action='template_view',
        timestamp__gte=time_threshold,
        timestamp__lte=range_end_dt,
    )
    exposure_count = template_view_logs.count()

    # 2. 轉換率 (Conversion Rate): Redemptions / Exposures
    conversion_rate = exclusive_redemptions_count / exposure_count if exposure_count > 0 else 0

    # 3. 留客率 (Retention Rate): (電話歸戶 + QR領取) 核銷數 / (電話歸戶 + QR領取) 發放數
    RETENTION_ACQUISITION_METHODS = ('consolidate', 'qr_claim')
    retention_coupons = exclusive_coupons.filter(acquisition_method__in=RETENTION_ACQUISITION_METHODS)
    retention_issued_count = retention_coupons.count()
    retention_redemptions = exclusive_redemptions.filter(coupon__acquisition_method__in=RETENTION_ACQUISITION_METHODS)
    retention_redemption_count = retention_redemptions.count()
    retention_rate = retention_redemption_count / retention_issued_count if retention_issued_count > 0 else 0

    # 4. 陌生獲客率 (Stranger Acquisition Rate): 非(電話歸戶 + QR領取)核銷數 / 總核銷數
    non_retention_redemptions = exclusive_redemptions.exclude(
        coupon__acquisition_method__in=RETENTION_ACQUISITION_METHODS
    )
    non_retention_redemption_count = non_retention_redemptions.count()
    stranger_acquisition_rate = non_retention_redemption_count / exclusive_redemptions_count if exclusive_redemptions_count > 0 else 0

    # 5. 流動率 (Circulation Rate): (transfer + public_pool) / 總優惠數
    total_coupons = exclusive_coupons.count()  # 已發出數 (issued count)
    transfer_coupons = exclusive_coupons.filter(acquisition_method__in=['transfer', 'public_pool'])
    transfer_count = transfer_coupons.count()
    circulation_rate = transfer_count / total_coupons if total_coupons > 0 else 0

    # 6. 流動核銷率 (Circulation Redemption Rate): (transfer + public_pool 且已核銷) / 轉手優惠數
    transfer_redemptions = exclusive_redemptions.filter(coupon__acquisition_method__in=['transfer', 'public_pool'])
    transfer_redemption_count = transfer_redemptions.count()
    circulation_redemption_rate = transfer_redemption_count / transfer_count if transfer_count > 0 else 0

    # 7. 核銷率 (Redemption Rate): 已核銷數量 / 已發出數量
    redemption_rate = exclusive_redemptions_count / total_coupons if total_coupons > 0 else 0

    # Calculate trend data for all metrics (daily data)
    # Use service for DB-aggregated redemption/view queries (zero per-day hits).
    # Rate metrics that depend on per-day sub-filtering (retention, stranger, circulation)
    # still derive from the pre-fetched daily redemption total — no extra DB queries.
    current_date = start_date_for_loop
    end_date = end_date_for_loop

    excl_redemption_by_date = {
        row['date']: row['count']
        for row in get_template_redemption_trend(template.id, start_date_for_loop, end_date_for_loop)
    }
    excl_view_by_date = {
        row['date']: row['count']
        for row in get_template_view_trend(template.id, start_date_for_loop, end_date_for_loop)
    }

    # Initialize trend data structures
    exposure_trend_data = []
    conversion_trend_data = []
    retention_trend_data = []
    stranger_acquisition_trend_data = []
    circulation_trend_data = []
    circulation_redemption_trend_data = []
    redemption_trend_data = []

    while current_date <= end_date:
        day_date = current_date.date() if hasattr(current_date, 'date') else current_date
        day_exposure_count = excl_view_by_date.get(day_date, 0)
        day_exclusive_count = excl_redemption_by_date.get(day_date, 0)

        # Daily conversion rate
        day_conversion_rate = day_exclusive_count / day_exposure_count if day_exposure_count > 0 else 0

        # Daily retention/stranger/circulation rates reuse aggregate denominators;
        # per-day numerators require sub-filtering which stays in the exclusive_redemptions QS.
        # Build a tz-aware window for the sub-queries below (still needed for rate breakdowns).
        _tz_name = getattr(store, 'timezone', None) or 'Asia/Taipei'
        try:
            _excl_zone = ZoneInfo(_tz_name)
        except Exception:
            _excl_zone = ZoneInfo('Asia/Taipei')
        day_start = timezone.make_aware(datetime.combine(day_date, datetime.min.time()), _excl_zone)
        day_end = day_start + timedelta(days=1)

        day_exclusive_redemptions = exclusive_redemptions.filter(
            redeemed_at__gte=day_start,
            redeemed_at__lt=day_end
        )

        # Daily retention rate
        day_retention_redemption_count = day_exclusive_redemptions.filter(
            coupon__acquisition_method__in=RETENTION_ACQUISITION_METHODS
        ).count()
        day_retention_rate = day_retention_redemption_count / retention_issued_count if retention_issued_count > 0 else 0

        # Daily stranger acquisition rate
        day_non_retention_count = day_exclusive_redemptions.exclude(
            coupon__acquisition_method__in=RETENTION_ACQUISITION_METHODS
        ).count()
        day_stranger_rate = day_non_retention_count / day_exclusive_count if day_exclusive_count > 0 else 0

        # Daily circulation rate (constant denominator; no per-day DB query needed)
        day_circulation_rate = transfer_count / total_coupons if total_coupons > 0 else 0

        # Daily circulation redemption rate
        day_transfer_redemption_count = day_exclusive_redemptions.filter(
            coupon__acquisition_method__in=['transfer', 'public_pool']
        ).count()
        day_circulation_redemption_rate = day_transfer_redemption_count / transfer_count if transfer_count > 0 else 0

        # Daily redemption rate
        day_redemption_rate = day_exclusive_count / total_coupons if total_coupons > 0 else 0

        exposure_trend_data.append({
            'date': current_date.isoformat(),
            'value': day_exposure_count
        })

        conversion_trend_data.append({
            'date': current_date.isoformat(),
            'value': day_conversion_rate,
            'count': day_exclusive_count
        })

        retention_trend_data.append({
            'date': current_date.isoformat(),
            'value': day_retention_rate,
            'count': day_retention_redemption_count
        })

        stranger_acquisition_trend_data.append({
            'date': current_date.isoformat(),
            'value': day_stranger_rate,
            'count': day_non_retention_count
        })

        circulation_trend_data.append({
            'date': current_date.isoformat(),
            'value': day_circulation_rate,
            'count': transfer_count
        })

        circulation_redemption_trend_data.append({
            'date': current_date.isoformat(),
            'value': day_circulation_redemption_rate,
            'count': day_transfer_redemption_count
        })

        redemption_trend_data.append({
            'date': current_date.isoformat(),
            'value': day_redemption_rate,
            'count': day_exclusive_count
        })

        current_date += timedelta(days=1)

    # Calculate averages for all trends
    def calculate_average(trend_data):
        valid_values = [d['value'] for d in trend_data if d['value'] is not None]
        return sum(valid_values) / len(valid_values) if valid_values else 0

    exposure_avg = calculate_average(exposure_trend_data)
    conversion_avg = calculate_average(conversion_trend_data)
    retention_avg = calculate_average(retention_trend_data)
    stranger_avg = calculate_average(stranger_acquisition_trend_data)
    circulation_avg = calculate_average(circulation_trend_data)
    circulation_redemption_avg = calculate_average(circulation_redemption_trend_data)
    redemption_avg = calculate_average(redemption_trend_data)

    # 009 US2: Date-range cost for exclusive templates only (此區間成本)
    date_range_cost_result = exclusive_redemptions.aggregate(
        total=Sum(Coalesce('savings_amount', Value(0, output_field=DecimalField(max_digits=14, decimal_places=2))))
    )
    date_range_cost = float(date_range_cost_result['total'] or 0)
    date_range_cost_currency = get_store_currency_code(store)

    response_data = {
        'exposure_count': exposure_count,
        'conversion_rate': conversion_rate,
        'retention_rate': retention_rate,
        'stranger_acquisition_rate': stranger_acquisition_rate,
        'circulation_rate': circulation_rate,
        'circulation_redemption_rate': circulation_redemption_rate,
        'redemption_rate': redemption_rate,
        # Count fields (exclusive templates only)
        'retention_count': retention_redemption_count,
        'stranger_acquisition_count': non_retention_redemption_count,
        'redemption_count': exclusive_redemptions_count,
        'circulation_count': transfer_count,
        'circulation_redemption_count': transfer_redemption_count,
        'date_range_cost': date_range_cost,
        'trends': {
            'exposure_count': {
                'current': exposure_count,
                'average': exposure_avg,
                'daily_data': exposure_trend_data
            },
            'conversion_rate': {
                'current': conversion_rate,
                'average': conversion_avg,
                'daily_data': conversion_trend_data
            },
            'retention_rate': {
                'current': retention_rate,
                'average': retention_avg,
                'daily_data': retention_trend_data
            },
            'stranger_acquisition_rate': {
                'current': stranger_acquisition_rate,
                'average': stranger_avg,
                'daily_data': stranger_acquisition_trend_data
            },
            'circulation_rate': {
                'current': circulation_rate,
                'average': circulation_avg,
                'daily_data': circulation_trend_data
            },
            'circulation_redemption_rate': {
                'current': circulation_redemption_rate,
                'average': circulation_redemption_avg,
                'daily_data': circulation_redemption_trend_data
            },
            'redemption_rate': {
                'current': redemption_rate,
                'average': redemption_avg,
                'daily_data': redemption_trend_data
            }
        }
    }
    if date_range_cost_currency:
        response_data['date_range_cost_currency'] = date_range_cost_currency
    return Response(response_data, status=status.HTTP_200_OK)
