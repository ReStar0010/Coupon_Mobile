# Backend Landscape

Last updated: 2026-05-14
Source of truth: `Backend/api/` on branch `refactor/frontend`.

---

## 1. Stack & runtime

| Concern | Choice |
|---|---|
| Language | Python 3.10+ |
| Framework | Django 5.2 + DRF 3.16 + drf-yasg |
| ASGI | Daphne + Channels (`Backend/Backend/asgi.py`) |
| HTTP | Gunicorn + gevent (per CLAUDE.md) |
| Auth | `rest_framework_simplejwt` (Bearer, 10 min access / 30 d refresh, rotating + blacklist on rotation). Custom `api.auth.CookieJWTAuthentication` also wired. |
| DB | SQLite (dev) / PostgreSQL via `DATABASE_URL` (prod) |
| Storage | Cloudflare R2 via `storages.backends.s3.S3Storage` when env present, else `FileSystemStorage` |
| Channel layer | `channels.layers.InMemoryChannelLayer` (dev/test). Multi-worker prod would need Redis. |
| Email | Resend SDK |
| SMS / OTP | Twilio (SMS_DEV_MODE=True ⇒ log to console) |
| Errors | Sentry SDK |

Throttle defaults (`REST_FRAMEWORK.DEFAULT_THROTTLE_RATES`): anon 60/h, user 1000/h, plus scoped throttles `phone_registration_lookup` 20/h, `redemption` 30/h.

---

## 2. Database schema

All models live in `Backend/api/models.py` except `Wallet` and `SpinnerRound` which live in `Backend/api/spinner_coop/models.py` and are re-exported via the line at the bottom of `models.py`. Migrations are linear `0001 → 0053`.

### 2.1 Identity & profiles

| Model | Key fields | Notes |
|---|---|---|
| `User` (`django.contrib.auth`) | id, email, username, date_joined, groups | Group `"Merchant"` distinguishes merchants. |
| `PasswordResetProfile` | user (1:1), token, token_created_at | |
| `StudentProfile` | user (1:1), phone_number (unique), verified, phone_verified, coupons_used_count, total_savings, monthly_savings, last_savings_reset, savings_goal_name/amount/image, last_draw_time, last_logged_in, sharing_progress_count, sharing_rewards_earned, referral_progress_count | Per-consumer profile. Statistics + goals + progress trackers live here. |
| `MerchantProfile` | user (1:1), phone, contact_person, contact_info, application_status, verified, violation_count, suspension_flagged | Per-merchant profile + UGC violation counters. |

### 2.2 Stores, tags, templates, coupons

| Model | Key fields | Notes |
|---|---|---|
| `Store` | owner (FK User, nullable), name, lat, lng, address, business_hours, image_url, store_type, average_order_value, unified_redeem_code (unique), timezone, currency_code, accepts_platform_vouchers | Geolocation lives here. No "news" table. |
| `Tag` | name (unique), display_name | |
| `CouponTemplate` | store, coupon_name, coupon_detail, important_notes, image_url, estimated_savings, template_redeem_code, tags M2M, total_quantity, remaining_quantity, start_date, expiry_date, draw_probability, show_in_desk_qrcode, is_active | Supports `generate_coupon(recipient)` race-safe via `select_for_update`. |
| `Coupon` | store, template (nullable), coupon_name, coupon_detail, important_notes, start_date, expiry_date, image_url, coupon_type ∈ {store, exclusive}, estimated_savings, tags M2M, original_owner, last_holder, current_holder, pending_phone_number, redeem_code, usage_per_day ∈ {one-time, unlimited}, acquisition_method ∈ {draw, consolidate, transfer, public_pool, qr_claim, admin_issue} | Store coupons have NO holder (multi-use). Exclusive coupons have a single holder and one redemption. |
| `CouponRedemption` | coupon, user, redeemed_at, savings_amount, lat, lng, coupon_type (denormalized) | Unique constraint: one redemption per exclusive coupon per user. |
| `Log` | timestamp, action ∈ {view, redeem, share, template_view}, user, coupon, template, lat, lng | Generic action log. |

### 2.3 Sharing

| Model | Notes |
|---|---|
| `CouponShareRequest` | coupon, from_user, to_user (nullable), token (unique), status ∈ {pending, accepted, declined, cancelled}, created_at, responded_at, is_public. Unique partial constraint: one pending public share per coupon. |
| `PlatformVoucher` + `PlatformVoucherRedemption` + `PlatformVoucherShareRequest` | Parallel system for platform-issued cash vouchers (face_value, currency_code). |

### 2.4 QR claim / web flow

| Model | Notes |
|---|---|
| `QRCodeSession` | template, merchant, session_token (UUID4), is_active, invalidated_at. Merchant generates per template; session ends when merchant closes display. |
| `StoreFixedSession` | store (1:1), session_token, is_active, rotated_at. Long-lived per-store table sticker token. |
| `QRCodeClaim` | idempotency_key (unique), user, template, coupon, session_token, claimed_at. Retry-safe consumer claim record. |
| `WebRedemption` | template (SET_NULL) + legacy_template_id/name snapshot, session_token, fixed_session_token, phone_number, progress_applied, redeemed_at. Anonymous web flow record. |

### 2.5 UGC compliance (Apple 1.2)

| Model | Notes |
|---|---|
| `ContentReport` | reporter, GenericFK to Coupon|Store, reason ∈ inappropriate/misleading/illegal/spam/other, status, reviewed_at/by. |
| `BlockedMerchant` | user + store (unique together). |
| `EULAAcceptance` | merchant, version (unique together). |
| `ModerationAction` | report, admin, action ∈ approve/remove/suspend, notes. |
| `ViolationRecord` | merchant, report, action, violation_type ∈ content_removed/account_suspended. |

### 2.6 Other infra

| Model | Notes |
|---|---|
| `CompletedGoal` | Per-user savings-goal achievement history. |
| `PhoneOTPRecord` | phone_number, otp_code, user (nullable for registration), purpose ∈ phone_change/registration/password_reset, expires_at, attempt_count (max 5), is_verified. Rate-limit helpers `can_send_otp` (3/h, 60 s cooldown). |
| `AccountDeletionLog` | Audit trail for `consumer_delete_account` / merchant `delete_account`. |

### 2.7 Spinner co-op (migration 0053, lives in `api/spinner_coop/models.py`)

| Model | Notes |
|---|---|
| `Wallet` | user (1:1, PK), `gems` (PositiveInt), `cou_points` (PositiveInt), `version` (optimistic-lock counter), created_at, updated_at. db_table `spinner_wallet`. **This is the single source of truth for both currencies.** |
| `SpinnerRound` | round_id (UUID PK), room_id, num_players, g_total, f_floor, m_multiplier, shares (JSON list of `{user_id, seat, stake, floor, excess, share}`), aborted, abort_reason, settled_at. Append-only ledger for coop rounds only. |

There is **no transaction ledger** for solo-spin, merchant redemption, share rewards, or CouPoint spending. Today only `SpinnerRound` records co-op activity.

---

## 3. HTTP API surface

Root URL conf: `Backend/Backend/urls.py` mounts everything under `/api/` plus a handful of public landing pages and `.well-known/` files. Domain routers live under `Backend/api/urls/`.

### 3.1 Auth (`auth_urls.py`)

| Method + Path | View | Auth | Notes |
|---|---|---|---|
| POST /api/register/ | `authentication.register` | none | Email/password. |
| POST /api/login/ | `authentication.login` | none | Email or phone + password (mutually exclusive). `client_type` ∈ {merchant, user}. |
| POST /api/logout/ | `authentication.logout` | JWT | Blacklists refresh token. |
| POST /api/token/refresh/ | `authentication.refresh_token` | refresh | Rotating. |
| POST /api/verify-email/ | `authentication.verify_email` | none | Token query. |
| POST /api/email-settings/send-verification/ | `authentication.request_email_verification` | JWT | |
| POST /api/merchant/verify-email/ | `authentication.verify_merchant_email` | none | |
| POST /api/merchant/resend-verification/ | `authentication.resend_merchant_verification` | JWT (merchant) | |
| GET /api/merchant/redirect/verify-email | redirector | none | |
| GET /api/merchant/redirect/reset-password | redirector | none | |
| POST /api/forgot-password/ | `authentication.forgot_password` | none | Email. |
| POST /api/reset-password/ | `authentication.reset_password` | none | Token. |
| POST /api/register/check-phone/ | `phone_otp.check_registration_phone` | none | Throttle `phone_registration_lookup`. |
| POST /api/register/send-otp/ | `phone_otp.send_registration_otp` | none | |
| POST /api/register/verify-otp/ | `phone_otp.verify_registration_otp` | none | Creates StudentProfile. |
| POST /api/forgot-password/phone/send-otp/ | `phone_otp.send_password_reset_otp` | none | |
| POST /api/forgot-password/phone/reset/ | `phone_otp.verify_password_reset_otp` | none | |
| GET /api/user-info/ | `auth.user_info.user_info` | JWT | Returns `{id, email, verified, is_merchant, message, date_joined, merchant_profile?, store?}`. |
| POST /api/phone-otp/send/ | `phone_otp.send_otp` | JWT | Phone change OTP. |
| POST /api/phone-otp/verify/ | `phone_otp.verify_otp` | JWT | |

### 3.2 Coupons (`coupon_urls.py`)

| Method + Path | View | Auth | Notes |
|---|---|---|---|
| GET /api/store-coupons/ | `coupon_views.get_store_coupons` | AllowAny | Public "Type A" + public-pool exclusive coupons. Filters blocked merchants for authed users. |
| GET /api/exclusive-coupons/ | `coupon_views.get_exclusive_coupons` | JWT | Authed user's available exclusive draws. |
| GET /api/coupons/`<int:id>`/ | `coupon_views.get_coupon_detail` | JWT (typical) | |
| POST /api/redeem/`<int:id>`/ | `coupon_views.redeem_coupon` | JWT (consumer) | Validates `redeem_code` body. Throttle `redemption`. |
| GET /api/unified-redemption/`<str:code>`/ | `coupon_views.validate_unified_redemption_code` | JWT | Returns store + available coupons + platform vouchers. |
| GET /api/platform-vouchers/ | `platform_voucher_views.platform_voucher_list` | JWT | |
| GET /api/platform-vouchers/`<int:pk>`/ | `.platform_voucher_detail` | JWT | |
| POST /api/platform-voucher/`<int>`/redeem/ | `.redeem_platform_voucher` | JWT | Body: `redeem_code` (store 6-digit). |
| POST /api/platform-voucher/`<int>`/share/ | `.share_platform_voucher` | JWT | Private share. |
| POST /api/platform-voucher/`<int>`/share-public/ | `.share_platform_voucher_public` | JWT | |
| GET /api/platform-voucher/share/`<token>`/ | `.get_platform_voucher_share` | JWT | |
| POST /api/platform-voucher/share/`<token>`/accept/ | `.accept_platform_voucher_share` | JWT | |
| GET /api/my-public-voucher-shares/ | `.my_public_voucher_shares` | JWT | |
| POST /api/events/template-view/ | `events.track_template_view` | JWT/AllowAny | Analytics. |
| GET /api/daily-draw-templates/ | `daily_draw.get_daily_draw_templates` | JWT | |
| POST /api/coupon/daily-draw/ | `daily_draw.draw_coupon` | JWT | Body: `template_id`. Probability-based template draw. |
| GET /api/coupon/draw-history/ | `daily_draw.draw_history` | JWT | |
| GET /api/last-draw/ | `daily_draw.get_last_draw_time` | JWT | |
| POST /api/coupon/`<int>`/share/ | `sharing_views.share_coupon` | JWT | Private share to phone. |
| POST /api/coupon/`<int>`/share-public/ | `.share_coupon_public` | JWT | |
| GET /api/coupon/share/`<token>`/ | `.get_share_request` | JWT | |
| POST /api/coupon/share/`<token>`/accept/ | `.accept_share_request` | JWT | |
| GET /api/my-public-shares/ | `.get_my_public_shares` | JWT | |
| POST /api/coupon/share-public/`<int>`/withdraw/ | `.withdraw_public_share` | JWT | |
| GET /api/tags/ | `merchant_coupon.get_all_tags` | JWT | |
| POST /api/qr-claim/claim/ | `qr_claim.claim_coupon_via_qr` | JWT | Body: `{template_id, session_token, idempotency_key?}` OR `{claim_token, idempotency_key?}`. |

### 3.3 Merchant (`merchant_urls.py`)

CRUD on `CouponTemplate`, merchant profile + statistics, account deletion, image upload, QR session generate/invalidate, voucher merchant-redeem, EULA.

| Method + Path | View | Notes |
|---|---|---|
| GET /api/merchant/coupon-templates/ | `merchant_coupon.list_coupon_templates` | |
| GET /api/merchant/coupon-templates/`<int>`/ | `.get_coupon_template` | |
| POST /api/merchant/coupon-templates/create/ | `.create_coupon_template` | |
| PUT /api/merchant/coupon-templates/`<int>`/update/ | `.update_coupon_template` | |
| DELETE /api/merchant/coupon-templates/`<int>`/delete/ | `.delete_coupon_template` | |
| GET /api/merchant/coupon-templates/`<int>`/analytics/ | `.get_template_analytics` | Includes `date_range_cost*` for exclusive. |
| POST /api/merchant/consolidate-coupon/ | `.merchant_consolidate_coupon` | Phone-based coupon move. |
| POST /api/merchant/refresh_redeem_code/ | `.refresh_redeem_code` | |
| POST /api/merchant/redeem/ | `.merchant_redeem` | Phone + template. |
| POST /api/merchant/unified-redemption/generate/ | `.generate_unified_redemption_code_view` | |
| GET /api/merchant/profile/ | `merchant_profile.get_merchant_profile` | |
| PUT /api/merchant/profile/update/ | `.update_merchant_profile` | |
| GET /api/merchant/statistics/ | `.get_merchant_statistics` | Includes `today_cost*`. |
| POST /api/merchant/account/pre-delete-check/ | `account_deletion.pre_delete_check` | |
| POST /api/merchant/account/delete/ | `.delete_account` | |
| GET /api/merchant/account/deletion-status/ | `.get_deletion_status` | |
| POST /api/merchant/upload-image/ | `merchant_coupon.upload_image` | |
| POST /api/merchant/qr-session/generate/ | `qr_claim.generate_qr_session` | |
| POST /api/merchant/qr-session/`<int>`/invalidate/ | `.invalidate_qr_session` | |
| POST /api/merchant/redeem-voucher/ | `platform_voucher_views.merchant_redeem_voucher` | |
| GET/POST /api/merchant/eula/{status,accept,content}/ | EULA views | |

### 3.4 User (`user_urls.py`)

| Method + Path | View | Notes |
|---|---|---|
| GET /api/progress-trackers/ | `user_profile.progress_trackers` | Returns `{total_redemptions, sharing_progress, referral_progress}`. |
| GET /api/user-statistics/ | `.user_statistics` | Returns coupons_used_count, savings, goal info. |
| POST /api/set-savings-goal/ | `.set_savings_goal` | |
| GET /api/completed-goals/ | `.completed_goals` | |
| POST /api/add-completed-goal/ | `.add_completed_goal` | |
| POST /api/reset-savings-goal/ | `.reset_savings_goal` | |
| POST /api/feedback/ | `feedback.submit_feedback` | Body: `{feedback_type ∈ bug/feature, details}`. Sends email via Resend. |
| GET/PUT /api/user/phone/ | `.user_phone` | |
| GET /api/coupon-history/ | `.coupon_history` | |
| GET /api/coupon-history/`<int>`/ | `.coupon_history_detail` | |
| POST /api/account/pre-delete-check/ | `consumer_account_deletion.consumer_pre_delete_check` | |
| POST /api/account/delete/ | `.consumer_delete_account` | |

### 3.5 Moderation (`moderation_urls.py`)

| Method + Path | View | Notes |
|---|---|---|
| POST /api/content/`<content_type>`/`<int>`/report/ | `ReportContentView` | content_type ∈ {coupon, store}. Body: `{reason, details?}`. 24-h duplicate window. |
| GET /api/content/`<content_type>`/`<int>`/report/status/ | `ReportStatusView` | |
| GET /api/user/reports/ | `UserReportsView` | |
| GET /api/user/blocked-merchants/ | `BlockedMerchantsListView` | Returns `[{id, store: {id, name, address, image_url}, created_at}]`. |
| POST /api/user/blocked-merchants/add/ | `BlockMerchantView` | Body: `{store_id}`. |
| DELETE /api/user/blocked-merchants/`<int:store_id>`/ | `UnblockMerchantView` | |
| GET /api/store/`<int:store_id>`/block-status/ | `BlockStatusView` | |
| GET /api/content-guidelines/ | EULA `ContentGuidelinesView` | Public. |
| GET /api/privacy-policy/ | `PrivacyPolicyView` | Public. |
| GET /api/terms/ | `TermsOfServiceView` | Public. |
| Admin /api/admin/moderation/* | various | `IsAdminUser`. Queue, report detail, action, escalations, merchant violations, stats. |

### 3.6 Web v1 (`web_v1_urls.py`)

Anonymous web-flow consumer endpoints (the "scan-at-table" experience without an app account). Not consumed by the mobile app today. Views live under `views/web_v1/`.

### 3.7 Other root paths (in `Backend/urls.py`)

- `admin/`, Swagger / Redoc, `swagger.json|yaml`
- `collection/<token>/`, `claim/<token>/`, `claim-fixed/<token>/`, `cl/<token>/`, `voucher/<token>/` — Universal Links landing pages.
- `.well-known/apple-app-site-association`, `.well-known/assetlinks.json`
- `api/ping/`, `api/health/`, `api/test-sentry/`, `api/load-test/*`
- `/media/` served by Django in DEBUG.

---

## 4. WebSocket surface

`Backend.asgi.application` is a `ProtocolTypeRouter`:
- `http` → Django HTTP app
- `websocket` → `AllowedHostsOriginValidator(URLRouter(websocket_urlpatterns))`
- `lifespan` handled inline.

The only WS route is `^ws/spinner/v1/?$` → `SpinnerCoopConsumer` (`api/spinner_coop/consumer.py`).

### 4.1 Auth & framing

- Connect URL: `wss://<host>/ws/spinner/v1/?token=<jwt>`
- Token validated via `JWTAuthentication().get_validated_token`; rejected with WS close code 4401 on failure.
- Display name read server-side from the User (capped at 40 chars). Client cannot spoof identity.

### 4.2 Commands (client → server)

| Type | Body | Effect |
|---|---|---|
| `room.create` | `{solo?: bool}` | Rate-limited to 5/min/user. |
| `room.join` | `{room_id?, code?}` | One of room_id or short code. |
| `room.leave` | `{}` | |
| `stake.set` | `{gems: int}` | Strict int — bools rejected. |
| `stake.lock` / `stake.unlock` | `{}` | |
| `countdown.start` | `{}` | |
| `charge.press_in` / `charge.press_out` | `{}` | Schedules charge_tick. |
| `reveal.ack` | `{round_id}` | |
| `rematch.request` | `{}` | |
| `pong` | `{id}` | Exempt from rate limit. |

Per-connection sliding-window rate limit: 20 commands/sec. One asyncio.Lock per room serializes the read → transition → write cycle.

### 4.3 Events (server → client, partial)

`room.created`, `room.joined`, `room.left`, `room.host_changed`, `room.staked`, `room.ready`, `room.countdown`, `room.charging`, `room.spinning`, `room.reveal`, `room.settled`, `room.aborted`, `error`, `ping`.

All envelopes include `v` (protocol version), `type`, `ts`, `seq` (per-room monotonic, except out-of-band: `error`, `room.aborted`, `ping`), `room_id`, `body`, and `you_are` (stamped per-recipient) on broadcast.

### 4.4 Side effects (server-owned)

`SideEffectExecutor` (`spinner_coop/executor.py`) runs persistence + wallet mutations via `WalletService` BEFORE state is committed and broadcasts emitted. Failures emit a synthetic `room.aborted` with reason `system_error` so clients can never animate winnings that didn't actually settle.

---

## 5. Wallet service (single currency authority)

`Backend/api/spinner_coop/wallet_service.py` exposes the only canonical mutators:

| Method | Behavior |
|---|---|
| `WalletService.ensure_wallet(user_id, initial_gems=0)` | Idempotent `get_or_create`. |
| `WalletService.get_balance(user_id) → (gems, cou_points)` | Raises `WalletNotFoundError`. |
| `WalletService.debit_gems({uid: gems})` | All-or-nothing inside `transaction.atomic + select_for_update`. Raises `InsufficientGemsError`. Bumps `version`. |
| `WalletService.refund_gems({uid: gems})` | Always succeeds. Bumps `version`. |
| `WalletService.credit_coupoints({uid: pts})` | Always succeeds. Bumps `version`. |

**Notably missing:** there is no `credit_gems`, no `debit_coupoints`, and no ledger row written per mutation. The coop path wraps these calls inside its own `SpinnerRound` write at REVEAL → SETTLED. Any new flow (solo spin, share-reward, merchant CouPoint spend) needs its own ledger model and must use the existing atomic methods to stay race-safe with the coop consumer.

---

## 6. Services (`Backend/api/services/`)

| Module | Purpose |
|---|---|
| `email_service.py` | Resend wrapper used by auth + sharing flows. |
| `sms_service.py` | Twilio wrapper for OTP. SMS_DEV_MODE=True logs to console. |
| `analytics_service.py` | Internal events. |
| `moderation_service.py` | UGC pipeline helpers (escalation thresholds, violation counters). |
| `spinner_coop_draw.py` | Co-op draw logic (M multiplier roll, share allocation). |

---

## 7. Things the backend explicitly does NOT have today

1. **No store geolocation search endpoint.** `Store.lat/lng` exist but no `/api/merchants/nearby/`. Frontend `listNearby()` has no target.
2. **No public merchant detail endpoint.** Only `/api/merchant/profile/` (merchant-self). Frontend `getMerchant(id)` has no target.
3. **No store news / merchant broadcast feed.** The MerchantSheet's "店家近況" has nothing to render against.
4. **No `/api/profile/` endpoint family.** Profile is split across `/api/user-info/`, `/api/user/phone/`, `/api/account/delete/`.
5. **No `/api/wallet/` endpoint.** `Wallet` exists; no read view.
6. **No `/api/coupons/` (list-mine).** Only `/api/store-coupons/` (public pool) and `/api/exclusive-coupons/` (drawable).
7. **No solo-spinner endpoint.** `/api/coupon/daily-draw/` is a template-probability draw, not the gems→CouPoints multiplier game in `useSpinLogic.ts`.
8. **No CouPoint spend endpoint.** `CouPointUseScreen` has nowhere to POST to.
9. **No CouPoint / unified transaction ledger.** Only `SpinnerRound` (coop only).
10. **No path aliases that match the FE's `apiClient` paths** for redeem / share / flag / block / coupon list.
11. **No share-reward credit path.** When a shared coupon is accepted, gems are not credited server-side (FE bumps locally).
12. **No `credit_gems` method on `WalletService`.** Earning gems is currently impossible through the wallet service surface.

---

## 8. Compliance & policy reminders

- Apple Guideline 1.2: every UGC entry point must surface reporting, blocking, EULA acceptance, and admin moderation. These endpoints exist; the FE must consume them.
- Apple Guideline 5.1.1: account-deletion endpoints exist for both consumer and merchant. The FE must wire them.
- All exceptions go through `api.exceptions.couPro_exception_handler`. New endpoints should raise typed exceptions (`api.exceptions`) instead of `Response(error=...)` to preserve the error envelope.
- All file uploads route through `default_storage` so they automatically flow to R2 when configured.
