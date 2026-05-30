"""
Utility functions for phone number validation, formatting, and store timezone/currency.
"""
import re
import secrets
from datetime import date, datetime
from zoneinfo import ZoneInfo
from pathlib import Path

from django.core.files.storage import default_storage

# Default timezone when store has none (e.g. Asia/Taipei per research.md)
DEFAULT_STORE_TIMEZONE = "Asia/Taipei"

# Taiwan mobile phone number format: 09XXXXXXXX (10 digits starting with 09)
TAIWAN_MOBILE_REGEX = re.compile(r'^09\d{8}$')
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
MAX_IMAGE_UPLOAD_SIZE = 5 * 1024 * 1024  # 5MB


def validate_phone_number(phone: str) -> str:
    """
    Validate and normalize Taiwan mobile phone number.
    
    Args:
        phone: Phone number string (may contain spaces, dashes, parentheses)
        
    Returns:
        Normalized phone number (digits only)
        
    Raises:
        ValueError: If phone number format is invalid
    """
    if not phone:
        raise ValueError("Phone number cannot be empty")
    
    # Remove spaces, dashes, parentheses
    normalized = re.sub(r'[\s\-\(\)]', '', phone)
    
    if not TAIWAN_MOBILE_REGEX.match(normalized):
        raise ValueError("Invalid phone number format. Must be Taiwan mobile (09XXXXXXXX)")
    
    return normalized


def mask_phone_number(phone: str) -> str:
    """
    Mask phone number for display: 0912345678 -> 0912****78
    
    Args:
        phone: Phone number string
        
    Returns:
        Masked phone number showing first 4 and last 2 digits
    """
    if not phone or len(phone) < 6:
        return phone
    
    return f"{phone[:4]}{'*' * (len(phone) - 6)}{phone[-2:]}"


def generate_unified_redemption_code() -> str:
    """
    Generate a 6-digit numeric unified redemption code (digits 0-9 only).
    
    Returns:
        6-digit numeric string (e.g., "123456")
    """
    return ''.join(str(secrets.randbelow(10)) for _ in range(6))


def generate_platform_voucher_redeem_code() -> str:
    """
    Generate a unique 6-character redeem_code for PlatformVoucher (distinct from store
    unified_redeem_code). Ensures DB uniqueness by checking existing PlatformVoucher
    and Store.unified_redeem_code to avoid collisions.
    
    Returns:
        6-character alphanumeric string (e.g., "A1B2C3") unique in DB.
    """
    from django.apps import apps
    
    def _random_6() -> str:
        # Alphanumeric 0-9, A-Z (no lowercase to avoid confusion)
        chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        return ''.join(secrets.choice(chars) for _ in range(6))
    
    PlatformVoucher = apps.get_model('api', 'PlatformVoucher')
    Store = apps.get_model('api', 'Store')
    max_attempts = 100
    for _ in range(max_attempts):
        code = _random_6()
        if PlatformVoucher.objects.filter(redeem_code=code).exists():
            continue
        if Store.objects.filter(unified_redeem_code=code).exists():
            continue
        return code
    raise RuntimeError("Could not generate unique platform voucher redeem_code after %d attempts" % max_attempts)


def grant_reward_voucher(user, face_value: int, description: str = 'System Reward'):
    """
    Auto-create a PlatformVoucher as a reward for the given user.

    Args:
        user: Django User instance who earns the reward.
        face_value: Integer TWD amount (e.g. 5 or 10).
        description: Human-readable batch_name for the voucher.

    Returns:
        The created PlatformVoucher instance.
    """
    from django.apps import apps
    from django.utils import timezone as dj_timezone

    PlatformVoucher = apps.get_model('api', 'PlatformVoucher')
    redeem_code = generate_platform_voucher_redeem_code()
    now = dj_timezone.now()
    taiwan = ZoneInfo(DEFAULT_STORE_TIMEZONE)
    now_local = now.astimezone(taiwan)
    candidate = datetime(now_local.year, 4, 26, 23, 59, 59, tzinfo=taiwan)
    if now_local > candidate:
        candidate = datetime(now_local.year + 1, 4, 26, 23, 59, 59, tzinfo=taiwan)
    expiry_date = candidate
    return PlatformVoucher.objects.create(
        face_value=face_value,
        currency_code='TWD',
        start_date=now,
        expiry_date=expiry_date,
        current_holder=user,
        original_owner=user,
        last_holder=None,
        acquisition_method='reward',
        batch_name=description,
        redeem_code=redeem_code,
    )


def increment_sharing_progress_for_redeemer(user) -> None:
    """
    Metric 2 (sharing light system): +1 toward the 3-light cycle for this user;
    grant $10 reward vouchers for each completed cycle.
    Same rules as exclusive coupon redemption in redeem_coupon.
    """
    from django.apps import apps
    from django.db.models import F

    StudentProfile = apps.get_model('api', 'StudentProfile')
    try:
        redeemer_profile = user.student_profile
    except (StudentProfile.DoesNotExist, AttributeError):
        return

    # Atomically increment sharing_progress_count to avoid race conditions
    StudentProfile.objects.filter(pk=redeemer_profile.pk).update(
        sharing_progress_count=F('sharing_progress_count') + 1
    )
    redeemer_profile.refresh_from_db()

    n = redeemer_profile.sharing_progress_count
    vouchers = n // 3
    for _ in range(vouchers):
        grant_reward_voucher(user, 10, 'Sharing Reward')

    # Atomically update both counters after reward calculation
    StudentProfile.objects.filter(pk=redeemer_profile.pk).update(
        sharing_rewards_earned=F('sharing_rewards_earned') + vouchers,
        sharing_progress_count=n % 3,
    )
    redeemer_profile.refresh_from_db()


def assert_nickname_set_for_public_share(user) -> None:
    """
    Guard for public-pool sharing: require a nickname (StudentProfile.display_name)
    so the recipient sees a chosen name instead of the sharer's phone/username.

    Raises ``NicknameRequired`` (HTTP 409, error_code NICKNAME_REQUIRED) when the
    user has no usable nickname. Shared by share_coupon_public and
    share_platform_voucher_public so the gate stays consistent across both pools.
    """
    from django.apps import apps
    from .exceptions import NicknameRequired

    StudentProfile = apps.get_model('api', 'StudentProfile')
    display_name = (
        StudentProfile.objects
        .filter(user=user)
        .values_list('display_name', flat=True)
        .first()
    )
    if not (display_name or '').strip():
        raise NicknameRequired(
            developer_message="User must set a nickname (display_name) before public sharing.",
            context={'hint': '/api/profile/'},
        )


def apply_referral_reward(referrer) -> None:
    """
    Increment the referrer's referral_progress_count and grant a reward voucher
    if the new count crosses a threshold.

    Thresholds (Metric 3, N=2):
      - count == 1  →  $5 TWD voucher
      - count >= 2  →  $10 TWD voucher per increment

    Args:
        referrer: Django User instance whose referral counter should increment.
    """
    from django.db.models import F

    try:
        profile = referrer.student_profile
        # Atomically increment referral_progress_count to avoid race conditions
        type(profile).objects.filter(pk=profile.pk).update(
            referral_progress_count=F('referral_progress_count') + 1
        )
        profile.refresh_from_db()
        count = profile.referral_progress_count
        if count == 1:
            grant_reward_voucher(referrer, 5, 'Referral Reward')
        elif count >= 2:
            grant_reward_voucher(referrer, 10, 'Referral Reward')
    except Exception:
        pass


def get_merchant_store(user):
    """
    Return the Store owned by the given merchant user.

    Returns the first store when a merchant has multiple stores (edge case).
    Returns None when no store exists for the user.
    """
    from django.apps import apps

    Store = apps.get_model('api', 'Store')
    try:
        return Store.objects.get(owner=user)
    except Store.DoesNotExist:
        return None
    except Store.MultipleObjectsReturned:
        return Store.objects.filter(owner=user).first()


def get_store_today(store) -> date:
    """
    Return "today" as a date in the store's timezone.
    Used for date-range validation (date_to <= today) and 今日成本.

    Args:
        store: Store model instance (with optional timezone field).

    Returns:
        Current calendar date in the store's timezone.
    """
    from django.utils import timezone as dj_timezone

    tz_name = getattr(store, "timezone", None) or DEFAULT_STORE_TIMEZONE
    try:
        zone = ZoneInfo(tz_name)
    except Exception:
        zone = ZoneInfo(DEFAULT_STORE_TIMEZONE)
    now = dj_timezone.now()
    # Convert to store TZ and take date
    if now.tzinfo is None:
        from django.conf import settings
        from datetime import datetime
        default_tz = getattr(settings, "TIME_ZONE", DEFAULT_STORE_TIMEZONE)
        now = now.replace(tzinfo=ZoneInfo(default_tz))
    local_dt = now.astimezone(zone)
    return local_dt.date()


def display_face_value(val) -> int | float:
    """
    Safely convert a Decimal/float face value to int when there's no fractional part.
    Returns 0 for None, NaN, or Infinity.
    """
    from decimal import Decimal, InvalidOperation
    import math

    if val is None:
        return 0
    try:
        f = float(val)
    except (TypeError, ValueError, InvalidOperation):
        return 0
    if math.isnan(f) or math.isinf(f):
        return 0
    return int(f) if f == int(f) else f


def get_store_currency_code(store) -> str | None:
    """
    Return the store's currency code for cost display (e.g. TWD, NT$).
    When null, callers may show number only or use a system default.

    Args:
        store: Store model instance (with optional currency_code field).

    Returns:
        Currency code string or None.
    """
    return getattr(store, "currency_code", None) or None


def validate_uploaded_image_file(image_file) -> tuple[str, str]:
    """
    Validate uploaded image file metadata and return normalized names.

    Returns:
        tuple[str, str]: (lowercase_filename, file_extension)
    """
    file_name = image_file.name.lower()
    file_extension = Path(file_name).suffix
    if file_extension not in ALLOWED_IMAGE_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_IMAGE_EXTENSIONS))
        raise ValueError(f"Invalid file type. Allowed types: {allowed}")

    if image_file.size > MAX_IMAGE_UPLOAD_SIZE:
        raise ValueError("File too large. Maximum size is 5MB.")

    return file_name, file_extension


def save_uploaded_image(image_file) -> str:
    """
    Save an uploaded image file to default storage and return its URL.

    The filename stored on disk is fully random (32-character hex string + validated
    extension).  The original user-supplied filename is intentionally discarded to
    prevent path traversal attacks and to avoid leaking business information.
    """
    _file_name, file_extension = validate_uploaded_image_file(image_file)
    # Use a cryptographically random name — never include any user-supplied path component.
    unique_filename = f"{secrets.token_hex(16)}{file_extension}"
    path = default_storage.save(unique_filename, image_file)
    return default_storage.url(path)

