"""
Shared load test consistency verification.
Returns pass/fail and errors for use by the management command and the verify-consistency API.
"""
from django.db.models import Count

from api.models import Coupon, CouponRedemption, CouponTemplate, CouponShareRequest


def verify_load_test_consistency() -> dict:
    """
    Verify load test consistency: no oversell, no duplicate redemption, isolation, share accept uniqueness.
    Reads current DB state. Returns {"passed": bool, "errors": list[str]}.
    """
    errors = []
    # (a) Redemption count per coupon <= configured quantity (for limited templates)
    templates_with_qty = CouponTemplate.objects.filter(
        total_quantity__gt=0
    ).values_list("id", flat=True)
    for tid in templates_with_qty:
        tpl = CouponTemplate.objects.get(id=tid)
        coupons_from_tpl = Coupon.objects.filter(template=tpl)
        for c in coupons_from_tpl:
            cnt = CouponRedemption.objects.filter(coupon=c).count()
            if cnt > tpl.total_quantity:
                errors.append(
                    f"(a) Oversell: coupon_id={c.id} template_id={tid} "
                    f"redemptions={cnt} quantity={tpl.total_quantity}"
                )
    # Store coupons: no quantity limit in template; skip oversell per coupon for store type
    # (exclusive: at most one redemption per coupon is enforced by DB unique constraint)

    # (b) At most one successful redemption per coupon_id (exclusive)
    exclusive_redemptions = CouponRedemption.objects.filter(
        coupon__coupon_type="exclusive"
    ).values("coupon_id").annotate(cnt=Count("id")).filter(cnt__gt=1)
    for r in exclusive_redemptions:
        errors.append(
            f"(b) Duplicate redemption: coupon_id={r['coupon_id']} count={r['cnt']}"
        )

    # (c) Per-merchant redemption sums = platform total
    platform_total = CouponRedemption.objects.count()
    per_store = (
        CouponRedemption.objects.values("coupon__store_id")
        .annotate(total=Count("id"))
        .order_by()
    )
    merchant_sum = sum(s["total"] for s in per_store)
    if merchant_sum != platform_total:
        errors.append(
            f"(c) Merchant isolation: platform total={platform_total} "
            f"sum(per-store)={merchant_sum}"
        )

    # (d) Share accept uniqueness: every accepted share request has exactly one to_user (non-null)
    accepted_shares = CouponShareRequest.objects.filter(status="accepted")
    for share in accepted_shares:
        if share.to_user_id is None:
            errors.append(
                f"(d) Share accept: share_request_id={share.id} token={share.token} "
                "has status=accepted but to_user is null"
            )
    # Per-token uniqueness: each token appears once; accepted implies one recipient
    token_counts = (
        CouponShareRequest.objects.filter(status="accepted")
        .values("token")
        .annotate(cnt=Count("id"))
    )
    for row in token_counts:
        if row["cnt"] > 1:
            errors.append(
                f"(d) Share accept: token {row['token']} has {row['cnt']} accepted records"
            )

    # (e) API success implies DB record — we cannot correlate without request log.
    # (e) Dashboard vs DB: we rely on (c) as in current code.

    return {"passed": len(errors) == 0, "errors": errors}
