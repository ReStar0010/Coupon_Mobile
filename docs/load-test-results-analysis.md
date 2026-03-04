# Load Test Results 分析報告

依據 `load-test-results/` 下的 Stage 1 產出（`stage1_stats.csv`、`stage1_failures.csv`、`stage1_stats_history.csv`、`consistency_summary.json`）整理。

---

## 1. 整體摘要

| 指標 | 數值 |
|------|------|
| 總請求數 | 1,242 |
| 總失敗數 | 372 |
| **整體失敗率** | **~30%** |
| 總 RPS | ~40 req/s |
| 總失敗/s | ~12 failures/s |
| 整體中位數延遲 | 340 ms |
| 整體平均延遲 | 2,194 ms |
| 整體最大延遲 | 17,006 ms |

**Consistency check**：`consistency_summary.json` 為 `passed: true`、`errors: []`，代表跑完後資料面沒有 oversell、重複兌換等問題。

---

## 2. 各 API 表現

| 類型 | 名稱 | 請求數 | 失敗數 | 失敗率 | 中位數 | 平均 | 最大 | RPS | Failures/s |
|------|------|--------|--------|--------|--------|------|------|-----|------------|
| POST | /api/login/ | 264 | 119 | **45.1%** | 410 ms | 1,789 ms | 16,636 ms | 8.5 | 3.8 |
| GET | /api/store-coupons/ | 911 | 241 | **26.5%** | 300 ms | 2,262 ms | 17,007 ms | 29.3 | 7.8 |
| POST | /api/redeem/[id]/ | 67 | 12 | **17.9%** | 290 ms | 2,878 ms | 16,847 ms | 2.2 | 0.4 |
| - | Aggregated | 1,242 | 372 | **29.9%** | 340 ms | 2,194 ms | 17,007 ms | 40.0 | 12.0 |

- **Login 失敗率最高（45%）**，且平均/最大延遲明顯偏高，代表登入在負載下最不穩。
- **Store-coupons** 請求量最大、失敗數最多（241），失敗率約 26.5%。
- **Redeem** 失敗率相對低（17.9%），但樣本數較少（67）。

---

## 3. 失敗類型分布（`stage1_failures.csv`）

| 錯誤類型 | 端點 | 次數 | 說明 |
|----------|------|------|------|
| **500 Internal Server Error** | GET /api/store-coupons/ | 133 | 後端未處理例外 |
| **500 Internal Server Error** | POST /api/login/ | 27 | 後端未處理例外 |
| **500 Internal Server Error** | POST /api/redeem/[id]/ | 12 | 後端未處理例外 |
| **Connection refused** | GET /api/store-coupons/ | 86 | 連不上 server（port 關閉或滿載拒連） |
| **Connection reset by peer** | POST /api/login/ | 92 | 連線被 server 端關閉 |
| **Connection reset by peer** | GET /api/store-coupons/ | 4 | 同上 |
| **RemoteDisconnected** | GET /api/store-coupons/ | 18 | 遠端關閉連線未回傳 response |

- **500**：合計 172 次，來自後端 exception（例如 DB、程式邏輯），需看 Django/Sentry 的 traceback。
- **Connection refused (86)**：多半是同一時段 server 重啟、掛掉或 process 崩潰，導致後續請求連不上。
- **Connection reset / RemoteDisconnected**：在負載高時常見，表示 server 負載過高關閉連線或崩潰。

整體說明：**在約 30 秒後負載上來，server 開始出現 500、關閉連線或短暫不可用，導致失敗率與延遲明顯惡化。**

---

## 4. 隨時間變化（`stage1_stats_history.csv`）

- **User count**：約從 0 升到 176~177，再略降到 145（部分 user 可能因失敗而停止）。
- **失敗出現時機**：約在 **User 138** 開始出現失敗（2 次），之後失敗數快速增加（8 → 16 → 33 → 51 → 66 → 90…），到結束約 **288 次失敗**（與最終 372 的差異可能來自不同時間點彙總方式）。
- **延遲惡化**：
  - 50%：約 310 ms → 380 ms
  - 95%：約 350 ms → **15,000 ms**
  - 99%：約 350 ms → **17,000 ms**
- **RPS / Failures/s**：RPS 從約 60 降到約 15；Failures/s 從 0 升到約 **8.1**。

解讀：**負載一超過某個臨界點（約 130~170 users），server 開始不穩，500 與連線錯誤增加、延遲飆高，符合「連線或並發處理能力到頂」的現象（例如 DB 連線用滿、runserver 單 process 瓶頸、或 OOM）。**

---

## 5. 結論與建議

| 項目 | 結論 |
|------|------|
| **資料正確性** | Consistency 通過，無 oversell / 重複兌換等問題。 |
| **穩定性** | 約 30% 失敗率、P95 飆到 15s+，**不適合當作通過標準**。 |
| **主要問題** | 1) **500**：後端未處理例外（需看 Django/Sentry）。2) **Connection refused / reset**：server 過載或短暫不可用。 |
| **與 port 無關** | 錯誤為 500 與連線被關閉，不是「port 開太多」；是 **server 或 DB 在並發下的能力/穩定性**。 |

**建議下一步：**

1. **查 500 的實際原因**：在跑負載時看 Django console 或 Sentry 的 traceback（例如是否為 DB 連線滿、timeout、或某支 API 的 bug）。
2. **用 Postgres + 連線設定**：確認 `DATABASE_URL` 與 `conn_max_age` 等設定，避免連線數爆掉。
3. **改用多 process/worker**：不要用單一 `runserver` 壓測，改用例如 `gunicorn -w 4` 再跑一次，觀察失敗率與 P95 是否改善。
4. **若要訂通過標準**：可要求例如「Stage 1 整體失敗率 < 1%、P95 < 500 ms」；目前結果遠未達標，需先改善上述項目再重測。
