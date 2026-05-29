"""
DRF throttles keyed by request attributes other than IP.
"""

import re

from rest_framework.throttling import SimpleRateThrottle, UserRateThrottle


class RedemptionThrottle(UserRateThrottle):
    """
    Rate limit redemption endpoints to prevent brute-force attacks on 6-digit codes.

    Scope rate comes from REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['redemption'].
    Applied to: redeem_coupon, merchant_redeem, validate_unified_redemption_code.
    """

    scope = "redemption"


class PhoneRegistrationLookupThrottle(SimpleRateThrottle):
    """
    Rate limit POST /api/register/check-phone/ by normalized phone_number in body.

    - Scope rate comes from REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['phone_registration_lookup'].
    - If phone_number is missing or empty after strip, return None (no throttle for that request).
    - Invalid-format phones still get a cache key from the stripped string so those attempts count.
    """

    scope = "phone_registration_lookup"

    def get_cache_key(self, request, view):
        if request.method != "POST":
            return None
        try:
            raw = request.data.get("phone_number", "")
        except Exception:
            return None
        if raw is None or (isinstance(raw, str) and not raw.strip()):
            return None
        if not isinstance(raw, str):
            raw = str(raw)
        stripped = re.sub(r"[-\s()]", "", raw)
        if not stripped:
            return None
        return self.cache_format % {
            "scope": self.scope,
            "ident": stripped,
        }
