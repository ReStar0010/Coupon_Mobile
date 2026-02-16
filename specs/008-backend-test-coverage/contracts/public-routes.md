# Public Routes (Coverage Contract)

**Source**: `Backend/Backend/urls.py`  
**Excluded**: `admin/`, `swagger`, `redoc`, schema JSON/YAML  
**Requirement**: Each route below MUST have at least one test that exercises it and asserts on expected success and/or 4xx/5xx (status and optionally body/headers). Protected routes must also be tested with unauthorized/wrong-role where relevant.

| # | Path / Pattern | Primary method(s) | Auth / notes |
|---|----------------|-------------------|---------------|
| 1 | `api/store-coupons/` | GET | Public |
| 2 | `api/exclusive-coupons/` | GET | Public |
| 3 | `api/coupons/<id>/` | GET | Public |
| 4 | `api/redeem/<id>/` | POST | User |
| 5 | `api/unified-redemption/<code>/` | GET | Public |
| 6 | `api/events/template-view/` | POST | Optional |
| 7 | `api/daily-draw-templates/` | GET | Public |
| 8 | `api/coupon/daily-draw/` | POST | User |
| 9 | `api/coupon/draw-history/` | GET | User |
| 10 | `api/last-draw/` | GET | User |
| 11 | `collection/<token>/` | GET | Public |
| 12 | `c/<token>/` | GET | Public (short) |
| 13 | `claim/<token>/` | GET | Public |
| 14 | `cl/<token>/` | GET | Public (short) |
| 15 | `.well-known/apple-app-site-association` | GET | Public |
| 16 | `.well-known/assetlinks.json` | GET | Public |
| 17 | `api/coupon/<id>/share/` | POST | User |
| 18 | `api/coupon/<id>/share-public/` | POST | User |
| 19 | `api/coupon/share/<token>/` | GET | Public |
| 20 | `api/coupon/share/<token>/accept/` | POST | User |
| 21 | `api/my-public-shares/` | GET | User |
| 22 | `api/register/` | POST | Public |
| 23 | `api/login/` | POST | Public |
| 24 | `api/logout/` | POST | User |
| 25 | `api/token/refresh/` | POST | Public (body token) |
| 26 | `api/verify-email/` | POST | Public |
| 27 | `api/merchant/verify-email/` | GET/POST | Public |
| 28 | `api/merchant/resend-verification/` | POST | Merchant |
| 29 | `api/merchant/redirect/verify-email` | GET | Public |
| 30 | `api/merchant/redirect/reset-password` | GET | Public |
| 31 | `api/forgot-password/` | POST | Public |
| 32 | `api/reset-password/` | POST | Public |
| 33 | `api/user-statistics/` | GET | User |
| 34 | `api/set-savings-goal/` | POST | User |
| 35 | `api/completed-goals/` | GET | User |
| 36 | `api/add-completed-goal/` | POST | User |
| 37 | `api/reset-savings-goal/` | POST | User |
| 38 | `api/user-info/` | GET | User |
| 39 | `api/phone-otp/send/` | POST | Public |
| 40 | `api/phone-otp/verify/` | POST | Public |
| 41 | `api/user/phone/` | GET, PUT, DELETE | User |
| 42 | `api/coupon-history/` | GET | User |
| 43 | `api/coupon-history/<id>/` | GET | User |
| 44 | `api/merchant/coupon-templates/` | GET | Merchant |
| 45 | `api/merchant/coupon-templates/<id>/` | GET | Merchant |
| 46 | `api/merchant/coupon-templates/create/` | POST | Merchant |
| 47 | `api/merchant/coupon-templates/<id>/update/` | PUT/PATCH | Merchant |
| 48 | `api/merchant/coupon-templates/<id>/delete/` | DELETE | Merchant |
| 49 | `api/merchant/coupon-templates/<id>/analytics/` | GET | Merchant |
| 50 | `api/merchant/consolidate-coupon/` | POST | Merchant |
| 51 | `api/merchant/refresh_redeem_code/` | POST | Merchant |
| 52 | `api/merchant/redeem/` | POST | Merchant |
| 53 | `api/merchant/unified-redemption/generate/` | POST | Merchant |
| 54 | `api/merchant/profile/` | GET | Merchant |
| 55 | `api/merchant/profile/update/` | PUT/PATCH | Merchant |
| 56 | `api/merchant/statistics/` | GET | Merchant |
| 57 | `api/merchant/account/pre-delete-check/` | GET | Merchant |
| 58 | `api/merchant/account/delete/` | POST | Merchant |
| 59 | `api/merchant/account/deletion-status/` | GET | Merchant |
| 60 | `api/merchant/upload-image/` | POST | Merchant |
| 61 | `api/tags/` | GET | Public/Merchant |
| 62 | `api/merchant/qr-session/generate/` | POST | Merchant |
| 63 | `api/merchant/qr-session/<session_id>/invalidate/` | POST | Merchant |
| 64 | `api/qr-claim/claim/` | POST | Public (body) |
| 65 | `api/ping/` | GET | Public |
| 66 | `api/content/<content_type>/<content_id>/report/` | POST | User |
| 67 | `api/content/<content_type>/<content_id>/report/status/` | GET | User |
| 68 | `api/user/reports/` | GET | User |
| 69 | `api/user/blocked-merchants/` | GET | User |
| 70 | `api/user/blocked-merchants/add/` | POST | User |
| 71 | `api/user/blocked-merchants/<store_id>/` | DELETE | User |
| 72 | `api/store/<store_id>/block-status/` | GET | User |
| 73 | `api/merchant/eula/status/` | GET | Merchant |
| 74 | `api/merchant/eula/accept/` | POST | Merchant |
| 75 | `api/merchant/eula/content/` | GET | Merchant |
| 76 | `api/content-guidelines/` | GET | Public |
| 77 | `api/privacy-policy/` | GET | Public |
| 78 | `api/admin/moderation/queue/` | GET | Admin |
| 79 | `api/admin/moderation/reports/<report_id>/` | GET | Admin |
| 80 | `api/admin/moderation/reports/<report_id>/action/` | POST | Admin |
| 81 | `api/admin/moderation/escalations/` | GET | Admin |
| 82 | `api/admin/moderation/merchants/<merchant_id>/violations/` | GET | Admin |
| 83 | `api/admin/moderation/stats/` | GET | Admin |

**Count**: 83 public routes (excluding admin UI, swagger, redoc). When adding a new route to `urls.py`, add a row here and add or update at least one test that covers it.
