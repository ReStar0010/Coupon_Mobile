from django.urls import path
from api.views.web_v1.merchants import merchant_coupons
from api.views.web_v1.coupons import coupon_detail as web_coupon_detail
from api.views.web_v1.sessions import resolve_session
from api.views.web_v1.fixed_sessions import resolve_fixed_session
from api.views.web_v1.shares import share_detail
from api.views.web_v1.redemptions import create_redemption
from api.views.web_v1.points import points_lookup

app_name = 'web_v1'

urlpatterns = [
    path('web/v1/merchants/<int:store_id>/coupons/', merchant_coupons, name='web_merchant_coupons'),
    path('web/v1/coupons/<int:template_id>/', web_coupon_detail, name='web_coupon_detail'),
    path('web/v1/sessions/<str:session_token>/resolve/', resolve_session, name='web_resolve_session'),
    path('web/v1/fixed-sessions/<str:session_token>/resolve/', resolve_fixed_session, name='web_resolve_fixed_session'),
    path('web/v1/shares/<str:share_token>/', share_detail, name='web_share_detail'),
    path('web/v1/redemptions/', create_redemption, name='web_create_redemption'),
    path('web/v1/points/lookup/', points_lookup, name='web_points_lookup'),
]
