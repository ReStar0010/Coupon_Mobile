---
date: 2026-03-12T00:00:00+08:00
researcher: agent
git_commit: 40e1296de7afa578ece9f97a31bee75d4ed17a40
branch: main
repository: Coupon_Mobile
topic: "User A 透過分享連結領取優惠券後，優惠券未出現在收藏頁"
tags:
  [
    research,
    codebase,
    collection,
    public-shares,
    useCoupons,
    useMyPublicShares,
    filteredCoupons,
  ]
status: complete
last_updated: 2026-03-12
last_updated_by: agent
---

# Research: 收藏頁領取後優惠券不顯示

**Date**: 2026-03-12  
**Researcher**: agent  
**Git Commit**: 40e1296de7afa578ece9f97a31bee75d4ed17a40  
**Branch**: main  
**Repository**: Coupon_Mobile

## Research Question

User A 透過分享連結從 User B 領取優惠券後，優惠券已屬於 User A，但在 User A 的收藏頁（collection）看不到。日誌顯示：

- Public shares response 有一筆 status "accepted"、claimed_by "a@a.com"、coupon_id 507；
- API response（exclusive-coupons）有 coupon 507，last_holder_email "a@a.com"。  
  研究範圍：`Mobile-Frontend/app/(tabs)/collection/`，說明現有實作與資料流。

## Summary

收藏頁的「主列表」資料來自 `useCoupons`（`GET /exclusive-coupons/`），後端已正確回傳該券（例如 id 507）。同一頁用 `useMyPublicShares`（`GET /my-public-shares/`）取得「我的公開分享」紀錄。  
**目前行為**：主列表會排除「所有出現在 my-public-shares 裡的 coupon_id」（不論 status 是 pending 或 accepted），而「我的公開分享」區塊只顯示 **status === 'pending'** 的分享。因此當某券同時 (1) 在 exclusive-coupons 回傳、(2) 在 my-public-shares 有一筆（例如 accepted）時，該券會從主列表被排除，又不會在「我的公開分享」區塊顯示，造成使用者在收藏頁看不到這張券。

## Detailed Findings

### 1. 收藏頁資料來源（index.tsx）

- **主列表用券**：`useCoupons(isAuthenticated, authLoading)` → `coupons`，來自 `GET /exclusive-coupons/`（`hooks/useCoupons.ts`）。
- **公開分享紀錄**：`useMyPublicShares(...)` → `publicShares`，來自 `GET /my-public-shares/`（`hooks/useMyPublicShares.ts`）。
- **顯示用列表**：`filteredCoupons` 由 `coupons` 經篩選（dismissed/blocked、搜尋、標籤、到期、店家）後，再**排除所有在 publicShareCouponIds 內的 coupon**。

### 2. 排除邏輯（index.tsx:149–176）

```ts
publicShareCouponIds = new Set(publicShares.map((s) => s.coupon_id));
```

- `publicShares` 包含後端回傳的**全部**分享（pending / accepted / declined / cancelled），不依 status 再篩。
- `activeCoupons`：先依店家 dismissed/blocked 篩選。
- `excludedFromPool = activeCoupons.filter((c) => !c.id || !publicShareCouponIds.has(c.id))`  
  → 凡 `coupon.id` 在 `publicShareCouponIds` 內就會被排除。
- `filteredCoupons = filterCoupons(excludedFromPool, ...)` 是實際餵給 FlatList 的資料。

因此：只要某券的 id 出現在「我的公開分享」任一筆（含 accepted），該券就不會出現在主列表。

### 3. 我的公開分享區塊顯示條件（MySharedCoupons.tsx:15–19）

```ts
const pendingShares = shares.filter((s) => s.status === "pending");
if (pendingShares.length === 0) return null;
```

- 只顯示 **status === 'pending'** 的分享（交換池中、等待被領取）。
- **accepted**（或 declined/cancelled）的分享不會在「我的公開分享」區塊顯示。

### 4. 資料流與「看不到」的成因

- 後端：`get_exclusive_coupons` 依 `current_holder=request.user` 回傳專屬券，領取後 User A 會拿到該券（日誌中的 API response 正確）。
- 後端：`get_my_public_shares` 依 `from_user=request.user` 回傳「我發起的公開分享」。若該筆分享是「User A 曾把此券放到公開池、後來被 a@a.com 領走」，則 A 的 my-public-shares 會含此筆（status accepted, coupon_id 507）。
- 前端：507 同時在 `coupons` 與 `publicShares`（某筆的 coupon_id）→ 被放進 `publicShareCouponIds` → 從主列表排除。
- 前端：該筆為 accepted → 不會在「我的公開分享」區塊顯示。
- 結果：該券在收藏頁既不在主列表，也不在區塊中，使用者看不到。

（若情境是「User B 分享 → User A 領取」，則在 A 的裝置上 my-public-shares 通常不會有該筆（因 from_user=B）；此時 507 不會被排除，理論上會出現在主列表。日誌中同時出現 public shares 與 exclusive-coupons 含 507，較符合「同一使用者 A 既有該券又被 my-public-shares 回傳到該券」的情境，例如 A 曾公開分享過此券且後來被領走。）

### 5. 後端端點摘要

- **Backend/api/views/coupon_views.py**
  - `get_exclusive_coupons`（約 153–215 行）：篩選 `coupon_type='exclusive'`、未過期、已開始、`current_holder=request.user`，排除已兌換與被封鎖店家，回傳列表。
- **Backend/api/views/sharing_views.py**
  - `get_my_public_shares`（約 384–408 行）：篩選 `from_user=request.user`、`is_public=True`，回傳每筆的 share_id、coupon_id、status、claimed_by、claimed_at 等。

### 6. 類型與轉換

- **useMyPublicShares**：`PublicShare` 含 share_id, coupon_id, status, claimed_by, claimed_at 等（見 `hooks/useMyPublicShares.ts`）。
- **useCoupons**：後端回傳欄位含 id, store_name, last_holder_email 等；前端以 `transformApiCoupon` 轉成 `CouponType`（`utils/couponUtils.ts`, `utils/types.ts`）。
- 主列表的 key 為 `item.id`（券 id），排除時用 `publicShareCouponIds.has(c.id)` 比對。

## Code References

- `Mobile-Frontend/app/(tabs)/collection/index.tsx:149–176` – publicShareCouponIds、excludedFromPool、filteredCoupons 計算
- `Mobile-Frontend/app/(tabs)/collection/index.tsx:320–321` – FlatList 使用 filteredCoupons
- `Mobile-Frontend/app/(tabs)/collection/index.tsx:226–229` – ListHeaderComponent 含 MySharedCoupons
- `Mobile-Frontend/app/(tabs)/collection/components/MySharedCoupons.tsx:15–19` – 僅顯示 pendingShares
- `Mobile-Frontend/app/(tabs)/collection/hooks/useCoupons.ts:40` – GET /exclusive-coupons/
- `Mobile-Frontend/app/(tabs)/collection/hooks/useMyPublicShares.ts:70–78` – GET /my-public-shares/
- `Backend/api/views/coupon_views.py:153–215` – get_exclusive_coupons
- `Backend/api/views/sharing_views.py:384–408` – get_my_public_shares

## Architecture Documentation

- 收藏頁主列表 = exclusive-coupons 回傳的券，再經前端篩選（dismissed/blocked、搜尋、標籤、到期、店家），並**一律排除**所有在 my-public-shares 中出現過的 coupon_id。
- 「我的公開分享」區塊僅顯示 status 為 pending 的分享，accepted/declined/cancelled 不顯示。
- 領取後刷新會呼叫 `fetchCoupons` 與 `fetchPublicShares`（useSharedCoupon.handleGiftAccepted、onRefresh），兩邊資料都會更新，但排除邏輯不區分 status，故 accepted 的券仍會被排除且不在區塊顯示。

## Historical Context (from thoughts/)

（專案內目前無 thoughts/ 目錄，無歷史脈絡可引用。）

## Related Research

（無其他相關研究文件路徑。）

## Open Questions

- 產品上是否希望「我領取的公開分享券」應出現在主列表、或另區塊（例如「已領取的公開分享」）顯示，需產品/設計確認。
- 若僅要修復「領取後要看到券」，可考慮：排除時僅排除 status === 'pending' 的 coupon_id，或讓「我的公開分享」區塊也顯示 accepted 並區分樣式；實作選擇依產品需求決定。
