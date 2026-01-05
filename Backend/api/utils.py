"""
Utility functions for phone number validation and formatting.
"""
import re

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

