"""
Utility functions for phone number validation, formatting, and store timezone/currency.
"""
import re
import secrets
from datetime import date
from zoneinfo import ZoneInfo

# Default timezone when store has none (e.g. Asia/Taipei per research.md)
DEFAULT_STORE_TIMEZONE = "Asia/Taipei"

# Taiwan mobile phone number format: 09XXXXXXXX (10 digits starting with 09)
TAIWAN_MOBILE_REGEX = re.compile(r'^09\d{8}$')


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
    from datetime import datetime

    PlatformVoucher = apps.get_model('api', 'PlatformVoucher')
    redeem_code = generate_platform_voucher_redeem_code()
    now = dj_timezone.now()
    year = now.year if (now.month < 3 or (now.month == 3 and now.day <= 29)) else now.year + 1
    # 固定用台灣時區：3/29 23:59:59 為「台灣當日結束」，不隨伺服器時區變動
    taiwan = ZoneInfo(DEFAULT_STORE_TIMEZONE)
    expiry_date = datetime(year, 3, 29, 23, 59, 59, tzinfo=taiwan)
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
    try:
        profile = referrer.student_profile
        profile.referral_progress_count += 1
        profile.save(update_fields=['referral_progress_count'])
        count = profile.referral_progress_count
        if count == 1:
            grant_reward_voucher(referrer, 5, 'Referral Reward')
        elif count >= 2:
            grant_reward_voucher(referrer, 10, 'Referral Reward')
    except Exception:
        pass


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

