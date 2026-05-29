# Thin re-export shim — real implementations in api/views/merchant/
from api.views.merchant.templates import (
    list_coupon_templates, get_coupon_template, create_coupon_template,
    update_coupon_template, delete_coupon_template, get_all_tags
)
from api.views.merchant.analytics import get_template_analytics
from api.views.merchant.redeem import (
    merchant_redeem, merchant_consolidate_coupon, refresh_redeem_code,
    generate_unified_redemption_code_view, upload_image
)
# Also re-export helpers used by other modules (e.g. qr_claim.py)
from api.views.merchant.helpers import get_merchant_store, haversine_distance

__all__ = [
    'list_coupon_templates',
    'get_coupon_template',
    'create_coupon_template',
    'update_coupon_template',
    'delete_coupon_template',
    'get_all_tags',
    'get_template_analytics',
    'merchant_redeem',
    'merchant_consolidate_coupon',
    'refresh_redeem_code',
    'generate_unified_redemption_code_view',
    'upload_image',
    'get_merchant_store',
    'haversine_distance',
]
