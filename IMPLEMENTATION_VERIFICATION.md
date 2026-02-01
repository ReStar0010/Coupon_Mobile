# Universal Links 實作驗證報告

## ✅ Backend 檢查

### 1. Settings (settings.py)

- ✅ `ALLOWED_HOSTS` 包含 `coupro.pro`、`.coupro.pro`
- ✅ `COUPRO_PUBLIC_BASE_URL = 'https://coupro.pro'`
- ✅ `COUPRO_APP_STORE_ID`、`COUPRO_PLAY_STORE_ID` 環境變數支援
- ✅ `COUPRO_IOS_TEAM_ID`、`COUPRO_ANDROID_SHA256` 環境變數支援
- ✅ `TEMPLATES` 設定 `APP_DIRS: True`（可找到 api/templates/）

### 2. Views (api/views/sharing_views.py)

- ✅ `share_coupon`: 回傳 `share_link_web` 與 `share_link`（向下相容）
- ✅ `collection_landing`: 渲染 HTML fallback 頁面，處理 404（無效 token）
- ✅ `apple_app_site_association`: 回傳 AASA JSON，空 team_id 時優雅降級
- ✅ `assetlinks_json`: 回傳 assetlinks JSON，空 SHA256 時優雅降級
- ✅ 所有 imports 正確（json, HttpResponse, render）

### 3. URLs (Backend/urls.py)

- ✅ `/collection/<token>/` → collection_landing
- ✅ `/c/<token>/` → collection_landing（短網址）
- ✅ `/.well-known/apple-app-site-association` → apple_app_site_association
- ✅ `/.well-known/assetlinks.json` → assetlinks_json
- ✅ 所有 views 正確 import

### 4. Template (api/templates/collection_landing.html)

- ✅ Django 模板語法正確
- ✅ Smart App Banner（iOS）：`{% if app_store_id %}` 條件渲染
- ✅ Open Graph meta tags
- ✅ JavaScript：嘗試 `CouPro://Collection?token=xxx`，2.5 秒後 fallback 到商店
- ✅ 使用者代理偵測（iOS vs Android）

---

## ✅ Frontend 檢查

### 1. 分享邏輯 (EasyUse/[id]/index.tsx)

- ✅ `handleLinkShare`: 優先使用 `share_link_web ?? share_link`
- ✅ 錯誤處理與中文提示
- ✅ Loading 狀態管理

### 2. 分享 Modal (EasyUse/[id]/components/ShareModal.tsx)

- ✅ Import `expo-clipboard`、`Link` icon
- ✅ `handleNativeLinkShare`: 使用系統分享面板
- ✅ `handleCopyWebLink`: 複製連結到剪貼簿
- ✅ 「複製網頁連結」按鈕：使用 https 連結
- ✅ Loading 與 disabled 狀態處理

### 3. Collection 工具 (Collection/utils/couponUtils.ts)

- ✅ `generateShareLink`: 優先使用 `share_link_web ?? share_link ?? null`

### 4. App 設定 (app.json)

- ✅ `ios.associatedDomains: ["applinks:coupro.pro"]`
- ✅ Bundle ID: `com.cokayne.MobileFrontend`

---

## ✅ 資料流驗證

### 流程 1: 用戶分享優惠券

1. **Frontend**: 用戶點擊「分享連結」或「複製網頁連結」
2. **API 請求**: `POST /api/coupon/{id}/share/`
3. **Backend 回應**:
   ```json
   {
     "share_link": "CouPro://Collection?token=xxxxx",
     "share_link_web": "https://coupro.pro/collection/xxxxx",
     "token": "xxxxx"
   }
   ```
4. **Frontend 處理**:
   - 取得 `share_link_web`（優先）或 `share_link`（fallback）
   - 「分享連結」: 開啟系統分享面板，傳遞 https URL
   - 「複製網頁連結」: 複製 https URL 到剪貼簿

### 流程 2A: 收件者開啟連結（已安裝 App + Universal Links 已設定）

1. **用戶點擊**: `https://coupro.pro/collection/xxxxx`
2. **系統驗證**:
   - iOS: 讀取 `/.well-known/apple-app-site-association`
   - Android: 讀取 `/.well-known/assetlinks.json`
3. **系統行為**: 直接開啟 App（不經過瀏覽器）
4. **App 處理**:
   - Expo Linking API 接收 URL
   - 解析 token，導向 `/Collection?token=xxxxx`
   - Gift.tsx 顯示領取 UI

### 流程 2B: 收件者開啟連結（未安裝 App 或 Universal Links 未設定）

1. **用戶點擊**: `https://coupro.pro/collection/xxxxx`
2. **瀏覽器開啟**: Backend 渲染 collection_landing.html
3. **頁面行為**:
   - iOS: 顯示 Smart App Banner（如有設定 APP_STORE_ID）
   - 顯示「在 App 中開啟」按鈕
   - 點擊時嘗試 `CouPro://Collection?token=xxxxx`
   - 2.5 秒後 fallback 到 App Store（iOS）或 Play Store（Android）

---

## ✅ 錯誤處理

### Backend

- ✅ 無效 token: `get_object_or_404` 回傳 404
- ✅ 空環境變數: 優雅降級（AASA/assetlinks 回傳空陣列）
- ✅ 非 exclusive coupon: share_coupon 回傳 403

### Frontend

- ✅ API 錯誤: 顯示中文錯誤訊息
- ✅ 無法生成連結: Alert 提示用戶
- ✅ 複製失敗: Alert 提示用戶

---

## ✅ 向下相容性

- ✅ Backend 仍回傳 `share_link`（CouPro:// scheme）
- ✅ Frontend 使用 nullish coalescing（`??`）fallback
- ✅ 舊版 App 可繼續使用 `share_link`
- ✅ 新版 App 優先使用 `share_link_web`

---

## ✅ Linter 檢查

- ✅ Backend: 無 Python linter 錯誤
- ✅ Frontend: 無 TypeScript linter 錯誤
- ✅ 所有 imports 正確
- ✅ 語法正確

---

## ⚠️ 部署前檢查清單

### 必須在正式環境完成：

1. **Apple Developer**:
   - 取得 Team ID → 設定 `COUPRO_IOS_TEAM_ID`
   - App 上架後取得 App Store ID → 設定 `COUPRO_APP_STORE_ID`
2. **Android Signing**:
   - 用上架 keystore 產生 SHA256 fingerprint:
     ```bash
     keytool -list -v -keystore release.keystore -alias key
     ```
   - 設定 `COUPRO_ANDROID_SHA256`（多個用逗號分隔）

3. **Android Manifest**:
   - 在 `AndroidManifest.xml` 或 Expo config plugin 加入 intent-filter：
     ```xml
     <intent-filter android:autoVerify="true">
       <action android:name="android.intent.action.VIEW" />
       <category android:name="android.intent.category.DEFAULT" />
       <category android:name="android.intent.category.BROWSABLE" />
       <data android:scheme="https" android:host="coupro.pro"
             android:pathPrefix="/collection" />
       <data android:scheme="https" android:host="coupro.pro"
             android:pathPrefix="/c" />
     </intent-filter>
     ```

4. **網域設定**:
   - 確保 `https://coupro.pro` 指向此 Django 專案
   - 或設定反向代理將 `/collection/`, `/c/`, `/.well-known/` 導向此專案
   - 確認 HTTPS 憑證有效

5. **Expo Build**:
   - 使用 `expo prebuild` 或 `eas build`
   - 確認 app.json 的 `associatedDomains` 與 Android intent-filter 正確
   - 重新建置並上傳到商店

### 測試步驟：

1. 在 TestFlight（iOS）或內部測試（Android）部署
2. 訪問 `https://coupro.pro/.well-known/apple-app-site-association`
3. 訪問 `https://coupro.pro/.well-known/assetlinks.json`
4. 用實體裝置測試分享連結：
   - 複製連結到訊息，確認可點擊
   - 點擊連結，確認開啟 App（已安裝）或 fallback 頁（未安裝）

---

## ✅ 結論

所有程式變更已完成並通過驗證：

- ✅ Backend API、Views、URLs、Template 邏輯正確
- ✅ Frontend 分享邏輯、UI、State 管理正確
- ✅ 錯誤處理與向下相容
- ✅ 無語法錯誤
- ✅ 文件齊全（docs/UNIVERSAL_LINKS.md）

**系統已準備好使用 Universal Links，待正式環境設定 Team ID、SHA256、App Store ID 後即可完整運作。**
