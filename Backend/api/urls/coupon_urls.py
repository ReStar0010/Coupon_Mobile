from django.urls import path
from api.views.coupon_views import (
    get_store_coupons, get_exclusive_coupons, get_coupon_detail,
    redeem_coupon, validate_unified_redemption_code,
)
from api.views.coupon_list_view import list_my_coupons
from api.views.coupon_receive_view import receive_coupon
from api.views.platform_voucher_views import (
    redeem_platform_voucher,
    platform_voucher_list,
    platform_voucher_detail,
    share_platform_voucher,
    get_platform_voucher_share,
    accept_platform_voucher_share,
    share_platform_voucher_public,
    my_public_voucher_shares,
)
from api.views.sharing_views import (
    share_coupon,
    get_share_request,
    accept_share_request,
    share_coupon_public,
    get_my_public_shares,
    withdraw_public_share,
)
from api.views.daily_draw import (
    get_daily_draw_templates, draw_coupon, draw_history, get_last_draw_time,
)
from api.views.events import track_template_view
from api.views.merchant_coupon import get_all_tags
from api.views.qr_claim import claim_coupon_via_qr

app_name = 'coupons'

urlpatterns = [
    # Phase 3: my-coupons list (FE-shaped projection of current_holder=user exclusives)
    path('coupons/', list_my_coupons, name='list_my_coupons'),

    # Store and exclusive coupons
    path('store-coupons/', get_store_coupons),
    path('exclusive-coupons/', get_exclusive_coupons),
    path('coupons/<int:id>/', get_coupon_detail),
    path('redeem/<int:id>/', redeem_coupon),

    # Phase 3: alias routes matching the FE service module path family.
    # These reuse the existing view functions verbatim — no logic change.
    path('coupons/<int:id>/redeem/', redeem_coupon, name='alias_redeem_coupon'),

    # Unified redemption
    path('unified-redemption/<str:code>/', validate_unified_redemption_code, name='validate_unified_redemption_code'),

    # Platform vouchers
    path('platform-vouchers/', platform_voucher_list, name='platform_voucher_list'),
    path('platform-vouchers/<int:pk>/', platform_voucher_detail, name='platform_voucher_detail'),
    path('platform-voucher/<int:voucher_id>/redeem/', redeem_platform_voucher, name='redeem_platform_voucher'),
    path('platform-voucher/<int:voucher_id>/share/', share_platform_voucher, name='share_platform_voucher'),
    path('platform-voucher/<int:voucher_id>/share-public/', share_platform_voucher_public, name='share_platform_voucher_public'),
    path('platform-voucher/share/<str:token>/', get_platform_voucher_share, name='get_platform_voucher_share'),
    path('platform-voucher/share/<str:token>/accept/', accept_platform_voucher_share, name='accept_platform_voucher_share'),
    path('my-public-voucher-shares/', my_public_voucher_shares, name='my_public_voucher_shares'),

    # Event tracking
    path('events/template-view/', track_template_view, name='track_template_view'),

    # Daily draw
    path('daily-draw-templates/', get_daily_draw_templates, name='daily_draw_templates'),
    path('coupon/daily-draw/', draw_coupon, name='daily_draw'),
    path('coupon/draw-history/', draw_history, name='draw_history'),
    path('last-draw/', get_last_draw_time, name='get_last_draw_time'),

    # Coupon sharing
    path('coupon/<int:coupon_id>/share/', share_coupon, name='share_coupon'),
    # Phase 3 alias matching the FE service path family.
    path('coupons/<int:coupon_id>/share/', share_coupon, name='alias_share_coupon'),
    path('coupon/<int:coupon_id>/share-public/', share_coupon_public, name='share_coupon_public'),
    path('coupon/share/<str:token>/', get_share_request, name='get_share_request'),
    path('coupon/share/<str:token>/accept/', accept_share_request, name='accept_share_request'),
    path('my-public-shares/', get_my_public_shares, name='get_my_public_shares'),
    path('coupon/share-public/<int:share_id>/withdraw/', withdraw_public_share, name='withdraw_public_share'),

    # Tags
    path('tags/', get_all_tags, name='get_all_tags'),

    # QR claim (consumer side)
    path('qr-claim/claim/', claim_coupon_via_qr, name='claim_coupon_via_qr'),

    # Phase 5: scan-to-receive flow for the mobile CouponReceiveQRScreen.
    # Thin wrapper that takes a single qrToken and delegates to the
    # claim-by-token path of claim_coupon_via_qr.
    path('coupon/receive/', receive_coupon, name='receive_coupon'),
]
