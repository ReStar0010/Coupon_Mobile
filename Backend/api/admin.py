from django import forms
import secrets
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.utils.html import format_html
from django.db.models import Case, Count, Exists, F, IntegerField, OuterRef, Q, Sum, Value, When
from django.utils import timezone
from django.urls import path, reverse
from django.shortcuts import render, redirect
from django.http import HttpResponseRedirect
from django.contrib import messages
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import User
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import *
from .utils import generate_platform_voucher_redeem_code
from .views.authentication import (
    send_merchant_application_approved_email,
    send_merchant_application_rejected_email,
)

admin.site.unregister(User)


class UserAdmin(BaseUserAdmin):
    list_display = BaseUserAdmin.list_display + ('date_joined',)


admin.site.register(User, UserAdmin)


# =============================================================================
# Inline Admin Classes
# =============================================================================

class CouponInline(admin.TabularInline):
    """顯示店家的優惠券（限制顯示最近 10 筆）"""
    model = Coupon
    extra = 0
    max_num = 10
    fields = ['coupon_name', 'coupon_type', 'start_date', 'expiry_date', 'current_holder']
    readonly_fields = ['current_holder']
    can_delete = False
    show_change_link = True


class CouponTemplateInline(admin.TabularInline):
    """顯示店家的優惠券範本（限制顯示最近 5 筆）"""
    model = CouponTemplate
    extra = 0
    max_num = 5
    fields = ['coupon_name', 'total_quantity', 'remaining_quantity', 'is_active']
    readonly_fields = ['remaining_quantity']
    can_delete = False
    show_change_link = True


class ViolationRecordInline(admin.TabularInline):
    """顯示商家的違規記錄"""
    model = ViolationRecord
    fk_name = 'merchant'  # Specify the ForeignKey field name since it points to User, not MerchantProfile
    extra = 0
    fields = ['violation_type', 'created_at', 'notes']
    readonly_fields = ['created_at']
    can_delete = False


# =============================================================================
# User Profile Admin
# =============================================================================

class SharingProgressFilter(admin.SimpleListFilter):
    title = '分享進度 (0–2)'
    parameter_name = 'sharing_progress'

    def lookups(self, request, model_admin):
        return [('0', '0'), ('1', '1'), ('2', '2')]

    def queryset(self, request, queryset):
        if self.value() is not None:
            return queryset.filter(sharing_progress_count=int(self.value()))
        return queryset


class HasSharingRewardFilter(admin.SimpleListFilter):
    title = '已得分享獎勵'
    parameter_name = 'has_sharing_reward'

    def lookups(self, request, model_admin):
        return [('yes', '是'), ('no', '否')]

    def queryset(self, request, queryset):
        if self.value() == 'yes':
            return queryset.filter(sharing_rewards_earned__gt=0)
        if self.value() == 'no':
            return queryset.filter(sharing_rewards_earned=0)
        return queryset


class ReferralCountFilter(admin.SimpleListFilter):
    title = '推薦數'
    parameter_name = 'referral_count'

    def lookups(self, request, model_admin):
        return [('0', '0'), ('1', '1'), ('2', '2+')]

    def queryset(self, request, queryset):
        if self.value() == '0':
            return queryset.filter(referral_progress_count=0)
        if self.value() == '1':
            return queryset.filter(referral_progress_count=1)
        if self.value() == '2':
            return queryset.filter(referral_progress_count__gte=2)
        return queryset


@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    change_list_template = 'admin/api/studentprofile/change_list.html'
    list_display = [
        'id', 'user_email', 'phone_number', 'verified_status',
        'coupons_used_count', 'total_savings',
        'sharing_progress_count', 'sharing_rewards_earned', 'referral_progress_count', 'game_next_reward',
        'last_logged_in'
    ]
    list_filter = [
        'verified', 'phone_verified', 'last_logged_in',
        SharingProgressFilter, HasSharingRewardFilter, ReferralCountFilter,
    ]
    search_fields = ['user__email', 'user__username', 'phone_number']
    actions = ['recompute_progress_selected']

    def get_urls(self):
        urls = super().get_urls()
        extra = [
            path(
                'activity-overview/',
                self.admin_site.admin_view(self.activity_overview_view),
                name='api_studentprofile_activity_overview',
            ),
        ]
        return extra + urls

    def activity_overview_view(self, request):
        sharing_0 = StudentProfile.objects.filter(sharing_progress_count=0).count()
        sharing_1 = StudentProfile.objects.filter(sharing_progress_count=1).count()
        sharing_2 = StudentProfile.objects.filter(sharing_progress_count=2).count()
        sharing_reward_earners = StudentProfile.objects.filter(sharing_rewards_earned__gt=0).count()
        referral_0 = StudentProfile.objects.filter(referral_progress_count=0).count()
        referral_1 = StudentProfile.objects.filter(referral_progress_count=1).count()
        referral_2_plus = StudentProfile.objects.filter(referral_progress_count__gte=2).count()
        reward_vouchers_total = PlatformVoucher.objects.filter(acquisition_method='reward').count()
        reward_sharing = PlatformVoucher.objects.filter(batch_name='Sharing Reward').count()
        reward_referral = PlatformVoucher.objects.filter(batch_name='Referral Reward').count()
        context = {
            'opts': self.model._meta,
            'title': '活動進度總覽',
            'sharing_0': sharing_0,
            'sharing_1': sharing_1,
            'sharing_2': sharing_2,
            'sharing_reward_earners': sharing_reward_earners,
            'referral_0': referral_0,
            'referral_1': referral_1,
            'referral_2_plus': referral_2_plus,
            'reward_vouchers_total': reward_vouchers_total,
            'reward_sharing': reward_sharing,
            'reward_referral': reward_referral,
        }
        return render(request, 'admin/api/studentprofile/activity_overview.html', context)
    readonly_fields = [
        'email_verification_token', 'last_draw_time', 'last_logged_in',
        'last_savings_reset', 'coupons_used_count', 'total_savings', 'monthly_savings',
        'sharing_progress_count', 'sharing_rewards_earned', 'referral_progress_count'
    ]
    fieldsets = (
        ('使用者資訊', {
            'fields': ('user', 'phone_number')
        }),
        ('驗證狀態', {
            'fields': ('verified', 'phone_verified', 'email_verification_token')
        }),
        ('統計數據', {
            'fields': (
                'coupons_used_count', 'total_savings', 'monthly_savings',
                'last_savings_reset', 'last_draw_time', 'last_logged_in',
                'sharing_progress_count', 'sharing_rewards_earned', 'referral_progress_count'
            )
        }),
        ('儲蓄目標', {
            'fields': ('savings_goal_name', 'savings_goal_amount', 'savings_goal_image'),
            'classes': ('collapse',)
        }),
    )
    
    def user_email(self, obj):
        return obj.user.email
    user_email.short_description = '電子郵件'
    user_email.admin_order_field = 'user__email'
    
    def verified_status(self, obj):
        email_icon = '✅' if obj.verified else '❌'
        phone_icon = '✅' if obj.phone_verified else '❌'
        return format_html(
            '<span title="Email">📧{}</span> <span title="Phone">📱{}</span>',
            email_icon, phone_icon
        )
    verified_status.short_description = '驗證狀態'

    def game_next_reward(self, obj):
        """e.g. 1/3 to $10 or 1/2 referral."""
        parts = []
        if obj.sharing_progress_count is not None:
            parts.append(f'{obj.sharing_progress_count}/3 分享')
        if obj.referral_progress_count is not None:
            parts.append(f'推薦 {obj.referral_progress_count}')
        return ' | '.join(parts) if parts else '—'
    game_next_reward.short_description = '活動進度'

    def recompute_progress_selected(self, request, queryset):
        from api.models import CouponRedemption
        from api.management.commands.recompute_progress import Command as RecomputeCommand
        User = get_user_model()
        user_ids = list(queryset.values_list('user_id', flat=True).distinct())
        if not user_ids:
            self.message_user(request, '未選取任何使用者', level=messages.WARNING)
            return
        users = User.objects.filter(id__in=user_ids).select_related('student_profile')
        referral_counts = {}
        for user_b in users:
            first_exclusive = (
                CouponRedemption.objects.filter(user=user_b, coupon_type='exclusive')
                .select_related('coupon')
                .order_by('redeemed_at')
                .first()
            )
            first_voucher = (
                PlatformVoucherRedemption.objects.filter(user=user_b)
                .select_related('voucher')
                .order_by('redeemed_at')
                .first()
            )
            first_obj = None
            if first_exclusive and first_voucher:
                first_obj = first_exclusive if first_exclusive.redeemed_at <= first_voucher.redeemed_at else first_voucher
            elif first_exclusive:
                first_obj = first_exclusive
            elif first_voucher:
                first_obj = first_voucher
            if first_obj:
                if hasattr(first_obj, 'coupon'):
                    source = first_obj.coupon.original_owner
                else:
                    source = first_obj.voucher.original_owner
                if source and source.id != user_b.id:
                    referral_counts[source.id] = referral_counts.get(source.id, 0) + 1
        updated = 0
        for user in users:
            try:
                profile = user.student_profile
            except StudentProfile.DoesNotExist:
                continue
            redeemer_count = CouponRedemption.objects.filter(
                user=user, coupon_type='exclusive'
            ).count()
            owner_count = CouponRedemption.objects.filter(
                coupon__original_owner=user, coupon_type='exclusive'
            ).exclude(user=user).count()
            total_sharing = redeemer_count + owner_count
            new_sharing = total_sharing % 3
            new_sharing_rewards = total_sharing // 3
            new_referral = referral_counts.get(user.id, 0)
            if (profile.sharing_progress_count != new_sharing or
                    profile.sharing_rewards_earned != new_sharing_rewards or
                    profile.referral_progress_count != new_referral):
                profile.sharing_progress_count = new_sharing
                profile.sharing_rewards_earned = new_sharing_rewards
                profile.referral_progress_count = new_referral
                profile.save(update_fields=[
                    'sharing_progress_count', 'sharing_rewards_earned', 'referral_progress_count'
                ])
                updated += 1
        self.message_user(request, f'已重算 {updated} 位使用者的活動進度')
    recompute_progress_selected.short_description = '重算所選使用者的活動進度'


@admin.register(MerchantProfile)
class MerchantProfileAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'user_email', 'contact_person', 'phone',
        'application_status_badge', 'verified', 'store_summary',
        'application_submitted_at', 'application_reviewed_at',
        'violation_count', 'suspension_status'
    ]
    list_filter = ['application_status', 'verified', 'suspension_flagged', 'violation_count']
    search_fields = ['user__email', 'user__username', 'contact_person', 'phone']
    list_select_related = ['user']
    readonly_fields = [
        'email_verification_token', 'verification_token_created_at',
        'last_verification_email_sent', 'verification_email_count',
        'violation_count', 'suspension_flagged_at',
        'application_submitted_at', 'application_reviewed_at',
    ]
    # Note: ViolationRecordInline removed - ViolationRecord.merchant points to User, not MerchantProfile
    # To view violations, use the User admin or ViolationRecord admin directly
    fieldsets = (
        ('使用者資訊', {
            'fields': ('user', 'contact_person', 'phone', 'contact_info')
        }),
        ('Email 驗證', {
            'fields': (
                'verified', 'email_verification_token', 
                'verification_token_created_at', 'last_verification_email_sent',
                'verification_email_count'
            )
        }),
        ('申請審核', {
            'fields': (
                'application_status', 'application_submitted_at',
                'application_reviewed_at', 'application_review_notes',
            )
        }),
        ('違規管理', {
            'fields': ('violation_count', 'suspension_flagged', 'suspension_flagged_at'),
            'classes': ('collapse',)
        }),
    )
    actions = ['approve_applications', 'reject_applications', 'mark_as_verified', 'flag_for_suspension']

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related('user')
            .annotate(
                pending_first=Case(
                    When(application_status='pending', then=Value(0)),
                    When(application_status='approved', then=Value(1)),
                    default=Value(2),
                    output_field=IntegerField(),
                )
            )
            .order_by('pending_first', '-application_submitted_at', 'user__email')
        )
    
    def user_email(self, obj):
        return obj.user.email
    user_email.short_description = '電子郵件'
    user_email.admin_order_field = 'user__email'

    def application_status_badge(self, obj):
        labels = {
            'pending': ('待審核', '#b26a00'),
            'approved': ('已核准', '#137333'),
            'rejected': ('已拒絕', '#b3261e'),
        }
        label, color = labels.get(obj.application_status, (obj.application_status, '#666666'))
        return format_html('<strong style="color: {};">{}</strong>', color, label)
    application_status_badge.short_description = '申請狀態'
    application_status_badge.admin_order_field = 'application_status'

    def store_summary(self, obj):
        store = Store.objects.filter(owner=obj.user).first()
        if not store:
            return '—'
        return f'{store.name or "未命名商店"} / {store.address or "未填地址"}'
    store_summary.short_description = '商店資訊'
    
    def suspension_status(self, obj):
        if obj.suspension_flagged:
            return format_html('<span style="color: red;">⚠️ 已標記</span>')
        if obj.violation_count >= 10:
            return format_html('<span style="color: orange;">⚠️ 接近限制</span>')
        return '正常'
    suspension_status.short_description = '暫停狀態'
    
    def mark_as_verified(self, request, queryset):
        count = queryset.update(verified=True)
        self.message_user(request, f'已標記 {count} 位商家為已驗證')
    mark_as_verified.short_description = '標記為已驗證'

    def approve_applications(self, request, queryset):
        approved_count = 0
        for profile in queryset.select_related('user'):
            profile.application_status = 'approved'
            profile.application_reviewed_at = timezone.now()
            profile.save(update_fields=['application_status', 'application_reviewed_at'])
            send_merchant_application_approved_email(profile.user.email)
            approved_count += 1
        self.message_user(request, f'已核准 {approved_count} 位商家申請')
    approve_applications.short_description = '核准商家申請'

    def reject_applications(self, request, queryset):
        rejected_count = 0
        for profile in queryset.select_related('user'):
            profile.application_status = 'rejected'
            profile.application_reviewed_at = timezone.now()
            profile.save(update_fields=['application_status', 'application_reviewed_at'])
            send_merchant_application_rejected_email(profile.user.email)
            rejected_count += 1
        self.message_user(request, f'已拒絕 {rejected_count} 位商家申請')
    reject_applications.short_description = '拒絕商家申請'
    
    def flag_for_suspension(self, request, queryset):
        count = queryset.update(suspension_flagged=True, suspension_flagged_at=timezone.now())
        self.message_user(request, f'已標記 {count} 位商家待審核暫停')
    flag_for_suspension.short_description = '標記待審核暫停'


@admin.register(PasswordResetProfile)
class PasswordResetProfileAdmin(admin.ModelAdmin):
    list_display = ['id', 'user_email', 'token_created_at', 'token_status']
    search_fields = ['user__email', 'user__username']
    readonly_fields = ['token', 'token_created_at']
    list_filter = ['token_created_at']
    
    def user_email(self, obj):
        return obj.user.email
    user_email.short_description = '電子郵件'
    user_email.admin_order_field = 'user__email'
    
    def token_status(self, obj):
        if not obj.token:
            return '無'
        if not obj.token_created_at:
            return '未知'
        # Token expires after 1 hour
        from datetime import timedelta
        expiry_time = obj.token_created_at + timedelta(hours=1)
        if timezone.now() > expiry_time:
            return format_html('<span style="color: red;">已過期</span>')
        return format_html('<span style="color: green;">有效</span>')
    token_status.short_description = 'Token 狀態'


# =============================================================================
# Store & Coupon Admin
# =============================================================================

@admin.register(Store)
class StoreAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'name', 'owner_email', 'store_type', 
        'address', 'has_location', 'unified_redeem_code', 'fixed_session_status'
    ]
    list_filter = ['store_type']
    search_fields = ['name', 'owner__email', 'address', 'unified_redeem_code']
    readonly_fields = ['unified_redeem_code']
    inlines = [CouponTemplateInline, CouponInline]
    actions = ['generate_or_rotate_fixed_table_qr_token']
    fieldsets = (
        ('基本資訊', {
            'fields': ('owner', 'name', 'store_type', 'image_url')
        }),
        ('地址與位置', {
            'fields': ('address', 'lat', 'lng', 'business_hours')
        }),
        ('營運設定', {
            'fields': (
                'average_order_value', 'unified_redeem_code', 'accepts_platform_vouchers',
                'timezone', 'currency_code'
            )
        }),
    )
    
    def owner_email(self, obj):
        return obj.owner.email if obj.owner else '（無）'
    owner_email.short_description = '店主郵件'
    owner_email.admin_order_field = 'owner__email'
    
    def has_location(self, obj):
        return '✅' if (obj.lat and obj.lng) else '❌'
    has_location.short_description = '已設定座標'
    
    def get_queryset(self, request):
        """優化查詢效能"""
        qs = super().get_queryset(request)
        return qs.select_related('owner')

    def fixed_session_status(self, obj):
        fixed = getattr(obj, 'fixed_session', None)
        if not fixed:
            return '未生成'
        if not fixed.is_active:
            return '已停用'
        return f'已生成 ({fixed.session_token[:10]}...)'
    fixed_session_status.short_description = '桌貼 QR Token'

    def generate_or_rotate_fixed_table_qr_token(self, request, queryset):
        generated = 0
        rotated = 0
        for store in queryset:
            token = secrets.token_urlsafe(24)
            fixed, created = StoreFixedSession.objects.get_or_create(
                store=store,
                defaults={
                    'session_token': token,
                    'is_active': True,
                },
            )
            if created:
                generated += 1
            else:
                fixed.session_token = token
                fixed.is_active = True
                fixed.rotated_at = timezone.now()
                fixed.save(update_fields=['session_token', 'is_active', 'rotated_at', 'updated_at'])
                rotated += 1

            api_base_url = getattr(settings, 'API_BASE_URL', 'http://127.0.0.1:8000').rstrip('/')
            claim_fixed_url = f"{api_base_url}/claim-fixed/{token}/"
            self.message_user(
                request,
                f"[{store.name}] 桌貼 URL: {claim_fixed_url}",
                level=messages.INFO,
            )

        self.message_user(
            request,
            f"已建立 {generated} 間店家固定桌貼 token，已重置 {rotated} 間店家 token。",
            level=messages.SUCCESS,
        )
    generate_or_rotate_fixed_table_qr_token.short_description = '生成/重置桌貼 QR token'


@admin.register(StoreFixedSession)
class StoreFixedSessionAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'store_name', 'session_token', 'is_active', 'claim_fixed_url', 'created_at', 'rotated_at'
    ]
    list_filter = ['is_active', 'created_at', 'rotated_at']
    search_fields = ['store__name', 'store__owner__email', 'session_token']
    readonly_fields = ['created_at', 'updated_at', 'rotated_at', 'claim_fixed_url']

    def store_name(self, obj):
        return obj.store.name
    store_name.short_description = '店家'
    store_name.admin_order_field = 'store__name'

    def claim_fixed_url(self, obj):
        api_base_url = getattr(settings, 'API_BASE_URL', 'http://127.0.0.1:8000').rstrip('/')
        return f"{api_base_url}/claim-fixed/{obj.session_token}/"
    claim_fixed_url.short_description = '桌貼 URL'

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('store', 'store__owner')


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'display_name', 'coupon_count', 'template_count']
    search_fields = ['name', 'display_name']
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.annotate(
            _coupon_count=Count('coupons', distinct=True),
            _template_count=Count('coupon_templates', distinct=True)
        )
    
    def coupon_count(self, obj):
        return obj._coupon_count
    coupon_count.short_description = '優惠券數量'
    coupon_count.admin_order_field = '_coupon_count'
    
    def template_count(self, obj):
        return obj._template_count
    template_count.short_description = '範本數量'
    template_count.admin_order_field = '_template_count'


@admin.register(CouponTemplate)
class CouponTemplateAdmin(admin.ModelAdmin):
    change_list_template = 'admin/api/coupontemplate/change_list.html'
    list_display = [
        'id', 'coupon_name', 'store_name', 'quantity_status',
        'start_date', 'expiry_date', 'is_active', 'draw_probability'
    ]
    list_filter = ['is_active', 'store__store_type', 'start_date', 'expiry_date']
    search_fields = ['coupon_name', 'store__name', 'template_redeem_code']
    readonly_fields = ['created_at', 'remaining_quantity']
    filter_horizontal = ['tags']
    date_hierarchy = 'start_date'
    actions = ['deactivate_templates', 'activate_templates', 'issue_to_user_action']
    fieldsets = (
        ('基本資訊', {
            'fields': ('store', 'coupon_name', 'coupon_detail', 'important_notes', 'image_url')
        }),
        ('數量與時效', {
            'fields': (
                'total_quantity', 'remaining_quantity', 
                'start_date', 'expiry_date', 'is_active'
            )
        }),
        ('抽獎設定', {
            'fields': ('draw_probability',)
        }),
        ('其他設定', {
            'fields': ('estimated_savings', 'template_redeem_code', 'tags', 'created_at'),
            'classes': ('collapse',)
        }),
    )
    def store_name(self, obj):
        return obj.store.name
    store_name.short_description = '店家'
    store_name.admin_order_field = 'store__name'
    
    def quantity_status(self, obj):
        percentage = (obj.remaining_quantity / obj.total_quantity * 100) if obj.total_quantity > 0 else 0
        if percentage == 0:
            color = 'red'
        elif percentage < 30:
            color = 'orange'
        else:
            color = 'green'
        # 避免 format_html 對 SafeString 使用 'f' 導致 ValueError，先將百分比格式成字串
        pct_str = '%d' % round(float(percentage))
        return format_html(
            '<span style="color: {};">{}/{} ({})%</span>',
            color, obj.remaining_quantity, obj.total_quantity, pct_str
        )
    quantity_status.short_description = '庫存狀態'
    
    def deactivate_templates(self, request, queryset):
        count = queryset.update(is_active=False)
        self.message_user(request, f'已停用 {count} 個範本')
    deactivate_templates.short_description = '停用所選範本'
    
    def activate_templates(self, request, queryset):
        count = queryset.update(is_active=True)
        self.message_user(request, f'已啟用 {count} 個範本')
    activate_templates.short_description = '啟用所選範本'

    def issue_to_user_action(self, request, queryset):
        """重導向至「發給指定使用者」表單，並預選目前勾選的範本。"""
        ids = list(queryset.values_list('id', flat=True))
        if not ids:
            self.message_user(request, '請先勾選要發放的範本。', level=messages.WARNING)
            return
        url = reverse('admin:api_coupontemplate_issue_to_user') + f"?template_ids={','.join(str(i) for i in ids)}"
        return HttpResponseRedirect(url)
    issue_to_user_action.short_description = '發給指定使用者'

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('store')

    def get_urls(self):
        urls = super().get_urls()
        extra = [
            path(
                'issue-to-user/',
                self.admin_site.admin_view(self.issue_to_user_view),
                name='api_coupontemplate_issue_to_user',
            ),
            path(
                'user-search/',
                self.admin_site.admin_view(self.user_search_view),
                name='api_coupontemplate_user_search',
            ),
        ]
        return extra + urls

    def _norm_digits(self, s: str) -> str:
        import re
        return re.sub(r'\D', '', s or '')

    def _profile_phone(self, u) -> str:
        try:
            return u.student_profile.phone_number or ''
        except StudentProfile.DoesNotExist:
            return ''

    def _phone_sort_key(self, u, q: str, digits_q: str) -> tuple[int, str]:
        raw_phone = self._profile_phone(u)
        pn_digits = self._norm_digits(raw_phone)
        if digits_q and pn_digits == digits_q:
            return (0, u.email or '')
        if digits_q and pn_digits.endswith(digits_q):
            return (1, u.email or '')
        if digits_q and digits_q in pn_digits:
            return (2, u.email or '')
        if q.lower() in (raw_phone or '').lower():
            return (3, u.email or '')
        return (4, u.email or '')

    def _display_user_text(self, u) -> str:
        phone = self._profile_phone(u)
        if phone:
            return f'{u.email} · 📱 {phone}'
        return u.email

    def _build_phone_filter(self, q: str, digits_q: str, has_phone: Q) -> Q:
        phone_contains = Q(student_profile__phone_number__icontains=q)
        if digits_q and len(digits_q) >= 2:
            phone_contains |= Q(student_profile__phone_number__icontains=digits_q)
        return has_phone & phone_contains

    def _build_phone_search_results(self, phone_users, limit: int = 20) -> tuple[list[dict], set[int]]:
        seen: set[int] = set()
        results: list[dict] = []
        for u in phone_users:
            if u.id in seen:
                continue
            seen.add(u.id)
            results.append({'id': u.id, 'text': self._display_user_text(u)})
            if len(results) >= limit:
                break
        return results, seen

    def user_search_view(self, request):
        """JSON：搜尋使用者。電話（StudentProfile）優先，其次 email／username。"""
        from django.http import JsonResponse

        q = request.GET.get('q', '').strip()
        if len(q) < 2:
            return JsonResponse({'results': []})

        digits_q = self._norm_digits(q)
        user_model = get_user_model()

        has_phone = (
            Q(student_profile__phone_number__isnull=False)
            & ~Q(student_profile__phone_number='')
        )
        # 電話比對：完整輸入 + 純數字（方便 +886 / 空格分隔仍能找到）
        phone_filter = self._build_phone_filter(q, digits_q, has_phone)

        phone_users = list(
            user_model.objects.filter(phone_filter)
            .select_related('student_profile')
            .distinct()[:40]
        )
        phone_users.sort(key=lambda u: self._phone_sort_key(u, q, digits_q))

        results, seen = self._build_phone_search_results(phone_users, limit=20)

        remaining = 20 - len(results)
        if remaining > 0:
            for u in (
                user_model.objects.filter(Q(email__icontains=q) | Q(username__icontains=q))
                .exclude(id__in=seen)
                .order_by('email')[:remaining]
            ):
                results.append({'id': u.id, 'text': self._display_user_text(u)})
                seen.add(u.id)

        return JsonResponse({'results': results})

    def issue_to_user_view(self, request):
        """表單：選擇優惠券範本與指定使用者，建立範本實例並發給該使用者。"""
        User = get_user_model()

        class IssueToUserForm(forms.Form):
            templates = forms.ModelMultipleChoiceField(
                queryset=CouponTemplate.objects.filter(remaining_quantity__gt=0).select_related('store').order_by('store__name', 'coupon_name'),
                widget=forms.CheckboxSelectMultiple,
                required=True,
                label='優惠券範本',
                help_text='可多選；每個範本會建立一張優惠券並發給下方指定使用者。',
            )
            user = forms.ModelChoiceField(
                queryset=User.objects.all().order_by('email'),
                required=True,
                label='指定使用者',
                help_text='搜尋時電話優先；無 StudentProfile／電話的帳號僅能以 email 找到。',
            )

        template_ids_str = request.GET.get('template_ids', '')
        if request.method == 'POST':
            form = IssueToUserForm(request.POST)
            if form.is_valid():
                templates = form.cleaned_data['templates']
                user = form.cleaned_data['user']
                created = 0
                failed = 0
                for tpl in templates:
                    coupon = tpl.generate_coupon(recipient=user)
                    if coupon:
                        coupon.acquisition_method = 'admin_issue'
                        coupon.save(update_fields=['acquisition_method'])
                        created += 1
                    else:
                        failed += 1
                if created:
                    messages.success(
                        request,
                        f'已建立 {created} 張優惠券並發給 {user.email}。' + (f'（{failed} 個範本庫存不足未建立）' if failed else ''),
                    )
                elif failed:
                    messages.warning(request, '所選範本庫存不足，未建立任何優惠券。')
                return redirect('admin:api_coupontemplate_changelist')
        else:
            initial = {}
            if template_ids_str:
                try:
                    ids = [int(x) for x in template_ids_str.split(',') if x.strip()]
                    initial['templates'] = CouponTemplate.objects.filter(
                        id__in=ids, remaining_quantity__gt=0
                    )
                except ValueError:
                    pass
            form = IssueToUserForm(initial=initial)

        return render(
            request,
            'admin/api/coupontemplate/issue_to_user.html',
            {'form': form, 'opts': self.model._meta},
        )


# -----------------------------------------------------------------------------
# Coupon list filters (derived state)
# -----------------------------------------------------------------------------

class CouponExpiredFilter(admin.SimpleListFilter):
    title = '效期狀態'
    parameter_name = 'expired'

    def lookups(self, request, model_admin):
        return [('yes', '已過期'), ('no', '有效中')]

    def queryset(self, request, queryset):
        now = timezone.now()
        if self.value() == 'yes':
            return queryset.filter(expiry_date__lte=now)
        if self.value() == 'no':
            return queryset.filter(expiry_date__gt=now)
        return queryset


class CouponHasHolderFilter(admin.SimpleListFilter):
    title = '持有者'
    parameter_name = 'has_holder'

    def lookups(self, request, model_admin):
        return [('yes', '有持有者'), ('no', '無持有者')]

    def queryset(self, request, queryset):
        if self.value() == 'yes':
            return queryset.exclude(current_holder__isnull=True)
        if self.value() == 'no':
            return queryset.filter(current_holder__isnull=True)
        return queryset


class CouponRedeemedFilter(admin.SimpleListFilter):
    title = '兌換狀態'
    parameter_name = 'redeemed'

    def lookups(self, request, model_admin):
        return [('yes', '已兌換'), ('no', '未兌換')]

    def queryset(self, request, queryset):
        from .models import CouponRedemption
        redeemed = CouponRedemption.objects.filter(coupon_id=OuterRef('pk'))
        if self.value() == 'yes':
            return queryset.filter(Exists(redeemed))
        if self.value() == 'no':
            return queryset.exclude(Exists(redeemed))
        return queryset


class CouponPendingPhoneFilter(admin.SimpleListFilter):
    title = '待歸戶電話'
    parameter_name = 'pending_phone'

    def lookups(self, request, model_admin):
        return [('yes', '有待歸戶'), ('no', '無')]

    def queryset(self, request, queryset):
        if self.value() == 'yes':
            return queryset.filter(
                coupon_type='exclusive',
                pending_phone_number__isnull=False
            ).exclude(pending_phone_number='')
        if self.value() == 'no':
            return queryset.filter(Q(pending_phone_number__isnull=True) | Q(pending_phone_number=''))
        return queryset


class CouponPublicPoolFilter(admin.SimpleListFilter):
    title = '公共池'
    parameter_name = 'public_pool'

    def lookups(self, request, model_admin):
        return [('yes', '在公共池'), ('no', '否')]

    def queryset(self, request, queryset):
        from .models import CouponShareRequest
        pending_public = CouponShareRequest.objects.filter(
            coupon_id=OuterRef('pk'),
            is_public=True,
            status='pending'
        )
        if self.value() == 'yes':
            return queryset.filter(current_holder__isnull=True).filter(Exists(pending_public))
        if self.value() == 'no':
            return queryset.exclude(Exists(pending_public))
        return queryset


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'coupon_name', 'store_name', 'store_owner_email', 'coupon_type',
        'holder_info', 'expiry_date', 'is_expired', 'redemption_info'
    ]
    list_filter = [
        'coupon_type', 'usage_per_day', 'acquisition_method',
        CouponExpiredFilter, CouponRedeemedFilter, CouponHasHolderFilter,
        CouponPendingPhoneFilter, CouponPublicPoolFilter,
        'start_date', 'expiry_date', 'store__owner'
    ]
    search_fields = [
        'coupon_name', 'store__name', 'redeem_code',
        'current_holder__email', 'original_owner__email', 'pending_phone_number'
    ]
    readonly_fields = ['original_owner', 'last_holder']
    filter_horizontal = ['tags']
    date_hierarchy = 'expiry_date'
    fieldsets = (
        ('基本資訊', {
            'fields': (
                'store', 'template', 'coupon_name', 'coupon_detail',
                'important_notes', 'image_url'
            )
        }),
        ('類型與時效', {
            'fields': (
                'coupon_type', 'start_date', 'expiry_date',
                'usage_per_day', 'redeem_code'
            )
        }),
        ('持有者資訊', {
            'fields': (
                'original_owner', 'last_holder', 'current_holder',
                'pending_phone_number', 'acquisition_method'
            )
        }),
        ('其他設定', {
            'fields': ('estimated_savings', 'tags'),
            'classes': ('collapse',)
        }),
    )
    actions = ['mark_as_expired', 'cancel_pending_public_share', 'assign_to_user']

    def get_urls(self):
        urls = super().get_urls()
        extra = [
            path(
                'assign-user/',
                self.admin_site.admin_view(self.assign_to_user_view),
                name='api_coupon_assign_user',
            ),
        ]
        return extra + urls

    def assign_to_user_view(self, request):
        from django import forms
        User = get_user_model()
        ids_param = request.GET.get('ids', '')
        if not ids_param:
            messages.error(request, '請從優惠券列表勾選後使用「指派給使用者」動作。')
            return redirect('admin:api_coupon_changelist')
        try:
            ids = [int(x) for x in ids_param.split(',') if x.strip()]
        except ValueError:
            messages.error(request, '無效的優惠券 ID。')
            return redirect('admin:api_coupon_changelist')
        if not ids:
            return redirect('admin:api_coupon_changelist')
        redeemed_ids = set(
            CouponRedemption.objects.filter(coupon_id__in=ids).values_list('coupon_id', flat=True)
        )
        eligible_ids = [
            pk for pk in ids
            if pk not in redeemed_ids
            and Coupon.objects.filter(pk=pk, coupon_type='exclusive').exists()
        ]
        if not eligible_ids:
            messages.warning(request, '沒有符合條件的優惠券（須為專屬且未兌換）。')
            return redirect('admin:api_coupon_changelist')

        class AssignForm(forms.Form):
            user = forms.ModelChoiceField(
                queryset=User.objects.all().order_by('email'),
                label='指派給使用者',
                required=True,
            )

        if request.method == 'POST':
            form = AssignForm(request.POST)
            if form.is_valid():
                user = form.cleaned_data['user']
                count = Coupon.objects.filter(id__in=eligible_ids).update(
                    current_holder=user,
                    pending_phone_number='',
                    acquisition_method='transfer',
                )
                Coupon.objects.filter(
                    id__in=eligible_ids,
                    original_owner__isnull=True
                ).update(original_owner=user)
                messages.success(request, f'已將 {count} 張優惠券指派給 {user.email}')
                return redirect('admin:api_coupon_changelist')
        else:
            form = AssignForm()
        context = {
            'form': form,
            'opts': self.model._meta,
            'eligible_count': len(eligible_ids),
            'title': '指派優惠券給使用者',
        }
        return render(request, 'admin/api/coupon/assign_user.html', context)

    def store_name(self, obj):
        return obj.store.name
    store_name.short_description = '店家'
    store_name.admin_order_field = 'store__name'

    def store_owner_email(self, obj):
        return obj.store.owner.email if obj.store and obj.store.owner else '—'
    store_owner_email.short_description = '店主'
    store_owner_email.admin_order_field = 'store__owner__email'

    def holder_info(self, obj):
        if obj.coupon_type == 'store':
            return '（隨取即用）'
        if obj.pending_phone_number:
            return format_html('📱 {}', obj.pending_phone_number)
        if obj.current_holder:
            return format_html('👤 {}', obj.current_holder.email)
        return '（無持有者）'
    holder_info.short_description = '持有者'
    
    def is_expired(self, obj):
        now = timezone.now()
        if now > obj.expiry_date:
            return format_html('<span style="color: red;">已過期</span>')
        days_left = (obj.expiry_date - now).days
        if days_left <= 3:
            return format_html('<span style="color: orange;">{} 天後過期</span>', days_left)
        return format_html('<span style="color: green;">有效</span>')
    is_expired.short_description = '狀態'
    
    def redemption_info(self, obj):
        if obj.coupon_type == 'exclusive':
            return '已兌換' if obj.is_redeemed() else '未兌換'
        count = obj.get_redemption_count()
        users = obj.get_unique_users_count()
        return format_html('{} 次 / {} 人', count, users)
    redemption_info.short_description = '兌換資訊'
    
    def mark_as_expired(self, request, queryset):
        count = queryset.update(expiry_date=timezone.now())
        self.message_user(request, f'已標記 {count} 張優惠券為過期')
    mark_as_expired.short_description = '標記為過期'

    def cancel_pending_public_share(self, request, queryset):
        from .models import CouponShareRequest
        exclusive = queryset.filter(coupon_type='exclusive')
        not_redeemed = exclusive.exclude(
            id__in=CouponRedemption.objects.values_list('coupon_id', flat=True)
        )
        updated = 0
        for coupon in not_redeemed:
            share = CouponShareRequest.objects.filter(
                coupon=coupon, is_public=True, status='pending'
            ).select_related('from_user').first()
            if share:
                share.status = 'cancelled'
                share.responded_at = timezone.now()
                share.save(update_fields=['status', 'responded_at'])
                coupon.current_holder = share.from_user
                coupon.save(update_fields=['current_holder'])
                updated += 1
        self.message_user(request, f'已取消 {updated} 張優惠券的公共池分享')
    cancel_pending_public_share.short_description = '取消所選的公共池分享'

    def assign_to_user(self, request, queryset):
        """Redirect to intermediate form to pick user and assign selected coupons."""
        selected = list(queryset.filter(coupon_type='exclusive').exclude(
            id__in=CouponRedemption.objects.values_list('coupon_id', flat=True)
        ).values_list('pk', flat=True)[:500])
        if not selected:
            self.message_user(request, '沒有符合條件的優惠券（須為專屬且未兌換）', level=messages.WARNING)
            return
        ids = ','.join(str(pk) for pk in selected)
        url = reverse('admin:api_coupon_assign_user') + '?ids=' + ids
        return redirect(url)

    assign_to_user.short_description = '指派給使用者'

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('store', 'store__owner', 'template', 'current_holder', 'original_owner')


@admin.register(CouponRedemption)
class CouponRedemptionAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'user_email', 'coupon_name', 'store_name',
        'redeemed_at', 'savings_amount', 'has_location'
    ]
    list_filter = ['coupon_type', 'redeemed_at']
    search_fields = ['user__email', 'coupon__coupon_name', 'coupon__store__name']
    readonly_fields = ['coupon_type', 'redeemed_at']
    date_hierarchy = 'redeemed_at'
    
    def user_email(self, obj):
        return obj.user.email
    user_email.short_description = '使用者'
    user_email.admin_order_field = 'user__email'
    
    def coupon_name(self, obj):
        return obj.coupon.coupon_name
    coupon_name.short_description = '優惠券'
    coupon_name.admin_order_field = 'coupon__coupon_name'
    
    def store_name(self, obj):
        return obj.coupon.store.name
    store_name.short_description = '店家'
    store_name.admin_order_field = 'coupon__store__name'
    
    def has_location(self, obj):
        return '✅' if (obj.lat and obj.lng) else '❌'
    has_location.short_description = '有位置資料'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('user', 'coupon__store')


@admin.register(CouponShareRequest)
class CouponShareRequestAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'coupon_name', 'from_user_email', 'to_user_email',
        'share_type', 'status', 'created_at', 'responded_at'
    ]
    list_filter = ['status', 'is_public', 'created_at']
    search_fields = ['from_user__email', 'to_user__email', 'coupon__coupon_name', 'token']
    readonly_fields = ['token', 'created_at', 'responded_at']
    date_hierarchy = 'created_at'
    actions = ['cancel_pending_public']

    def cancel_pending_public(self, request, queryset):
        pending_public = queryset.filter(status='pending', is_public=True)
        count = 0
        for share in pending_public.select_related('coupon', 'from_user'):
            share.status = 'cancelled'
            share.responded_at = timezone.now()
            share.save(update_fields=['status', 'responded_at'])
            share.coupon.current_holder = share.from_user
            share.coupon.save(update_fields=['current_holder'])
            count += 1
        self.message_user(request, f'已取消 {count} 筆待處理的公共池分享')
    cancel_pending_public.short_description = '取消所選的待處理公共池分享'

    def coupon_name(self, obj):
        return obj.coupon.coupon_name
    coupon_name.short_description = '優惠券'
    
    def from_user_email(self, obj):
        return obj.from_user.email
    from_user_email.short_description = '分享者'
    from_user_email.admin_order_field = 'from_user__email'
    
    def to_user_email(self, obj):
        return obj.to_user.email if obj.to_user else '（公共池）'
    to_user_email.short_description = '接收者'
    
    def share_type(self, obj):
        return '公共池' if obj.is_public else '私人'
    share_type.short_description = '類型'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('coupon', 'from_user', 'to_user')


# =============================================================================
# Platform Cash Voucher (011)
# =============================================================================

class PlatformVoucherExpiredFilter(admin.SimpleListFilter):
    title = '效期狀態'
    parameter_name = 'expired'

    def lookups(self, request, model_admin):
        return [('yes', '已過期'), ('no', '有效中')]

    def queryset(self, request, queryset):
        now = timezone.now()
        if self.value() == 'yes':
            return queryset.filter(expiry_date__lte=now)
        if self.value() == 'no':
            return queryset.filter(expiry_date__gt=now)
        return queryset


class PlatformVoucherRedeemedFilter(admin.SimpleListFilter):
    title = '兌換狀態'
    parameter_name = 'redeemed'

    def lookups(self, request, model_admin):
        return [('yes', '已兌換'), ('no', '未兌換')]

    def queryset(self, request, queryset):
        redeemed = PlatformVoucherRedemption.objects.filter(voucher_id=OuterRef('pk'))
        if self.value() == 'yes':
            return queryset.filter(Exists(redeemed))
        if self.value() == 'no':
            return queryset.exclude(Exists(redeemed))
        return queryset


class PlatformVoucherHasHolderFilter(admin.SimpleListFilter):
    title = '持有者'
    parameter_name = 'has_holder'

    def lookups(self, request, model_admin):
        return [('yes', '有持有者'), ('no', '在公共池')]

    def queryset(self, request, queryset):
        if self.value() == 'yes':
            return queryset.exclude(current_holder__isnull=True)
        if self.value() == 'no':
            return queryset.filter(current_holder__isnull=True)
        return queryset


class PlatformVoucherBatchFilter(admin.SimpleListFilter):
    title = '批次／獎勵'
    parameter_name = 'batch_type'

    def lookups(self, request, model_admin):
        return [
            ('reward', '獎勵券 (Sharing/Referral)'),
            ('other', '其他批次'),
        ]

    def queryset(self, request, queryset):
        if self.value() == 'reward':
            return queryset.filter(acquisition_method='reward')
        if self.value() == 'other':
            return queryset.exclude(acquisition_method='reward')
        return queryset


@admin.register(PlatformVoucher)
class PlatformVoucherAdmin(admin.ModelAdmin):
    change_list_template = 'admin/api/platformvoucher/change_list.html'
    list_display = [
        'id', 'redeem_code', 'face_value', 'currency_code',
        'current_holder_email', 'batch_name', 'acquisition_method',
        'start_date', 'expiry_date', 'expiry_status_display', 'created_at',
        'is_redeemed_display', 'in_public_pool_display'
    ]
    list_filter = [
        'acquisition_method', 'currency_code',
        PlatformVoucherExpiredFilter, PlatformVoucherRedeemedFilter,
        PlatformVoucherHasHolderFilter, PlatformVoucherBatchFilter,
        'created_at'
    ]
    search_fields = ['redeem_code', 'batch_name', 'current_holder__email', 'original_owner__email']
    readonly_fields = ['redeem_code', 'created_at']
    date_hierarchy = 'created_at'
    actions = ['mark_as_expired', 'assign_vouchers_to_user', 'cancel_pending_public_share']
    fieldsets = (
        ('金額與效期', {
            'fields': ('face_value', 'currency_code', 'start_date', 'expiry_date')
        }),
        ('持有與來源', {
            'fields': ('current_holder', 'original_owner', 'last_holder', 'acquisition_method', 'batch_name')
        }),
        ('代碼', {
            'fields': ('redeem_code', 'created_at')
        }),
    )

    def current_holder_email(self, obj):
        return obj.current_holder.email if obj.current_holder else '（公共池）'
    current_holder_email.short_description = '當前持有者'
    current_holder_email.admin_order_field = 'current_holder__email'

    def expiry_status_display(self, obj):
        now = timezone.now()
        if now > obj.expiry_date:
            return format_html('<span style="color: red;">已過期</span>')
        days = (obj.expiry_date - now).days
        if days <= 3:
            return format_html('<span style="color: orange;">{} 天後過期</span>', days)
        return format_html('<span style="color: green;">有效</span>')
    expiry_status_display.short_description = '效期狀態'

    def is_redeemed_display(self, obj):
        return '是' if getattr(obj, '_redeemed', False) else '否'
    is_redeemed_display.short_description = '已兌換'

    def in_public_pool_display(self, obj):
        return '是' if getattr(obj, '_in_public_pool', False) else '否'
    in_public_pool_display.short_description = '在公共池'

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        redeemed = PlatformVoucherRedemption.objects.filter(voucher_id=OuterRef('pk'))
        in_public = PlatformVoucherShareRequest.objects.filter(
            voucher_id=OuterRef('pk'), is_public=True, status='pending'
        )
        return qs.annotate(
            _redeemed=Exists(redeemed),
            _in_public_pool=Exists(in_public),
        )

    def mark_as_expired(self, request, queryset):
        not_redeemed = queryset.exclude(
            id__in=PlatformVoucherRedemption.objects.values_list('voucher_id', flat=True)
        )
        count = not_redeemed.update(expiry_date=timezone.now())
        self.message_user(request, f'已標記 {count} 張平台券為過期')
    mark_as_expired.short_description = '標記所選為過期'

    def assign_vouchers_to_user(self, request, queryset):
        not_redeemed = queryset.exclude(
            id__in=PlatformVoucherRedemption.objects.values_list('voucher_id', flat=True)
        ).values_list('pk', flat=True)[:500]
        ids = list(not_redeemed)
        if not ids:
            self.message_user(request, '沒有未兌換的所選平台券', level=messages.WARNING)
            return
        url = reverse('admin:api_platformvoucher_assign_user') + '?ids=' + ','.join(str(pk) for pk in ids)
        return redirect(url)
    assign_vouchers_to_user.short_description = '指派所選給使用者'

    def cancel_pending_public_share(self, request, queryset):
        redeemed_ids = set(
            PlatformVoucherRedemption.objects.values_list('voucher_id', flat=True)
        )
        not_redeemed = queryset.exclude(id__in=redeemed_ids)
        updated = 0
        for voucher in not_redeemed:
            share = PlatformVoucherShareRequest.objects.filter(
                voucher=voucher, is_public=True, status='pending'
            ).select_related('from_user').first()
            if share:
                share.status = 'declined'
                share.responded_at = timezone.now()
                share.save(update_fields=['status', 'responded_at'])
                voucher.current_holder = share.from_user
                voucher.save(update_fields=['current_holder'])
                updated += 1
        self.message_user(request, f'已取消 {updated} 張平台券的公共池分享')
    cancel_pending_public_share.short_description = '取消所選的公共池分享'

    def get_urls(self):
        urls = super().get_urls()
        extra = [
            path('batch-issue/', self.admin_site.admin_view(self.batch_issue_view), name='api_platformvoucher_batch_issue'),
            path('participating-stores/', self.admin_site.admin_view(self.participating_stores_view), name='api_platformvoucher_participating_stores'),
            path('assign-user/', self.admin_site.admin_view(self.assign_to_user_view), name='api_platformvoucher_assign_user'),
        ]
        return extra + urls

    def assign_to_user_view(self, request):
        from django import forms
        User = get_user_model()
        ids_param = request.GET.get('ids', '')
        if not ids_param:
            messages.error(request, '請從平台券列表勾選後使用「指派所選給使用者」動作。')
            return redirect('admin:api_platformvoucher_changelist')
        try:
            ids = [int(x) for x in ids_param.split(',') if x.strip()]
        except ValueError:
            messages.error(request, '無效的平台券 ID。')
            return redirect('admin:api_platformvoucher_changelist')
        redeemed_ids = set(
            PlatformVoucherRedemption.objects.filter(voucher_id__in=ids).values_list('voucher_id', flat=True)
        )
        eligible_ids = [pk for pk in ids if pk not in redeemed_ids]
        if not eligible_ids:
            messages.warning(request, '沒有未兌換的所選平台券。')
            return redirect('admin:api_platformvoucher_changelist')
        class AssignForm(forms.Form):
            user = forms.ModelChoiceField(
                queryset=User.objects.all().order_by('email'),
                label='指派給使用者',
                required=True,
            )
        if request.method == 'POST':
            form = AssignForm(request.POST)
            if form.is_valid():
                user = form.cleaned_data['user']
                count = PlatformVoucher.objects.filter(id__in=eligible_ids).update(
                    current_holder=user,
                    original_owner=user,
                )
                messages.success(request, f'已將 {count} 張平台券指派給 {user.email}')
                return redirect('admin:api_platformvoucher_changelist')
        else:
            form = AssignForm()
        context = {
            'form': form,
            'opts': self.model._meta,
            'eligible_count': len(eligible_ids),
            'title': '指派平台券給使用者',
        }
        return render(request, 'admin/api/platformvoucher/assign_user.html', context)

    def batch_issue_view(self, request):
        """Custom view: form with batch_name, face_value, quantity, expiry_date; create that many vouchers."""
        from django import forms
        from django.contrib.auth import get_user_model
        User = get_user_model()

        class BatchIssueForm(forms.Form):
            batch_name = forms.CharField(max_length=255, required=True, label='Batch name')
            face_value = forms.DecimalField(max_digits=10, decimal_places=2, min_value=0.01, label='Face value')
            quantity = forms.IntegerField(min_value=1, max_value=1000, initial=10, label='Quantity')
            expiry_date = forms.DateTimeField(label='Expiry date')
            original_owner = forms.ModelChoiceField(queryset=User.objects.all(), required=False, label='Original owner (optional)')

        if request.method == 'POST':
            form = BatchIssueForm(request.POST)
            if form.is_valid():
                batch_name = form.cleaned_data['batch_name']
                face_value = form.cleaned_data['face_value']
                quantity = form.cleaned_data['quantity']
                expiry_date = form.cleaned_data['expiry_date']
                owner = form.cleaned_data.get('original_owner')
                start_date = timezone.now()
                created = 0
                for _ in range(quantity):
                    try:
                        PlatformVoucher.objects.create(
                            face_value=face_value,
                            currency_code='TWD',
                            start_date=start_date,
                            expiry_date=expiry_date,
                            current_holder=owner,
                            original_owner=owner,
                            redeem_code=generate_platform_voucher_redeem_code(),
                            batch_name=batch_name,
                            acquisition_method='platform_issue',
                        )
                        created += 1
                    except Exception:
                        break
                messages.success(request, f'Created {created} platform voucher(s).')
                return redirect('admin:api_platformvoucher_changelist')
        else:
            form = BatchIssueForm(initial={'expiry_date': timezone.now() + timezone.timedelta(days=365)})
        return render(request, 'admin/api/platformvoucher/batch_issue.html', {'form': form, 'opts': self.model._meta})

    def participating_stores_view(self, request):
        """Custom view: select which stores can redeem platform vouchers (accepts_platform_vouchers)."""
        from django import forms

        class ParticipatingStoresForm(forms.Form):
            stores = forms.ModelMultipleChoiceField(
                queryset=Store.objects.none(),
                widget=forms.CheckboxSelectMultiple,
                required=False,
            )

        stores_qs = Store.objects.all().order_by('name').select_related('owner')
        participating_ids = set(
            Store.objects.filter(accepts_platform_vouchers=True).values_list('id', flat=True)
        )

        if request.method == 'POST':
            form = ParticipatingStoresForm(request.POST)
            form.fields['stores'].queryset = stores_qs
            if form.is_valid():
                selected = form.cleaned_data['stores']
                selected_ids = [s.id for s in selected]
                Store.objects.filter(id__in=selected_ids).update(accepts_platform_vouchers=True)
                Store.objects.exclude(id__in=selected_ids).update(accepts_platform_vouchers=False)
                messages.success(request, f'已更新：{len(selected_ids)} 家店家可核銷平台現金券。')
                return redirect('admin:api_platformvoucher_changelist')
        else:
            form = ParticipatingStoresForm()
            form.fields['stores'].queryset = stores_qs

        return render(
            request,
            'admin/api/platformvoucher/participating_stores.html',
            {
                'form': form,
                'stores': stores_qs,
                'participating_ids': participating_ids,
                'opts': self.model._meta,
            },
        )


@admin.register(PlatformVoucherRedemption)
class PlatformVoucherRedemptionAdmin(admin.ModelAdmin):
    list_display = ['id', 'voucher_id', 'user_email', 'store_name', 'amount_used', 'redeemed_at']
    list_filter = ['redeemed_at', 'store']
    search_fields = ['user__email', 'store__name', 'voucher__redeem_code']
    readonly_fields = ['redeemed_at']

    def user_email(self, obj):
        return obj.user.email
    user_email.short_description = '兌換者'

    def store_name(self, obj):
        return obj.store.name
    store_name.short_description = '店家'


@admin.register(PlatformVoucherShareRequest)
class PlatformVoucherShareRequestAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'voucher_id', 'voucher_redeem_code', 'voucher_batch_name',
        'from_user_email', 'to_user_email',
        'share_type', 'status', 'created_at', 'responded_at'
    ]
    list_filter = ['status', 'is_public', 'created_at']
    search_fields = ['from_user__email', 'to_user__email', 'token', 'voucher__redeem_code', 'voucher__batch_name']
    readonly_fields = ['token', 'created_at', 'responded_at']
    date_hierarchy = 'created_at'
    actions = ['cancel_pending_requests']

    def voucher_redeem_code(self, obj):
        return obj.voucher.redeem_code if obj.voucher_id else '—'
    voucher_redeem_code.short_description = '兌換碼'
    voucher_redeem_code.admin_order_field = 'voucher__redeem_code'

    def voucher_batch_name(self, obj):
        return obj.voucher.batch_name or '—' if obj.voucher_id else '—'
    voucher_batch_name.short_description = '批次'
    voucher_batch_name.admin_order_field = 'voucher__batch_name'

    def cancel_pending_requests(self, request, queryset):
        pending = queryset.filter(status='pending')
        count = 0
        for share in pending.select_related('voucher', 'from_user'):
            share.status = 'declined'
            share.responded_at = timezone.now()
            share.save(update_fields=['status', 'responded_at'])
            share.voucher.current_holder = share.from_user
            share.voucher.save(update_fields=['current_holder'])
            count += 1
        self.message_user(request, f'已取消 {count} 筆待處理分享')
    cancel_pending_requests.short_description = '取消所選的待處理分享'

    def from_user_email(self, obj):
        return obj.from_user.email
    from_user_email.short_description = '分享者'

    def to_user_email(self, obj):
        return obj.to_user.email if obj.to_user else '（待領取）'
    to_user_email.short_description = '接收者'

    def share_type(self, obj):
        return '公共池' if obj.is_public else '私人'
    share_type.short_description = '類型'

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('voucher', 'from_user', 'to_user')


# =============================================================================
# QR Code & Claims Admin
# =============================================================================

@admin.register(QRCodeSession)
class QRCodeSessionAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'template_name', 'merchant_email', 'session_token',
        'is_active', 'created_at', 'invalidated_at'
    ]
    list_filter = ['is_active', 'created_at']
    search_fields = ['session_token', 'merchant__email', 'template__coupon_name']
    readonly_fields = ['session_token', 'created_at', 'invalidated_at']
    date_hierarchy = 'created_at'
    
    def template_name(self, obj):
        return obj.template.coupon_name
    template_name.short_description = '範本'
    template_name.admin_order_field = 'template__coupon_name'
    
    def merchant_email(self, obj):
        return obj.merchant.email
    merchant_email.short_description = '商家'
    merchant_email.admin_order_field = 'merchant__email'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('template', 'merchant')


@admin.register(QRCodeClaim)
class QRCodeClaimAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'user_email', 'template_name', 'coupon_id',
        'claimed_at', 'session_token'
    ]
    list_filter = ['claimed_at']
    search_fields = [
        'idempotency_key', 'user__email', 'template__coupon_name',
        'session_token', 'coupon__id'
    ]
    readonly_fields = ['idempotency_key', 'claimed_at']
    date_hierarchy = 'claimed_at'
    
    def user_email(self, obj):
        return obj.user.email
    user_email.short_description = '領取者'
    user_email.admin_order_field = 'user__email'
    
    def template_name(self, obj):
        return obj.template.coupon_name
    template_name.short_description = '範本'
    template_name.admin_order_field = 'template__coupon_name'
    
    def coupon_id(self, obj):
        return obj.coupon.id
    coupon_id.short_description = '優惠券 ID'
    coupon_id.admin_order_field = 'coupon__id'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('user', 'template', 'coupon')


# =============================================================================
# Statistics & Logs Admin
# =============================================================================

@admin.register(Log)
class LogAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'timestamp', 'action', 'user_email',
        'coupon_info', 'template_info', 'has_location'
    ]
    list_filter = ['action', 'timestamp']
    search_fields = ['user__email', 'coupon__coupon_name', 'template__coupon_name']
    readonly_fields = ['timestamp']
    date_hierarchy = 'timestamp'
    
    def user_email(self, obj):
        return obj.user.email if obj.user else '（匿名）'
    user_email.short_description = '使用者'
    user_email.admin_order_field = 'user__email'
    
    def coupon_info(self, obj):
        return f'ID: {obj.coupon.id}' if obj.coupon else '—'
    coupon_info.short_description = '優惠券'
    
    def template_info(self, obj):
        return f'ID: {obj.template.id}' if obj.template else '—'
    template_info.short_description = '範本'
    
    def has_location(self, obj):
        return '✅' if (obj.lat and obj.lng) else '❌'
    has_location.short_description = '位置'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('user', 'coupon', 'template')


@admin.register(CompletedGoal)
class CompletedGoalAdmin(admin.ModelAdmin):
    list_display = ['id', 'user_email', 'name', 'amount', 'completed_date']
    list_filter = ['completed_date']
    search_fields = ['user__email', 'name']
    readonly_fields = ['completed_date']
    date_hierarchy = 'completed_date'
    
    def user_email(self, obj):
        return obj.user.email
    user_email.short_description = '使用者'
    user_email.admin_order_field = 'user__email'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('user')


# =============================================================================
# Phone OTP Admin
# =============================================================================

@admin.register(PhoneOTPRecord)
class PhoneOTPRecordAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'phone_number', 'user_email', 'purpose',
        'otp_code', 'attempt_count', 'is_verified',
        'created_at', 'expires_at', 'is_expired'
    ]
    list_filter = ['purpose', 'is_verified', 'created_at']
    search_fields = ['phone_number', 'user__email', 'otp_code']
    readonly_fields = ['created_at', 'expires_at', 'attempt_count']
    date_hierarchy = 'created_at'
    
    def user_email(self, obj):
        return obj.user.email if obj.user else '（註冊用）'
    user_email.short_description = '使用者'
    user_email.admin_order_field = 'user__email'
    
    def is_expired(self, obj):
        if obj.is_expired():
            return format_html('<span style="color: red;">已過期</span>')
        return format_html('<span style="color: green;">有效</span>')
    is_expired.short_description = '狀態'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('user')


# =============================================================================
# Account Management Admin
# =============================================================================

@admin.register(AccountDeletionLog)
class AccountDeletionLogAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'deleted_user_email', 'deleted_user_id',
        'status', 'deletion_reason', 'initiated_at',
        'completed_at', 'retry_count'
    ]
    list_filter = ['status', 'deleted_at', 'deletion_reason']
    search_fields = ['deleted_user_email', 'deleted_user_id']
    readonly_fields = [
        'deleted_at', 'initiated_at', 'completed_at',
        'stores_anonymized', 'coupons_preserved'
    ]
    date_hierarchy = 'deleted_at'
    actions = ['retry_failed_deletions']
    
    def retry_failed_deletions(self, request, queryset):
        failed = queryset.filter(status='failed')
        count = failed.update(status='pending', retry_count=F('retry_count') + 1)
        self.message_user(request, f'已標記 {count} 筆記錄重試刪除')
    retry_failed_deletions.short_description = '重試失敗的刪除'


# =============================================================================
# UGC Compliance Models (Apple Guideline 1.2)
# =============================================================================

@admin.register(ContentReport)
class ContentReportAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'reporter_email', 'content_display', 'reason',
        'status', 'created_at', 'reviewed_at', 'reviewed_by_email'
    ]
    list_filter = ['status', 'reason', 'created_at', 'reviewed_at']
    search_fields = ['reporter__email', 'details', 'id']
    readonly_fields = ['created_at', 'reviewed_at', 'content_type', 'object_id']
    date_hierarchy = 'created_at'
    actions = ['mark_as_reviewed', 'mark_as_dismissed']
    fieldsets = (
        ('回報資訊', {
            'fields': ('reporter', 'content_type', 'object_id', 'reason', 'details')
        }),
        ('審核資訊', {
            'fields': ('status', 'reviewed_at', 'reviewed_by')
        }),
    )
    
    def reporter_email(self, obj):
        return obj.reporter.email
    reporter_email.short_description = '回報者'
    reporter_email.admin_order_field = 'reporter__email'
    
    def content_display(self, obj):
        if obj.content_object:
            return format_html('{}: {}', obj.content_type.model, str(obj.content_object)[:50])
        return '（已刪除）'
    content_display.short_description = '回報內容'
    
    def reviewed_by_email(self, obj):
        return obj.reviewed_by.email if obj.reviewed_by else '—'
    reviewed_by_email.short_description = '審核者'
    reviewed_by_email.admin_order_field = 'reviewed_by__email'
    
    def mark_as_reviewed(self, request, queryset):
        count = queryset.filter(status='pending').update(
            status='reviewed',
            reviewed_at=timezone.now(),
            reviewed_by=request.user
        )
        self.message_user(request, f'已標記 {count} 筆回報為已審核')
    mark_as_reviewed.short_description = '標記為已審核'
    
    def mark_as_dismissed(self, request, queryset):
        count = queryset.filter(status='pending').update(
            status='dismissed',
            reviewed_at=timezone.now(),
            reviewed_by=request.user
        )
        self.message_user(request, f'已標記 {count} 筆回報為已駁回')
    mark_as_dismissed.short_description = '標記為已駁回'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('reporter', 'reviewed_by', 'content_type')


@admin.register(BlockedMerchant)
class BlockedMerchantAdmin(admin.ModelAdmin):
    list_display = ['id', 'user_email', 'store_name', 'created_at']
    list_filter = ['created_at']
    search_fields = ['user__email', 'store__name']
    readonly_fields = ['created_at']
    date_hierarchy = 'created_at'
    
    def user_email(self, obj):
        return obj.user.email
    user_email.short_description = '使用者'
    user_email.admin_order_field = 'user__email'
    
    def store_name(self, obj):
        return obj.store.name
    store_name.short_description = '店家'
    store_name.admin_order_field = 'store__name'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('user', 'store')


@admin.register(EULAAcceptance)
class EULAAcceptanceAdmin(admin.ModelAdmin):
    list_display = ['id', 'merchant_email', 'version', 'accepted_at', 'ip_address']
    list_filter = ['version', 'accepted_at']
    search_fields = ['merchant__email', 'ip_address']
    readonly_fields = ['accepted_at']
    date_hierarchy = 'accepted_at'
    
    def merchant_email(self, obj):
        return obj.merchant.email
    merchant_email.short_description = '商家'
    merchant_email.admin_order_field = 'merchant__email'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('merchant')


@admin.register(ModerationAction)
class ModerationActionAdmin(admin.ModelAdmin):
    list_display = ['id', 'report_id', 'admin_email', 'action', 'created_at']
    list_filter = ['action', 'created_at']
    search_fields = ['admin__email', 'notes', 'report__id']
    readonly_fields = ['created_at']
    date_hierarchy = 'created_at'
    
    def report_id(self, obj):
        return f'Report #{obj.report.id}'
    report_id.short_description = '回報'
    report_id.admin_order_field = 'report__id'
    
    def admin_email(self, obj):
        return obj.admin.email
    admin_email.short_description = '管理員'
    admin_email.admin_order_field = 'admin__email'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('admin', 'report')


@admin.register(ViolationRecord)
class ViolationRecordAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'merchant_email', 'violation_type', 
        'report_id', 'action_id', 'created_at'
    ]
    list_filter = ['violation_type', 'created_at']
    search_fields = ['merchant__email', 'notes']
    readonly_fields = ['created_at']
    date_hierarchy = 'created_at'
    
    def merchant_email(self, obj):
        return obj.merchant.email
    merchant_email.short_description = '商家'
    merchant_email.admin_order_field = 'merchant__email'
    
    def report_id(self, obj):
        return f'#{obj.report.id}' if obj.report else '—'
    report_id.short_description = '相關回報'
    
    def action_id(self, obj):
        return f'#{obj.action.id}' if obj.action else '—'
    action_id.short_description = '相關動作'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('merchant', 'report', 'action')


# =============================================================================
# Admin Site Customization
# =============================================================================

admin.site.site_header = 'CouPro 管理後台'
admin.site.site_title = 'CouPro Admin'
admin.site.index_title = '歡迎使用 CouPro 管理系統'