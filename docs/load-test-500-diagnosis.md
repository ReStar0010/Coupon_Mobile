# Load Test 500 錯誤診斷

## 現象

- Locust 跑約 30 秒後開始出現 **500 Internal Server Error** on `POST /api/login/`
- 失敗率約 45% login、約 18% store-coupons、約 17% redeem
- 錯誤發生在 **server 端**（未處理的 exception），不是 client 或 port 問題

## 根本原因（最可能）

### 1. **SQLite + 高併發**

目前若未設 `DATABASE_URL`，Backend 使用 **SQLite**（`Backend/Backend/settings.py`）：

- SQLite 同一時間只允許 **單一 writer**
- Locust Stage 1：200 users、spawn 10/s，短時間內大量並發請求
- 並發寫入（login 會寫 `student_profile.last_logged_in`、JWT 等讀寫）容易觸發：
  - `OperationalError: database is locked`
  - 或 timeout 後未處理 → Django 回傳 **500**

因此「約 30 秒後開始 500」符合：spawn 到一定數量後並發寫入壓垮 SQLite。

### 2. 與「port 開太多」無關

- 500 是 **server 內部 exception**（例如 DB 錯誤），不是連線數或 port 限制
- 若為 port 問題，會是 connection refused / timeout，不是 500

## 建議解法

### 方案 A：負載測試改用 PostgreSQL（強烈建議）

與 production 一致，且能承受並發：

1. 啟動本地 Postgres（你已有 `Backend/docker-compose.yml`）：
   ```bash
   cd Backend && docker compose up -d
   ```

2. 在 `Backend/.env` 設定：
   ```env
   DATABASE_URL=postgres://django_user:django_password@127.0.0.1:5432/django_db
   ```

3. 套用 migrations 並跑 seed：
   ```bash
   cd Backend && python manage.py migrate && python manage.py seed_load_test --stage 1
   ```

4. 再跑 Locust（從 repo root）：
   ```bash
   export BASE_URL=http://localhost:8000
   export STAGE=1
   python load_tests/run_stage.py
   ```

### 方案 B：暫時只用 SQLite 時降低負載

若暫時不能改用 Postgres，可**先降壓**驗證是否為 DB 鎖定：

- 減少使用者數與 spawn rate，例如：
  ```bash
  locust -f load_tests/locustfile.py --headless -u 20 -r 2 -t 1m
  ```
- 若 500 明顯減少或消失，可佐證是 SQLite 並發導致

### 方案 C：確認實際 exception（除錯用）

看 Django 跑起來時的 console 輸出，或 Sentry，確認 500 對應的 traceback：

- 若是 `OperationalError: database is locked` 或 `sqlite3.OperationalError`，即為上述原因。

## 小結

| 可能原因           | 說明 |
|--------------------|------|
| SQLite 並發寫入     | 最可能；負載測試請改用 Postgres。 |
| Port / 連線數      | 與 500 無關；500 為 server 內部錯誤。 |
| runserver 能力     | 單 process 在極高 RPS 下也可能不穩，但先解決 DB 較重要。 |

**建議：負載測試一律使用 `DATABASE_URL` 指向 PostgreSQL（本地 docker 或遠端），避免 SQLite。**
