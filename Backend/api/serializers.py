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