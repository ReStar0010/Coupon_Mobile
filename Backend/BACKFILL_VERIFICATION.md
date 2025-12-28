# Backfill 和統計驗證指南

## 實施步驟

### 1. 執行 Backfill Command

首先在測試環境執行 backfill（建議先用 dry-run 模式預覽）：

```bash
cd Backend

# 預覽模式（不會實際修改資料）
python manage.py backfill_coupon_templates --dry-run

# 實際執行
python manage.py backfill_coupon_templates
```

### 2. 驗證 Backfill 結果

檢查是否所有 store coupon 都有 template：

```python
# 在 Django shell 中執行
from api.models import Coupon

# 檢查是否還有沒有 template 的 store coupon
legacy_count = Coupon.objects.filter(
    coupon_type='store',
    template__isnull=True
).count()

print(f"剩餘沒有 template 的 store coupon: {legacy_count}")
# 應該為 0（或接近 0，如果有異常資料）
```

### 3. 驗證 API 返回 template_id

測試優惠券詳情 API 是否返回 template_id：

```bash
# 測試 store type coupon
curl -X GET "http://localhost:8000/api/coupons/{coupon_id}/" \
  -H "Authorization: Bearer {token}"

# 檢查 response 中是否有 template_id 欄位
# 應該看到: "template_id": <number> 或 "template_id": null
```

### 4. 驗證 template_view 日誌創建

1. 使用前端或 API 工具進入優惠券詳情頁
2. 檢查資料庫中的 Log 記錄：

```python
from api.models import Log

# 檢查最新的 template_view 日誌
recent_template_views = Log.objects.filter(
    action='template_view'
).order_by('-timestamp')[:5]

for log in recent_template_views:
    print(f"Template: {log.template.id if log.template else None}, "
          f"Coupon: {log.coupon.id if log.coupon else None}, "
          f"User: {log.user.email if log.user else 'Anonymous'}, "
          f"Location: ({log.lat}, {log.lng})")
```

### 5. 驗證商家統計使用 template_view

1. 登入商家帳號
2. 查看商家統計 API：

```bash
curl -X GET "http://localhost:8000/api/merchant/statistics/" \
  -H "Authorization: Bearer {merchant_token}"

# 檢查 total_views 是否基於 template_view 計算
```

3. 查看商家分析 API：

```bash
curl -X GET "http://localhost:8000/api/merchant/analytics/?days=30" \
  -H "Authorization: Bearer {merchant_token}"

# 檢查：
# - overall_conversion_rate 的分母應該基於 template_view
# - trends 中的 daily_data 應該基於 template_view
```

### 6. 驗證 view coupon 仍然存在

確認 `view coupon` 日誌仍然正常創建（不應被移除）：

```python
from api.models import Log

# 檢查最新的 view coupon 日誌
recent_view_coupons = Log.objects.filter(
    action='view coupon'
).order_by('-timestamp')[:5]

print(f"最新的 view coupon 日誌數量: {recent_view_coupons.count()}")
# 應該 > 0（如果最近有查看優惠券）
```

## 預期結果

### ✅ 成功指標

1. **Backfill 完成**：
   - 所有（或絕大部分）store coupon 都有 template 關聯
   - 沒有 template 的 coupon 數量接近 0

2. **API 返回 template_id**：
   - 所有優惠券詳情 API 都返回 `template_id`（不為 null）

3. **template_view 日誌創建**：
   - 每次進入優惠券詳情頁都會創建 `template_view` 日誌
   - 日誌包含 template、coupon、user、位置資訊

4. **商家統計正確**：
   - `total_views` 基於 `template_view` 計算
   - 轉換率的分母基於 `template_view`
   - 趨勢資料基於 `template_view`

5. **view coupon 保留**：
   - `view coupon` 日誌仍然正常創建
   - 不影響商家統計（統計不再使用它）

### ⚠️ 注意事項

- 如果 backfill 後仍有少量 coupon 沒有 template，這些 coupon 的點擊不會計入統計
- 這是預期行為（因為沒有 template 就無法創建 template_view 日誌）
- 可以手動檢查這些 coupon 並決定是否需要處理

## 故障排除

### 問題：Backfill 後仍有 coupon 沒有 template

**可能原因**：
- Coupon 資料不完整（缺少必要欄位）
- 資料異常

**解決方案**：
- 檢查 backfill command 的輸出，查看 skipped 的 coupon
- 手動檢查這些 coupon 的資料完整性
- 必要時手動建立 template 並關聯

### 問題：商家統計顯示 0

**可能原因**：
- 還沒有 template_view 日誌（需要先有使用者查看優惠券）
- template_view 日誌的 template 沒有正確關聯到 store

**解決方案**：
- 確認有 template_view 日誌存在
- 檢查 template_view 日誌的 template__store 是否正確
- 測試：進入優惠券詳情頁，然後檢查統計是否更新

