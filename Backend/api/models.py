from django.db import models
from django.contrib.auth.models import User  # Import Django's default User model
from django.utils import timezone
import random

# Profile model for password reset functionality
class PasswordResetProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='password_reset')
    token = models.CharField(max_length=100, null=True, blank=True)
    token_created_at = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"Password Reset Profile - {self.user.email}"

# Profile model for Students
class StudentProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')

    # phone number
    phone_number = models.CharField(max_length=20, null=True, blank=True, unique=True)

    # Email verification
    verified = models.BooleanField(default=False)
    email_verification_token = models.CharField(max_length=64, null=True, blank=True, unique=True) # Ensure token is unique

    # Statistics tracking fields
    coupons_used_count = models.IntegerField(default=0)
    total_savings = models.DecimalField(max_digits=10, decimal_places=2, default=0)  # type: ignore
    monthly_savings = models.DecimalField(max_digits=10, decimal_places=2, default=0) # type: ignore
    last_savings_reset = models.DateField(null=True, blank=True)
    
    # Savings goal settings
    savings_goal_name = models.CharField(max_length=100, null=True, blank=True)
    savings_goal_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    savings_goal_image = models.CharField(max_length=200, null=True, blank=True)  # URL to the image

    # last draw time
    last_draw_time = models.DateTimeField(null=True, blank=True)

    # last logged in time
    last_logged_in = models.DateTimeField(null=True, blank=True)
 
    def update_monthly_savings(self):
        """
        Check if it's a new month and reset monthly_savings if needed
        """
        today = timezone.now().date()
        
        # If this is the first time (no last reset date) or it's a new month
        if not self.last_savings_reset or self.last_savings_reset.month != today.month or self.last_savings_reset.year != today.year:
            self.monthly_savings = 0
            self.last_savings_reset = today
            self.save()
    
    def __str__(self):
        return f"Student Profile - {self.user.email}"

# Profile model for Merchants
class MerchantProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='merchant_profile')

    # Merchant contact informations
    phone = models.CharField(max_length=20) # Merchant contact phone
    contact_person = models.CharField(max_length=100)
    contact_info = models.CharField(max_length=100, help_text="e.g., Line ID or alternative phone") # Combined contact info

    def __str__(self):
        return f"{self.user.email} - Merchant Profile"

class Store(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_stores', limit_choices_to={'groups__name': "Merchant"})

    # store information
    name = models.CharField(max_length=100)
    lat = models.FloatField()
    lng = models.FloatField()
    address = models.CharField(max_length=200)
    business_hours = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name

# ADD: Tags Model for Coupon
class Tag(models.Model):
    name = models.CharField(max_length=50, unique=True)
    display_name = models.CharField(max_length=50)
    
    def __str__(self):
        return self.display_name


# Model for coupon templates (for batch creation)
class CouponTemplate(models.Model):
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='coupon_templates')
    coupon_name = models.CharField(max_length=100)
    coupon_detail = models.TextField()
    important_notes = models.TextField(blank=True, null=True)
    image_url = models.CharField(max_length=255, blank=True, null=True)
    estimated_savings = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    template_redeem_code = models.CharField(max_length=6, null=True, blank=True, help_text="Template redeem code for exclusive coupons")
    # ADD: tags
    tags = models.ManyToManyField(Tag, blank=True, related_name='coupon_templates')

    # For daily draw functionality
    total_quantity = models.PositiveIntegerField(default=1)
    remaining_quantity = models.PositiveIntegerField(default=1)
    start_date = models.DateTimeField()
    expiry_date = models.DateTimeField()
    
    # Daily drawing settings
    draw_probability = models.FloatField(default=0.5, help_text="Probability (0-1) of successful draw")


    # remove this since it's not used
    # draw_limit_per_day = models.PositiveIntegerField(default=1, help_text="How many times a user can draw per day")
    
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    
    def generate_coupon(self, recipient=None):
        """Generate a new coupon from this template"""
        if self.remaining_quantity <= 0:
            return None
            
        coupon = Coupon(
            store=self.store,
            template=self,
            coupon_name=self.coupon_name,
            coupon_detail=self.coupon_detail,
            important_notes=self.important_notes,
            start_date=self.start_date,
            expiry_date=self.expiry_date,
            image_url=self.image_url,
            coupon_type='exclusive',
            estimated_savings=self.estimated_savings,
            original_owner=recipient,
            last_holder=None,
            current_holder=recipient,
            redeem_code=self.template_redeem_code if self.template_redeem_code else None,
        )
        coupon.save()
        coupon.tags.set(self.tags.all())  # Set tags for the coupon        
        
        # Decrease remaining quantity
        self.remaining_quantity -= 1
        if self.remaining_quantity <= 0:
            self.is_active = False
        self.save()
        
        return coupon
    
    def __str__(self):
        return f"Template: {self.coupon_name} ({self.remaining_quantity}/{self.total_quantity})"

class Coupon(models.Model):
    store = models.ForeignKey(Store, on_delete=models.CASCADE)
    template = models.ForeignKey(CouponTemplate, on_delete=models.SET_NULL, null=True, blank=True, related_name='coupons')

    # coupon information
    coupon_name = models.CharField(max_length=100)  # 優惠名稱
    coupon_detail = models.TextField()  # 優惠內容
    important_notes = models.TextField(blank=True, null=True)  # 注意事項
    start_date = models.DateTimeField()  # 起始日期
    expiry_date = models.DateTimeField()  # 到期日期
    image_url = models.CharField(max_length=255, blank=True, null=True)  # 優惠券或店家圖片URL
    COUPON_TYPE_CHOICES = [
        ('store', '隨取及用'),
        ('exclusive', '專屬優惠'),
    ]
    coupon_type = models.CharField(max_length=10, choices=COUPON_TYPE_CHOICES, default='store')
    estimated_savings = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Estimated amount saved in TWD")
    # ADD: tags
    tags = models.ManyToManyField(Tag, blank=True, related_name='coupons')

    # source_user should be NULL for 'store' type coupons
    original_owner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='owned_coupons')
    last_holder = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='last_coupons')
    current_holder = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='held_coupons')
    
    # redemption code
    redeem_code = models.CharField(max_length=6, null=True, blank=True)  # 兌換碼

    USAGE_PER_DAY_CHOICES = [
        ('one-time', '每日單次'),
        ('unlimited', '每日無限制'),
    ]
    usage_per_day = models.CharField(max_length=10, choices=USAGE_PER_DAY_CHOICES, default='unlimited', help_text="How many times this coupon can be used per day")
 
    def save(self, *args, **kwargs):
        # Ensure original_owner and current_holder is None for 'store' type coupons
        if self.coupon_type == 'store':
            self.original_owner = None
            self.last_holder = None
            self.current_holder = None
            self.template = None
            self.redeem_code = None
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.coupon_name} - {self.store.name} (ID: {self.id}, Holder: {self.current_holder.email if self.current_holder else 'None'})" # type: ignore 
    
    def is_redeemed(self):
        """Check if an exclusive coupon has been redeemed"""
        if self.coupon_type == 'exclusive':
            return CouponRedemption.objects.filter(coupon=self).exists()
        return False
 
    def get_redemption_count(self):
        """Get redemption count (useful for store coupons)"""
        return CouponRedemption.objects.filter(coupon=self).count()
        
    def get_unique_users_count(self):
        """Get count of unique users who redeemed this coupon"""
        return CouponRedemption.objects.filter(coupon=self).values('user').distinct().count()

# Model for tracking coupon redemptions
class CouponRedemption(models.Model):
    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE, related_name='redemptions')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='coupon_redemptions')
    redeemed_at = models.DateTimeField(default=timezone.now)
    savings_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    # Denormalized field (copies coupon_type for use in constraints)
    coupon_type = models.CharField(max_length=20, editable=False)

    def save(self, *args, **kwargs):
        if self.coupon and not self.coupon_type:
            self.coupon_type = self.coupon.coupon_type
        super().save(*args, **kwargs)

    def __str__(self):
        locat_redeemed_at = timezone.localtime(self.redeemed_at)
        return f"{self.user.email} redeemed {self.coupon.coupon_name} at {locat_redeemed_at} ({locat_redeemed_at.tzinfo})"

    class Meta:
        # Enforce uniqueness only if coupon_type is 'exclusive'
        constraints = [
            models.UniqueConstraint(
                fields=['coupon', 'user'],
                condition=models.Q(coupon_type='exclusive'),
                name='unique_exclusive_coupon_redemption'
            )
        ]

class Log(models.Model):
    timestamp = models.DateTimeField(auto_now_add=True)
    action = models.CharField(max_length=20)  # "view", "redeem", "share"
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True) # User performing the action
    coupon = models.ForeignKey(Coupon, on_delete=models.SET_NULL, null=True, blank=True) # Coupon related to the action
    
    def __str__(self):
        user_email = self.user.email if self.user else "Anonymous/System"
        coupon_id = self.coupon.id if self.coupon else "Deleted Coupon"  # type: ignore
        local_time = timezone.localtime(self.timestamp)
        return f"{local_time} ({local_time.tzinfo}) - {user_email} - {self.action} - Coupon ID: {coupon_id}"

class CouponShareRequest(models.Model):
    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE, related_name='share_requests')
    from_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_share_requests')
    to_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='received_share_requests')

    # Token for the share request, used for verification
    token = models.CharField(max_length=64, unique=True)
    status = models.CharField(max_length=16, choices=[('pending', 'Pending'), ('accepted', 'Accepted'), ('declined', 'Declined')], default='pending')
    created_at = models.DateTimeField(default=timezone.now)
    responded_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Share {self.coupon} from {self.from_user} to {self.to_user} ({self.status})"

# Model to track completed savings goals
class CompletedGoal(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='completed_goals')
    name = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    image = models.CharField(max_length=200, null=True, blank=True)  # URL to the image
    completed_date = models.DateTimeField(default=timezone.now)
    
    def __str__(self):
        return f"{self.name} - {self.amount} - {self.user.email}"
    
    class Meta:
        ordering = ['-completed_date']  # Most recent goals first