# Runbook

<!-- AUTO-GENERATED: endpoint lists and env var references are derived from urls/, settings.py, and README.md. Operational prose is hand-written. -->

## Deployment (Render)

### Backend Deploy Steps

1. Push to the target branch (production tracks `main`).
2. Render auto-deploys via `build.sh`:
   - installs dependencies
   - runs `python manage.py migrate`
   - runs `python manage.py seed_load_test` (idempotent — safe to re-run)
   - collects static files
3. Gunicorn starts via `gunicorn.conf.py` (gevent worker, `Backend.wsgi:application`).

### Required Env Vars (Production)

Set these in the Render service's environment tab:

| Variable | Notes |
|----------|-------|
| `SECRET_KEY` | Django secret key — generate with `python -c "import secrets; print(secrets.token_urlsafe(50))"` |
| `DATABASE_URL` | Render PostgreSQL connection string (auto-injected if using a Render DB) |
| `DEBUG` | Must be `False` |
| `API_BASE_URL` | `https://api.coupro.pro` |
| `FRONTEND_URL` | `https://app.coupro.pro` |
| `RESEND_API_KEY` | Transactional email |
| `TWILIO_ACCOUNT_SID` | OTP SMS |
| `TWILIO_AUTH_TOKEN` | OTP SMS |
| `TWILIO_PHONE_NUMBER` | OTP SMS sender |
| `SENTRY_DSN` | Error tracking |
| `SENTRY_TRACES_SAMPLE_RATE` | Set to `0.1` in production |
| `SENTRY_PROFILES_SAMPLE_RATE` | Set to `0.1` in production |
| `R2_ACCOUNT_ID` | Media storage (optional — falls back to local files) |
| `R2_ACCESS_KEY_ID` | Media storage |
| `R2_SECRET_ACCESS_KEY` | Media storage |
| `R2_BUCKET_NAME` | Media storage |
| `R2_PUBLIC_MEDIA_URL` | Public CDN URL for media assets |
| `LOAD_TEST_SECRET` | Shared secret for load test endpoints |

---

## Health Checks

| Endpoint | Method | Auth | Returns |
|----------|--------|------|---------|
| `/api/auth/user-info/` | GET | JWT Bearer | 200 if backend is up and DB is reachable |
| `/api/load-test/verify-consistency/` | GET | `X-Load-Test-Secret` | `{"passed": bool, "errors": [...]}` |

For uptime monitoring, use `/api/auth/user-info/` with a valid JWT from a canary account — any non-500 response confirms the server and DB are healthy.

---

## API Endpoint Reference

<!-- AUTO-GENERATED from api/urls/*.py -->

Base prefix: `/api/`

### Authentication (`/api/auth/`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `auth/register/` | Register consumer with email + password |
| POST | `auth/login/` | Login, returns JWT access + refresh |
| POST | `auth/logout/` | Blacklist refresh token |
| POST | `auth/token/refresh/` | Refresh JWT access token |
| GET | `auth/user-info/` | Current authenticated user info |
| POST | `auth/verify-email/` | Verify email with token |
| POST | `auth/email-settings/send-verification/` | Request email verification link |
| POST | `auth/forgot-password/` | Send password reset email |
| POST | `auth/reset-password/` | Reset password with token |
| POST | `auth/register/check-phone/` | Check if phone is already registered |
| POST | `auth/register/send-otp/` | Send OTP for phone registration |
| POST | `auth/register/verify-otp/` | Verify OTP and complete phone registration |
| POST | `auth/forgot-password/phone/send-otp/` | Send OTP for phone-based password reset |
| POST | `auth/forgot-password/phone/reset/` | Reset password via OTP |
| POST | `auth/phone-otp/send/` | Send OTP to current user's phone |
| POST | `auth/phone-otp/verify/` | Verify OTP for current user |
| GET/POST | `auth/merchant/verify-email/` | Merchant email verification |
| POST | `auth/merchant/resend-verification/` | Resend merchant verification email |

### Coupons (`/api/`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `store-coupons/` | List coupons for nearby stores |
| GET | `exclusive-coupons/` | List exclusive (daily draw) coupons |
| GET | `coupons/<id>/` | Coupon detail |
| POST | `redeem/<id>/` | Redeem a coupon |
| GET | `unified-redemption/<code>/` | Validate unified redemption code |
| GET | `daily-draw-templates/` | Available daily draw templates |
| POST | `coupon/daily-draw/` | Draw a coupon |
| GET | `coupon/draw-history/` | User's draw history |
| GET | `last-draw/` | Timestamp of user's last draw |
| POST | `coupon/<id>/share/` | Create private share request |
| POST | `coupon/<id>/share-public/` | Create public share listing |
| GET | `coupon/share/<token>/` | Get share request details |
| POST | `coupon/share/<token>/accept/` | Accept a share request |
| GET | `my-public-shares/` | User's public share listings |
| POST | `coupon/share-public/<id>/withdraw/` | Withdraw a public share |
| POST | `qr-claim/claim/` | Claim coupon via merchant QR session |
| GET | `tags/` | All coupon tags |

### Platform Vouchers (`/api/`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `platform-vouchers/` | List user's platform vouchers |
| GET | `platform-vouchers/<pk>/` | Voucher detail |
| POST | `platform-voucher/<id>/redeem/` | Redeem a platform voucher |
| POST | `platform-voucher/<id>/share/` | Share voucher privately |
| POST | `platform-voucher/<id>/share-public/` | Share voucher publicly |
| GET | `platform-voucher/share/<token>/` | Get voucher share details |
| POST | `platform-voucher/share/<token>/accept/` | Accept voucher share |
| GET | `my-public-voucher-shares/` | User's public voucher shares |

### User (`/api/`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `user-statistics/` | Savings stats, goals, streaks |
| GET | `progress-trackers/` | Progress tracker list |
| POST | `set-savings-goal/` | Set savings goal |
| POST | `reset-savings-goal/` | Reset savings goal |
| GET | `completed-goals/` | Completed goals list |
| POST | `add-completed-goal/` | Mark a goal complete |
| POST | `feedback/` | Submit user feedback |
| GET/POST | `user/phone/` | Get or set user phone number |
| GET | `coupon-history/` | Coupon redemption history |
| GET | `coupon-history/<id>/` | Single history entry |
| POST | `account/pre-delete-check/` | Pre-deletion data summary |
| DELETE | `account/delete/` | Delete consumer account |

### Merchant (`/api/`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `merchant/coupon-templates/` | List merchant's coupon templates |
| GET | `merchant/coupon-templates/<id>/` | Template detail |
| POST | `merchant/coupon-templates/create/` | Create template |
| PUT | `merchant/coupon-templates/<id>/update/` | Update template |
| DELETE | `merchant/coupon-templates/<id>/delete/` | Delete template |
| GET | `merchant/coupon-templates/<id>/analytics/` | Template analytics |
| POST | `merchant/consolidate-coupon/` | Consolidate coupons |
| POST | `merchant/refresh_redeem_code/` | Refresh store redeem code |
| POST | `merchant/redeem/` | Redeem coupon at merchant POS |
| POST | `merchant/unified-redemption/generate/` | Generate unified redemption code |
| GET | `merchant/profile/` | Merchant profile |
| POST | `merchant/profile/update/` | Update merchant profile |
| GET | `merchant/statistics/` | Merchant statistics |
| POST | `merchant/account/pre-delete-check/` | Pre-deletion check |
| DELETE | `merchant/account/delete/` | Delete merchant account |
| GET | `merchant/account/deletion-status/` | Deletion request status |
| POST | `merchant/upload-image/` | Upload coupon image to R2/local |
| POST | `merchant/qr-session/generate/` | Generate QR claim session |
| POST | `merchant/qr-session/<id>/invalidate/` | Invalidate QR session |
| POST | `merchant/redeem-voucher/` | Redeem a platform voucher at merchant |
| GET | `merchant/eula/status/` | Check EULA acceptance status |
| POST | `merchant/eula/accept/` | Accept EULA |
| GET | `merchant/eula/content/` | Get EULA content |

### Content Moderation (`/api/`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `content/<type>/<id>/report/` | Report UGC content |
| GET | `content/<type>/<id>/report/status/` | Report status |
| GET | `user/reports/` | User's report history |
| GET | `user/blocked-merchants/` | User's blocked merchant list |
| POST | `user/blocked-merchants/add/` | Block a merchant |
| DELETE | `user/blocked-merchants/<id>/` | Unblock a merchant |
| GET | `store/<id>/block-status/` | Check if a store is blocked |
| GET | `content-guidelines/` | Public content guidelines |
| GET | `privacy-policy/` | Privacy policy |
| GET | `terms/` | Terms of service |
| GET | `admin/moderation/queue/` | Admin — moderation queue |
| GET | `admin/moderation/reports/<id>/` | Admin — report detail |
| POST | `admin/moderation/reports/<id>/action/` | Admin — take moderation action |
| GET | `admin/moderation/escalations/` | Admin — escalated reports |
| GET | `admin/moderation/merchants/<id>/violations/` | Admin — merchant violations |
| GET | `admin/moderation/stats/` | Admin — moderation stats |

### Web V1 (`/api/`)

Unauthenticated or session-token authenticated endpoints for the web consumer flow.

| Method | Path | Description |
|--------|------|-------------|
| GET | `web/v1/merchants/<store_id>/coupons/` | Public coupon list for a store |
| GET | `web/v1/coupons/<template_id>/` | Public coupon template detail |
| GET | `web/v1/sessions/<token>/resolve/` | Resolve QR session token |
| GET | `web/v1/fixed-sessions/<token>/resolve/` | Resolve fixed session token |
| GET | `web/v1/shares/<token>/` | Share link detail |
| POST | `web/v1/redemptions/` | Create web redemption |
| GET | `web/v1/points/lookup/` | Look up CouPoints balance |

### Load Test

| Method | Path | Auth Header | Description |
|--------|------|-------------|-------------|
| GET | `load-test/verify-consistency/` | `X-Load-Test-Secret` | Consistency check |
| POST | `load-test/reset/` | `X-Load-Test-Secret` | Clear redemptions |

---

## Common Issues

### Database not migrating on deploy

```bash
# Check for unapplied migrations
python manage.py showmigrations

# Force run
python manage.py migrate --run-syncdb
```

If a merge migration is missing (two 0026 files exist — see migrations/), run:

```bash
python manage.py makemigrations --merge
```

### OTP SMS not sending in dev

Set `SMS_DEV_MODE=true` in `.env`. OTP is printed to the Django console log instead of being sent via Twilio.

### Media images returning 404 after deploy

If `R2_*` env vars are not set, the backend falls back to `FileSystemStorage` (local `images/` directory). Set all five R2 variables to enable Cloudflare R2 CDN delivery.

### JWT token expired

The mobile client should call `POST /api/auth/token/refresh/` with the stored refresh token before retrying. If the refresh token is also expired, redirect to login.

### Load test data missing after redeploy

`build.sh` runs `seed_load_test` which is idempotent. If data is still missing:

```bash
python manage.py seed_load_test
```

### Sentry not receiving events

Verify `SENTRY_DSN` is set and `DEBUG=False`. In development, events are captured locally but not sent unless DSN is configured.

---

## Rollback Procedures

### Backend

Render supports one-click rollback to a previous deploy from the dashboard. For database rollback:

```bash
# Identify the migration to roll back to
python manage.py showmigrations

# Roll back to a specific migration
python manage.py migrate api 0051   # example: roll back migration 0052
```

**Warning:** Rolling back migrations that drop columns requires restoring from a DB snapshot first.

### Mobile Frontend

Expo EAS: use `eas update --channel production --message "rollback"` pointing at the previous update branch, or revert the relevant commit and redeploy.

---

## Alerting

- **Sentry**: configured via `SENTRY_DSN` — errors appear in the Sentry dashboard under the `coupro-backend` project.
- **Render**: deploy failure notifications sent via the Render notification settings.
- **Load test**: after any load test run, call `GET /api/load-test/verify-consistency/` and assert `passed: true`.
