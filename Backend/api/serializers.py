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