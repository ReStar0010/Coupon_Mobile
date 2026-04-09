---
date: 2026-03-18T12:00:00+08:00
researcher: auto
git_commit: 24b9829b144b64e91bb17b4001d6cf80ec50fae9
branch: dev
repository: Coupon_Mobile
topic: "專屬券分享到公開池後若已被他人領取，分享者按「收回」會發生什麼？"
tags: [research, codebase, collection, withdraw, public-share, exclusive-coupon]
status: complete
last_updated: 2026-03-18
last_updated_by: auto
last_updated_note: "Added follow-up research for stale UI / no-refresh withdraw scenario"
---

# Research: 專屬券分享到公開池後若已被他人領取，分享者按「收回」會發生什麼？

**Date**: 2026-03-18  
**Researcher**: auto  
**Git Commit**: 24b9829b144b64e91bb17b4001d6cf80ec50fae9  
**Branch**: dev  
**Repository**: Coupon_Mobile  

## Research Question

In `Mobile-Frontend/app/(tabs)/collection/index.tsx`, if an exclusive coupon is shared to the public pool, and picked by others, what will happen if the user who shares it presses "withdraw" (收回)?

## Summary

- **在 App 畫面上**：一旦該筆分享被他人領取，狀態會變成 `accepted`，該筆分享**不會**出現在「專屬酷胖」列表的「交換池中」區塊，因此分享者**看不到那張卡、也無法按「收回」**。
- **若仍呼叫收回 API**（例如舊版客戶端、競態或手動打 API）：後端只允許對 `pending` 的分享做收回；對已 `accepted` 的分享會回傳 **400** 與 `ShareNotPendingForWithdraw`，**不會**把券還給分享者，券仍屬於領取者。

## Detailed Findings

### 1. 畫面上誰會看到「收回」按鈕（Collection 列表）

- 列表資料來自 `filteredCoupons`，其中「交換池中」的項目來自 `pendingPoolItems`。
- `pendingPoolItems` 只納入 `publicShares` 裡 **`status === 'pending'`** 的項目（`index.tsx` 第 186–201 行）。
- 每筆 `PublicShare` 的 `status` 來自 API `/my-public-shares/`，型別為 `'pending' | 'accepted' | 'declined' | 'cancelled'`（`useMyPublicShares.ts` 第 12 行）。
- 因此：**已被他人領取的分享**（狀態為 `accepted`）**不會**出現在 `pendingPoolItems`，也就不會出現在列表裡，分享者在 Collection 頁**沒有該張「交換池中」的卡，自然無法按「收回」**。

### 2. 收回按鈕與呼叫流程（僅對「交換池中」顯示的項目）

- 「收回」按鈕只在 `shareIdInPool != null && onWithdrawFromPool` 時顯示（`Coupon.tsx` 第 124–142 行），按下去會呼叫 `onWithdrawFromPool(shareIdInPool)`。
- Collection 的 `handleWithdrawFromPool`（`index.tsx` 第 207–217 行）會：
  - 呼叫 `withdrawPublicShare(shareId)`（對應 `POST /api/coupon/share-public/<share_id>/withdraw/`），
  - 成功後再 `fetchCoupons()` 與 `fetchPublicShares()` 重整列表。
- 若 API 失敗，僅 `console.error('Withdraw from pool failed:', err)`，沒有對使用者顯示特定錯誤訊息。

### 3. 後端收回邏輯（已被人領取時的行為）

- `withdraw_public_share` 在 `Backend/api/views/sharing_views.py` 第 450–483 行。
- 條件：
  - 必須是該分享的 `from_user`（分享者本人）。
  - 只處理 **`status == 'pending'`** 的公開分享。
- 若 `share_request.status != 'pending'`（例如已被領取變成 `accepted`），會 **raise `ShareNotPendingForWithdraw`**，不回 200。
- `ShareNotPendingForWithdraw` 定義在 `Backend/api/exceptions.py` 第 347–350 行：`status_code = 400`，`error_code = "SHARE_NOT_PENDING_FOR_WITHDRAW"`。
- 因此：**已被領取的分享無法被收回**；API 回 400，後端不會把券改回分享者，券仍屬於領取者。

### 4. 小結表

| 情境 | 分享是否還出現在「交換池中」列表 | 分享者能否按「收回」 | 若呼叫 withdraw API 的結果 |
|------|----------------------------------|----------------------|----------------------------|
| 分享仍在池中（pending） | 是 | 能 | 200，分享改為 cancelled，券歸還分享者 |
| 分享已被他人領取（accepted） | 否 | 不能（沒有該卡） | 400 ShareNotPendingForWithdraw，不變更 |

## Code References

- `Mobile-Frontend/app/(tabs)/collection/index.tsx:186-201` — `pendingPoolItems` 只含 `status === 'pending'` 的 public shares
- `Mobile-Frontend/app/(tabs)/collection/index.tsx:207-217` — `handleWithdrawFromPool` 呼叫 `withdrawPublicShare` 並重整
- `Mobile-Frontend/app/(tabs)/collection/utils/couponUtils.ts:46-51` — `withdrawPublicShare` 呼叫 `POST .../withdraw/`
- `Mobile-Frontend/app/(tabs)/collection/components/Coupon.tsx:124-142` — 僅在 `shareIdInPool` 時顯示「收回」按鈕
- `Mobile-Frontend/app/(tabs)/collection/hooks/useMyPublicShares.ts:6-16` — `PublicShare` 含 `status: 'pending' | 'accepted' | 'declined' | 'cancelled'`
- `Backend/api/views/sharing_views.py:450-483` — `withdraw_public_share` 僅允許 pending，否則 raise ShareNotPendingForWithdraw
- `Backend/api/exceptions.py:347-350` — ShareNotPendingForWithdraw 定義（400）

## Architecture Notes

- 公開分享狀態由後端 `CouponShareRequest.status` 決定；前端「我的公開分享」列表與 Collection 的「交換池中」區塊只顯示 **pending** 的分享，因此收回按鈕只會出現在尚未被領取的分享上。
- 收回成功時後端會：將該筆 share 設為 `cancelled`、`responded_at` 設為現在，並把對應 `coupon.current_holder` 設回 `request.user`（分享者）。

## Follow-up: 未重整時，分享者畫面上仍顯示「收回」並按下（競態）

情境：你分享到公開池後**沒有重整**，此時別人已領取該券，你畫面上仍看到那張「交換池中」的卡與「收回」按鈕，然後你按了「收回」。

- **後端**：該筆分享已是 `accepted`，`withdraw_public_share` 會 raise `ShareNotPendingForWithdraw`，回傳 **400**，不變更任何資料（券仍在領取者身上）。
- **前端**：`withdrawPublicShare(shareId)` 拋錯，進入 `catch`（`index.tsx` 第 215–216 行），只執行 `console.error('Withdraw from pool failed:', err)`，**沒有**對使用者顯示錯誤訊息或 toast，也**不會**執行 `fetchCoupons()` / `fetchPublicShares()`（因為在 try 裡排在 await 之後）。
- **結果**：畫面上不會有成功或失敗的提示，列表也不會更新；那張卡會繼續以「交換池中」+「收回」的樣式留在畫面上，直到使用者手動下拉重整或離開再進來，重整後該筆會從「交換池中」消失（因 API 回傳的該筆狀態已是 `accepted`）。

## Open Questions

- 無。行為已由前端篩選與後端條件完整決定。
