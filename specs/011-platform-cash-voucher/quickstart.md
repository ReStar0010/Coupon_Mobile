# Quickstart: Platform Cash Voucher (011)

**Feature**: 011-platform-cash-voucher  
**Branch**: `011-platform-cash-voucher`

## Prerequisites

- Backend: Python 3.10+, venv activated (`source .venv/bin/activate` or `.venv\Scripts\activate`)
- DB: SQLite (dev) or PostgreSQL (prod); migrations applied for existing app

## Implementation order

1. **Store participation**  
   Add `accepts_platform_vouchers` (Boolean, default False) to `Store` in `Backend/api/models.py`. Create and run migration.

2. **Platform voucher models**  
   Add `PlatformVoucher`, `PlatformVoucherRedemption`, `PlatformVoucherShareRequest` to `Backend/api/models.py` (see [data-model.md](./data-model.md)). Add UniqueConstraint on `PlatformVoucherRedemption.voucher` and optional unique pending public share per voucher on `PlatformVoucherShareRequest`. Run migrations.

3. **Voucher code generation**  
   Implement or reuse a 6-character unique code generator for `PlatformVoucher.redeem_code` (distinct from store `unified_redeem_code`). Ensure uniqueness in DB.

4. **Admin**  
   Register `PlatformVoucher`, `PlatformVoucherRedemption`, `PlatformVoucherShareRequest` in `Backend/api/admin.py`. Optionally add custom “batch issue” action or form (batch_name, face_value, quantity, expiry_date) that creates multiple vouchers with unique redeem_codes.

5. **Serializers**  
   Add DRF serializers in `Backend/api/serializers.py` for list/detail, redeem request, and share responses. Extend unified redemption validate serializer to include `available_platform_vouchers`.

6. **Views**  
   Implement in `Backend/api/views/platform_voucher_views.py`: list, detail, redeem (consumer), share, get_share, accept_share, share_public, my_public_shares. In `coupon_views.py`, extend `validate_unified_redemption_code` to query redeemable platform vouchers for the current user and the resolved store (when store participates) and add `available_platform_vouchers` to the response. Optional: merchant redeem view using `get_merchant_store(request.user)`.

7. **URLs**  
   In `Backend/Backend/urls.py`, register:
   - `api/platform-vouchers/` (list)
   - `api/platform-vouchers/<id>/` (detail)
   - `api/platform-voucher/<id>/redeem/` (POST)
   - `api/platform-voucher/<id>/share/` (POST)
   - `api/platform-voucher/<id>/share-public/` (POST)
   - `api/platform-voucher/share/<token>/` (GET)
   - `api/platform-voucher/share/<token>/accept/` (POST)
   - `api/my-public-voucher-shares/` (GET)
   - Optional: `api/merchant/redeem-voucher/` (POST)

8. **Tests**  
   Add tests under `Backend/api/tests/` or `Backend/tests/`: redemption (holder, expiry, already redeemed, store participation, invalid code), share/accept (race-safe, public pool, self-claim blocked), validate response includes `available_platform_vouchers` when store participates.

## Commands

```bash
cd Backend
source .venv/bin/activate   # or .venv\Scripts\activate on Windows

# Migrations
python manage.py makemigrations api
python manage.py migrate

# Run tests (full suite per constitution)
python manage.py test api tests
```

## Contract reference

- [contracts/api.md](./contracts/api.md) — request/response shapes and error behaviour for all new and extended endpoints.

## Data model reference

- [data-model.md](./data-model.md) — entity attributes, constraints, and state transitions.
