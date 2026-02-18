# Research: QR Code Deep Linking

**Feature**: 002-qr-deep-linking  
**Date**: 2026-02-05

## 1. Claim token identity (single token, backend resolves)

**Decision**: Use the existing `session_token` (QRCodeSession) as the claim token in the URL. No new table or token type.

**Rationale**:
- `session_token` is already unique and tied to one template via QRCodeSession; backend can resolve session_token → template_id + session_token in one lookup.
- Keeps URLs short (UUID4); single-use is enforced by existing claim idempotency and optionally by invalidating the session after claim.
- Aligns with spec: "single token; backend resolves to template_id + session_token."

**Alternatives considered**:
- New `ClaimToken` model with a separate token string: adds storage and migration; rejected for simplicity.
- Opaque token that maps to (template_id, session_token) in a new table: same complexity; rejected.

---

## 2. Claim landing page pattern

**Decision**: Implement claim landing the same way as collection landing: a Django view that renders HTML with install guidance and store links only (Smart App Banner, Open Graph, JS try-app-then-fallback). Path: `/claim/<token>/` (and optional short path e.g. `/cl/<token>/`). Reuse the same template structure as `collection_landing.html` but with claim-specific copy and no claim-related actions on web.

**Rationale**:
- Spec requires "same pattern as share link landing page URL"; collection landing is already implemented and documented (UNIVERSAL_LINKS.md).
- Reduces implementation variance and keeps AASA/assetlinks behaviour consistent.

**Alternatives considered**:
- Separate SPA or static page: more moving parts; rejected.
- Redirect-only to store: worse UX; rejected.

---

## 3. Expo deep link handling for claim URL

**Decision**: Use expo-linking (`Linking.getInitialURL()`, `Linking.addEventListener('url', ...)`) and expo-router to handle claim URLs. When the app receives `https://coupro.pro/claim/<token>` or `coupro://claim?token=<token>`, parse the token and navigate to the claim flow (e.g. a dedicated claim screen or existing QR-claim flow with token pre-filled). No legacy JSON payload in QR; in-app scanner only accepts URL format and parses the claim token from the URL.

**Rationale**:
- Matches existing pattern for collection share (UNIVERSAL_LINKS.md: "Linking.getInitialURL() / addEventListener('url', ...)").
- Scheme in app.json is `coupro`; use `coupro://claim?token=<token>` for app scheme.
- Single code path: URL → token → claim API (claim by token).

**Alternatives considered**:
- Separate "claim by token" screen vs reusing QR-claim screen with token: reusing with token pre-filled is simpler and preserves re-scan prevention semantics (same payload = same URL string).

---

## 4. Backend claim-by-token and template binding

**Decision**: Add a claim-by-token flow: accept `claim_token` (session_token) in the request body (e.g. `POST /api/qr-claim/claim/` with `{"claim_token": "<session_token>"}`). Backend looks up QRCodeSession by session_token; uses `qr_session.template` for all claim logic (template_id, stock, expiry); never trusts template_id from the client when claiming by token. Enforce single-use: after a successful claim for that session_token, either set QRCodeSession.is_active=False or rely on idempotency (existing QRCodeClaim by session_token/user). Enforce short-lived: optionally expire sessions after a configured TTL (e.g. 24h) if not already present.

**Rationale**:
- Fixes the existing security issue (template_id not bound to session_token): when claiming by token, template comes only from QRCodeSession.
- Single-use/short-lived: spec requirement; idempotency already prevents double claim; optional TTL limits exposure.

**Alternatives considered**:
- Keep only template_id + session_token in API and fix binding: spec chose single token; we add claim_token path and use session as source of truth for template.

---

## 5. AASA and assetlinks paths for claim

**Decision**: Add `/claim/*` (and optional `/cl/*`) to iOS AASA and Android assetlinks path prefixes so that `https://coupro.pro/claim/<token>` opens the app when installed.

**Rationale**:
- Same pattern as `/collection/*` and `/c/*`; documented in UNIVERSAL_LINKS.md.
- Required for "scan outside app → open app" when the QR encodes the https URL.

---

## 6. Merchant QR content (no legacy JSON)

**Decision**: Merchant app (Mobile-Merchant-Frontend) will encode the claim URL (from the generate API response) in the QR code instead of the current JSON. Backend generate endpoint returns `claim_link_web` and `claim_link` (scheme) in addition to existing fields; merchant displays a QR that encodes `claim_link_web` (preferred for outside-app scan) or `claim_link`. Legacy JSON encoding is removed for this feature (breaking change for existing QRs that encode JSON).

**Rationale**:
- Spec: in-app scanner accepts only deep-link URL format; legacy JSON out of scope.
- Single format simplifies client and backend; claim token = session_token so URLs are derived from existing generate response.

**Alternatives considered**:
- Support both JSON and URL in QR: spec explicitly chose no legacy support.
