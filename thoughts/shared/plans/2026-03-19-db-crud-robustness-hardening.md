# DB CRUD Robustness Hardening Implementation Plan

## Overview

針對後端 Coupon/QR/Phone OTP 相關 CRUD 路徑，補強高併發與競態情境下的一致性與錯誤處理，降低「庫存與發券狀態不同步」與「重複核銷時回 500」風險，同時維持現有 API 契約不破壞。

## Current State Analysis

目前關鍵路徑中，既有一部分已採用較強的 transaction/locking 策略（例如 QR claim 與 `CouponTemplate.generate_coupon`），但也有局部流程仍採用「先查後寫、手動扣量」的模式。

- `merchant_consolidate_coupon` 已註冊分支使用 `generate_coupon()`（具 `transaction.atomic + select_for_update`），但未註冊分支仍是直接建券 + 手動扣 `remaining_quantity`（`Backend/api/views/merchant_coupon.py`）。
- `redeem_coupon` 建立 `CouponRedemption` 時主要攔 `ValueError`，但 DB 唯一約束競態最常見實際會是 `IntegrityError`（`Backend/api/views/coupon_views.py` + `Backend/api/models.py`）。
- `claim_coupon_via_qr` 已有 `atomic + F()` 扣量與 idempotency double-check，屬較完整的併發處理範本（`Backend/api/views/qr_claim.py`）。
- 電話驗證後 pending coupon 指派在 `phone_otp.py` 已有交易包覆；`user_profile.assign_pending_coupons` 則是逐筆 `save()`（`Backend/api/views/user_profile.py`）。

## Desired End State

完成後系統在以下情境具一致行為：

1. 商家電話歸戶（未註冊收件人）在高併發下不會超發或少扣庫存。
2. `redeem_coupon` 在重複兌換競態下會穩定回傳業務錯誤（`CouponAlreadyRedeemed`），不回 500。
3. pending coupon 指派邏輯在不同入口（phone verify / registration / helper）具一致資料寫入語意。
4. 既有 API response contract 不變（除錯誤更穩定外），既有測試通過並新增針對競態的回歸測試。

### Key Discoveries:
- `merchant_consolidate_coupon` 未註冊分支目前為非原子「建券 + 扣量」（`Backend/api/views/merchant_coupon.py`）。
- `CouponTemplate.generate_coupon` 已提供可重用的 race-safe 發券模式（`Backend/api/models.py`）。
- `redeem_coupon` 實際依賴 `unique_exclusive_coupon_redemption`（`Backend/api/models.py`）保護 exclusive 重複核銷（`Backend/api/views/coupon_views.py`）。
- 現有測試以 `django.test.TestCase + APIClient` 為主，且 QR contract tests 已有 race condition 測項（`Backend/tests/contract/test_qr_claim.py`）。

## What We're NOT Doing

- 不變更資料表 schema（本計畫不新增 migration）。
- 不改前端 API payload 契約（例如不強制新增必填欄位導致舊版 app 失效）。
- 不重構整個 coupon 發券架構（只針對高風險寫入點加固）。
- 不調整商業規則本身（例如 store/exclusive 的產品語意不更動）。

## Implementation Approach

以「最小破壞、優先修競態高風險點」為策略，分三階段：

1. 先補 `merchant_consolidate_coupon` 未註冊分支的原子化扣量與建券。
2. 再補 `redeem_coupon` 對 DB 唯一約束競態的例外映射。
3. 最後統一 pending coupon 指派入口語意，補齊回歸測試。

---

## Phase 1: Hardening Merchant Consolidate Pending Flow

### Overview

讓 `merchant_consolidate_coupon` 的未註冊分支，與已註冊分支一樣具備可預期的併發安全，避免多請求同時發送時出現扣量不一致。

### Changes Required:

#### 1. Merchant consolidate 寫入原子化
**File**: `Backend/api/views/merchant_coupon.py`  
**Changes**:
- 在未註冊分支導入 `transaction.atomic()`。
- 將模板扣量改為 `F('remaining_quantity') - 1` 或 row lock 後再減，避免 lost update。
- 僅在扣量成功後建立 pending coupon；扣量失敗回 `CouponTemplateOutOfStock`。
- `is_active` 的更新改為與扣量後狀態一致（同交易內）。

```python
with transaction.atomic():
    updated = CouponTemplate.objects.filter(
        id=coupon_template.id,
        is_active=True,
        remaining_quantity__gt=0,
    ).update(remaining_quantity=F('remaining_quantity') - 1)
    if updated == 0:
        raise CouponTemplateOutOfStock(...)

    coupon_template.refresh_from_db(fields=['remaining_quantity', 'is_active'])
    if coupon_template.remaining_quantity <= 0 and coupon_template.is_active:
        coupon_template.is_active = False
        coupon_template.save(update_fields=['is_active'])

    coupon = Coupon.objects.create(...)
```

#### 2. 測試補強（merchant consolidate 競態/邊界）
**File**: `Backend/tests/test_merchant_coupon_routes.py`  
**Changes**:
- 新增「未註冊分支連續請求」與「庫存=1 時第二次請求失敗」測試。
- 驗證 `remaining_quantity` 不會變負、建立 coupon 數量與扣量一致。

### Success Criteria:

#### Automated Verification:
- [x] 後端測試通過（merchant coupon 路徑）：`cd Backend && python manage.py test tests.test_merchant_coupon_routes`
- [x] QR contract 測試仍通過（確保沒破壞既有發券語意）：`cd Backend && python manage.py test tests.contract.test_qr_claim`
- [x] 全域後端 smoke 測試通過：`cd Backend && python manage.py test api.tests`

#### Manual Verification:
- [ ] 商家端以同一模板、同一未註冊手機連續送券，庫存顯示與實際 pending 券數一致。
- [ ] 庫存耗盡後再送券，前端可收到明確失敗訊息（非 500）。
- [ ] 既有已註冊分支（直接發給現有用戶）行為不回歸。

**Implementation Note**: 完成本 phase 並通過自動驗證後，先由人工確認商家端手動測試結果，再進入下一階段。

---

## Phase 2: Harden Redemption Race Error Handling

### Overview

補上 `redeem_coupon` 在 unique constraint 競態下的穩定錯誤映射，避免重複核銷少數情境回 500。

### Changes Required:

#### 1. 補 `IntegrityError` 映射為業務錯誤
**File**: `Backend/api/views/coupon_views.py`  
**Changes**:
- 匯入 `django.db.utils.IntegrityError`。
- 在建立 `CouponRedemption` 區段補 `except IntegrityError`，回拋 `CouponAlreadyRedeemed`。
- 保持現有 API response schema 與錯誤碼映射機制不變。

```python
try:
    redemption = CouponRedemption(...)
    redemption.save()
except IntegrityError:
    raise CouponAlreadyRedeemed(developer_message="This coupon has already been redeemed by this user.")
```

#### 2. 測試補強（重複核銷）
**File**: `Backend/tests/test_coupon_routes.py`  
**Changes**:
- 新增/調整測試：同一 exclusive coupon + 同一 user 重複 redeem 時，第二次應穩定得到業務錯誤（4xx + CouPro error payload）。
- 測試不僅驗 status code，也驗 `error_code`（若 handler 有輸出）。

### Success Criteria:

#### Automated Verification:
- [x] coupon route 測試通過：`cd Backend && python manage.py test tests.test_coupon_routes`
- [x] merchant route 測試通過（避免互相影響）：`cd Backend && python manage.py test tests.test_merchant_coupon_routes`
- [x] 後端 smoke 測試通過：`cd Backend && python manage.py test api.tests`

#### Manual Verification:
- [ ] 同一張 exclusive 券重複核銷時，前端穩定顯示「已兌換」而不是 generic crash。
- [ ] 正常單次核銷流程（含統計更新）不受影響。

**Implementation Note**: 完成本 phase 並通過自動驗證後，先由人工確認 consumer 端核銷 UX，再進入下一階段。

---

## Phase 3: Align Pending Coupon Assignment Semantics

### Overview

統一 pending coupon 在不同入口的 claim/transfer 行為，確保資料狀態（holder、pending_phone、acquisition_method）一致。

### Changes Required:

#### 1. 統一 helper 與 OTP 路徑語意
**Files**:
- `Backend/api/views/user_profile.py`
- `Backend/api/views/phone_otp.py`

**Changes**:
- 明確定義 pending claim 後欄位寫法（例如 `current_holder`、`pending_phone_number=None`、是否更新 `original_owner` / `acquisition_method`）。
- `assign_pending_coupons` 可改成批次 `update(...)`（若符合業務語意）或保留逐筆但補 transaction 邊界與一致欄位策略。
- 確認 `verify_otp` 與 `verify_registration_otp` 與 helper 的欄位更新策略一致。

#### 2. 測試補強（pending assignment）
**Files**:
- `Backend/tests/test_merchant_coupon_routes.py`（或新增 `Backend/tests/test_phone_otp_pending_claim.py`）
- `Backend/tests/contract/test_qr_claim.py`（僅在需要 cross-flow 時）

**Changes**:
- 新增 phone verify / registration 後 pending coupon 被正確歸戶的測試。
- 驗證舊手機轉移 + 新手機領取時，狀態不衝突。

### Success Criteria:

#### Automated Verification:
- [x] OTP 與 pending claim 測試通過：`cd Backend && python manage.py test tests.test_phone_otp`（專案內 OTP 測試位於 `tests/`，非 `api.tests`）
- [x] merchant/coupon 測試仍通過：`cd Backend && python manage.py test tests.test_merchant_coupon_routes tests.test_coupon_routes`
- [x] 合約測試（QR）仍通過：`cd Backend && python manage.py test tests.contract.test_qr_claim`

#### Manual Verification:
- [ ] 使用者完成手機驗證後，pending 券於 collection 內正確出現。
- [ ] 更換手機號場景下，舊號未領券與新號 pending 券都能按預期歸戶。
- [ ] 前端不需改 API 欄位也能正常顯示結果。

**Implementation Note**: 完成本 phase 並通過自動驗證後，請人工做完整 user journey 驗收（merchant 發券 → phone verify/register → consumer collection/redeem）。

---

## Testing Strategy

### Unit Tests:
- `merchant_consolidate_coupon` 未註冊分支扣量與建券一致性。
- `redeem_coupon` 的 `IntegrityError -> CouponAlreadyRedeemed` 映射。
- pending claim 欄位語意一致性（`current_holder`, `pending_phone_number`, `acquisition_method`）。

### Integration Tests:
- 低庫存（1 張）連續請求下，只允許一筆成功建券。
- 重複 redeem 同一 exclusive coupon 時，第二次回業務錯誤，不拋 500。
- registration OTP / phone verify 後 pending coupon 正確歸戶。

### Manual Testing Steps:
1. 商家端用同模板對未註冊手機連續發券，觀察庫存與 pending 券數。
2. 消費者完成註冊（或 phone verify）後，確認 pending 券進入 collection。
3. 對同一 exclusive coupon 連續按兌換，確認 UI 顯示可理解錯誤訊息。
4. QR claim 仍可正常領券，且重試行為不產生非預期重複。

## Performance Considerations

- Phase 1 使用 `F()` update/單筆 refresh，不會增加明顯查詢負擔；可降低併發重試成本。
- Phase 3 若改批次 `update()`，會比逐筆 `save()` 更省 query，但需注意是否需要逐筆 side effects（例如 log）。

## Migration Notes

- 本計畫預期不需 schema migration。
- 若實作中發現需新增 DB 約束（例如額外 unique/index），需另開 migration 子任務與資料回填策略。

## References

- 研究文件：`thoughts/shared/research/2026-03-16-db-integrity-constraints-crud-safety.md`
- 主要實作：
  - `Backend/api/views/merchant_coupon.py`
  - `Backend/api/views/coupon_views.py`
  - `Backend/api/views/qr_claim.py`
  - `Backend/api/views/phone_otp.py`
  - `Backend/api/views/user_profile.py`
  - `Backend/api/models.py`
- 既有測試：
  - `Backend/tests/test_coupon_routes.py`
  - `Backend/tests/test_merchant_coupon_routes.py`
  - `Backend/tests/contract/test_qr_claim.py`
