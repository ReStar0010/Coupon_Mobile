# Frontend Landscape

Last updated: 2026-05-14
Source of truth: `Mobile-Frontend/` on branch `refactor/frontend`.

---

## 1. Stack

| Concern | Choice |
|---|---|
| Framework | Expo ~54.0.34 (RN 0.81.5, React 19.1) |
| Language | TypeScript strict |
| Routing | Expo Router 6 (file-based, under `app/`) |
| State | React Context + hooks (`AuthContext`, `WalletContext`) |
| HTTP | axios (`src/services/api/client.ts`) with JWT bearer + refresh interceptor |
| WS | Native `WebSocket` via `coopClient.ts` |
| Animations | react-native-reanimated ~4.1 |
| Storage | `expo-secure-store` token store (`services/auth/tokenStore.ts`) |
| Camera | `expo-camera` (`CameraView`, QR scanning) |
| Errors | `@sentry/react-native` |
| Analytics | `@react-native-firebase/analytics` |
| Theme | Custom neo-brutalism tokens in `src/theme/` |

`EXPO_PUBLIC_API_URL` (default `https://api.coupro.pro`) configures the axios `baseURL` and is reused for the WS URL via `replace(/^http/, 'ws')`.

---

## 2. Router map (`app/`)

```
app/
├── _layout.tsx                 RootLayout: Sentry, FontProvider, AuthProvider, WalletProvider, Stack
├── index.tsx                   Redirect → /(tabs)/home  ← DEV BYPASS (skips auth)
├── (auth)/
│   ├── _layout.tsx
│   ├── login.tsx
│   ├── register.tsx
│   └── otp.tsx
├── (tabs)/
│   ├── _layout.tsx             Slot + TabBar (home, map, spinner). Settings is also a tab destination but currently lacks its own pill.
│   ├── home.tsx                → src/features/home/HomeScreen
│   ├── map.tsx                 → src/features/map/MapScreen
│   ├── spinner.tsx             → src/features/spinner/SpinnerScreen
│   └── settings.tsx            → src/features/settings/SettingsScreen
├── coupon/
│   ├── [id].tsx                → src/features/coupon/CouponDetailScreen
│   ├── share.tsx               → src/features/coupon/CouponShareScreen
│   ├── qr.tsx                  → src/features/coupon/CouponUseQRScreen
│   └── receive.tsx             → src/features/coupon/CouponReceiveQRScreen   (NEW)
└── coupoint/
    ├── use.tsx                 → src/features/coupoint/CouPointUseScreen
    └── history/
        ├── index.tsx           → src/features/home/HistoryScreen
        └── [id].tsx            → src/features/home/HistoryDetailScreen
```

⚠️ `app/index.tsx` is currently `<Redirect href="/(tabs)/home" />` regardless of auth status (commented `DEV BYPASS: skip auth — revert before commit`). The real gate is `useAuth().isAuthenticated` and must be restored before any backend wiring is meaningful.

---

## 3. API client modules (`src/services/api/`)

All exported functions and the endpoints they call:

### 3.1 `client.ts`
- `apiClient` (axios) with `baseURL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.coupro.pro'`
- Request interceptor injects `Authorization: Bearer <access>` from `tokenStore`.
- Response interceptor: on 401, coalesces a single in-flight refresh, retries the original request, redirects to `/(auth)/login` on terminal failure.

### 3.2 `auth.ts`
| Function | Method + path | Body | Response |
|---|---|---|---|
| `login(email?, phone?, password)` | POST `/api/auth/login/` | `{email, phone, password}` | `{access, refresh, user}` |
| `register(data)` | POST `/api/auth/register/` | `{email?, phone?, password, displayName?}` | `LoginResponse` |
| `refreshToken(refresh)` | POST `/api/auth/token/refresh/` | `{refresh}` | `{access, refresh}` |
| `requestOtp(phone)` | POST `/api/auth/otp/send/` | `{phone}` | `{detail}` |
| `verifyOtp(phone, code)` | POST `/api/auth/otp/verify/` | `{phone, code}` | `{access, refresh, user}` |
| `logout()` | POST `/api/auth/logout/` | — | always clears local tokens |

### 3.3 `profile.ts`
| Function | Method + path | Notes |
|---|---|---|
| `getProfile()` | GET `/api/profile/` | Expects `{id, email, phone?, displayName?, avatarUrl?, phoneVerified}` |
| `updateProfile(data)` | PATCH `/api/profile/` | |
| `deleteAccount()` | DELETE `/api/profile/` | |
| `submitFeedback(message, rating?)` | POST `/api/feedback/` | Body `{message, rating?}` |
| `getWallet()` | GET `/api/wallet/` | Expects `{gems, couPoints}` |

### 3.4 `coupons.ts`
| Function | Method + path | Notes |
|---|---|---|
| `listMyCoupons()` | GET `/api/coupons/` | Expects array of `Coupon` |
| `getCoupon(id)` | GET `/api/coupons/{id}/` | |
| `redeemCoupon(id)` | POST `/api/coupons/{id}/redeem/` | |
| `shareCoupon(id, phone)` | POST `/api/coupons/{id}/share/` | Body `{recipientPhone}` |

FE `Coupon` shape: `{id: string, store: string, detail: string, expires: string ('11/08'), amount: number, status: 'active'|'redeemed'|'expired'|'shared', tier: 'bronze'|'silver'|'gold'}`.

### 3.5 `merchants.ts`
| Function | Method + path | Notes |
|---|---|---|
| `listNearby(lat, lng, radius?)` | GET `/api/merchants/nearby/?lat&lng&radius` | |
| `getMerchant(id)` | GET `/api/merchants/{id}/` | |
| `flagMerchant(id, reason)` | POST `/api/merchants/{id}/flag/` | |
| `blockMerchant(id)` | POST `/api/merchants/{id}/block/` | |
| `getBlockedMerchants()` | GET `/api/merchants/blocked/` | |
| `unblockMerchant(id)` | DELETE `/api/merchants/{id}/block/` | |

FE `Merchant` shape: `{id: string, name, category, lat, lng, address, verified: boolean, logoUrl?}`.

### 3.6 `spinner.ts`
| Function | Method + path | Body | Response |
|---|---|---|---|
| `drawCoupon(gems)` | POST `/api/spinner/draw/` | `{gems}` | `{coupon, pointsEarned}` |
| `getSpinnerState()` | GET `/api/spinner/` | — | `{gems, multiplier}` |

### 3.7 `errors.ts`
Normalizes axios errors to `ApiError` with status, code, message, fieldErrors.

---

## 4. State (`src/state/`)

### 4.1 `AuthContext.tsx`
- `useAuth()` exposes `{user, isLoading, isAuthenticated, login, register, logout, refreshProfile}`.
- On mount: reads token from `tokenStore`; if present, calls `getProfile()` to hydrate.
- `login(email, password)` → `apiLogin` → `setTokens` → `getProfile` → `router.replace('/(tabs)/home')`.

### 4.2 `WalletContext.tsx`
- `useWallet()` exposes `{gems, couPoints, coupons, isLoading, refreshWallet, spendGems, addPoints, setGemsLocal, setCouPointsLocal}`.
- On `isAuthenticated` true: calls `Promise.all([getWallet(), listMyCoupons()])`.
- `spendGems / addPoints / setGemsLocal / setCouPointsLocal` are **local-only setters** — they never POST. The server has no idea.

These two contexts are the **only** components currently calling the API.

---

## 5. Feature inventory (what each screen does, what it consumes, what's mocked)

| Screen | File | API used | Mock data / local state |
|---|---|---|---|
| Login | `src/features/...` (not yet inspected) | `auth.login` | |
| Register / OTP | `(auth)/register, otp` | `auth.register`, `auth.requestOtp`, `auth.verifyOtp` | |
| Home | `home/HomeScreen.tsx` | none | `SAMPLE_COUPONS` (4 entries hard-coded). Reads gems/couPoints from WalletContext (real) but the coupon list is fake. |
| CouPointsCard | `home/CouPointsCard.tsx` | none | Reads couPoints from WalletContext. |
| DrawModal | `home/DrawModal.tsx` | none | Local probability stub. |
| RedeemModal | `home/RedeemModal.tsx` | none | Local stub. |
| HistoryScreen | `home/HistoryScreen.tsx` | none | `HISTORY_DATA` (7 hard-coded entries in `historyData.ts`). |
| HistoryDetailScreen | `home/HistoryDetailScreen.tsx` | none | Reads from same `HISTORY_DATA`. |
| MapScreen | `map/MapScreen.tsx` | none | `SAMPLE_MERCHANTS` (6 hard-coded merchants with embedded `myCoupons`, `sharedCoupons`, `news`). |
| MerchantSheet | `map/MerchantSheet.tsx` | none | Renders `MapMerchant.myCoupons / sharedCoupons / news` props (all mocked above). |
| SharedCouponModal | `map/SharedCouponModal.tsx` | none | The legacy auto-popup; queued for replacement by pin-tap sheet flow. |
| FlagStoreModal | `map/FlagStoreModal.tsx` | none | Should call `flagMerchant` (or moderation `report`). |
| BlockStoreModal | `map/BlockStoreModal.tsx` | none | Should call `blockMerchant`. |
| SpinnerScreen | `spinner/SpinnerScreen.tsx` | none | Reads gems/couPoints from WalletContext; runs `useSpinLogic` which is **fully client-RNG**. |
| useSpinLogic | `spinner/useSpinLogic.ts` | none | Rolls multiplier via `Math.random()`, decrements gems locally, credits couPoints locally. Triggers meltdown bonus on multiplier=5. **Currency mutations never persist.** |
| WheelDial / MeltdownWheel / MeltdownOverlay / ResultModal | `spinner/*.tsx` | none | Pure animation. |
| CoopQRModal | `spinner/CoopQRModal.tsx` | none | Invite UI for the coop room. |
| CoopRoomScreen | `spinner/coop/CoopRoomScreen.tsx` | WS `/ws/spinner/v1/` | Real. Uses `useCoopRoom` → `coopClient` → `coopReducer`. Server-authoritative. |
| CouponDetailScreen | `coupon/CouponDetailScreen.tsx` | none | Reads navigation params; renders ticket. No `getCoupon(id)` call. |
| CouponUseQRScreen | `coupon/CouponUseQRScreen.tsx` | none | Camera scaffold; `handleScan` flips a flag and `setGems((g) => g + 1)` locally. No `redeemCoupon` call. |
| CouponShareScreen | `coupon/CouponShareScreen.tsx` | none | Local target selector; `handleConfirm` `setGems((g) => g + 1)` locally. No `shareCoupon` call. |
| CouponReceiveQRScreen | `coupon/CouponReceiveQRScreen.tsx` | none (NEW) | Pure stub. `handleScan` just `setSuccess(true)`. |
| CouPointUseScreen | `coupoint/CouPointUseScreen.tsx` | none | Scan → amount picker (multiples of 5) → "success" with no server call. |
| SettingsScreen | `settings/SettingsScreen.tsx` | none | Profile fields are local component state with hard-coded defaults (`CoKayne`, `duankayne@gmail.com`, `+886 912-345-678`). |
| EditProfileModal | `settings/modals/EditProfileModal.tsx` | none | Should call `updateProfile`. |
| DeleteAccountModal | `settings/modals/DeleteAccountModal.tsx` | none | Should call `deleteAccount`. |
| FeedbackModal | `settings/modals/FeedbackModal.tsx` | none | `handleSend` just `setSent(true)` — never POSTs. |
| BlockedMerchantsModal | `settings/modals/BlockedMerchantsModal.tsx` | none | Should call `getBlockedMerchants` / `unblockMerchant`. |
| VerifyModal | `settings/modals/VerifyModal.tsx` | none | Phone OTP UI. Should call `requestOtp` / `verifyOtp`. |
| LegalTextModal | `settings/modals/LegalTextModal.tsx` | none | Should hit `/api/terms/`, `/api/privacy-policy/`, `/api/content-guidelines/`. |
| LogoutConfirmModal | `settings/modals/LogoutConfirmModal.tsx` | none | Should call `useAuth().logout()`. |

---

## 6. Hidden frontend economy (currently client-only)

The FE encodes a CouGem + CouPoint loop that **the backend has no way to know about**:

| Action | What FE does locally |
|---|---|
| Use a coupon (`CouponUseQRScreen.handleScan`) | `setGems((g) => g + 1)` |
| Share a coupon (`CouponShareScreen.handleConfirm`) | `setGems((g) => g + 1)` |
| Solo spinner spin (`useSpinLogic.handleSpin`) | `setGems((prev) => prev - 1)`, rolls multiplier 0..5 via `Math.random()` weighted 1/(v+1), `setCouPoints((p) => p + earnedPts)` where `earnedPts = gemsUsed × mult` |
| 5× meltdown bonus | Rolls `MELT_MULTS` (`2×@47.5%`, `3×@47.5%`, `5×@5%`), credits `couPoints += earnedPts × (meltMult − 1)` |
| Use CouPoints (`CouPointUseScreen`) | Picks amount in steps of 5, shows success — but **no spend mutation** |

The next time `refreshWallet()` runs, every one of those local mutations is **silently overwritten** by the server's view of `Wallet`. This is the single biggest correctness gap.

---

## 7. Mismatches between FE and BE contract

| FE expects | BE reality | Severity |
|---|---|---|
| `Coupon` shape: `id: string`, `expires: '11/08'`, `tier: bronze/silver/gold`, `status` enum | BE `Coupon` model has `id: int`, `expiry_date: datetime`, no `tier`, status implicit | HIGH — needs serializer projection |
| `GET /api/coupons/` (list mine) | Doesn't exist | HIGH |
| `POST /api/coupons/{id}/redeem/` body `{}` | BE `/api/redeem/<id>/` requires `redeem_code` | HIGH path + body |
| `POST /api/coupons/{id}/share/` body `{recipientPhone}` | BE `/api/coupon/<id>/share/` — confirm body shape | MEDIUM |
| `GET /api/merchants/nearby/` | Doesn't exist | HIGH |
| `GET /api/merchants/{id}/` | Doesn't exist | HIGH |
| `POST /api/merchants/{id}/flag/` `{reason}` | BE `/api/content/<type>/<id>/report/` `{reason, details?}` | MEDIUM |
| `POST /api/merchants/{id}/block/` no body | BE `/api/user/blocked-merchants/add/` body `{store_id}` | MEDIUM |
| `GET /api/merchants/blocked/` array of `Merchant` | BE returns `[{id, store: {id, name, address, image_url}, created_at}]` | MEDIUM shape |
| `DELETE /api/merchants/{id}/block/` | BE `DELETE /api/user/blocked-merchants/<store_id>/` | MEDIUM path |
| `GET /api/profile/` `{id, email, phone?, displayName?, avatarUrl?, phoneVerified}` | BE `/api/user-info/` `{id, email, verified, is_merchant, merchant_profile?, store?}` | HIGH shape |
| `PATCH /api/profile/` | Split across `/api/user/phone/` + `/api/email-settings/send-verification/` + (no display_name endpoint) | HIGH |
| `DELETE /api/profile/` | BE `/api/account/delete/` with pre-check requirement | MEDIUM |
| `GET /api/wallet/` `{gems, couPoints}` | Doesn't exist (`Wallet` model exists though) | HIGH |
| `POST /api/feedback/` `{message, rating?}` | BE `{feedback_type ∈ bug/feature, details}` | HIGH shape |
| `POST /api/spinner/draw/` `{gems}` | Doesn't exist (only `/api/coupon/daily-draw/` for templates) | HIGH |
| `GET /api/spinner/` | Doesn't exist | HIGH |
| `POST /api/auth/otp/send/` `{phone}` | BE `/api/phone-otp/send/` (different path) | LOW path |
| `POST /api/auth/otp/verify/` | BE `/api/phone-otp/verify/` | LOW path |

---

## 8. What the frontend is missing from itself

- `CouPointUseScreen` has no service module to call (would need `coupoint.ts`).
- No `coupoint/history` service — `HistoryScreen` and `HistoryDetailScreen` consume `HISTORY_DATA` only.
- No `merchantSheet` service to fetch `myCoupons / sharedCoupons / news` for a specific merchant.
- No `coupon/receive` service for the scan-to-receive flow.
- No `reports` service for `flagMerchant` (it exists but the path doesn't match BE).
- `LegalTextModal` has no service module to fetch `/api/terms/` etc.
- `auth.ts` has no `forgotPassword` / `resetPassword` / `requestEmailVerification` functions.
- No coop-room **discovery / invite-link** endpoint use (today the room ID/short code are exchanged via in-app only).

---

## 9. What the frontend is missing from the backend (already-existing endpoints not yet wired)

- `/api/progress-trackers/` — the home screen would benefit (sharing lights, referral lights).
- `/api/user-statistics/` — for SettingsScreen savings summary.
- `/api/set-savings-goal/`, `/api/completed-goals/`, `/api/add-completed-goal/`, `/api/reset-savings-goal/`.
- `/api/coupon-history/` — could back HistoryScreen for coupon redemptions.
- `/api/store-coupons/` — public-pool & store-type coupons for HomeScreen (when consumer has none of their own).
- `/api/exclusive-coupons/` — drawable coupons for DrawModal.
- `/api/tags/` — for filter / categorization UI.
- `/api/unified-redemption/{code}/` — alternative redemption path.
- `/api/last-draw/` — for "next free draw" UI.
- `/api/content/{type}/{id}/report/` — backing the flag flow.
- `/api/user/blocked-merchants/*` — backing block UX.
- `/api/content-guidelines/`, `/api/privacy-policy/`, `/api/terms/` — backing `LegalTextModal`.
- `/api/account/pre-delete-check/` — backing the delete confirmation copy.

---

## 10. Testing posture

- Jest tests exist for every service module (`__tests__/auth.test.ts`, `coupons.test.ts`, `merchants.test.ts`, `profile.test.ts`, `spinner.test.ts`, `client.test.ts`).
- Screen tests exist for major surfaces (Home, Map, Spinner, Settings, Coupon*, MerchantSheet, modals). They mock the service modules and assert UI behavior — they will keep passing even when the service modules call non-existent endpoints, so a green test suite does NOT prove integration.
- E2E: Maestro flows mentioned in the most recent commit but not directly inspected here.

---

## 11. Build & dev commands (from CLAUDE.md, confirmed against `package.json` indirectly via `npm` scripts)

```bash
cd Mobile-Frontend
npm install
npm start                # Expo dev server
npm run android | ios    # platform
npm test                 # Jest
npm run test:coverage
npm run typecheck        # tsc --noEmit
npm run lint             # eslint
npm run clean            # clear Expo cache
```
