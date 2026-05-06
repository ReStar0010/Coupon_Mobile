from django.urls import path
from api.views.user_profile import (
    user_statistics, set_savings_goal, reset_savings_goal,
    coupon_history, coupon_history_detail, completed_goals, add_completed_goal,
    user_phone, progress_trackers,
)
from api.views.consumer_account_deletion import consumer_pre_delete_check, consumer_delete_account
from api.views.feedback import submit_feedback

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
]
