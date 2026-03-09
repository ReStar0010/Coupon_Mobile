# API Contracts: Platform Cash Voucher (011)

**Feature**: 011-platform-cash-voucher  
**Base path**: `/api/` (Backend)

All endpoints use JSON; auth where noted is session/token (IsAuthenticated). Errors return appropriate HTTP status and a body such as `{"error": "message"}`.

---

## 1. List my platform vouchers

**GET** `/api/platform-vouchers/`  
**Auth**: Required (consumer)

**Response 200**: Array of objects — vouchers where `current_holder == request.user`, not expired, and with no PlatformVoucherRedemption.

```json
[
  {
    "id": 1,
    "face_value": "100.00",
    "currency_code": "TWD",
    "redeem_code": "ABC123",
    "expiry_date": "2026-12-31T23:59:59Z",
    "batch_name": "Campaign 2026"
  }
]
```

**Errors**: 401 Unauthorized.

---

## 2. Platform voucher detail

**GET** `/api/platform-vouchers/<id>/`  
**Auth**: Required (must be current_holder)

**Response 200**: Single object.

```json
{
  "id": 1,
  "face_value": "100.00",
  "currency_code": "TWD",
  "start_date": "2026-01-01T00:00:00Z",
  "expiry_date": "2026-12-31T23:59:59Z",
  "batch_name": "Campaign 2026",
  "redeem_code": "ABC123",
  "is_redeemed": false,
  "current_holder_id": 42
}
```

**Errors**: 403 if not holder, 404 if not found.

---

## 3. Redeem platform voucher (consumer)

**POST** `/api/platform-voucher/<voucher_id>/redeem/`  
**Auth**: Required (must be current_holder)

**Body**:
```json
{
  "redeem_code": "123456"
}
```
`redeem_code` is the **store’s** 6-digit unified redemption code (not the voucher’s redeem_code). Server resolves store by this code and checks `store.accepts_platform_vouchers`.

**Response 200**: Success; one PlatformVoucherRedemption created (voucher, user, store, amount_used=face_value, redeemed_at).

**Errors**:  
- 400 Invalid body or redeem_code not matching a participating store.  
- 403 Not current holder.  
- 404 Voucher not found or already redeemed / expired.

---

## 4. Share (private)

**POST** `/api/platform-voucher/<voucher_id>/share/`  
**Auth**: Required (must be current_holder)

**Body**: Optional (e.g. empty object or future options).

**Response 200**:
```json
{
  "token": "<unique-token>",
  "share_link": "coupro://platform-voucher?token=<token>",
  "share_link_web": "https://api.example.com/api/platform-voucher/share/<token>/"
}
```

**Errors**: 403 Not holder; 400 Already redeemed or expired.

---

## 5. Get share info by token

**GET** `/api/platform-voucher/share/<token>/`  
**Auth**: Optional (AllowAny for link open)

**Response 200**:
```json
{
  "voucher_id": 1,
  "face_value": "100.00",
  "currency_code": "TWD",
  "from_user_email": "sender@example.com",
  "status": "pending",
  "is_public": false
}
```

**Errors**: 404 Invalid token.

---

## 6. Accept share

**POST** `/api/platform-voucher/share/<token>/accept/`  
**Auth**: Required (acceptor)

**Body**: Empty or optional.

**Response 200**: Success; voucher transferred to request.user; share request status=accepted. Race-safe (transaction + select_for_update on share request).

**Errors**: 400 Already accepted/declined or voucher already redeemed; 404 Invalid token. For public: 400 if from_user == request.user (no self-claim).

---

## 7. Share to public pool

**POST** `/api/platform-voucher/<voucher_id>/share-public/`  
**Auth**: Required (must be current_holder)

**Response 200**: Share request created with is_public=True; voucher.current_holder set to null.

**Errors**: 403 Not holder; 400 Already redeemed/expired or already in public pool.

---

## 8. My public voucher shares

**GET** `/api/my-public-voucher-shares/`  
**Auth**: Required

**Response 200**: Array of share requests where from_user=request.user and is_public=True.

```json
[
  {
    "share_id": 1,
    "voucher_id": 1,
    "face_value": "100.00",
    "status": "pending",
    "created_at": "2026-03-09T12:00:00Z",
    "claimed_by": null,
    "claimed_at": null
  }
]
```

---

## 9. Validate unified redemption code (extended)

**GET** `/api/unified-redemption/<code>/`  
**Auth**: Required (existing behaviour)

**Response 200**: Existing shape plus new key `available_platform_vouchers` when the code maps to a store. Only include vouchers that are redeemable at that store (store must have accepts_platform_vouchers=True).

```json
{
  "store": { "id": 1, "name": "...", "address": "..." },
  "available_coupons": [ ... ],
  "available_platform_vouchers": [
    {
      "id": 1,
      "face_value": "100.00",
      "redeem_code": "VOUCH1",
      "expiry_date": "2026-12-31T23:59:59Z",
      "batch_name": "Campaign 2026"
    }
  ]
}
```

If the store does not participate (`accepts_platform_vouchers=False`), `available_platform_vouchers` may be omitted or empty. Backward compatibility: clients that do not use this key are unchanged.

---

## 10. Merchant redeem (optional)

**POST** `/api/merchant/redeem-voucher/`  
**Auth**: Required (merchant; store from get_merchant_store)

**Body**:
```json
{
  "voucher_id": 1,
  "consumer_phone": "0912345678"
}
```

**Response 200**: PlatformVoucherRedemption created for voucher at merchant’s store; consumer identified by phone (StudentProfile.phone_number) and must be voucher.current_holder.

**Errors**: 400 Invalid phone or not current holder; 404 No store for merchant or voucher not found.
