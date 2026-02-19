# Universal Links 設定說明

分享連結已從自訂 scheme `CouPro://Collection?token=xxx` 改為 Universal Link  
`https://coupro.pro/collection/<token>`，以解決：

- 複製貼上到訊息後連結可被點擊
- 未安裝 App 時可導向網頁 fallback 或商店

## 已實作項目

### Backend (Django)

- **分享 API**：`POST /api/coupon/<id>/share/` 回傳 `share_link_web`（https）與 `share_link`（CouPro://）
- **網頁 fallback**：
  - `https://coupro.pro/collection/<token>/` 或 `https://coupro.pro/c/<token>/`
  - 內含：Smart App Banner（iOS）、Open Graph、JS 嘗試開啟 App 後 fallback 至商店
- **`.well-known`**（用於 iOS/Android 驗證）：
  - `https://coupro.pro/.well-known/apple-app-site-association`
  - `https://coupro.pro/.well-known/assetlinks.json`

### 環境變數 (Backend)

| 變數                    | 說明                                                 | 預設                         |
| ----------------------- | ---------------------------------------------------- | ---------------------------- |
| `FRONTEND_URL`          | 對外分享網域                                         | `https://coupro.pro`         |
| `COUPRO_APP_STORE_ID`   | iOS App Store app id（Smart Banner / fallback 連結） | 空                           |
| `COUPRO_PLAY_STORE_ID`  | Android package（fallback 連結）                     | `com.cokayne.MobileFrontend` |
| `COUPRO_IOS_TEAM_ID`    | Apple Team ID（AASA 用）                             | 需在正式環境設定             |
| `COUPRO_ANDROID_SHA256` | 簽署 APK/AAB 的 SHA256 fingerprint（assetlinks 用）  | 需在正式環境設定             |

### 前端 (Expo)

- 分享時優先使用 `share_link_web`（https），「分享連結」與「複製網頁連結」皆為可點擊的 https 連結
- `app.json` 已設定 `ios.associatedDomains: ["applinks:coupro.pro"]`

---

## iOS Universal Links 完整設定

### 1. 網域與 AASA

- 網域需指向提供 fallback 頁與 AASA 的服務（例如本 Backend）。
- AASA 由 Backend 動態提供：  
  `GET https://coupro.pro/.well-known/apple-app-site-association`  
  （無副檔名、Content-Type 建議 `application/json`）

### 2. Xcode / Expo 設定

- **Associated Domains**：在 Expo 已設為 `applinks:coupro.pro`（見 `app.json`）。
- 若使用 bare workflow 或原生專案，在 Xcode 的 Signing & Capabilities 新增 **Associated Domains**，並加入：  
  `applinks:coupro.pro`

### 3. 處理開啟連結 (Expo Router)

- 使用 `expo-linking`：`Linking.getInitialURL()` / `Linking.addEventListener('url', ...)` 可取得 `https://coupro.pro/collection/<token>`。
- 解析 URL 取得 `token`，導向對應畫面（例如 `/Collection?token=<token>` 或 Gift 領取流程）。

---

## Android App Links 完整設定

### 1. 網域與 assetlinks.json

- 同網域需提供：  
  `GET https://coupro.pro/.well-known/assetlinks.json`
- 內容需包含正確的 `package_name` 與簽署憑證的 **SHA256 fingerprint**。  
  Fingerprint 由 Backend 設定讀取 `COUPRO_ANDROID_SHA256` 產生。

### 2. AndroidManifest (Expo / prebuild)

- 在 `app.json` 的 `expo.plugins` 或原生 `AndroidManifest.xml` 中，為主要 Activity 加上 intent-filter，例如：

```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="https" android:host="coupro.pro" android:pathPrefix="/collection" />
  <data android:scheme="https" android:host="coupro.pro" android:pathPrefix="/c" />
</intent-filter>
```

- 若用 Expo config plugin，可透過 `expo-build-properties` 或自訂 plugin 寫入上述 `intent-filter`，並設定 `android:autoVerify="true"`。

### 3. 處理開啟連結

- 同上，用 `expo-linking` 取得 `https://coupro.pro/collection/<token>`，解析 `token` 並導向 App 內對應頁面。

---

## 部署注意事項

1. **HTTPS**：`coupro.pro` 必須使用 HTTPS，否則 Universal / App Links 驗證會失敗。
2. **AASA**：
   - 不可加 `.json` 副檔名。
   - 回傳建議為 `Content-Type: application/json`。
   - Apple 會緩存，修改後可能需數小時生效。
3. **assetlinks.json**：
   - 必須對應上架/簽署用 keystore 的 SHA256 fingerprint。
   - 可透過 [Statement List Generator](https://developers.google.com/digital-asset-links/tools/generator) 檢查格式。
4. **開發 / 測試**：
   - 本機或非 coupro.pro 網域無法完成系統驗證，需在正式網域上測試。
   - 可用開發 build 在實機搭配正式網域驗證。

完成上述設定後，  
`https://coupro.pro/collection/<token>` 在已安裝 App 時會由系統直接開啟 App，未安裝時則會開啟網頁 fallback（再導向商店）。
