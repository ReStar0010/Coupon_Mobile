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

class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField(help_text="Email to send the reset link")

class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField(help_text="Email to send the reset link")
    token = serializers.CharField(help_text="Password reset token")
    new_password = serializers.CharField(help_text="New password", style={'input_type': 'password'})

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