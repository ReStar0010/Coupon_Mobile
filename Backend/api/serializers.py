from rest_framework import serializers

class ConsolidateCouponSerializer(serializers.Serializer):
    """
    Serializer for consolidating coupons with user's information.
    """
    template_id = serializers.IntegerField(required=True, help_text="ID of the coupon template")
    phone_number = serializers.CharField(max_length=15, required=True, help_text="User's phone number")
     
class RefreshRedeemCodeSerializer(serializers.Serializer):
    """
    Serializer for refreshing the redeem code of a coupon template.
    """
    template_id = serializers.IntegerField(required=True, help_text="ID of the coupon template")
    new_redeem_code = serializers.CharField(max_length=100, required=True, help_text="New redeem code for the template")

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(help_text="user's registered email")
    password = serializers.CharField(help_text="user's password", style={'input_type': 'password'})
    client_type = serializers.ChoiceField(
        choices=['merchant', 'user'],
        required=True,
        help_text="merchant = 商家端 App；user = 使用者端 App",
    )

class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField(help_text="Email to send the reset link")

class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField(help_text="Email to send the reset link")
    token = serializers.CharField(help_text="Password reset token")
    new_password = serializers.CharField(help_text="New password", style={'input_type': 'password'})

class RegistrationOTPSendSerializer(serializers.Serializer):
    """
    Serializer for POST /api/register/send-otp/
    Sends OTP to phone number for registration (unauthenticated).
    """
    phone_number = serializers.CharField(
        max_length=20,
        help_text="Taiwan mobile number (09XXXXXXXX format)"
    )

    def validate_phone_number(self, value):
        """Validate Taiwan mobile phone number format."""
        import re
        # Remove any formatting (dashes, spaces)
        normalized = re.sub(r'[-\s()]', '', value)

        # Validate Taiwan mobile format: 09XXXXXXXX (10 digits)
        if not re.match(r'^09\d{8}$', normalized):
            raise serializers.ValidationError(
                "請輸入有效的台灣手機號碼 (09開頭，共10碼)"
            )
        return normalized

class RegistrationOTPVerifySerializer(serializers.Serializer):
    """
    Serializer for POST /api/register/verify-otp/
    Verifies OTP and creates user account with phone + password.
    """
    phone_number = serializers.CharField(
        max_length=20,
        help_text="Phone number that received the OTP"
    )
    otp_code = serializers.CharField(
        max_length=6,
        min_length=6,
        help_text="6-digit verification code"
    )
    password = serializers.CharField(
        help_text="Password for the new account",
        style={'input_type': 'password'}
    )

    def validate_phone_number(self, value):
        """Validate Taiwan mobile phone number format."""
        import re
        normalized = re.sub(r'[-\s()]', '', value)
        if not re.match(r'^09\d{8}$', normalized):
            raise serializers.ValidationError(
                "請輸入有效的台灣手機號碼 (09開頭，共10碼)"
            )
        return normalized

    def validate_otp_code(self, value):
        """Validate OTP code format."""
        import re
        if not re.match(r'^\d{6}$', value):
            raise serializers.ValidationError(
                "驗證碼必須為6位數字"
            )
        return value

class PhoneLoginSerializer(serializers.Serializer):
    """
    Serializer for POST /api/login/ with phone_number OR email.
    Mutually exclusive: exactly one of phone_number or email must be provided.
    """
    phone_number = serializers.CharField(
        max_length=20,
        required=False,
        help_text="Taiwan mobile number (09XXXXXXXX format)"
    )
    email = serializers.EmailField(
        required=False,
        help_text="User's registered email"
    )
    password = serializers.CharField(
        help_text="User's password",
        style={'input_type': 'password'}
    )
    client_type = serializers.ChoiceField(
        choices=['merchant', 'user'],
        required=True,
        help_text="merchant = 商家端 App；user = 使用者端 App"
    )

    def validate(self, attrs):
        """Validate that exactly one of phone_number or email is provided."""
        phone = attrs.get('phone_number')
        email = attrs.get('email')

        if not phone and not email:
            raise serializers.ValidationError(
                "必須提供手機號碼或電子郵件"
            )
        if phone and email:
            raise serializers.ValidationError(
                "只能提供手機號碼或電子郵件其中一個"
            )
        return attrs

    def validate_phone_number(self, value):
        """Validate Taiwan mobile phone number format if provided."""
        if value:
            import re
            normalized = re.sub(r'[-\s()]', '', value)
            if not re.match(r'^09\d{8}$', normalized):
                raise serializers.ValidationError(
                    "請輸入有效的台灣手機號碼 (09開頭，共10碼)"
                )
            return normalized
        return value

class PhoneForgotPasswordSerializer(serializers.Serializer):
    """
    Serializer for POST /api/forgot-password/phone/send-otp/
    Sends password reset OTP to registered phone number.
    """
    phone_number = serializers.CharField(
        max_length=20,
        help_text="Registered phone number"
    )

    def validate_phone_number(self, value):
        """Validate Taiwan mobile phone number format."""
        import re
        normalized = re.sub(r'[-\s()]', '', value)
        if not re.match(r'^09\d{8}$', normalized):
            raise serializers.ValidationError(
                "請輸入有效的台灣手機號碼 (09開頭，共10碼)"
            )
        return normalized

class PhoneResetPasswordSerializer(serializers.Serializer):
    """
    Serializer for POST /api/forgot-password/phone/reset/
    Verifies OTP and resets password for phone-registered user.
    """
    phone_number = serializers.CharField(
        max_length=20,
        help_text="Phone number that received the OTP"
    )
    otp_code = serializers.CharField(
        max_length=6,
        min_length=6,
        help_text="6-digit verification code"
    )
    new_password = serializers.CharField(
        help_text="New password",
        style={'input_type': 'password'}
    )

    def validate_phone_number(self, value):
        """Validate Taiwan mobile phone number format."""
        import re
        normalized = re.sub(r'[-\s()]', '', value)
        if not re.match(r'^09\d{8}$', normalized):
            raise serializers.ValidationError(
                "請輸入有效的台灣手機號碼 (09開頭，共10碼)"
            )
        return normalized

    def validate_otp_code(self, value):
        """Validate OTP code format."""
        import re
        if not re.match(r'^\d{6}$', value):
            raise serializers.ValidationError(
                "驗證碼必須為6位數字"
            )
        return value

class RedeemCouponSerializer(serializers.Serializer):
    """
    Serializer for redeeming a coupon.
    """
    redeem_code = serializers.CharField(max_length=100, help_text="Redeem code for the coupon")

class DrawCouponSerializer(serializers.Serializer):
    """
    Serializer for drawing a coupon.
    """
    template_id = serializers.IntegerField(required=True, help_text="ID of the coupon template to draw from")

class SetSavingsGoalSerializer(serializers.Serializer):
    """
    Serializer for setting a user's savings goal.
    """
    goal_name = serializers.CharField(max_length=100, help_text="Name of the savings goal")
    goal_amount = serializers.DecimalField(max_digits=10, decimal_places=2, help_text="Target amount for the savings goal")
    goal_image = serializers.ImageField(required=False, help_text="Image representing the savings goal")

class MerchantRegisterSerializer(serializers.Serializer):
    """
    Serializer for merchant registration.
    """
    email = serializers.EmailField(help_text="Merchant's email address")
    password = serializers.CharField(help_text="Merchant's password", style={'input_type': 'password'})
    phone = serializers.CharField(max_length=20, help_text="Merchant contact phone")
    contact_person = serializers.CharField(max_length=100, help_text="Contact person name")
    contact_info = serializers.CharField(max_length=100, required=False, allow_blank=True, allow_null=True, help_text="Additional contact info (e.g., Line ID)")
    # Store information
    store_name = serializers.CharField(max_length=100, help_text="Store name")
    store_address = serializers.CharField(max_length=200, help_text="Store address")
    store_lat = serializers.FloatField(help_text="Store latitude")
    store_lng = serializers.FloatField(help_text="Store longitude")
    business_hours = serializers.CharField(required=False, allow_blank=True, allow_null=True, help_text="Business hours")

class CouponTemplateSerializer(serializers.Serializer):
    """
    Serializer for coupon template CRUD operations.
    """
    id = serializers.IntegerField(read_only=True)
    store_id = serializers.IntegerField(required=False, help_text="Store ID (auto-set from authenticated merchant)")
    coupon_name = serializers.CharField(max_length=100, help_text="Coupon name")
    coupon_detail = serializers.CharField(help_text="Coupon detail/description")
    important_notes = serializers.CharField(required=False, allow_blank=True, help_text="Important notes")
    image_url = serializers.CharField(max_length=255, required=False, allow_blank=True, help_text="Image URL")
    estimated_savings = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True, help_text="Estimated savings amount")
    template_redeem_code = serializers.CharField(max_length=6, required=False, allow_blank=True, allow_null=True, help_text="Template redeem code")
    total_quantity = serializers.IntegerField(help_text="Total quantity of coupons")
    remaining_quantity = serializers.IntegerField(read_only=True, help_text="Remaining quantity")
    start_date = serializers.DateTimeField(help_text="Start date")
    expiry_date = serializers.DateTimeField(help_text="Expiry date")
    draw_probability = serializers.FloatField(required=False, default=0.5, help_text="Draw probability (0-1)")
    is_active = serializers.BooleanField(required=False, default=True, help_text="Is template active")
    created_at = serializers.DateTimeField(read_only=True)
    tags = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
        help_text="List of tag IDs"
    )

class MerchantRedeemSerializer(serializers.Serializer):
    """
    Serializer for merchant coupon redemption using phone number and template ID.
    """
    template_id = serializers.IntegerField(required=True, help_text="ID of the coupon template")
    phone_number = serializers.CharField(max_length=15, required=True, help_text="User's phone number")

class MerchantProfileSerializer(serializers.Serializer):
    """
    Serializer for merchant profile.
    """
    phone = serializers.CharField(max_length=20, required=False)
    contact_person = serializers.CharField(max_length=100, required=False)
    contact_info = serializers.CharField(max_length=100, required=False, allow_blank=True)

class StoreSerializer(serializers.Serializer):
    """
    Serializer for store information.
    """
    name = serializers.CharField(max_length=100, required=False)
    address = serializers.CharField(max_length=200, required=False)
    lat = serializers.FloatField(required=False)
    lng = serializers.FloatField(required=False)
    business_hours = serializers.CharField(required=False, allow_blank=True)

class SendOTPSerializer(serializers.Serializer):
    """
    Serializer for POST /api/phone-otp/send/
    """
    phone_number = serializers.CharField(
        max_length=20,
        help_text="Taiwan mobile number (09XXXXXXXX format)"
    )

    def validate_phone_number(self, value):
        """Validate Taiwan mobile phone number format."""
        import re
        # Remove any formatting (dashes, spaces)
        normalized = re.sub(r'[-\s()]', '', value)

        # Validate Taiwan mobile format: 09XXXXXXXX (10 digits)
        if not re.match(r'^09\d{8}$', normalized):
            raise serializers.ValidationError(
                "請輸入有效的台灣手機號碼 (09開頭，共10碼)"
            )
        return normalized


class VerifyOTPSerializer(serializers.Serializer):
    """
    Serializer for POST /api/phone-otp/verify/
    """
    phone_number = serializers.CharField(
        max_length=20,
        help_text="Phone number that received the OTP"
    )
    otp_code = serializers.CharField(
        max_length=6,
        min_length=6,
        help_text="6-digit verification code"
    )

    def validate_phone_number(self, value):
        """Validate Taiwan mobile phone number format."""
        import re
        normalized = re.sub(r'[-\s()]', '', value)
        if not re.match(r'^09\d{8}$', normalized):
            raise serializers.ValidationError(
                "請輸入有效的台灣手機號碼 (09開頭，共10碼)"
            )
        return normalized

    def validate_otp_code(self, value):
        """Validate OTP code format."""
        import re
        if not re.match(r'^\d{6}$', value):
            raise serializers.ValidationError(
                "驗證碼必須為6位數字"
            )
        return value


class UnifiedRedemptionCodeSerializer(serializers.Serializer):
    """
    Serializer for unified redemption code generation response.
    """
    unified_redeem_code = serializers.CharField(max_length=6, read_only=True, help_text="Generated 6-digit unified redemption code")
    store_id = serializers.IntegerField(read_only=True, help_text="Store ID")
    store_name = serializers.CharField(max_length=100, read_only=True, help_text="Store name")


class UnifiedRedemptionValidateSerializer(serializers.Serializer):
    """
    Serializer for unified redemption code validation response.
    """
    store = serializers.DictField(read_only=True, help_text="Store information (id, name, address)")
    available_coupons = serializers.ListField(read_only=True, help_text="List of available coupons for the consumer")
    available_platform_vouchers = serializers.ListField(read_only=True, required=False, allow_empty=True, help_text="List of platform vouchers redeemable at this store (when store participates)")


class PlatformVoucherRedeemRequestSerializer(serializers.Serializer):
    """Request body for POST /api/platform-voucher/<id>/redeem/ (store's 6-digit code)."""
    redeem_code = serializers.CharField(max_length=6, min_length=6, help_text="Store's unified redemption code (6 digits)")


class PlatformVoucherListSerializer(serializers.Serializer):
    """List item for GET /api/platform-vouchers/ (contract: id, face_value, currency_code, redeem_code, expiry_date, batch_name)."""
    id = serializers.IntegerField(read_only=True)
    face_value = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    currency_code = serializers.CharField(read_only=True)
    redeem_code = serializers.CharField(read_only=True)
    expiry_date = serializers.DateTimeField(read_only=True)
    batch_name = serializers.CharField(read_only=True, allow_blank=True)


class PlatformVoucherDetailSerializer(serializers.Serializer):
    """Detail for GET /api/platform-vouchers/<id>/ (contract: id, face_value, ..., is_redeemed, current_holder_id)."""
    id = serializers.IntegerField(read_only=True)
    face_value = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    currency_code = serializers.CharField(read_only=True)
    start_date = serializers.DateTimeField(read_only=True)
    expiry_date = serializers.DateTimeField(read_only=True)
    batch_name = serializers.CharField(read_only=True, allow_blank=True)
    redeem_code = serializers.CharField(read_only=True)
    is_redeemed = serializers.BooleanField(read_only=True)
    current_holder_id = serializers.IntegerField(read_only=True, allow_null=True)


class GenerateQRSessionSerializer(serializers.Serializer):
    """
    Serializer for POST /api/merchant/qr-session/generate/
    """
    template_id = serializers.IntegerField(required=True, help_text="ID of the coupon template to generate QR code for")


class InvalidateSessionSerializer(serializers.Serializer):
    """
    Serializer for POST /api/merchant/qr-session/{session_id}/invalidate/
    Note: session_id is passed as URL parameter, not in request body.
    """
    pass  # No request body needed, session_id is in URL


class ClaimCouponRequestSerializer(serializers.Serializer):
    """
    Serializer for POST /api/qr-claim/claim/
    """
    template_id = serializers.IntegerField(required=True, help_text="ID of the coupon template (from QR code)")
    session_token = serializers.CharField(required=True, max_length=100, help_text="Session token from QR code (UUID4 format)")
    idempotency_key = serializers.CharField(required=False, max_length=64, allow_blank=True, help_text="Optional idempotency key to prevent duplicate claims on retry")


class ClaimByTokenRequestSerializer(serializers.Serializer):
    """
    Serializer for POST /api/qr-claim/claim/ (claim-by-token deep link flow).
    claim_token = session_token from QRCodeSession; backend resolves to template.
    """
    claim_token = serializers.CharField(required=True, max_length=100, help_text="Claim token from the claim URL (same as session_token)")
    idempotency_key = serializers.CharField(required=False, max_length=64, allow_blank=True, help_text="Optional; for retry idempotency")


class ClaimCouponResponseSerializer(serializers.Serializer):
    """
    Serializer for claim success response.
    """
    message = serializers.CharField(read_only=True, help_text="Success message")
    coupon_id = serializers.IntegerField(read_only=True, help_text="ID of the created coupon")
    coupon_name = serializers.CharField(read_only=True, help_text="Name of the claimed coupon")
    template_id = serializers.IntegerField(read_only=True, help_text="ID of the template this coupon was created from")
    remaining_quantity = serializers.IntegerField(read_only=True, help_text="Remaining quantity in the template after claim")
    acquisition_method = serializers.CharField(read_only=True, help_text="How the coupon was acquired")


# Account Deletion Serializers (App Store Guideline 5.1.1 Compliance)

class AccountDeletionSerializer(serializers.Serializer):
    """
    Serializer for merchant account deletion request.
    """
    password = serializers.CharField(
        write_only=True, 
        required=True,
        style={'input_type': 'password'},
        help_text="Current account password for verification"
    )
    acknowledgments = serializers.ListField(
        child=serializers.CharField(),
        required=True,
        help_text="List of warning codes the user has acknowledged (e.g., ['ACTIVE_COUPONS', 'DATA_LOSS'])"
    )


class PreDeleteCheckSerializer(serializers.Serializer):
    """
    Serializer for pre-deletion check response.
    """
    can_delete = serializers.BooleanField(
        read_only=True,
        help_text="Whether the account can be deleted"
    )
    warnings = serializers.ListField(
        child=serializers.DictField(),
        read_only=True,
        help_text="List of warnings about the deletion"
    )
    data_summary = serializers.DictField(
        read_only=True,
        help_text="Summary of data that will be affected"
    )


# =============================================================================
# UGC Compliance Serializers (Apple Guideline 1.2)
# =============================================================================

from .models import REPORT_REASONS, REPORT_STATUS, MODERATION_ACTIONS, VIOLATION_TYPES


class ContentReportCreateSerializer(serializers.Serializer):
    """
    Serializer for creating a content report.
    POST /api/content/{type}/{id}/report/
    """
    reason = serializers.ChoiceField(
        choices=REPORT_REASONS,
        help_text="Report reason category"
    )
    details = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=1000,
        help_text="Optional additional details"
    )


class ContentReportSerializer(serializers.Serializer):
    """
    Serializer for content report responses.
    """
    id = serializers.IntegerField(read_only=True)
    reason = serializers.CharField(read_only=True)
    reason_display = serializers.SerializerMethodField()
    status = serializers.CharField(read_only=True)
    status_display = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(read_only=True)
    reviewed_at = serializers.DateTimeField(read_only=True, allow_null=True)
    content_type = serializers.CharField(source='content_type.model', read_only=True)
    object_id = serializers.IntegerField(read_only=True)

    def get_reason_display(self, obj) -> str:
        return dict(REPORT_REASONS).get(obj.reason, obj.reason)

    def get_status_display(self, obj) -> str:
        return dict(REPORT_STATUS).get(obj.status, obj.status)


class BlockedMerchantCreateSerializer(serializers.Serializer):
    """
    Serializer for blocking a merchant.
    POST /api/user/blocked-merchants/add/
    """
    store_id = serializers.IntegerField(help_text="ID of the store to block")


class BlockedStoreSummarySerializer(serializers.Serializer):
    """Nested store summary for blocked merchant responses (matches mobile contract)."""
    id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(read_only=True)
    address = serializers.CharField(read_only=True, allow_null=True)
    image_url = serializers.CharField(read_only=True, allow_null=True)


class BlockedMerchantSerializer(serializers.Serializer):
    """
    Serializer for blocked merchant responses.
    Returns nested `store` object for mobile (id, name, address, image_url).
    """
    id = serializers.IntegerField(read_only=True)
    store = BlockedStoreSummarySerializer(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)


class EULAAcceptSerializer(serializers.Serializer):
    """
    Serializer for accepting EULA.
    POST /api/merchant/eula/accept/
    """
    version = serializers.CharField(max_length=20, help_text="EULA version to accept")
    agreed = serializers.BooleanField(help_text="Must be true to accept")

    def validate_agreed(self, value):
        if not value:
            raise serializers.ValidationError("您必須同意使用條款才能繼續")
        return value


class EULAStatusSerializer(serializers.Serializer):
    """
    Serializer for EULA status response.
    GET /api/merchant/eula/status/
    """
    has_accepted = serializers.BooleanField(read_only=True)
    accepted_version = serializers.CharField(read_only=True, allow_null=True)
    current_version = serializers.CharField(read_only=True)
    needs_acceptance = serializers.BooleanField(read_only=True)


class EULAContentSerializer(serializers.Serializer):
    """
    Serializer for EULA content response.
    GET /api/merchant/eula/content/
    """
    version = serializers.CharField(read_only=True)
    content = serializers.CharField(read_only=True)
    content_guidelines = serializers.CharField(read_only=True)


class ModerationActionCreateSerializer(serializers.Serializer):
    """
    Serializer for creating a moderation action.
    POST /api/admin/moderation/reports/{id}/action/
    """
    action = serializers.ChoiceField(
        choices=MODERATION_ACTIONS,
        help_text="Action type to take"
    )
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=2000,
        help_text="Admin notes/justification"
    )


class ModerationActionSerializer(serializers.Serializer):
    """
    Serializer for moderation action responses.
    """
    id = serializers.IntegerField(read_only=True)
    report_id = serializers.IntegerField(source='report.id', read_only=True)
    admin_email = serializers.CharField(source='admin.email', read_only=True)
    action = serializers.CharField(read_only=True)
    action_display = serializers.SerializerMethodField()
    notes = serializers.CharField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)

    def get_action_display(self, obj) -> str:
        return dict(MODERATION_ACTIONS).get(obj.action, obj.action)


class ViolationRecordSerializer(serializers.Serializer):
    """
    Serializer for violation record responses.
    """
    id = serializers.IntegerField(read_only=True)
    merchant_id = serializers.IntegerField(source='merchant.id', read_only=True)
    merchant_email = serializers.CharField(source='merchant.email', read_only=True)
    violation_type = serializers.CharField(read_only=True)
    violation_type_display = serializers.SerializerMethodField()
    notes = serializers.CharField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)

    def get_violation_type_display(self, obj) -> str:
        return dict(VIOLATION_TYPES).get(obj.violation_type, obj.violation_type)


class ModerationQueueItemSerializer(serializers.Serializer):
    """
    Serializer for moderation queue items.
    GET /api/admin/moderation/queue/
    """
    id = serializers.IntegerField(read_only=True)
    reporter_email = serializers.CharField(source='reporter.email', read_only=True)
    content_type = serializers.CharField(source='content_type.model', read_only=True)
    object_id = serializers.IntegerField(read_only=True)
    reason = serializers.CharField(read_only=True)
    reason_display = serializers.SerializerMethodField()
    details = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    hours_since_report = serializers.SerializerMethodField()
    is_escalated = serializers.SerializerMethodField()

    def get_reason_display(self, obj) -> str:
        return dict(REPORT_REASONS).get(obj.reason, obj.reason)

    def get_hours_since_report(self, obj) -> float:
        from django.utils import timezone
        delta = timezone.now() - obj.created_at
        return round(delta.total_seconds() / 3600, 1)

    def get_is_escalated(self, obj) -> bool:
        from django.conf import settings
        hours = self.get_hours_since_report(obj)
        return hours >= getattr(settings, 'ESCALATION_HOURS_WARNING', 20)


class ModerationStatsSerializer(serializers.Serializer):
    """
    Serializer for moderation dashboard statistics.
    GET /api/admin/moderation/stats/
    """
    pending_count = serializers.IntegerField(read_only=True)
    escalated_count = serializers.IntegerField(read_only=True)
    reviewed_today = serializers.IntegerField(read_only=True)
    avg_response_hours = serializers.FloatField(read_only=True, allow_null=True)


# --- 009 Coupon Date-Range and Cost Analytics: response extensions ---


class TemplateAnalyticsCostExtrasSerializer(serializers.Serializer):
    """
    Optional response fields for template analytics (exclusive templates only).
    GET /api/merchant/coupon-templates/{id}/analytics/ — date_range_cost, date_range_cost_currency.
    """
    date_range_cost = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=0, required=False, allow_null=True
    )
    date_range_cost_currency = serializers.CharField(
        max_length=10, required=False, allow_null=True, allow_blank=True
    )


class MerchantStatisticsCostExtrasSerializer(serializers.Serializer):
    """
    Response extensions for merchant statistics (今日成本).
    GET /api/merchant/statistics/ — today_cost, today_cost_currency.
    """
    today_cost = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=0, required=True
    )
    today_cost_currency = serializers.CharField(
        max_length=10, required=False, allow_null=True, allow_blank=True
    )