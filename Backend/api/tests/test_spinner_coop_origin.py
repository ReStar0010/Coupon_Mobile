"""
Origin-validator integration tests for the spinner co-op WebSocket route.

These exercise the full ASGI stack including the validator middleware sitting
in front of the SpinnerCoopConsumer. The previous validator
(`AllowedHostsOriginValidator`) rejected every connection whose Origin
didn't match `settings.ALLOWED_HOSTS`, which silently blocked legitimate
React Native clients (their native WebSocket sends `Origin: null` or omits
the header entirely).

The new `MobileFriendlyOriginValidator` accepts:
  * Missing Origin header (native mobile)
  * `Origin: null` (some iOS WS implementations)
  * `Origin: <host>` where <host> is in `settings.ALLOWED_HOSTS` (own domains)

Anything else is rejected with close code 4403, distinguishable from the
consumer's auth-fail close code 4401.
"""
from __future__ import annotations

import pytest
from channels.testing import WebsocketCommunicator

from Backend.asgi import application


pytestmark = [pytest.mark.asyncio]


WS_PATH = "/ws/spinner/v1/?token="  # No token — consumer will 4401 if it runs


async def _try_connect(headers: list[tuple[bytes, bytes]] | None):
    """
    Open the WS, capture whether the handshake was accepted AND the close
    code if it was rejected. Channels' WebsocketCommunicator.connect()
    returns (accepted, code|None).
      * Validator rejects before accept → accepted=False, code=4403
      * Validator passes, consumer 4401s on missing token → accepted=False,
        code=4401
      * Both pass → accepted=True (we don't reach this case in these tests)
    """
    communicator = WebsocketCommunicator(application, WS_PATH, headers=headers or [])
    try:
        accepted, code = await communicator.connect()
        return accepted, code
    finally:
        await communicator.disconnect()


class TestMobileFriendlyOriginValidator:
    """All assertions check the close CODE rather than connected/disconnected
    only — we need to distinguish 'rejected by validator' (4403) from
    'reached consumer, no auth' (4401), since both end with accepted=False."""

    async def test_missing_origin_header_passes_validator_and_reaches_consumer(self):
        # Native mobile clients (React Native) typically don't send Origin.
        # The validator must let these through; the consumer then closes
        # with 4401 because we passed an empty token.
        accepted, code = await _try_connect(headers=[])
        assert accepted is False
        assert code == 4401, (
            f"Expected to reach consumer's 4401 path, got close code {code}. "
            "If 4403, the validator is still rejecting missing-Origin requests."
        )

    async def test_null_origin_passes_validator_and_reaches_consumer(self):
        # Some iOS WebSocket clients send Origin: null.
        accepted, code = await _try_connect(headers=[(b"origin", b"null")])
        assert accepted is False
        assert code == 4401, (
            f"Expected validator to allow Origin: null, got close code {code}."
        )

    async def test_allowed_host_origin_passes_validator(self):
        # Origin matches a host in settings.ALLOWED_HOSTS (test_settings.py
        # includes localhost). Must reach consumer's 4401 path.
        accepted, code = await _try_connect(headers=[(b"origin", b"http://localhost:3000")])
        assert accepted is False
        assert code == 4401, (
            f"Expected validator to allow allowlisted Origin, got code {code}."
        )

    async def test_foreign_origin_is_rejected_with_4403(self):
        # A browser cross-origin attack would arrive with a foreign Origin.
        # Must be rejected at the validator with our distinct 4403 code,
        # NOT 4401 — the consumer must never run for these connections.
        accepted, code = await _try_connect(
            headers=[(b"origin", b"https://evil.example.com")]
        )
        assert accepted is False
        assert code == 4403, (
            f"Expected foreign Origin to be rejected at validator with 4403, "
            f"got code {code}. (4401 means the consumer ran — validator failed open.)"
        )

    async def test_foreign_origin_with_matching_host_substring_is_rejected(self):
        # Regression guard: a sloppy substring match like `'localhost' in
        # origin` would accept `https://localhost.evil.com` as a valid
        # allowlisted Origin. Validate host equality, not containment.
        accepted, code = await _try_connect(
            headers=[(b"origin", b"https://localhost.evil.com")]
        )
        assert accepted is False
        assert code == 4403, (
            f"Expected localhost.evil.com to be rejected (host != localhost), "
            f"got code {code}."
        )

    async def test_lookalike_suffix_without_dot_boundary_is_rejected(self):
        # Regression guard for the endswith() dot-boundary bug surfaced
        # in code review. test_settings.py allows `*.loca.lt`. Without
        # the dot anchor, `evilevilloca.lt`.endswith('.loca.lt') would
        # return True and the validator would accept this foreign host.
        # The fix is `host == bare OR host.endswith('.' + bare)`.
        accepted, code = await _try_connect(
            headers=[(b"origin", b"https://evilevilloca.lt")]
        )
        assert accepted is False
        assert code == 4403, (
            "Expected evilevilloca.lt to be rejected (not a subdomain of "
            f"loca.lt despite ending with the string '.loca.lt'), got {code}."
        )

    async def test_empty_origin_value_is_rejected(self):
        # An `Origin:` header with an empty value is malformed per RFC
        # 6454 and no real client emits it. Reject defensively.
        accepted, code = await _try_connect(headers=[(b"origin", b"")])
        assert accepted is False
        assert code == 4403, (
            f"Expected empty Origin to be rejected at validator, got {code}."
        )
