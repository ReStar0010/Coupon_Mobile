from django.contrib import admin
from django.utils.html import format_html
from django.db.models import Case, Count, F, IntegerField, Sum, Value, When
from django.utils import timezone
from django.urls import path
from django.shortcuts import render, redirect
from django.contrib import messages
from .models import *
from .utils import generate_platform_voucher_redeem_code
from .views.authentication import (
    send_merchant_application_approved_email,
    send_merchant_application_rejected_email,
)


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

@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'user_email', 'phone_number', 'verified_status', 
        'coupons_used_count', 'total_savings', 'last_logged_in'
    ]
    list_filter = ['verified', 'phone_verified', 'last_logged_in']
    search_fields = ['user__email', 'user__username', 'phone_number']
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
        'address', 'has_location', 'unified_redeem_code'
    ]
    list_filter = ['store_type']
    search_fields = ['name', 'owner__email', 'address', 'unified_redeem_code']
    readonly_fields = ['unified_redeem_code']
    inlines = [CouponTemplateInline, CouponInline]
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
    list_display = [
        'id', 'coupon_name', 'store_name', 'quantity_status',
        'start_date', 'expiry_date', 'is_active', 'draw_probability'
    ]
    list_filter = ['is_active', 'store__store_type', 'start_date', 'expiry_date']
    search_fields = ['coupon_name', 'store__name', 'template_redeem_code']
    readonly_fields = ['created_at', 'remaining_quantity']
    filter_horizontal = ['tags']
    date_hierarchy = 'start_date'
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
    actions = ['deactivate_templates', 'activate_templates']
    
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
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('store')


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'coupon_name', 'store_name', 'coupon_type',
        'holder_info', 'expiry_date', 'is_expired', 'redemption_info'
    ]
    list_filter = [
        'coupon_type', 'usage_per_day', 'acquisition_method',
        'start_date', 'expiry_date'
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
    actions = ['mark_as_expired']
    
    def store_name(self, obj):
        return obj.store.name
    store_name.short_description = '店家'
    store_name.admin_order_field = 'store__name'
    
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
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('store', 'template', 'current_holder', 'original_owner')


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

@admin.register(PlatformVoucher)
class PlatformVoucherAdmin(admin.ModelAdmin):
    change_list_template = 'admin/api/platformvoucher/change_list.html'
    list_display = [
        'id', 'redeem_code', 'face_value', 'currency_code',
        'current_holder_email', 'batch_name', 'acquisition_method',
        'start_date', 'expiry_date', 'created_at', 'is_redeemed_display'
    ]
    list_filter = ['acquisition_method', 'currency_code', 'created_at']
    search_fields = ['redeem_code', 'batch_name', 'current_holder__email', 'original_owner__email']
    readonly_fields = ['redeem_code', 'created_at']
    date_hierarchy = 'created_at'
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

    def is_redeemed_display(self, obj):
        from api.models import PlatformVoucherRedemption
        return '是' if PlatformVoucherRedemption.objects.filter(voucher=obj).exists() else '否'
    is_redeemed_display.short_description = '已兌換'

    def get_urls(self):
        urls = super().get_urls()
        extra = [
            path('batch-issue/', self.admin_site.admin_view(self.batch_issue_view), name='api_platformvoucher_batch_issue'),
            path('participating-stores/', self.admin_site.admin_view(self.participating_stores_view), name='api_platformvoucher_participating_stores'),
        ]
        return extra + urls

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
    list_filter = ['redeemed_at']
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
        'id', 'voucher_id', 'from_user_email', 'to_user_email',
        'share_type', 'status', 'created_at', 'responded_at'
    ]
    list_filter = ['status', 'is_public', 'created_at']
    search_fields = ['from_user__email', 'to_user__email', 'token', 'voucher__redeem_code']
    readonly_fields = ['token', 'created_at', 'responded_at']
    date_hierarchy = 'created_at'

    def from_user_email(self, obj):
        return obj.from_user.email
    from_user_email.short_description = '分享者'

    def to_user_email(self, obj):
        return obj.to_user.email if obj.to_user else '（待領取）'
    to_user_email.short_description = '接收者'

    def share_type(self, obj):
        return '公共池' if obj.is_public else '私人'
    share_type.short_description = '類型'


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