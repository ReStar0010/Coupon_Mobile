# Quickstart: QR Code Deep Linking

**Feature**: 002-qr-deep-linking  
**Date**: 2026-02-05

## Overview

QR codes encode a **claim URL** (web or app scheme) with a single **claim token**. Scanning outside the app opens the URL; if the app is installed it launches to the claim flow; if not, a landing page shows install + store links. The in-app scanner accepts only deep-link URL format; re-scan prevention is unchanged. Claim token = session_token (backend resolves to template + session).

## Architecture

- **Backend**: Claim-by-token endpoint; generate response includes `claim_link_web` and `claim_link`; claim landing view at `/claim/<token>/` (same pattern as collection landing).
- **Mobile-Frontend**: Deep link handling (expo-linking + expo-router) for claim URL; in-app scanner parses URL and extracts token; re-scan prevention unchanged.
- **Mobile-Merchant-Frontend**: Encode claim URL (from API) in QR instead of JSON.

## Setup

### Backend

1. Activate venv: `cd Backend && source .venv/bin/activate` (Unix) or `.venv\Scripts\activate` (Windows).
2. Apply migrations if any: `python manage.py migrate`.
3. Run server: `python manage.py runserver`.
4. Ensure `FRONTEND_URL`, `COUPRO_APP_STORE_ID`, `COUPRO_PLAY_STORE_ID` (and optional `COUPRO_IOS_TEAM_ID`, `COUPRO_ANDROID_SHA256` for Universal/App Links) are set for claim landing and AASA/assetlinks.

### Local dev with tunnel (lt / loca.lt) — testing “scan outside app”

To test opening the claim URL in a browser (or scanning a QR that opens the link):

1. **Start your tunnel** so the Backend is reachable at a public URL (e.g. `https://coupro-123.loca.lt`). Example with [local tunnel](https://localtunnel.github.io/www/): `lt --port 8000 --subdomain coupro-123` (Backend must be on port 8000), or use your usual tunnel command.
2. **Backend**: In local dev, `Backend/Backend/settings.py` uses `API_BASE_URL` as the public base when `FRONTEND_URL` is unset and `DEBUG` is True. So ensure `API_BASE_URL` matches your tunnel URL (default in settings is `https://coupro-123.loca.lt`). Optionally create `Backend/.env` with:
   - `API_BASE_URL=https://YOUR-SUBDOMAIN.loca.lt` (no trailing slash)
   - Or `FRONTEND_URL=https://YOUR-SUBDOMAIN.loca.lt` to override.
3. **Mobile-Frontend**: Use `EXPO_PUBLIC_BACKEND_MODE=local-network` and `EXPO_PUBLIC_LOCAL_HOST=https://YOUR-SUBDOMAIN.loca.lt` in `Mobile-Frontend/.env` so the app talks to the same tunnel.
4. **Mobile-Merchant-Frontend**: Point its API config to the same tunnel so the merchant app generates QR codes with `claim_link_web` like `https://YOUR-SUBDOMAIN.loca.lt/claim/<token>/`.
5. **Test**: Generate a QR in the merchant app, then open `https://YOUR-SUBDOMAIN.loca.lt/claim/<token>/` in a browser (or scan the QR with the system camera). You should see the claim landing page; with the app installed, the same URL can open the app (if AASA/App Links are configured for that host).

### Mobile-Frontend

1. `cd Mobile-Frontend && npm install && npx expo start`.
2. `app.json`: `scheme` includes `coupro`; `ios.associatedDomains` includes `applinks:coupro.pro` (add `/claim` path in AASA on backend).

### Mobile-Merchant-Frontend

1. `cd Mobile-Merchant-Frontend && npm install && npm start`.
2. QR display: use `claim_link_web` (or `claim_link`) from generate API response as the string to encode in the QR.

## Key endpoints and URLs

| Purpose                               | Method/URL                                    | Notes                                             |
| ------------------------------------- | --------------------------------------------- | ------------------------------------------------- |
| Generate QR session (with claim URLs) | `POST /api/merchant/qr-session/generate/`     | Response includes `claim_link_web`, `claim_link`. |
| Claim by token                        | `POST /api/qr-claim/claim/`                   | Body: `{ "claim_token": "<session_token>" }`.     |
| Claim landing (no app)                | `GET /claim/<token>/` or `/cl/<token>/`       | HTML; install + store links only.                 |
| AASA (iOS)                            | `GET /.well-known/apple-app-site-association` | Add paths `/claim/*`, `/cl/*`.                    |
| Asset links (Android)                 | `GET /.well-known/assetlinks.json`            | Add `/claim` (and `/cl`) in intent filters.       |

## Deep link handling (Mobile-Frontend)

- **Initial open**: `Linking.getInitialURL()` on app load; if host/path is claim (e.g. `https://coupro.pro/claim/<token>` or `coupro://claim?token=<token>`), parse token and navigate to claim flow with token.
- **App already open**: `Linking.addEventListener('url', ...)`; same parsing and navigation.
- **In-app scanner**: When QR payload is a URL, parse token from URL (path or query); call claim API with `claim_token`; keep existing re-scan prevention (same URL string = same payload).

## Contract

- `specs/002-qr-deep-linking/contracts/qr-claim-deeplink-api.yaml`: Generate response with claim links; claim-by-token request/response.

## Testing

- Backend: Contract tests for `POST /api/qr-claim/claim/` with `claim_token`; generate response includes `claim_link_web`/`claim_link`; claim landing returns 200 and HTML.
- Mobile: Manual or E2E: scan QR with claim URL outside app → app opens to claim flow; scan same QR in-app → claim then re-scan blocked; open claim URL in browser without app → landing page.

### Testing with Expo Go (and an old/production app installed)

If you run the user app in **Expo Go** but also have the **published CouPro app** (old version) installed, opening a claim link (e.g. from a scanned QR) will open the **old app**, not Expo Go. That’s expected:

- **Universal Links (iOS)** and **App Links (Android)** are tied to a specific app (bundle ID `com.cokayne.MobileFrontend`). Only the **installed production/standalone app** is registered for `https://coupro.pro` and the `coupro://` scheme. **Expo Go** is a different app (different bundle ID) and does not register your project’s scheme or domain, so the system never opens Expo Go for those links.

**What you can test in Expo Go:**

1. **In-app scanning**  
   Open your project in Expo Go → go to the QR claim screen → scan a QR that encodes the claim URL. The in-app scanner parses the URL and calls the claim API. This flow does not rely on the system opening the app from a link.

2. **“No app” (landing page only)**  
   Use the **tunnel URL** in the QR (e.g. `https://coupro-123.loca.lt/claim/<token>/`). The production app is only associated with `coupro.pro`, not `*.loca.lt`. So when you open that URL (scan with system camera or paste in browser), it should open in the **browser** and show the claim landing page. You can verify the landing page and store links without the old app taking the link.

**If you need to test “scan outside app → open app with token”:**

- Use a **development build** (custom dev client) and either associate it with a dev-only domain (e.g. tunnel) in AASA, or temporarily **uninstall the production app** and use a build that registers for the same domain/scheme; or
- Use a **second device** that does not have the production CouPro app installed, so the claim link opens in the browser and you can at least confirm the landing page (and, if you install a dev build there, “open in app” on that device).
