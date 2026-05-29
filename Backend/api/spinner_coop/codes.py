"""
Short-code generator for room joining.

Crockford-ish alphabet — ambiguous characters (0/O, 1/I/L) stripped.
"""

from __future__ import annotations

import secrets

# 32 chars: A-Z minus I,L,O + 2-9 (no 0, no 1)
_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

CODE_LENGTH: int = 6


def generate_code(length: int = CODE_LENGTH) -> str:
    """Generate a cryptographically random short code.

    32^6 ≈ 1.07 billion possibilities; collision risk negligible at our scale.
    Caller should still check uniqueness against the active room set and retry
    on collision.
    """
    if length < 4 or length > 12:
        raise ValueError("code length must be 4..12")
    return "".join(secrets.choice(_ALPHABET) for _ in range(length))


def is_valid_code(code: str) -> bool:
    """Check that an input string could be a generated code."""
    if not isinstance(code, str):
        return False
    if not (4 <= len(code) <= 12):
        return False
    return all(ch in _ALPHABET for ch in code)


def normalize(code: str) -> str:
    """Uppercase + map common confusions back to canonical chars."""
    if not isinstance(code, str):
        return ""
    s = code.strip().upper()
    # Tolerant: user types O/0 → O, 1/I/L → I (we'll fail validation downstream
    # if they typed an O thinking it's a 0 since 0 isn't in the alphabet either).
    s = s.replace("0", "O").replace("1", "I").replace("L", "I")
    return s
