"""
WebSocket origin validator for the spinner co-op route.

Why a custom validator instead of `channels.security.websocket.AllowedHostsOriginValidator`?

    The stock validator rejects every WS handshake whose `Origin` header
    doesn't match `settings.ALLOWED_HOSTS`. That's the right policy for
    pure browser apps, but it breaks **native mobile clients**: React
    Native's `WebSocket` sends either no Origin header or `Origin: null`,
    depending on platform/implementation. The result is a silent 403 with
    no path to recovery from the client side — the rejection happens
    before the consumer's auth check ever runs.

Policy implemented here:

    ✓ Missing Origin header           → allow (native mobile / curl / server)
    ✓ Origin: null                    → allow (some iOS WS implementations)
    ✓ Origin: <scheme>://<host>[:port] where <host> ∈ ALLOWED_HOSTS → allow
    ✗ Anything else                   → reject with close code 4403

Why is "accept missing Origin" safe?

    Browsers ALWAYS send an Origin header on WS handshakes per RFC 6455 —
    this is enforced by every browser engine and cannot be suppressed
    from JavaScript. A request with no Origin therefore cannot come from
    a browser, so accepting it does NOT open a Cross-Site WebSocket
    Hijacking (CSWSH) vector. Native mobile clients, CLIs, and
    server-to-server traffic are the only sources.

    The consumer also authenticates with a JWT in `?token=<...>` (NOT
    cookies). Even a malicious page in a sandboxed iframe with
    `Origin: null` cannot read the legitimate user's token from another
    origin's storage to put in the URL.

Distinguishable close code (4403):

    The consumer's auth-fail close code is 4401. Using 4403 here lets
    the frontend (useCoopRoom.ts) distinguish "validator rejected my
    origin" from "JWT was bad" — different remediation paths.
"""
from __future__ import annotations

from urllib.parse import urlparse

from django.conf import settings


# Close code returned on origin rejection. 4xxx range is the WebSocket spec's
# private-use range; 4403 was picked to mirror HTTP's 403 Forbidden semantic
# and to be distinct from the consumer's 4401 (auth failure).
ORIGIN_REJECTED_CLOSE_CODE = 4403


def _origin_header(scope) -> bytes | None:
    """Return the raw Origin header value (bytes) or None if missing."""
    for name, value in scope.get("headers") or []:
        if name == b"origin":
            return value
    return None


def _is_allowed_host(host: str) -> bool:
    """
    True iff `host` is in settings.ALLOWED_HOSTS. Uses exact match — a
    sloppy `host in ALLOWED_HOSTS` substring would let
    `localhost.evil.com` pass when `localhost` is allowlisted. We also
    honour the `'*'` wildcard for parity with Django's own host check
    (used in some test settings).
    """
    allowed = getattr(settings, "ALLOWED_HOSTS", []) or []
    if "*" in allowed:
        return True
    if host in allowed:
        return True
    # Django wildcard-subdomain entries like ".loca.lt" / "*.loca.lt"
    # match `anything.loca.lt`. Honour the same convention so the
    # validator doesn't disagree with Django's own host parsing.
    #
    # IMPORTANT: enforce a dot boundary on the suffix match. A naive
    # `host.endswith('.loca.lt')` accepts `evilevilloca.lt` because the
    # string literally ends in `.loca.lt`. We must match either the
    # bare host (`loca.lt`) exactly OR a subdomain (`<x>.loca.lt`).
    for pattern in allowed:
        if pattern.startswith("."):
            bare = pattern.lstrip(".")  # ".loca.lt" -> "loca.lt"
        elif pattern.startswith("*."):
            bare = pattern[2:]  # "*.loca.lt" -> "loca.lt"
        else:
            continue
        if host == bare or host.endswith("." + bare):
            return True
    return False


def _is_acceptable_origin(origin_header: bytes | None) -> bool:
    """Apply the policy documented at the top of this module."""
    if origin_header is None:
        # Missing Origin — cannot come from a browser (RFC 6455 §10.2
        # mandates Origin on WS handshakes, enforced by every browser
        # engine). Native mobile / curl / server-to-server is the
        # only source.
        return True
    # ASCII-only per HTTP spec (RFC 7230 field-value). latin-1 would
    # silently decode control chars and high-bytes; ascii rejects them
    # outright which is the safer default.
    try:
        origin_str = origin_header.decode("ascii").strip()
    except (UnicodeDecodeError, AttributeError):
        return False
    if origin_str == "":
        # Malformed `Origin:` with empty value — no real client sends
        # this. Reject to be safe.
        return False
    if origin_str.lower() == "null":
        # `Origin: null` CAN come from a browser (sandboxed iframe,
        # `file://`, `data:` URI). Accepting it here is SAFE ONLY
        # because the consumer authenticates with a JWT in `?token=`
        # (the URL), NOT cookies — a foreign sandboxed page can't
        # read another origin's storage to mint a valid token.
        #
        # ⚠ If WS auth ever migrates to cookies, this branch becomes
        # a CSWSH vector from sandboxed-iframe attackers and MUST be
        # removed or narrowed.
        return True
    parsed = urlparse(origin_str)
    if not parsed.scheme or not parsed.hostname:
        # Malformed Origin (e.g. raw "junk" without scheme) — reject.
        return False
    return _is_allowed_host(parsed.hostname)


class MobileFriendlyOriginValidator:
    """
    ASGI middleware that gates the WS upgrade by Origin header. Plays the
    same role as Channels' `AllowedHostsOriginValidator` but with mobile-
    aware policy (see module docstring).

    Wrap the WS router with this in `asgi.py`:

        "websocket": MobileFriendlyOriginValidator(URLRouter(websocket_urlpatterns)),
    """

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        # Defensive: this middleware is registered only on the websocket
        # branch of the protocol router. If it ever gets wired onto http,
        # fall through cleanly rather than erroring.
        if scope.get("type") != "websocket":
            await self.inner(scope, receive, send)
            return

        if _is_acceptable_origin(_origin_header(scope)):
            await self.inner(scope, receive, send)
            return

        # Reject: close before accept. The 'websocket.close' message
        # before any 'websocket.accept' translates on the wire to the
        # given close code without a server-side accept.
        await send({"type": "websocket.close", "code": ORIGIN_REJECTED_CLOSE_CODE})
