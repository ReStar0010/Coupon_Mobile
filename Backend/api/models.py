from django.db import models
from django.contrib.auth.models import User  # Import Django's default User model
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
import random
import uuid

# UGC Compliance: Report reason choices
REPORT_REASONS = [
    ('inappropriate', '不當內容'),      # Inappropriate content
    ('misleading', '誤導資訊'),         # Misleading information
    ('illegal', '違法商品'),            # Illegal goods
    ('spam', '垃圾訊息'),               # Spam
    ('other', '其他'),                  # Other
]

# UGC Compliance: Report status choices
REPORT_STATUS = [
    ('pending', '待審核'),              # Pending
    ('reviewed', '已審核'),             # Reviewed (action taken)
    ('dismissed', '已駁回'),            # Dismissed (no action)
]

# UGC Compliance: Moderation action choices
MODERATION_ACTIONS = [
    ('approve', '核准'),              # Approve (dismiss report)
    ('remove', '移除內容'),           # Remove content
    ('suspend', '暫停帳號'),          # Suspend merchant account
]

# UGC Compliance: Violation type choices
VIOLATION_TYPES = [
    ('content_removed', '內容移除'),     # Content was removed
    ('account_suspended', '帳號暫停'),   # Account suspended
]

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
    
    # Phone verification (for phone-based registration)
    phone_verified = models.BooleanField(default=False, help_text="True if phone was verified via OTP")

    # Profile presentation (consumer-facing display)
    display_name = models.CharField(max_length=80, null=True, blank=True, help_text="Consumer display name")
    avatar_url = models.CharField(max_length=255, null=True, blank=True, help_text="URL to consumer avatar image")

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

    # Progress tracker counters (011-progress-tracker)
    sharing_progress_count = models.IntegerField(default=0)   # Metric 2: current cycle 0..2 (resets at 3)
    sharing_rewards_earned = models.IntegerField(default=0)    # Metric 2: number of $10 vouchers granted for sharing
    referral_progress_count = models.IntegerField(default=0)  # Metric 3: O value for new user referral light system

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
    APPLICATION_STATUS_CHOICES = [
        ('pending', '待審核'),
        ('approved', '已核准'),
        ('rejected', '已拒絕'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='merchant_profile')

    # Merchant contact informations
    phone = models.CharField(max_length=20) # Merchant contact phone
    contact_person = models.CharField(max_length=100, blank=True)
    contact_info = models.CharField(max_length=100, help_text="e.g., Line ID or alternative phone") # Combined contact info

    # Merchant application review fields
    application_status = models.CharField(
        max_length=20,
        choices=APPLICATION_STATUS_CHOICES,
        default='pending',
        db_index=True,
    )
    application_submitted_at = models.DateTimeField(default=timezone.now)
    application_reviewed_at = models.DateTimeField(null=True, blank=True)
    application_review_notes = models.TextField(blank=True)

    # Email verification fields
    verified = models.BooleanField(default=False)
    email_verification_token = models.CharField(
        max_length=64,
        unique=True,
        null=True,
        blank=True
    )
    verification_token_created_at = models.DateTimeField(null=True, blank=True)
    last_verification_email_sent = models.DateTimeField(null=True, blank=True)
    verification_email_count = models.PositiveIntegerField(default=0)

    def is_verification_token_valid(self) -> bool:
        """Check if verification token is still valid (24-hour expiration)."""
        from datetime import timedelta
        if not self.verification_token_created_at:
            return False
        expiry_time = self.verification_token_created_at + timedelta(hours=24)
        return timezone.now() < expiry_time

    def can_send_verification_email(self) -> tuple[bool, str, int]:
        """
        Check if a verification email can be sent.
        Returns: (allowed, message, wait_seconds)
        """
        from datetime import timedelta
        now = timezone.now()

        # Reset count if last send was > 1 hour ago
        if self.last_verification_email_sent:
            if now - self.last_verification_email_sent > timedelta(hours=1):
                self.verification_email_count = 0

        # Rate limit: max 3 per hour
        if self.verification_email_count >= 3:
            return (False, '已達到發送限制，請稍後再試', 0)

        # Cooldown: 60 seconds between sends
        if self.last_verification_email_sent:
            elapsed = (now - self.last_verification_email_sent).total_seconds()
            if elapsed < 60:
                wait = 60 - int(elapsed)
                return (False, f'請等待 {wait} 秒後再試', wait)

        return (True, '', 0)

    def generate_verification_token(self) -> str:
        """Generate a new verification token."""
        import secrets
        self.email_verification_token = secrets.token_urlsafe(32)
        self.verification_token_created_at = timezone.now()
        self.last_verification_email_sent = timezone.now()
        self.verification_email_count += 1
        self.save()
        return self.email_verification_token

    def verify_email(self) -> None:
        """Mark email as verified and clear token."""
        self.verified = True
        self.email_verification_token = None
        self.verification_token_created_at = None
        self.save()

    # UGC Compliance: Violation tracking fields
    violation_count = models.PositiveIntegerField(default=0, help_text="Denormalized violation counter")
    suspension_flagged = models.BooleanField(default=False, help_text="Flagged for suspension review")
    suspension_flagged_at = models.DateTimeField(null=True, blank=True, help_text="When flagged for suspension")

    def __str__(self):
        return f"{self.user.email} - Merchant Profile"


class Store(models.Model):
    STORE_TYPE_CHOICES = [
        ('restaurant', '餐飲'),
        ('retail', '零售'),
        ('service', '服務'),
        ('entertainment', '娛樂'),
        ('beauty', '美容'),
        ('education', '教育'),
        ('medical', '醫療'),
        ('other', '其他'),
    ]
    
    owner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='owned_stores', limit_choices_to={'groups__name': "Merchant"})

    # store information
    name = models.CharField(max_length=100, blank=True)
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)
    address = models.CharField(max_length=200, blank=True)
    business_hours = models.TextField(blank=True, null=True)
    image_url = models.CharField(max_length=255, blank=True, null=True)
    store_type = models.CharField(max_length=20, choices=STORE_TYPE_CHOICES, blank=True, null=True)
    average_order_value = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Average order value in TWD for GMV calculation")
    unified_redeem_code = models.CharField(max_length=6, null=True, blank=True, unique=True, help_text="Unified redemption code for all coupons from this store (6-digit numeric format)")
    # Optional: store timezone (IANA e.g. Asia/Taipei) for "today" and date-range boundaries
    timezone = models.CharField(max_length=63, null=True, blank=True)
    # Optional: currency for cost display (e.g. TWD, NT$)
    currency_code = models.CharField(max_length=10, null=True, blank=True)
    # Platform cash voucher: when True, store accepts platform voucher redemptions
    accepts_platform_vouchers = models.BooleanField(default=False)
    # CouMap visibility: pins are only rendered for stores we have a signed
    # partnership with. New stores default to hidden so a freshly-registered
    # merchant doesn't leak onto the consumer map before sign-off.
    is_visible_on_map = models.BooleanField(
        default=False,
        help_text='Show this store as a pin on CouMap (requires signed partnership).',
    )

    def __str__(self):
        return self.name


class StoreNews(models.Model):
    """Per-store broadcast feed for the CouMap merchant bottom-sheet.

    Short-form updates a merchant pushes to consumers viewing the merchant
    bottom-sheet on CouMap. The MerchantSheet UI surfaces the latest entry
    inline and supports an expand-to-see-all flow via the lens icon.

    v1 lifecycle: merchant can create / list / delete their own news; no
    editing (delete + repost is the supported pattern).
    """

    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='news',
    )
    body = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'store_news'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['store', '-created_at'], name='store_news_store_recent_idx'),
        ]

    def __str__(self) -> str:  # pragma: no cover (display only)
        return f"StoreNews(store={self.store_id}, {self.body[:30]!r})"


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
    gem_reward = models.PositiveIntegerField(default=1, help_text="Gems earned when this coupon is redeemed")
    draw_probability = models.FloatField(default=0.5, help_text="Probability (0-1) of successful draw")
    show_in_desk_qrcode = models.BooleanField(
        default=True,
        help_text="Whether template should be visible on desk QR web page",
    )


    # remove this since it's not used
    # draw_limit_per_day = models.PositiveIntegerField(default=1, help_text="How many times a user can draw per day")
    
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    
    def generate_coupon(self, recipient=None):
        """Generate a new coupon from this template (race-safe)."""
        from django.db import transaction

        with transaction.atomic():
            # Re-read with row lock to prevent over-issuance
            tpl = CouponTemplate.objects.select_for_update().get(pk=self.pk)
            if tpl.remaining_quantity <= 0:
                return None

            coupon = Coupon(
                store=tpl.store,
                template=tpl,
                coupon_name=tpl.coupon_name,
                coupon_detail=tpl.coupon_detail,
                important_notes=tpl.important_notes,
                start_date=tpl.start_date,
                expiry_date=tpl.expiry_date,
                image_url=tpl.image_url,
                coupon_type='exclusive',
                estimated_savings=tpl.estimated_savings,
                original_owner=recipient,
                last_holder=None,
                current_holder=recipient,
                redeem_code=tpl.template_redeem_code if tpl.template_redeem_code else None,
            )
            coupon.save()
            coupon.tags.set(tpl.tags.all())

            # Decrease remaining quantity
            # safe: row lock held via select_for_update() above
            tpl.remaining_quantity -= 1
            if tpl.remaining_quantity <= 0:
                tpl.is_active = False
            tpl.save()

            # Update self to reflect changes
            self.remaining_quantity = tpl.remaining_quantity
            self.is_active = tpl.is_active

            return coupon
    
    def __str__(self):
        return f"Template: {self.coupon_name} ({self.remaining_quantity}/{self.total_quantity})"


class QRCodeSession(models.Model):
    """
    Represents an active QR code generation session for a coupon template.
    Created when a merchant requests a QR code, invalidated when the merchant closes the QR code display.
    """
    template = models.ForeignKey(CouponTemplate, on_delete=models.CASCADE, related_name='qr_sessions')
    merchant = models.ForeignKey(User, on_delete=models.CASCADE, related_name='qr_sessions')
    session_token = models.CharField(max_length=100, unique=True, help_text="Unique token encoded in QR code (UUID4 format)")
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True, help_text="Whether the session is still valid")
    invalidated_at = models.DateTimeField(null=True, blank=True, help_text="When the session was invalidated")

    class Meta:
        db_table = 'api_qrcode_session'
        indexes = [
            models.Index(fields=['session_token'], name='qr_session_token_idx'),
            models.Index(fields=['template', 'is_active'], name='qr_session_template_active_idx'),
            models.Index(fields=['merchant', 'is_active'], name='qr_session_merchant_active_idx'),
        ]

    def __str__(self):
        return f"QR Session {self.id} - Template {self.template_id} - {'Active' if self.is_active else 'Inactive'}"


class StoreFixedSession(models.Model):
    """
    Fixed table-sticker session token for web consumers.
    One store has one long-lived token unless admin rotates it.
    """
    store = models.OneToOneField(
        Store,
        on_delete=models.CASCADE,
        related_name='fixed_session',
    )
    session_token = models.CharField(max_length=100, unique=True, db_index=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    rotated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'api_store_fixed_session'
        indexes = [
            models.Index(fields=['session_token'], name='store_fixed_session_token_idx'),
            models.Index(fields=['store', 'is_active'], name='store_fixed_session_active_idx'),
        ]

    def __str__(self):
        return f"StoreFixedSession {self.store_id} - {'Active' if self.is_active else 'Inactive'}"


class QRCodeClaim(models.Model):
    """
    Tracks QR code coupon claims with idempotency key to prevent duplicate claims.
    Each idempotency key can only be used once, ensuring retry-safe coupon creation.
    """
    idempotency_key = models.CharField(max_length=64, unique=True, db_index=True, help_text="Unique key to prevent duplicate claims")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='qr_claims')
    template = models.ForeignKey(CouponTemplate, on_delete=models.CASCADE, related_name='qr_claims')
    coupon = models.ForeignKey('Coupon', on_delete=models.CASCADE, related_name='qr_claim_record')
    claimed_at = models.DateTimeField(auto_now_add=True, help_text="When the coupon was claimed")
    session_token = models.CharField(max_length=255, help_text="Session token from QR code")

    class Meta:
        db_table = 'api_qrcode_claim'
        indexes = [
            models.Index(fields=['idempotency_key'], name='qr_claim_idempotency_key_idx'),
            models.Index(fields=['user', 'template'], name='qr_claim_user_template_idx'),
        ]

    def __str__(self):
        return f"QR Claim {self.id} - User {self.user.email} - Template {self.template_id} - {self.claimed_at}"


class WebRedemption(models.Model):
    """
    Records an anonymous web-flow coupon redemption.
    Created by POST /api/web/v1/redemptions/. Unique on session_token to prevent
    double-redemption of the same table QR from the web flow.
    phone_number is null at creation; optionally populated when the user
    enters their phone on the Points Accumulation screen.

    `template` may be set NULL when the merchant deletes the CouponTemplate; legacy_* fields
    preserve which template this row referred to for audit and admin display.
    """
    template = models.ForeignKey(
        CouponTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='web_redemptions',
    )
    legacy_template_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        db_index=True,
        help_text="CouponTemplate pk at time of redemption; kept after template is deleted.",
    )
    legacy_template_coupon_name = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Snapshot of template coupon_name; kept after template is deleted.",
    )
    session_token = models.CharField(
        max_length=255,
        db_index=True,
        help_text="The QRCodeSession.session_token from the scanned table QR",
    )
    fixed_session_token = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        db_index=True,
        help_text="Store-level fixed session token for table sticker QR flow",
    )
    phone_number = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        db_index=True,
        help_text="Populated when user enters phone on points screen",
    )
    progress_applied = models.BooleanField(
        default=False,
        help_text=(
            "Legacy: Web self-redemption no longer advances sharing lights; "
            "field retained for DB compatibility."
        ),
    )
    redeemed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'api_web_redemption'

    def save(self, *args, **kwargs):
        if self.template_id:
            self.legacy_template_id = self.template_id
            if not self.legacy_template_coupon_name:
                try:
                    tpl = CouponTemplate.objects.only('coupon_name').get(pk=self.template_id)
                    self.legacy_template_coupon_name = tpl.coupon_name
                except CouponTemplate.DoesNotExist:
                    pass
        super().save(*args, **kwargs)

    def __str__(self):
        tid = self.template_id or self.legacy_template_id
        return f"WebRedemption {self.id} - template {tid} - {self.redeemed_at}"


class CouponQuerySet(models.QuerySet):
    """Reusable chainable filters for the Coupon model.

    Centralises the "what counts as an actionable coupon for this user
    right now?" predicate that recurred ad-hoc across half a dozen
    views. Using a QuerySet manager keeps the predicate definition in
    one place — when business rules shift (e.g. add a `disabled` flag)
    every caller picks up the change for free.
    """

    def exclusives(self) -> 'CouponQuerySet':
        """Personal coupons held by individual users; NOT 'store'-type templates."""
        return self.filter(coupon_type='exclusive')

    def not_expired(self, *, now=None) -> 'CouponQuerySet':
        """Coupons whose expiry is still in the future."""
        from django.utils import timezone
        cutoff = now or timezone.now()
        return self.filter(expiry_date__gt=cutoff)

    def held_by(self, user) -> 'CouponQuerySet':
        # Defensive: AnonymousUser has pk=None, which Django would
        # translate into `current_holder IS NULL` — the exact opposite
        # of "coupons held by this user", and a potential info leak.
        # Every current caller is behind @permission_classes([IsAuthenticated])
        # so this guard only protects future sites that forget it.
        if not getattr(user, 'is_authenticated', False):
            return self.none()
        return self.filter(current_holder=user)

    def at_store(self, store) -> 'CouponQuerySet':
        return self.filter(store=store)

    def active_for_user(self, user, *, now=None) -> 'CouponQuerySet':
        """Exclusive, not-expired, held by `user` — the merchant-sheet predicate."""
        return self.held_by(user).exclusives().not_expired(now=now)


class Coupon(models.Model):
    objects = CouponQuerySet.as_manager()

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
    
    # Phone-based coupon send: store phone number for pending (unclaimed) coupons
    pending_phone_number = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        db_index=True,
        help_text='Phone number for pending (unclaimed) coupons sent to unregistered users'
    )
    
    # redemption code
    redeem_code = models.CharField(max_length=6, null=True, blank=True)  # 兌換碼

    USAGE_PER_DAY_CHOICES = [
        ('one-time', '每日單次'),
        ('unlimited', '每日無限制'),
    ]
    usage_per_day = models.CharField(max_length=10, choices=USAGE_PER_DAY_CHOICES, default='unlimited', help_text="How many times this coupon can be used per day")
    
    # Acquisition method tracking
    ACQUISITION_METHOD_CHOICES = [
        ('draw', '抽優惠券'),
        ('consolidate', '電話歸戶'),
        ('transfer', '私人轉讓'),
        ('public_pool', '公共池領取'),
        ('qr_claim', 'QR Code 領取'),
        ('admin_issue', '後台發放'),
    ]
    acquisition_method = models.CharField(
        max_length=20, 
        choices=ACQUISITION_METHOD_CHOICES, 
        null=True, 
        blank=True,
        help_text="How the coupon was acquired by the current holder"
    )
 
    def save(self, *args, **kwargs):
        # Ensure original_owner and current_holder is None for 'store' type coupons
        if self.coupon_type == 'store':
            self.original_owner = None
            self.last_holder = None
            self.current_holder = None
            # Keep template field for store type coupons to allow synchronization with CouponTemplate
            # Only clear redeem_code for store type coupons
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
    lat = models.FloatField(null=True, blank=True, help_text="Latitude of redemption location")
    lng = models.FloatField(null=True, blank=True, help_text="Longitude of redemption location")

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
    action = models.CharField(max_length=20)  # "view", "redeem", "share", "template_view"
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True) # User performing the action
    coupon = models.ForeignKey(Coupon, on_delete=models.SET_NULL, null=True, blank=True) # Coupon related to the action
    template = models.ForeignKey(CouponTemplate, on_delete=models.SET_NULL, null=True, blank=True, related_name='logs') # Template related to the action
    lat = models.FloatField(null=True, blank=True, help_text="Latitude of action location")
    lng = models.FloatField(null=True, blank=True, help_text="Longitude of action location")
    
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
    status = models.CharField(
        max_length=16,
        choices=[
            ('pending', 'Pending'),
            ('accepted', 'Accepted'),
            ('declined', 'Declined'),
            ('cancelled', 'Cancelled'),
        ],
        default='pending',
    )
    created_at = models.DateTimeField(default=timezone.now)
    responded_at = models.DateTimeField(null=True, blank=True)

    # Flag for public pool sharing (EasyUse)
    is_public = models.BooleanField(default=False, help_text="If True, coupon is shared to public pool")
    message = models.TextField(blank=True, default='', max_length=80, help_text="Optional note from the sharer")

    class Meta:
        constraints = [
            # Ensure only one pending public share per coupon
            models.UniqueConstraint(
                fields=['coupon'],
                condition=models.Q(is_public=True, status='pending'),
                name='unique_pending_public_share_per_coupon'
            )
        ]

    def __str__(self):
        share_type = "Public" if self.is_public else "Private"
        return f"{share_type} Share {self.coupon} from {self.from_user} ({self.status})"


# =============================================================================
# Platform Cash Voucher (011)
# =============================================================================

ACQUISITION_METHOD_PLATFORM = [
    ('platform_issue', 'Platform Issue'),
    ('transfer', 'Transfer'),
    ('public_pool', 'Public Pool'),
    ('reward', 'Reward'),
]


class PlatformVoucher(models.Model):
    """Single-use, transferable platform voucher; redeemable at participating stores only."""
    face_value = models.DecimalField(max_digits=10, decimal_places=2)
    currency_code = models.CharField(max_length=10, default='TWD')
    start_date = models.DateTimeField()
    expiry_date = models.DateTimeField()
    current_holder = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='held_platform_vouchers'
    )
    original_owner = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='owned_platform_vouchers'
    )
    last_holder = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='last_platform_vouchers'
    )
    redeem_code = models.CharField(max_length=6, unique=True)
    batch_name = models.CharField(max_length=255, blank=True)
    acquisition_method = models.CharField(
        max_length=20, choices=ACQUISITION_METHOD_PLATFORM, null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"PlatformVoucher #{self.id} {self.face_value} {self.currency_code} ({self.redeem_code})"


class PlatformVoucherRedemption(models.Model):
    """One redemption per platform voucher (full face value)."""
    voucher = models.OneToOneField(
        PlatformVoucher, on_delete=models.CASCADE, related_name='redemption'
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='platform_voucher_redemptions')
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='platform_voucher_redemptions')
    redeemed_at = models.DateTimeField(default=timezone.now)
    amount_used = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['voucher'], name='unique_platform_voucher_redemption'),
        ]

    def __str__(self):
        return f"Redemption of {self.voucher} at {self.store} by {self.user}"


class PlatformVoucherShareRequest(models.Model):
    """Share request for platform voucher (private link or public pool)."""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
    ]
    voucher = models.ForeignKey(
        PlatformVoucher, on_delete=models.CASCADE, related_name='share_requests'
    )
    from_user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='platform_voucher_share_requests_sent'
    )
    to_user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='platform_voucher_share_requests_received'
    )
    token = models.CharField(max_length=64, unique=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default='pending')
    is_public = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['voucher'],
                condition=models.Q(is_public=True, status='pending'),
                name='unique_pending_public_share_per_platform_voucher',
            ),
        ]

    def __str__(self):
        share_type = "Public" if self.is_public else "Private"
        return f"{share_type} PlatformVoucher share {self.voucher_id} from {self.from_user} ({self.status})"


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

class PhoneOTPRecord(models.Model):
    """
    Tracks OTP verification attempts for phone numbers.
    Enforces: 3 requests/hour, 5 attempts/code, 10-min expiration.
    """

    PURPOSE_CHOICES = [
        ('phone_change', 'Phone Change'),
        ('registration', 'Registration'),
        ('password_reset', 'Password Reset'),
    ]

    phone_number = models.CharField(
        max_length=20,
        db_index=True,
        help_text="Taiwan mobile number in 09XXXXXXXX format"
    )
    otp_code = models.CharField(
        max_length=6,
        help_text="6-digit verification code"
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='phone_otp_records',
        null=True,
        blank=True,
        help_text="User requesting verification (null for registration OTPs)"
    )
    purpose = models.CharField(
        max_length=20,
        choices=PURPOSE_CHOICES,
        default='phone_change',
        help_text="Purpose of this OTP (phone_change, registration, password_reset)"
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        help_text="When OTP was generated"
    )
    expires_at = models.DateTimeField(
        help_text="When OTP expires (created_at + 10 minutes)"
    )

    attempt_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of verification attempts (max 5)"
    )

    is_verified = models.BooleanField(
        default=False,
        help_text="True if OTP was successfully verified"
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['phone_number', 'created_at'], name='api_phoneotp_phone_created_idx'),
            models.Index(fields=['user', 'created_at'], name='api_phoneotp_user_created_idx'),
        ]

    def __str__(self) -> str:
        status = "verified" if self.is_verified else "pending"
        return f"OTP for {self.phone_number} ({status})"

    def is_expired(self) -> bool:
        """Check if OTP has expired."""
        return timezone.now() > self.expires_at

    def can_attempt(self) -> bool:
        """Check if more verification attempts are allowed."""
        return self.attempt_count < 5 and not self.is_expired()

    def increment_attempt(self) -> None:
        """Increment attempt count."""
        self.attempt_count += 1
        self.save(update_fields=['attempt_count'])

    @classmethod
    def can_send_otp(cls, phone_number: str, purpose: str = 'phone_change') -> tuple[bool, str, int]:
        """
        Check rate limits for sending OTP.
        Rate limiting is scoped per purpose to prevent cross-purpose abuse.
        Returns (allowed, error_message_if_not_allowed, retry_after_seconds).
        """
        from datetime import timedelta

        now = timezone.now()
        one_hour_ago = now - timedelta(hours=1)
        one_minute_ago = now - timedelta(seconds=60)

        # Check hourly limit: max 3 requests per phone per hour per purpose
        hourly_count = cls.objects.filter(
            phone_number=phone_number,
            purpose=purpose,
            created_at__gte=one_hour_ago
        ).count()

        if hourly_count >= 3:
            return False, "已超過每小時OTP請求次數限制，請稍後再試", 1800

        # Check cooldown: 60 seconds between requests for same purpose
        recent = cls.objects.filter(
            phone_number=phone_number,
            purpose=purpose,
            created_at__gte=one_minute_ago
        ).first()

        if recent:
            seconds_remaining = 60 - int((now - recent.created_at).total_seconds())
            return False, "請等待60秒後再重新發送驗證碼", max(seconds_remaining, 1)

        return True, "", 0

    @classmethod
    def create_otp(cls, user, phone_number: str, purpose: str = 'phone_change') -> 'PhoneOTPRecord':
        """
        Generate and store a new OTP for the given phone number.
        For registration OTPs, user can be None.
        """
        import secrets
        from datetime import timedelta

        otp_code = ''.join(str(secrets.randbelow(10)) for _ in range(6))
        expires_at = timezone.now() + timedelta(minutes=10)

        return cls.objects.create(
            user=user,
            phone_number=phone_number,
            otp_code=otp_code,
            expires_at=expires_at,
            purpose=purpose
        )

    @classmethod
    def cleanup_old_records(cls, phone_number: str, user=None, purpose: str = 'phone_change') -> None:
        """
        Delete old unverified OTP records for this phone/user/purpose.
        Called after successful verification.
        For registration OTPs, user can be None.
        """
        filter_kwargs = {
            'phone_number': phone_number,
            'purpose': purpose,
            'is_verified': False
        }
        if user is not None:
            filter_kwargs['user'] = user
        
        cls.objects.filter(**filter_kwargs).delete()

class AccountDeletionLog(models.Model):
    """
    Tracks account deletion events for audit purposes and network failure recovery.
    Supports retry mechanism for pending deletions.
    """
    # Reference to deleted user (store email/id before deletion)
    deleted_user_email = models.EmailField()
    deleted_user_id = models.IntegerField()

    # Deletion metadata
    deleted_at = models.DateTimeField(auto_now_add=True)
    deletion_reason = models.CharField(max_length=255, default='user_requested')

    # What was preserved
    stores_anonymized = models.IntegerField(default=0)
    coupons_preserved = models.IntegerField(default=0)

    # Network failure handling
    initiated_at = models.DateTimeField()
    completed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('completed', 'Completed'),
            ('failed', 'Failed'),
        ],
        default='pending'
    )
    retry_count = models.IntegerField(default=0)

    class Meta:
        db_table = 'account_deletion_log'
        ordering = ['-deleted_at']

    def __str__(self):
        return f"Account Deletion: {self.deleted_user_email} ({self.status})"


# =============================================================================
# UGC Compliance Models (Apple Guideline 1.2)
# =============================================================================

class ContentReport(models.Model):
    """
    Consumer report of merchant content (coupon or store).
    Supports content reporting mechanism required by Apple Guideline 1.2.
    """
    reporter = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='content_reports',
        help_text="Consumer who submitted the report"
    )
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        help_text="Django ContentType for generic relation"
    )
    object_id = models.PositiveIntegerField(
        db_index=True,
        help_text="ID of the reported content"
    )
    content_object = GenericForeignKey('content_type', 'object_id')
    reason = models.CharField(
        max_length=20,
        choices=REPORT_REASONS,
        help_text="Report reason category"
    )
    details = models.TextField(
        blank=True,
        help_text="Optional additional details"
    )
    status = models.CharField(
        max_length=20,
        choices=REPORT_STATUS,
        default='pending',
        db_index=True,
        help_text="Report processing status"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        help_text="When report was submitted"
    )
    reviewed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When report was reviewed"
    )
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_reports',
        help_text="Admin who reviewed"
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'created_at'], name='report_status_created_idx'),
            models.Index(fields=['reporter', 'content_type', 'object_id'], name='report_reporter_content_idx'),
        ]

    def __str__(self) -> str:
        return f"Report #{self.id} - {self.get_reason_display()}"


class BlockedMerchant(models.Model):
    """
    Consumer's blocked merchant store.
    Allows consumers to block merchants so their content is hidden from feed/search.
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='blocked_merchants',
        help_text="Consumer who blocked"
    )
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='blocked_by',
        help_text="Blocked merchant store"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When block was created"
    )

    class Meta:
        unique_together = ['user', 'store']
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f"{self.user.username} blocked {self.store.name}"


class EULAAcceptance(models.Model):
    """
    Record of merchant EULA acceptance.
    Required before merchants can upload content (Apple Guideline 1.2).
    """
    merchant = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='eula_acceptances',
        help_text="Merchant who accepted"
    )
    version = models.CharField(
        max_length=20,
        help_text="EULA version string (e.g., '1.0.0')"
    )
    accepted_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When acceptance occurred"
    )
    ip_address = models.GenericIPAddressField(
        help_text="IP address at acceptance"
    )

    class Meta:
        unique_together = ['merchant', 'version']
        ordering = ['-accepted_at']

    def __str__(self) -> str:
        return f"{self.merchant.username} accepted EULA v{self.version}"


class ModerationAction(models.Model):
    """
    Admin action on reported content.
    Audit log of administrator actions for Apple Guideline 1.2 compliance.
    """
    report = models.ForeignKey(
        ContentReport,
        on_delete=models.CASCADE,
        related_name='actions',
        help_text="Associated report"
    )
    admin = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='moderation_actions',
        help_text="Admin who took action"
    )
    action = models.CharField(
        max_length=20,
        choices=MODERATION_ACTIONS,
        help_text="Action type taken"
    )
    notes = models.TextField(
        blank=True,
        help_text="Admin notes/justification"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When action was taken"
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f"Action #{self.id} - {self.get_action_display()}"


class ViolationRecord(models.Model):
    """
    Merchant violation history for suspension tracking.
    10 violations triggers suspension review (Apple Guideline 1.2).
    """
    merchant = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='violations',
        help_text="Merchant with violation"
    )
    report = models.ForeignKey(
        ContentReport,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='violations',
        help_text="Originating report"
    )
    action = models.ForeignKey(
        ModerationAction,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='violations',
        help_text="Action that created violation"
    )
    violation_type = models.CharField(
        max_length=20,
        choices=VIOLATION_TYPES,
        help_text="Type of violation"
    )
    notes = models.TextField(
        blank=True,
        help_text="Additional context"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When violation was recorded"
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f"Violation #{self.id} - {self.merchant.username}"


# ── Spinner Co-op (deliverable 3b) ──────────────────────────────────────────
# Re-export so Django picks them up via app config.
from api.spinner_coop.models import (  # noqa: E402, F401
    Wallet,
    SpinnerRound,
    WalletTransaction,
    DailyDrawAttempt,
)

