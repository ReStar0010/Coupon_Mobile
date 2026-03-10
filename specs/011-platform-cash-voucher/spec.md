# Feature Specification: Platform Cash Voucher

**Feature Branch**: `011-platform-cash-voucher`  
**Created**: 2026-03-09  
**Status**: Draft  
**Input**: User description: "實作需求：平台現金券（Platform Cash Voucher）— 不綁單一店家，可在任一家店核銷；核銷與分享流程與一般優惠券一致；管理僅用 Django Admin。"

## Clarifications

### Session 2026-03-09

- Q: Private share: who can accept? → A: Anyone with the share link can accept (link is the capability; no designated recipient).
- Q: Store eligibility for platform voucher redemption? → A: Only stores explicitly marked as participating in platform vouchers can accept; require a store-level flag or list.
- Q: Share link token validity? → A: No expiry; token remains valid until the share is accepted or declined (or cancelled).
- Q: Redemption amount: full face value only or partial use allowed? → A: Full face value only in a single redemption.
- Q: Cancelling or revoking a share? → A: Creator cannot cancel; share stays pending until someone accepts or the voucher is redeemed/expired.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consumer Redeems Platform Voucher at a Store (Priority: P1)

A consumer who holds a platform cash voucher goes to any participating store, enters the store’s 6-digit redemption code in the app, and redeems the voucher. The system records the redemption against that store and prevents the voucher from being used again.

**Why this priority**: Core value of platform vouchers is “use at any store”; redemption is the primary user action.

**Independent Test**: Consumer holds one platform voucher; enters a valid store code; redemption succeeds and voucher is marked used. Can be tested end-to-end without share or admin flows.

**Acceptance Scenarios**:

1. **Given** the user holds an unexpired, unredeemed platform voucher, **When** they submit the correct 6-digit code for a store that is marked as participating in platform vouchers, **Then** the voucher is redeemed at that store and cannot be redeemed again.
2. **Given** the user holds a platform voucher, **When** they submit a code that does not match any store or matches a store that does not participate in platform vouchers, **Then** the system rejects the redemption and returns a clear error.
3. **Given** the user is not the current holder of the voucher or the voucher is expired or already redeemed, **When** they attempt redemption, **Then** the system rejects the request.
4. **Given** the user is on the unified redemption screen, **When** they view available options, **Then** they see both store coupons and platform vouchers that they can redeem with the same store code.

---

### User Story 2 - Consumer Views and Manages Their Platform Vouchers (Priority: P1)

A consumer can see a list of their platform cash vouchers (current holder, not expired, not yet redeemed), open a voucher to see details (face value, expiry, batch, redemption status), and use the same redemption flow as for store coupons.

**Why this priority**: Listing and detail are required for users to discover and use platform vouchers.

**Independent Test**: User with one or more platform vouchers can call list and detail; response includes face value, expiry, batch, and redemption status where applicable.

**Acceptance Scenarios**:

1. **Given** the user is logged in, **When** they request their platform vouchers, **Then** they receive only vouchers they currently hold that are not expired and not yet redeemed.
2. **Given** the user requests a specific voucher by id, **When** the voucher exists and they are the current holder, **Then** they see full details including face value, currency, expiry, batch, and whether it has been redeemed.
3. **Given** the user requests a voucher they do not hold or that does not exist, **When** the request is made, **Then** the system returns an appropriate error (e.g. 404 or 403).

---

### User Story 3 - Consumer Shares Platform Voucher (Private or Public Pool) (Priority: P2)

A consumer can share a platform voucher privately (to another user via a share link/token) or to a public pool. The recipient can view share details via the token and accept the share; acceptance transfers the voucher to the recipient and records the share as accepted. The flow matches the existing store-coupon share flow (token, private vs public, race-safe accept).

**Why this priority**: Sharing aligns platform vouchers with store coupons and supports gifting and public campaigns.

**Independent Test**: Holder creates private share → recipient opens link and accepts → voucher moves to recipient. Holder creates public share → voucher has no current holder until someone accepts.

**Acceptance Scenarios**:

1. **Given** the user is the current holder of an unexpired, unredeemed platform voucher, **When** they create a private share, **Then** a share request is created and a share link (token) is returned; anyone with the link can accept (the link is the capability; there is no designated recipient).
2. **Given** a share request exists with a token, **When** a user opens the share info by token, **Then** they see voucher details (e.g. face value) and share metadata (e.g. from_user) without yet owning the voucher.
3. **Given** a pending private share and the accepting user has the token, **When** they accept the share, **Then** the voucher’s current holder becomes the acceptor, the share request is marked accepted, and concurrent accepts do not assign the voucher twice (e.g. via locking or uniqueness).
4. **Given** the user is the current holder, **When** they create a public-pool share, **Then** the voucher has no current holder and appears in the relevant public/share listing until someone accepts.
5. **Given** the user has created one or more public-pool shares, **When** they request “my public voucher shares”, **Then** they see those share requests and their status (e.g. pending, accepted).

---

### User Story 4 - Platform and Store Staff Manage Vouchers (Priority: P2)

Platform operators create and issue platform vouchers (single or in batches) and view redemptions and share requests. Optionally, store staff can redeem a voucher on behalf of a consumer (e.g. by verifying the consumer’s identity) so that redemption is recorded at their store.

**Why this priority**: Enables issuance, auditing, and optional in-store assisted redemption.

**Independent Test**: Admin creates a batch of vouchers with face value and expiry; vouchers appear with unique codes. Optional: merchant calls redeem-with-consumer; redemption is created for that store and consumer.

**Acceptance Scenarios**:

1. **Given** an admin user, **When** they create one or more platform vouchers (e.g. via batch form), **Then** each voucher has a unique 6-digit redemption code, face value, currency, expiry, and batch name.
2. **Given** an admin user, **When** they view platform vouchers and redemptions, **Then** they can list, filter, and search by voucher code, batch, holder, and redemption store/date.
3. **Given** store staff and an optional “merchant redeem” flow, **When** staff submits the consumer’s identifier (e.g. phone) and voucher, **Then** the system verifies the consumer is the current holder and creates a redemption at that store.

---

### Edge Cases

- What happens when a user tries to redeem the same platform voucher twice?  
  System must reject the second attempt and return a clear error; at most one redemption record exists per voucher.

- What happens when two users accept the same share token at the same time?  
  System must assign the voucher to exactly one acceptor (e.g. via transaction and row locking) and mark the share request accordingly; the other request receives a conflict or “already accepted” response.

- What happens when a voucher has expired or already been redeemed and the user attempts to share or redeem?  
  System rejects share and redeem; list/detail may still show the voucher with status indicating expired or redeemed.

- What happens when the store 6-digit code does not exist, is invalid, or the store does not participate in platform vouchers?  
  Redemption fails with a clear validation error; no redemption record is created.

- What happens when the current holder is null (e.g. public pool) and someone tries to redeem?  
  Redemption is rejected; only the current holder can initiate consumer redemption (or merchant redeem identifies the holder by another means).

- Do share link tokens expire?  
  No; a share token remains valid until the share request is accepted or declined.

- Can the share creator cancel a pending share?  
  No; the creator cannot revoke the link. The share stays pending until someone accepts or the voucher is redeemed or expired.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support platform cash vouchers that have a face value, currency, validity period (start/expiry), and a unique 6-character redemption code.
- **FR-002**: System MUST record who currently holds each voucher (current holder), and optionally the original owner and last holder, and how the voucher was acquired (e.g. platform issue, transfer, public pool).
- **FR-003**: System MUST allow redemption of a platform voucher only once, for the full face value; each redemption MUST be tied to one store and record the redeeming user, amount used (equal to face value), and time. Partial use is not supported.
- **FR-004**: Consumer redemption MUST use the same flow as store coupons: holder submits the store’s 6-digit redemption code; system validates holder, voucher validity, that the code maps to a store, and that the store is explicitly marked as participating in platform vouchers, then creates the redemption.
- **FR-005**: System MUST provide the authenticated user with a list of their platform vouchers that are currently held, not expired, and not yet redeemed.
- **FR-006**: System MUST provide voucher detail by id for the current holder, including face value, expiry, batch, and whether it has been redeemed.
- **FR-007**: System MUST support private share: holder creates a share request and receives a token/link; anyone with the link can view share info by token and accept, transferring the voucher to the acceptor (no designated recipient); accept MUST be race-safe (e.g. only one accept succeeds). Share tokens have no expiry and remain valid until the share is accepted or declined. The share creator cannot cancel or revoke a pending share; it stays pending until someone accepts or the voucher is redeemed or expired.
- **FR-008**: System MUST support public-pool share: holder can put a voucher into the public pool (no current holder); users can accept from the pool; requester can list their public-pool share requests and status.
- **FR-009**: System MUST extend the unified redemption-code check so that the same screen can show both redeemable store coupons and redeemable platform vouchers for the current user (e.g. one combined list or two lists with consistent structure).
- **FR-010**: System MUST allow platform operators to create and manage platform vouchers and to view redemptions and share requests (e.g. via admin only); optionally support batch creation (batch name, face value, quantity, expiry).
- **FR-011**: Optionally, system MUST allow store staff to redeem a platform voucher on behalf of a consumer by verifying the consumer (e.g. by phone) and recording the redemption at the staff member’s store.

### Key Entities

- **Platform voucher**: A single-use, transferable cash voucher issued by the platform. Attributes include face value, currency, validity period, unique 6-character redemption code, current holder, original owner, last holder, batch name, and acquisition method. Not tied to a single store; redeemable only at stores explicitly marked as participating in platform vouchers (store-level flag or equivalent).

- **Store (platform voucher participation)**: Stores that may accept platform voucher redemptions are determined by an explicit participation flag or list (e.g. a store-level “accepts platform vouchers” attribute); only those stores are valid targets for redemption.

- **Platform voucher redemption**: Record of one redemption of one platform voucher for the full face value. Links the voucher, the user who redeemed, the store where it was redeemed, the amount used (equal to voucher face value), and the time. Exactly one redemption per voucher; partial redemption is not supported.

- **Platform voucher share request**: A request to transfer a platform voucher (private or public). Links the voucher, sender and recipient (or public), a unique token for the share link, status (e.g. pending, accepted, declined), and timestamps. Structure aligned with existing coupon share requests so the same accept/share flow can be reused.

## Assumptions

- Voucher redemption codes are 6 characters and unique across all platform vouchers; they are not the same as store 6-digit codes (store codes identify the store; voucher code identifies the voucher).
- Consumer redeems by entering the **store’s** 6-digit code (unified with store coupons); the system uses that to resolve the store, verifies the store participates in platform vouchers, then records the redemption at that store.
- Management of platform vouchers (create, batch issue, view) is done only through the admin interface; no separate store-facing “create voucher” UI is required for this feature.
- Existing store coupon and share behaviour (Coupon, CouponShareRequest, redeem_coupon, sharing views, validate_unified_redemption_code) remains unchanged; the only extension is adding platform vouchers to the unified redemption response and new endpoints for platform voucher lifecycle.
- Currency defaults to TWD when not specified.
- Share link tokens do not expire; they remain valid until the share is accepted or declined. The share creator cannot cancel a pending share.
- Redemption is full face value only; each voucher is redeemed once for its entire amount. Partial use is not supported.
- Optional “merchant redeem” and optional updates to user profile stats (e.g. total_savings, coupons_used_count) are out-of-scope for must-have but may be implemented as optional enhancements.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Consumers can redeem a platform voucher at any store that is explicitly marked as participating in platform vouchers, using the same “enter store 6-digit code” flow as store coupons, with no duplicate redemptions.
- **SC-002**: Consumers see their redeemable platform vouchers together with redeemable store coupons on the unified redemption screen (or equivalent) so they can choose which to use without switching flows.
- **SC-003**: Private and public-pool share flows complete successfully under concurrent accept attempts (no double assignment of the same voucher).
- **SC-004**: Platform operators can create and list platform vouchers (including by batch) and view all redemptions and share requests via the admin interface.
- **SC-005**: At least 95% of valid redemption attempts (correct holder, valid store code, unexpired, unredeemed) complete successfully and produce exactly one redemption record per voucher.
