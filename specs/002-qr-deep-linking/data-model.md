# Data Model: QR Code Deep Linking

**Feature**: 002-qr-deep-linking  
**Date**: 2026-02-05

No new persistent entities are introduced. The feature reuses existing models and adds URL/link concepts and validation rules.

---

## Existing entities (unchanged structure)

### QRCodeSession (Backend)

- **Purpose**: Active QR session for a coupon template; holds the token used in the claim URL.
- **Relevant fields**: `id`, `template_id` (FK), `merchant_id` (FK), `session_token` (unique), `is_active`, `created_at` (if present).
- **Use in this feature**: `session_token` is the claim token in the claim URL. Backend resolves claim_token (from URL or request body) to this row, then uses `template` for claim logic. Single-use/short-lived: after successful claim the session can be set `is_active=False` or rely on idempotency; optional TTL on `created_at` for expiry.

### CouponTemplate (Backend)

- **Purpose**: Template for coupon instances; has remaining_quantity, expiry_date.
- **Use in this feature**: Claim flow uses the template from QRCodeSession only (no client-supplied template_id when claiming by token).

### QRCodeClaim (Backend)

- **Purpose**: Records a claim for idempotency and analytics.
- **Use in this feature**: Unchanged; claim-by-token still creates QRCodeClaim tied to the template and user; idempotency key can be derived from claim_token/user when claiming by token.

### Coupon (Backend)

- **Purpose**: Coupon instance created when user claims.
- **Use in this feature**: Unchanged; created from QRCodeSession.template when claim succeeds.

---

## Logical entities (no new tables)

### Claim URL

- **What it is**: A URL (web or app scheme) that encodes a single claim token (session_token).
- **Formats**:
  - Web: `https://<base_url>/claim/<token>/` (or `/cl/<token>/`).
  - App scheme: `coupro://claim?token=<token>` (scheme from app.json).
- **Validation**: Token must match an active QRCodeSession.session_token; template must be active, in stock, not expired.

### Claim token

- **What it is**: The single parameter in the claim URL; same value as QRCodeSession.session_token.
- **Lifecycle**: Created when merchant generates a QR session; valid until first successful claim (or session invalidated / optional TTL). Single-use and short-lived per spec.
- **Short-lived / TTL**: At least one MUST be enforced: (1) invalidate after first successful claim (session `is_active=False` or idempotency), or (2) optional TTL from `created_at` (e.g. 24h). Implementation may use QRCodeSession.is_active and optional created_at check.

### Landing page (claim)

- **What it is**: The web page served at `/claim/<token>/` when the user does not have the app. Renders install guidance and store links only; no claim-related actions on web.
- **Data**: Token from path; lookup QRCodeSession for optional display (e.g. “CouPro 優惠券”); same settings as collection landing (COUPRO_PUBLIC_BASE_URL, store links).

### Re-scan prevention state (in-app)

- **What it is**: In-session state in the mobile app used to block duplicate claims (e.g. same payload already claimed, or same payload within a time window).
- **Out of scope for change**: Same behaviour as today; “payload” for deep-link QRs is the URL string (so same URL = same payload).

---

## Validation rules (from spec and research)

1. **Claim token resolution**: Backend MUST resolve claim_token to QRCodeSession by session_token; MUST use qr_session.template for template_id and all template checks; MUST NOT trust client-supplied template_id when claiming by token.
2. **Single-use**: A claim token MUST result in at most one successful claim (idempotency and/or session invalidation after claim).
3. **Short-lived**: Claim tokens MUST be limited by at least one of: (a) invalidate after first successful claim, or (b) optional TTL from creation (e.g. 24h); use QRCodeSession.is_active and optional created_at check.
4. **Landing page**: Served without authentication; token in path; page content is install + store links only.
