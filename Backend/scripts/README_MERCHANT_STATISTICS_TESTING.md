# Merchant Statistics Testing Framework

這套測試框架用於測試 Merchant Statistics Panel 的統計功能，包含 5 個測試階段，每個階段測試不同複雜度的統計指標。

## 文件結構

- `merchant_test_scenarios.py` - 定義 5 個階段的場景配置
- `generate_merchant_test_data.py` - 測資生成工具
- `verify_merchant_statistics.py` - 驗證工具（DB 查詢與 API 比對）
- `test_merchant_statistics.py` - 主測試腳本

## 測試階段

### Stage 1: 基本計數指標
測試 `/api/merchant/statistics/` API 的基本計數功能：
- `active_coupons`: 活躍模板數量
- `total_templates`: 總模板數
- `total_coupons_generated`: 生成的優惠券總數
- `total_views`: 總曝光次數
- `total_redemptions`: 總核銷數

### Stage 2: EasyUse 模板分析
測試 EasyUse 模板（`total_quantity=0`）的分析功能：
- `exposure_count`: 曝光次數
- `conversion_rate`: 轉換率（核銷數 / 曝光數）
- 時間趨勢數據驗證

### Stage 3: Exclusive 基礎指標
測試 Exclusive 模板的基礎指標：
- `exposure_count`: 曝光次數
- `conversion_rate`: 轉換率
- `redemption_rate`: 核銷率

### Stage 4: Exclusive 進階指標
測試 Exclusive 模板的複雜指標：
- `retention_rate`: 留客率
- `stranger_acquisition_rate`: 陌生獲客率
- `circulation_rate`: 流動率
- `circulation_redemption_rate`: 流動核銷率

### Stage 5: 時間趨勢與邊界場景
測試時間範圍查詢和邊界場景：
- 不同時間範圍（3/7/30/90 天）的數據過濾
- 空數據場景
- 極高核銷率場景
- 極低轉換率場景

## 使用方式

### 1. 生成測資

```bash
# 生成 Stage 1 的測資（使用默認參數）
python scripts/generate_merchant_test_data.py --stage 1

# 生成 Stage 4 的測資（使用自定義參數）
python scripts/generate_merchant_test_data.py --stage 4 \
  --num-exclusive-templates 3 \
  --coupons-per-template 150 \
  --redemption-rate 0.6 \
  --stranger-acquisition-ratio 0.7

# 使用 JSON 配置文件
python scripts/generate_merchant_test_data.py --stage 3 --config custom_config.json
```

### 2. 運行測試

```bash
# 測試特定階段
python scripts/test_merchant_statistics.py --stage 1

# 測試所有階段
python scripts/test_merchant_statistics.py --all

# 使用現有數據（不重新生成）
python scripts/test_merchant_statistics.py --stage 2 --no-generate

# 保存測試報告
python scripts/test_merchant_statistics.py --all --report test_report.json
```

### 3. 獨立驗證

```bash
# 驗證特定模板
python scripts/verify_merchant_statistics.py --template-id 123 --days 30

# 驗證所有模板
python scripts/verify_merchant_statistics.py --all --days 30
```

## 配置文件格式

JSON 配置文件範例：

```json
{
  "stage1": {
    "num_active_templates": 5,
    "num_inactive_templates": 3,
    "num_store_templates": 2,
    "total_quantity_per_template": 30,
    "clicks_per_template": 100
  },
  "stage4": {
    "num_exclusive_templates": 3,
    "coupons_per_template": 150,
    "redemption_rate": 0.6,
    "stranger_acquisition_ratio": 0.7,
    "sharing_rate": 0.4,
    "circulation_redemption_ratio": 0.75
  }
}
```

## 驗證方法

每個測試階段都會進行雙重驗證：

1. **API 驗證**：調用 API 獲取統計數據
2. **DB 驗證**：直接查詢資料庫計算預期值
3. **比對**：比較 API 返回值與 DB 查詢值，計算誤差

驗證通過條件：
- Stage 1: 完全匹配（誤差 = 0）
- Stage 2: 曝光次數完全匹配，轉換率誤差 <= 0.1%
- Stage 3: 所有指標誤差 <= 1%
- Stage 4: 所有指標誤差 <= 2%
- Stage 5: 時間範圍過濾正確，邊界場景不產生錯誤

## 測試流程

1. 啟動測試服務器：
   ```bash
   ./run_test_server.sh
   ```

2. 初始化測試資料庫（如需要）：
   ```bash
   python scripts/init_test_db.py
   ```

3. 生成測資：
   ```bash
   python scripts/generate_merchant_test_data.py --stage 1
   ```

4. 運行測試：
   ```bash
   python scripts/test_merchant_statistics.py --stage 1
   ```

5. 查看結果：
   - 終端輸出會顯示每個測試的結果
   - 如果指定了 `--report`，會生成 JSON 格式的詳細報告

## 自定義參數

所有階段都支援通過命令行參數自定義：

**Stage 1:**
- `--num-active-templates`
- `--num-inactive-templates`
- `--num-store-templates`
- `--total-quantity-per-template`
- `--clicks-per-template`

**Stage 2:**
- `--num-store-templates`
- `--clicks-per-template`
- `--conversion-rate`
- `--time-range-days`
- `--nearby-click-ratio`

**Stage 3:**
- `--num-exclusive-templates`
- `--coupons-per-template`
- `--clicks-per-template`
- `--redemption-rate`
- `--time-range-days`
- `--nearby-click-ratio`

**Stage 4:**
- `--num-exclusive-templates`
- `--coupons-per-template`
- `--redemption-rate`
- `--stranger-acquisition-ratio`
- `--sharing-rate`
- `--circulation-redemption-ratio`
- `--time-range-days`

## 注意事項

1. 測試前確保測試服務器正在運行（`./run_test_server.sh`）
2. 每個階段會生成新的測試數據，可能會覆蓋現有數據
3. 使用 `--no-generate` 可以跳過數據生成，使用現有數據進行測試
4. 驗證工具可以獨立使用，不需要運行完整測試套件

