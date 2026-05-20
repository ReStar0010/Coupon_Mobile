# CouPro E2E (Playwright)

Two Playwright projects in one suite:

| Project | Target | What it covers |
|---|---|---|
| `web-app` | Expo Web build of `Mobile-Frontend` | Onboarding, login Zod form, upgrade prompt (mocked API), error boundary, settings smoke |
| `backend-landing` | Django HTML landing pages | `/collection/<token>/`, `/claim/<token>/`, `/voucher/<token>/`, AASA + assetlinks, `/api/app/version-info/` |

## Run locally

```bash
# 1) Install (first time only)
npm install
npx playwright install chromium

# 2a) Web-app project — needs Expo Web running
#     In Mobile-Frontend, in another terminal:
#       npx expo start --web
#     Wait until the URL prints (http://localhost:8081 by default), then:
npm run test:web

# 2b) Backend-landing project — hits staging directly, no local server needed
npm run test:backend

# Both
npm test

# Headed mode (watch the browser)
npm run test:headed

# Open the HTML report after a run
npm run report
```

## Environment overrides

| Var | Default | Use |
|---|---|---|
| `EXPO_WEB_PORT` | `8081` | Port of `expo start --web` |
| `E2E_WEB_BASE_URL` | `http://localhost:8081` | Override the whole web-app base URL |
| `E2E_BACKEND_BASE_URL` | `https://coupon-mobile-dev.onrender.com` | Override the backend-landing base URL |
| `CI` | unset | When set, retries=2 and reporter switches to github + html |

## Out-of-scope flows (documented gaps)

These surfaces are **deliberately not tested** by Playwright because they require native binaries:

- **CouMap** — `react-native-maps` has no web binding for v1.20.x. Web shims render no-ops.
- **Coupon QR scan** — `expo-camera` is mobile-only.
- **Coupon redeem QR display** — render works on web but the camera path doesn't.
- **Spinner co-op WebSocket** — Channels speaks ws:// fine, but the spinner UI uses Reanimated worklets that don't fully implement on web.
- **Native share sheet** (`Share.share`) — no-op on web.
- **Deep link claim from a custom-scheme URL** — `coupro://collection?token=…` only fires on a real device.
- **EAS Updates** — `Updates.isEnabled === false` on web; the apply-updates helper short-circuits to `'disabled'`.

For mobile-only coverage of these, set up Maestro or Detox as a separate suite.

## CI

`.github/workflows/e2e.yml` (see repo root) runs the suite on every PR. The web-app project boots `expo start --web` in a separate step; backend-landing hits staging directly.
