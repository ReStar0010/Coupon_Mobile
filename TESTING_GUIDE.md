# Universal Links 測試指南

## 本機開發測試

### 1. 啟動 Backend（Django）

```bash
cd Backend
# Windows
.venv\Scripts\activate
# Unix/macOS
source .venv/bin/activate

python manage.py runserver
```

### 2. 測試 API 端點

#### 測試分享 API（需要登入 token）

```bash
curl -X POST http://localhost:8000/api/coupon/123/share/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

預期回應：

```json
{
  "share_link": "CouPro://Collection?token=...",
  "share_link_web": "https://coupro.pro/collection/...",
  "token": "..."
}
```

#### 測試 AASA（無需登入）

```bash
curl http://localhost:8000/.well-known/apple-app-site-association
```

預期回應（COUPRO_IOS_TEAM_ID 未設定時）：

```json
{
  "applinks": {
    "apps": [],
    "details": []
  }
}
```

預期回應（COUPRO_IOS_TEAM_ID 已設定為 "ABC123XYZ"）：

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "ABC123XYZ.com.cokayne.MobileFrontend",
        "paths": ["/collection/*", "/c/*"]
      }
    ]
  }
}
```

#### 測試 assetlinks（無需登入）

```bash
curl http://localhost:8000/.well-known/assetlinks.json
```

預期回應（COUPRO_ANDROID_SHA256 未設定時）：

```json
[]
```

預期回應（COUPRO_ANDROID_SHA256 已設定）：

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.cokayne.MobileFrontend",
      "sha256_cert_fingerprints": ["AA:BB:CC:..."]
    }
  }
]
```

#### 測試 fallback 頁面

瀏覽器開啟（使用有效的 token）：

```
http://localhost:8000/collection/YOUR_TEST_TOKEN
```

應該看到：

- 標題「CouPro 優惠分享」
- 描述文字（含優惠券名稱）
- 「在 App 中開啟」按鈕
- App Store / Google Play 下載連結

點擊「在 App 中開啟」會嘗試開啟 `CouPro://Collection?token=...`

### 3. 前端測試（Expo）

```bash
cd Mobile-Frontend
npx expo start
```

在 App 中測試：

1. 登入帳號
2. 進入專屬優惠（Collection）
3. 選擇一個優惠券，點擊「分享」
4. 測試三個按鈕：
   - **分享到 CouPro**: 開啟系統分享面板（測試是否為 https URL）
   - **分享連結**: 開啟系統分享面板（測試是否為 https URL）
   - **複製網頁連結**: 複製到剪貼簿（貼到訊息 app，確認可點擊）

5. 將複製的連結貼到記事本或訊息 app：
   - ✅ 應該是 `https://coupro.pro/collection/...`（而非 `CouPro://...`）
   - ✅ 應該可被點擊（在訊息 app 中會顯示為藍色連結）

---

## 正式環境測試（部署後）

### 前置條件

1. ✅ Backend 部署到 `https://coupro.pro`（或設定反向代理）
2. ✅ 設定環境變數：
   - `COUPRO_IOS_TEAM_ID`（Apple Developer Team ID）
   - `COUPRO_APP_STORE_ID`（App Store app id，上架後）
   - `COUPRO_ANDROID_SHA256`（簽署 keystore 的 SHA256）
3. ✅ App 已透過 Expo/EAS build 並包含：
   - iOS: Associated Domains entitlement
   - Android: intent-filter with autoVerify
4. ✅ App 已上傳到 TestFlight（iOS）或內部測試（Android）

### 測試步驟

#### 步驟 1: 驗證 .well-known 檔案

```bash
# AASA（iOS）
curl https://coupro.pro/.well-known/apple-app-site-association

# 確認：
# 1. 回傳 JSON（非 404）
# 2. appID 格式為 "TEAM_ID.BUNDLE_ID"
# 3. paths 包含 "/collection/*" 和 "/c/*"
```

```bash
# assetlinks（Android）
curl https://coupro.pro/.well-known/assetlinks.json

# 確認：
# 1. 回傳 JSON array（非空）
# 2. package_name 為 "com.cokayne.MobileFrontend"
# 3. sha256_cert_fingerprints 包含正確的 SHA256
```

#### 步驟 2: 驗證 Apple 的 AASA 驗證

訪問（在瀏覽器）：

```
https://app-site-association.cdn-apple.com/a/v1/coupro.pro
```

或使用工具：

```
https://search.developer.apple.com/appsearch-validation-tool/
```

輸入 `coupro.pro`，確認 Apple 已成功抓取並驗證 AASA。

#### 步驟 3: 驗證 Android 的 assetlinks

使用 Google 的工具：

```
https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://coupro.pro&relation=delegate_permission/common.handle_all_urls
```

確認回傳的 JSON 包含你的 App。

#### 步驟 4: 實機測試（已安裝 App）

1. 在 **裝置 A**（已安裝 TestFlight/內部測試 App）登入
2. 分享一個優惠券，複製網頁連結
3. 將連結貼到 **裝置 B**（同一台或另一台已安裝 App）的訊息 app
4. 點擊連結

**預期行為**：

- ✅ **直接開啟 App**（不經過瀏覽器）
- ✅ App 顯示 Gift 領取畫面
- ✅ 可以領取優惠券

**如果開啟瀏覽器而非 App**：

- 檢查 AASA/assetlinks 是否正確
- 檢查 App 的 Associated Domains / intent-filter 設定
- iOS: 嘗試刪除 App 重裝（系統會重新驗證）
- Android: 確認 `android:autoVerify="true"` 已設定

#### 步驟 5: 實機測試（未安裝 App）

1. 在 **裝置 C**（未安裝 App）開啟同一個連結

**預期行為**：

- ✅ 開啟瀏覽器，顯示 fallback 頁面
- ✅ iOS 顯示 Smart App Banner（如已設定 APP_STORE_ID）
- ✅ 點擊「在 App 中開啟」無反應（因未安裝）
- ✅ 2.5 秒後自動跳轉到 App Store / Google Play
- ✅ 或手動點擊下方的商店連結

---

## 常見問題排查

### 問題：連結貼到訊息後無法點擊

**可能原因**：前端回傳的是 `CouPro://` 而非 `https://`
**檢查**：

```javascript
// Mobile-Frontend/app/EasyUse/[id]/index.tsx
// 確認 handleLinkShare 優先使用 share_link_web
const link = webLink ?? schemeLink;
```

### 問題：點擊連結開啟瀏覽器而非 App

**可能原因**：Universal Links 未正確設定
**檢查**：

1. AASA/assetlinks 是否可訪問（200 OK）
2. Team ID / SHA256 是否正確
3. App 是否包含 Associated Domains / intent-filter
4. iOS: 在 Settings → Safari → Advanced → Website Data 清除 coupro.pro 的快取

### 問題：AASA 回傳空 details

**可能原因**：`COUPRO_IOS_TEAM_ID` 未設定
**解決**：設定環境變數，重啟 Django

### 問題：assetlinks 回傳空陣列

**可能原因**：`COUPRO_ANDROID_SHA256` 未設定
**解決**：設定環境變數（可設定多個，逗號分隔），重啟 Django

### 問題：fallback 頁面的 Smart App Banner 未顯示

**可能原因**：

1. `COUPRO_APP_STORE_ID` 未設定
2. 非 iOS Safari 瀏覽器（Smart App Banner 只在 Safari 有效）

---

## 測試檢查清單

### 本機開發

- [ ] Backend API 正常啟動
- [ ] POST `/api/coupon/<id>/share/` 回傳 `share_link_web`
- [ ] GET `/.well-known/apple-app-site-association` 回傳 JSON
- [ ] GET `/.well-known/assetlinks.json` 回傳 JSON
- [ ] GET `/collection/<token>` 顯示 fallback 頁面
- [ ] 前端「複製網頁連結」複製 https URL
- [ ] 複製的連結在訊息 app 可點擊

### 正式環境（部署後）

- [ ] `https://coupro.pro/.well-known/apple-app-site-association` 可訪問
- [ ] `https://coupro.pro/.well-known/assetlinks.json` 可訪問
- [ ] Apple 已驗證 AASA（使用驗證工具）
- [ ] Google 已驗證 assetlinks（使用 API 查詢）
- [ ] 已安裝 App：點擊連結直接開啟 App
- [ ] 未安裝 App：點擊連結開啟 fallback 頁面
- [ ] Fallback 頁面的「在 App 中開啟」按鈕運作
- [ ] Fallback 頁面的商店連結正確

---

## 環境變數範例

### 開發環境（.env）

```bash
FRONTEND_URL=http://localhost:8000
COUPRO_IOS_TEAM_ID=
COUPRO_APP_STORE_ID=
COUPRO_ANDROID_SHA256=
```

### 正式環境（.env.production）

```bash
FRONTEND_URL=https://coupro.pro
COUPRO_IOS_TEAM_ID=ABC123XYZ
COUPRO_APP_STORE_ID=1234567890
COUPRO_ANDROID_SHA256=AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99
```
