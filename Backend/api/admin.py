from django.contrib import admin
from .models import *

admin.site.register(StudentProfile)
admin.site.register(MerchantProfile)
admin.site.register(Store)
admin.site.register(Log)
admin.site.register(CompletedGoal)
admin.site.register(CouponTemplate)
admin.site.register(CouponRedemption)
admin.site.register(CouponShareRequest)
admin.site.register(Tag)
# admin.site.register(PasswordResetProfile)

@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    search_fields = ['coupon_name', 'store__name']


# UGC Compliance Models (Apple Guideline 1.2)
@admin.register(ContentReport)
class ContentReportAdmin(admin.ModelAdmin):
    list_display = ['id', 'reporter', 'reason', 'status', 'created_at', 'reviewed_at']
    list_filter = ['status', 'reason', 'created_at']
    search_fields = ['reporter__email', 'details']
    readonly_fields = ['created_at']


@admin.register(BlockedMerchant)
class BlockedMerchantAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'store', 'created_at']
    list_filter = ['created_at']
    search_fields = ['user__email', 'store__name']


@admin.register(EULAAcceptance)
class EULAAcceptanceAdmin(admin.ModelAdmin):
    list_display = ['id', 'merchant', 'version', 'accepted_at', 'ip_address']
    list_filter = ['version', 'accepted_at']
    search_fields = ['merchant__email']
    readonly_fields = ['accepted_at']


@admin.register(ModerationAction)
class ModerationActionAdmin(admin.ModelAdmin):
    list_display = ['id', 'report', 'admin', 'action', 'created_at']
    list_filter = ['action', 'created_at']
    search_fields = ['admin__email', 'notes']
    readonly_fields = ['created_at']


@admin.register(ViolationRecord)
class ViolationRecordAdmin(admin.ModelAdmin):
    list_display = ['id', 'merchant', 'violation_type', 'created_at']
    list_filter = ['violation_type', 'created_at']
    search_fields = ['merchant__email', 'notes']
    readonly_fields = ['created_at']