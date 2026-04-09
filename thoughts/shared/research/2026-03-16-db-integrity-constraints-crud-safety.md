---
date: 2026-03-16T16:45:38.298140+08:00
researcher: Kayne
git_commit: 1130a64ea50f4ce6cb366d12b507374498bd3c22
branch: dev
repository: Coupon_Mobile
topic: "Examine DB integrity constraints and CRUD write paths"
tags: [research, codebase, backend, django, models, constraints, crud]
status: complete
last_updated: 2026-03-16
last_updated_by: Kayne
---

# Research: Examine DB integrity constraints and CRUD write paths

**Date**: 2026-03-16T16:45:38.298140+08:00  
**Researcher**: Kayne  
**Git Commit**: 1130a64ea50f4ce6cb366d12b507374498bd3c22  
**Branch**: dev  
**Repository**: Coupon_Mobile

## Research Question
檢查資料庫（Django ORM models）目前的完整性約束（unique/index/foreign key on_delete/條件式 constraint 等），並盤點後端 CRUD 寫入路徑，確認現有 CRUD 是如何依賴/觸發這些約束（僅描述現況，不做改進建議）。

## Summary
- DB 完整性約束主要集中在 `Backend/api/models.py`：包含多個 `unique=True` 欄位、`unique_together`、條件式 `UniqueConstraint(condition=...)`、`OneToOneField`、以及多個 `Index`（含具名 indexes）。  
- 後端「會寫 DB」的入口主要在 `Backend/api/views/*.py`（商家模板 CRUD、使用者兌換、QR 領券、平台券兌換/分享、用戶目標/徽章、註冊/驗證/密碼重設等），多數寫入用 `objects.create()` / `save()` / `delete()`；部分流程用 `transaction.atomic()`、`select_for_update()`、`F()` update 來配合約束與併發下的完整性。

## Detailed Findings

### DB schema 與完整性約束（models）

- **User ↔ Profile（一對一）**
  - `PasswordResetProfile.user`：`OneToOneField(User, on_delete=CASCADE)`（重設密碼資料會跟著 user 刪除）。  
  - `StudentProfile.user`：`OneToOneField(User, on_delete=CASCADE)`；`phone_number` 設 `unique=True` 且可為 `null/blank`；`email_verification_token` 設 `unique=True` 且可為 `null/blank`。  
  - `MerchantProfile.user`：`OneToOneField(User, on_delete=CASCADE)`；`email_verification_token` 設 `unique=True` 且可為 `null/blank`；`application_status` 有 `db_index=True`。

- **Store / Tag / CouponTemplate / Coupon**
  - `Store.owner`：`ForeignKey(User, on_delete=SET_NULL, null=True, blank=True)`（商家刪除後 store 可保留但 owner 變 `NULL`）。  
  - `Store.unified_redeem_code`：`unique=True, null=True, blank=True`（6 位數）。  
  - `Tag.name`：`unique=True`。  
  - `CouponTemplate.store`：`ForeignKey(Store, on_delete=CASCADE)`；`tags` `ManyToManyField(Tag)`；數量欄位 `total_quantity/remaining_quantity`（`PositiveIntegerField`）。  
  - `Coupon.template`：`ForeignKey(CouponTemplate, on_delete=SET_NULL, null=True, blank=True)`；多個 holder 欄位（`original_owner/last_holder/current_holder`）都是 `SET_NULL + null/blank`；`pending_phone_number` 有 `db_index=True`。  
  - `Coupon.save()`：當 `coupon_type='store'` 時會清空 `original_owner/last_holder/current_holder`，並清空 `redeem_code`（在 model save 層做欄位狀態約束）。

- **QR session / claim**
  - `QRCodeSession.session_token`：`unique=True`；`Meta.indexes` 包含 `session_token`、以及 `(template,is_active)`、`(merchant,is_active)` 的具名 index。  
  - `QRCodeClaim.idempotency_key`：`unique=True` 且 `db_index=True`；`Meta.indexes` 另有具名 index（含 `(user,template)`）。

- **Redemption / share request（條件式唯一性）**
  - `CouponRedemption`：透過 `coupon_type`（denormalized 欄位）+ `Meta.constraints` 定義條件式唯一性  
    - `UniqueConstraint(fields=['coupon','user'], condition=Q(coupon_type='exclusive'), name='unique_exclusive_coupon_redemption')`  
    - `CouponRedemption.save()` 會在 `coupon_type` 空值時，把 `coupon.coupon_type` 寫入 `coupon_type`。  
  - `CouponShareRequest`：`token unique=True`；另有條件式 constraint：同一張 coupon 在 `is_public=True` 且 `status='pending'` 時只能存在一筆 pending public share（`unique_pending_public_share_per_coupon`）。

- **Platform voucher（兌換與分享）**
  - `PlatformVoucher.redeem_code`：`unique=True`。  
  - `PlatformVoucherRedemption.voucher`：`OneToOneField(PlatformVoucher, on_delete=CASCADE)`；另在 `Meta.constraints` 也宣告 `UniqueConstraint(fields=['voucher'], name='unique_platform_voucher_redemption')`（效果等同「每張券最多被兌換一次」）。  
  - `PlatformVoucherShareRequest.token`：`unique=True`；另有條件式 constraint：同一張 voucher 在 `is_public=True` 且 `status='pending'` 時只能存在一筆 pending public share（`unique_pending_public_share_per_platform_voucher`）。

- **UGC / 其他**
  - `BlockedMerchant`：`unique_together = ['user','store']`。  
  - `EULAAcceptance`：`unique_together = ['merchant','version']`。  
  - `ContentReport`：`object_id`、`status`、`created_at` 等有多個具名 index。  
  - `PhoneOTPRecord`：`phone_number`、`created_at` 有 `db_index` 與具名複合 index（`(phone_number,created_at)`、`(user,created_at)`）；OTP rate limit/attempt 行為由 model classmethod/instance method 操作 DB 記錄達成。

### CRUD 寫入路徑（views / serializers）與約束的對齊

#### 商家端：模板 CRUD 與同步 store-type coupon
- `create_coupon_template`：建立 `CouponTemplate`；若 `total_quantity == 0` 會建立對應 `Coupon(coupon_type='store')` 並 `coupon.tags.set(...)`。  
  - 依賴點：`Coupon.save()` 會在 `coupon_type='store'` 時清空 holders/redeem_code。  
- `update_coupon_template`：更新模板欄位後 `template.save()`；依 `template.total_quantity` 決定「建立/更新/刪除」對應的 store-type `Coupon`。  
- `delete_coupon_template`：刪除 store-type `Coupon`（若存在）與 `template.delete()`。

#### 商家端：電話歸戶發券 / 核銷
- `merchant_consolidate_coupon`
  - 若手機已註冊（`StudentProfile.phone_number` 查得到）：呼叫 `CouponTemplate.generate_coupon(recipient)`（其內部用 `transaction.atomic()` + `select_for_update()` 鎖住 template row，並扣 `remaining_quantity`、建立 `Coupon`）。  
  - 若手機未註冊：建立 `Coupon(... pending_phone_number=...)` 並手動扣 `coupon_template.remaining_quantity` 後 `save()`。  
  - 依賴點：`StudentProfile.phone_number unique=True` 讓「以 phone 找 user」具有唯一性；`pending_phone_number` 有 index 供後續 claim 使用。  
- `merchant_redeem`
  - `CouponRedemption.objects.create(coupon=coupon, user=user, ...)`；`CouponRedemption.save()` 會把 `coupon_type` 從 `coupon.coupon_type` 複製，配合條件式 UniqueConstraint `unique_exclusive_coupon_redemption`。

#### 使用者端：兌換（CouponRedemption）
- `redeem_coupon`
  - 會建立 `CouponRedemption(coupon=..., user=..., coupon_type=coupon.coupon_type)` 並 `save()`。  
  - 依賴點：`unique_exclusive_coupon_redemption` 讓「exclusive coupon 同一 user 只能兌換一次」由 DB 約束；store coupon 不受此條件式約束影響（因為條件是 `coupon_type='exclusive'`）。  

#### QR 領券：Session、Claim 與 Idempotency
- `generate_qr_session`：`QRCodeSession.objects.create(... session_token=uuid4 ...)`（`session_token unique=True`）。  
- `invalidate_qr_session`：更新 `QRCodeSession.is_active/invalidated_at` 並 `save()`。  
- `claim_coupon_via_qr`
  - 若提供 `idempotency_key`：先查 `QRCodeClaim.idempotency_key`；transaction 內再 double-check；最後 `QRCodeClaim.objects.create(idempotency_key=...)`（`idempotency_key unique=True`）。  
  - transaction 內用 `CouponTemplate.objects.filter(... remaining_quantity__gt=0).update(remaining_quantity=F('remaining_quantity')-1)` 扣庫存，然後建立 `Coupon`。

#### PlatformVoucher：兌換 / 分享（含 public pool）
- `redeem_platform_voucher`：`PlatformVoucherRedemption.objects.create(voucher=...)`；`voucher` 的 OneToOne + `unique_platform_voucher_redemption` 保證每張 voucher 只能兌換一次。  
- `share_platform_voucher`：建立 `PlatformVoucherShareRequest(token=...)`，`token unique=True`。  
- `share_platform_voucher_public`：`transaction.atomic()` 內建立 `PlatformVoucherShareRequest(is_public=True, status='pending')`（受條件式 constraint 限制同一 voucher 只能有一筆 pending public share），並把 `voucher.current_holder = None` 後 `save(update_fields=...)`。  
- `accept_platform_voucher_share`：`transaction.atomic()` + `select_for_update()` 鎖 share request row，更新 voucher holder 與 share request 狀態。

#### 使用者檔案：pending coupon 指派 / 儲蓄目標
- `assign_pending_coupons(user, phone_number)`：查 `Coupon.pending_phone_number=... AND current_holder is null`，逐張更新 `current_holder/original_owner/pending_phone_number` 後 `save()`。  
- `set_savings_goal` / `add_completed_goal` / `reset_savings_goal`：更新 `StudentProfile` 或建立 `CompletedGoal`。

#### 註冊 / 驗證 / 密碼重設（User + profile）
- `register`
  - 建 `User(username=email, email=email)`；依 `user_type` 建 `MerchantProfile` + `Store` 或 `StudentProfile(email_verification_token=token)`。  
  - 依賴點：`StudentProfile.email_verification_token unique=True`、`MerchantProfile.email_verification_token unique=True`（token 由 `secrets.token_urlsafe(32)` 生成）。  
- `request_email_verification`
  - 更新 `User.email`、更新 `StudentProfile.email_verification_token` 並 `save(update_fields=...)`。  
  - 依賴點：`User.email`/`StudentProfile.email_verification_token` 的唯一性檢查與約束。
- `verify_email`
  - 以 `StudentProfile.email_verification_token` 找 profile，將 `verified=True` 並清空 token 後 `save()`。
- `forgot_password` / `reset_password`
  - `PasswordResetProfile.objects.get_or_create(user=user)`，寫入/清除 token，並更新 `User.set_password(...); user.save()`。

## Code References
- `Backend/api/models.py:39-1048` — 主要 models、unique/unique_together/UniqueConstraint/index、以及 `Coupon.save()`/`CouponRedemption.save()`。  
- `Backend/api/serializers.py:1-710` — CRUD/登入/OTP/QR/平台券等 request body 驗證（DRF serializer）。  
- `Backend/api/views/merchant_coupon.py:51-603` — `merchant_consolidate_coupon`、模板 CRUD、統一兌換碼生成、以及部分寫入點。  
- `Backend/api/views/coupon_views.py:24-650` — coupon 列表/詳細與 `redeem_coupon`（建立 `CouponRedemption`）。  
- `Backend/api/views/qr_claim.py:49-330` — `QRCodeSession` 建立/作廢、`claim_coupon_via_qr`（idempotency + atomic 扣庫存 + 建券）。  
- `Backend/api/views/platform_voucher_views.py:27-320` — 平台券列表/兌換/分享/公開池/接受分享（含 atomic + select_for_update）。  
- `Backend/api/views/user_profile.py:20-424` — 儲蓄目標/徽章，以及 `assign_pending_coupons`（pending_phone_number → holder）。  
- `Backend/api/views/authentication.py:831-1590` — `register`、`request_email_verification`、`verify_email`、密碼重設流程（User/Profile 寫入）。  

## Architecture Documentation (as-is)
- **條件式唯一性**：`CouponRedemption` 以 `coupon_type` denormalized 欄位配合條件式 UniqueConstraint（exclusive only）。  
- **公開池（public pool）唯一性**：`CouponShareRequest` / `PlatformVoucherShareRequest` 以條件式 UniqueConstraint 保證「每張券同一時間最多一筆 pending public share」。  
- **併發與庫存扣減**：`CouponTemplate.generate_coupon()` 使用 `transaction.atomic()` + `select_for_update()`；QR claim 使用 `transaction.atomic()` + `F()` update 扣庫存並搭配 idempotency 記錄。  

## Historical Context (from thoughts/)
- `thoughts/shared/research/2026-03-12-store-coupon-redeemed-still-on-easy-use.md` — 討論 store coupon 與 `CouponRedemption` 條件式 unique 的互動語意。  
- `thoughts/shared/research/2026-03-14-progress-tracker-feature-research.md` — 梳理 `CouponRedemption`/`PlatformVoucherRedemption`/分享 request 的 schema 與 transaction 模式。  
- `thoughts/shared/research/2026-03-15-crash-prone-code-patterns.md` — 包含部分交易/一致性相關的現況描述。  
- `thoughts/shared/research/2026-03-16-get-store-exclusive-coupons-and-pages.md` — 列表 API 的 query/prefetch 與前端頁面連動脈絡。  

## Related Research
- `thoughts/shared/research/2026-03-14-progress-tracker-feature-research.md`
- `thoughts/shared/research/2026-03-16-get-store-exclusive-coupons-and-pages.md`
- `thoughts/shared/research/2026-03-12-store-coupon-redeemed-still-on-easy-use.md`

## Open Questions
- 本次盤點聚焦在 `Backend/api/models.py` 與主要 views；若專案另有其他 app 或額外 models/migrations 定義 schema（例如 `Backend/<other_app>/models.py`），需要再擴展掃描範圍才能做全庫完整性清單。

