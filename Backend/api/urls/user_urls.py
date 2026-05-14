from django.urls import path
from api.views.user_profile import (
    user_statistics, set_savings_goal, reset_savings_goal,
    coupon_history, coupon_history_detail, completed_goals, add_completed_goal,
    user_phone, progress_trackers,
)
from api.views.consumer_account_deletion import consumer_pre_delete_check, consumer_delete_account
from api.views.feedback import submit_feedback
from api.views.wallet_views import get_transaction, get_wallet, list_transactions
from api.views.profile_views import profile
from api.views.spinner_views import get_spinner_state, post_spinner_draw
from api.views.coupoint_views import use_coupoints
from api.views.merchant_discovery_views import (
    list_nearby_merchants,
    get_merchant_detail,
    list_blocked_merchants,
    flag_merchant,
    block_unblock_merchant,
)

app_name = 'users'

urlpatterns = [
    # User statistics and savings
    path('progress-trackers/', progress_trackers, name='progress_trackers'),
    path('user-statistics/', user_statistics, name='user_statistics'),
    path('set-savings-goal/', set_savings_goal, name='set_savings_goal'),
    path('completed-goals/', completed_goals, name='completed_goals'),
    path('add-completed-goal/', add_completed_goal, name='add_completed_goal'),
    path('reset-savings-goal/', reset_savings_goal, name='reset_savings_goal'),

    # Feedback
    path('feedback/', submit_feedback, name='feedback'),

    # Phone management
    path('user/phone/', user_phone, name='user_phone'),

    # Coupon history
    path('coupon-history/', coupon_history, name='coupon_history'),
    path('coupon-history/<int:id>/', coupon_history_detail, name='coupon_history_detail'),

    # Consumer account deletion (App Store compliance)
    path('account/pre-delete-check/', consumer_pre_delete_check, name='consumer_pre_delete_check'),
    path('account/delete/', consumer_delete_account, name='consumer_delete_account'),

    # Wallet read (Phase 1) — single-source-of-truth gem + couPoint balance
    path('wallet/', get_wallet, name='get_wallet'),

    # Wallet ledger (Phase 8) — paginated transaction history + single-row detail
    path('wallet/transactions/', list_transactions, name='list_wallet_transactions'),
    path('wallet/transactions/<int:id>/', get_transaction, name='get_wallet_transaction'),

    # Consumer profile (Phase 1) — FE-contract-shaped projection of User+StudentProfile
    path('profile/', profile, name='profile'),

    # Solo spinner (Phase 2) — server-authoritative draw + state
    path('spinner/', get_spinner_state, name='get_spinner_state'),
    path('spinner/draw/', post_spinner_draw, name='post_spinner_draw'),

    # CouPoint spend (Phase 2)
    path('coupoints/use/', use_coupoints, name='use_coupoints'),

    # Phase 4: Merchant discovery + sheet data (FE-shaped)
    path('merchants/nearby/', list_nearby_merchants, name='list_nearby_merchants'),
    path('merchants/blocked/', list_blocked_merchants, name='list_blocked_merchants'),
    path('merchants/<int:id>/', get_merchant_detail, name='get_merchant_detail'),
    path('merchants/<int:id>/flag/', flag_merchant, name='flag_merchant'),
    path('merchants/<int:id>/block/', block_unblock_merchant, name='block_merchant_alias'),
]
