from django.urls import path
from api.views.content_moderation import (
    ReportContentView, ReportStatusView, UserReportsView,
    BlockMerchantView, UnblockMerchantView, BlockedMerchantsListView, BlockStatusView,
)
from api.views.eula_acceptance import (
    ContentGuidelinesView, PrivacyPolicyView, TermsOfServiceView,
)
from api.views.admin_moderation import (
    ModerationQueueView, ReportDetailView, ModerationActionView,
    EscalatedReportsView, MerchantViolationsView, ModerationStatsView,
)

app_name = 'moderation'

urlpatterns = [
    # Content reporting (UGC Compliance - User Story 1)
    path('content/<str:content_type>/<int:content_id>/report/', ReportContentView.as_view(), name='report_content'),
    path('content/<str:content_type>/<int:content_id>/report/status/', ReportStatusView.as_view(), name='report_status'),
    path('user/reports/', UserReportsView.as_view(), name='user_reports'),

    # Merchant blocking (UGC Compliance - User Story 2)
    path('user/blocked-merchants/', BlockedMerchantsListView.as_view(), name='blocked_merchants_list'),
    path('user/blocked-merchants/add/', BlockMerchantView.as_view(), name='block_merchant'),
    path('user/blocked-merchants/<int:store_id>/', UnblockMerchantView.as_view(), name='unblock_merchant'),
    path('store/<int:store_id>/block-status/', BlockStatusView.as_view(), name='block_status'),

    # Public legal content (UGC Compliance - User Story 5)
    path('content-guidelines/', ContentGuidelinesView.as_view(), name='content_guidelines'),
    path('privacy-policy/', PrivacyPolicyView.as_view(), name='privacy_policy'),
    path('terms/', TermsOfServiceView.as_view(), name='terms_of_service'),

    # Admin moderation dashboard (UGC Compliance - User Story 4)
    path('admin/moderation/queue/', ModerationQueueView.as_view(), name='moderation_queue'),
    path('admin/moderation/reports/<int:report_id>/', ReportDetailView.as_view(), name='report_detail'),
    path('admin/moderation/reports/<int:report_id>/action/', ModerationActionView.as_view(), name='moderation_action'),
    path('admin/moderation/escalations/', EscalatedReportsView.as_view(), name='escalated_reports'),
    path('admin/moderation/merchants/<int:merchant_id>/violations/', MerchantViolationsView.as_view(), name='merchant_violations'),
    path('admin/moderation/stats/', ModerationStatsView.as_view(), name='moderation_stats'),
]
