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

