# Collection 使用者可見錯誤提示 — 實作計畫

## Overview

在使用者於「專屬酷胖」按下「收回」公開分享等操作失敗時，目前僅 `console.error`，使用者看不到原因（例如券已被他人領取）。本計畫在 **不變更後端** 的前提下，沿用專案既有 **`useApiError` + `react-native-toast-message`（`failRed`）** 模式，讓錯誤以繁中（或 i18n 鍵）顯示；並在收回失敗後 **重新拉取分享列表與券列表**，修正未重整造成的過期 UI。

## Current State Analysis

| 位置 | 現況 |
|------|------|
| `Mobile-Frontend/app/(tabs)/collection/index.tsx` `handleWithdrawFromPool`（約 209–217 行） | 失敗僅 `console.error`，不提示、不重整 |
| 後端 `withdraw_public_share` | 非 `pending` 時回 400，`error_code: SHARE_NOT_PENDING_FOR_WITHDRAW` |
| `Mobile-Frontend/locales/zh-TW/translation.json` | 已有 `errors.SHARE_NOT_PENDING_FOR_WITHDRAW` 文案 |
| `authAPI.ts` | `SHARE_NOT_PENDING_FOR_WITHDRAW` 已在 `EXPECTED_ERROR_CODES`，不會誤報 Sentry |
| 同頁其他操作 | `Gift.tsx` / `VoucherGift.tsx` / `useDailyDraw` 等部分錯誤仍僅 console |

## Desired End State

1. 使用者在「專屬酷胖」按「收回」若 API 失敗（含已被領取），畫面上會看到 **與登入頁同風格的紅色 Toast**，內容為 `getErrorMessage(err)`（已對應上述 i18n）。
2. 失敗後自動執行 `fetchPublicShares()`（建議一併 `fetchCoupons()`），使「交換池中」過期卡片消失，無需手動下拉重整。
3. （可選第二階段）其他使用者主動觸發且目前靜默失敗的操作，同樣顯示 Toast。

### Key Discoveries

- `login.tsx` 使用 `Toast.show({ type: 'failRed', text1: getErrorMessage(err), position: 'bottom', ... })`（約 91–97 行），Collection  tabs 已掛在根 `_layout` 的 `Toast` 上，可直接複用。
- `useApiError` 僅能於 **React 元件或自訂 hook** 內呼叫；`handleWithdrawFromPool` 在 `Collection` 元件內，可於該元件頂層 `const { getErrorMessage } = useApiError()`。

## What We're NOT Doing

- 不修改後端 withdraw 行為或錯誤碼。
- 不把「背景載入券列表／分享列表」的失敗全面改成 Toast（仍可用既有列表內錯誤狀態或 console；避免一進頁多個 Toast）。
- 不強制加入英文 `en` 翻譯（專案目前僅 `zh-TW`；缺鍵時 `useApiError` 會 fallback `GENERIC_ERROR`，此情境已有 zh-TW 鍵）。

## Implementation Approach

**Phase 1** 僅改 `collection/index.tsx`：注入 `useApiError`、`Toast`，在 `catch` 中顯示 Toast，並在 `finally` 或 `catch` 內於失敗時仍呼叫 `fetchPublicShares()` + `fetchCoupons()` 以同步 UI。

**Phase 2**（可選）針對使用者明確點擊卻失敗的流程補 Toast。

---

## Phase 1: 收回公開分享 — 錯誤提示 + 列表同步

### Overview

修正「收回」失敗時無提示、列表過期的問題。

### Changes Required

#### 1. `Mobile-Frontend/app/(tabs)/collection/index.tsx`

**Changes**:

- `import Toast from 'react-native-toast-message';`
- `import { useApiError } from '@/app/hooks/useApiError';`
- 在 `Collection` 內：`const { getErrorMessage } = useApiError();`
- 改寫 `handleWithdrawFromPool`：

```tsx
const handleWithdrawFromPool = useCallback(
  async (shareId: number) => {
    try {
      await withdrawPublicShare(shareId);
      await Promise.all([fetchCoupons(), fetchPublicShares()]);
    } catch (err) {
      Toast.show({
        type: 'failRed',
        text1: getErrorMessage(err),
        position: 'bottom',
        visibilityTime: 3500,
        autoHide: true,
      });
      await Promise.all([fetchCoupons(), fetchPublicShares()]);
    }
  },
  [fetchCoupons, fetchPublicShares, getErrorMessage],
);
```

**說明**：成功路徑不變；失敗時先 Toast，再強制重整列表，讓 `pending` 已消失的分享從畫面移除。

### Success Criteria

#### Automated Verification

- [ ] `cd Mobile-Frontend && npm run typecheck` 通過 — 截至實作日全專案仍有既有 Tamagui 型別錯誤（collection 內多檔等），非本變更造成；`collection/index.tsx` 變更與 login Toast 模式一致。
- [x] `cd Mobile-Frontend && npm run lint` 通過（0 errors）

#### Manual Verification

- [ ] 分享券至公開池 → 另一帳號領取 → 原帳號**不重整**按「收回」→ 出現說明「已被領取或已收回」類 Toast，且該張「交換池中」卡片消失
- [ ] 正常 pending 時按「收回」→ 成功後列表更新（與現況一致）
- [ ] 網路斷線時按「收回」→ 顯示網路/通用錯誤 Toast（`NETWORK_ERROR` / `GENERIC_ERROR`）

**Implementation Note**：Phase 1 完成並通過自動化檢查後，請人工確認上述手動情境再決定是否做 Phase 2。

---

## Phase 2（可選）：其他 Collection 使用者操作錯誤提示

### Overview

對「使用者主動點擊」且目前僅 `console.error` 的流程補上 Toast，與 Phase 1 一致。

### Candidate Files

| 檔案 | 情境 | 建議 |
|------|------|------|
| `Gift.tsx` | 接受贈券失敗 | `catch` 內 `Toast` + `getErrorMessage`；保留 `setError` 若畫面上已有內嵌錯誤則可二選一避免重複 |
| `components/VoucherGift.tsx` | 接受平台券贈禮失敗 | 同上 |
| `hooks/useDailyDraw.ts` | 每日抽獎失敗 | 需從 hook 回傳 `onDrawError` 或由呼叫端 `DailyDrawModal` 顯示 Toast（hook 內不宜直接 import Toast 若無法取得穩定文案；較乾淨作法為 hook `return { drawError: string | null }` 或由 `index.tsx` 包一層） |

### Success Criteria

#### Automated Verification

- [ ] `npm run typecheck` / `npm run lint`（`lint` 已通過；`typecheck` 仍被既有 Tamagui 型別錯誤阻擋，含 `Gift.tsx`/`VoucherGift.tsx` 在內的舊錯誤）

#### Manual Verification

- [ ] 各操作在故意觸發 API 失敗時，使用者能看到 Toast（或與現有 UI 錯誤區塊一致且不重複）

---

## Testing Strategy

### Manual（Phase 1 必做）

1. 裝置 A：專屬券 → 公開分享；裝置 B：領取同一筆。
2. 裝置 A：不重整，按「收回」→ 預期 Toast + 卡片消失。
3. 裝置 A：pending 時按「收回」→ 預期成功、券回到列表邏輯與現況一致。

### Unit / E2E

- 現有後端已有 `test_sharing_routes.py` withdraw 測試；前端可視團隊慣例補元件測試（非必須）。

## Performance Considerations

- 失敗時多兩次 GET（coupons + public shares）可接受；與使用者下拉重整成本相同。

## References

- 研究：`thoughts/shared/research/2026-03-18-exclusive-coupon-withdraw-when-picked.md`
- `Mobile-Frontend/app/(auth)/login.tsx` — Toast + `useApiError` 範例
- `Backend/api/views/sharing_views.py` — `withdraw_public_share`
- `Mobile-Frontend/locales/zh-TW/translation.json` — `errors.SHARE_NOT_PENDING_FOR_WITHDRAW`
