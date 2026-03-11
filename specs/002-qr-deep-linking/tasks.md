---
description: "Task list for QR Code Deep Linking feature implementation"
---

# Tasks: QR Code Deep Linking

**Input**: Design documents from `/specs/002-qr-deep-linking/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g. US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `Backend/api/`, `Backend/Backend/`, `Backend/tests/`
- **Mobile-Frontend**: `Mobile-Frontend/app/`
- **Mobile-Merchant-Frontend**: `Mobile-Merchant-Frontend/app/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify project structure and environment for claim URLs and deep linking

- [x] T001 Verify Backend env vars (FRONTEND_URL, COUPRO_APP_STORE_ID, COUPRO_PLAY_STORE_ID) for claim landing and AASA in Backend/Backend/settings.py or .env
- [x] T002 [P] Verify Mobile-Frontend app.json has scheme and associatedDomains for deep links in Mobile-Frontend/app.json
- [x] T003 [P] Verify expo-linking and expo-router are available in Mobile-Frontend/package.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend claim-by-token, claim URLs in generate response, claim landing, and AASA/assetlinks. MUST be complete before any user story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Add ClaimByTokenRequest serializer (claim_token, optional idempotency_key) in Backend/api/serializers.py
- [x] T005 Extend claim endpoint to accept claim_token in Backend/api/views/qr_claim.py: resolve claim_token to QRCodeSession by session_token, use qr_session.template for all claim logic (do not trust client template_id)
- [x] T006 Extend GenerateQRSessionResponse: add claim_link_web and claim_link to generate_qr_session response in Backend/api/views/qr_claim.py using FRONTEND_URL and app scheme
- [x] T007 Add claim_landing view in Backend/api/views/sharing_views.py (same pattern as collection_landing) and create Backend/api/templates/claim_landing.html with install guidance and store links only (no claim actions on web)
- [x] T008 Add routes path('claim/<str:token>/', ...) and path('cl/<str:token>/', ...) in Backend/Backend/urls.py and wire claim_landing view
- [x] T009 Add /claim/_ and /cl/_ to AASA paths in Backend/api/views/sharing_views.py (apple_app_site_association); for Android, ensure app intent filters include /claim (assetlinks.json does not use path prefixes—document if needed)

**Checkpoint**: Foundation ready — user story implementation can begin

---

## Phase 3: User Story 1 — Scan QR Outside App and Open Coupon Claim (Priority: P1) 🎯 MVP

**Goal**: User scans a coupon QR with system camera or external app; app opens and shows claim flow with coupon parameters pre-filled.

**Independent Test**: Scan a QR that encodes the claim URL with system camera or external QR reader; confirm app opens and shows claim flow with correct coupon context.

- [x] T010 [US1] Handle initial URL in Mobile-Frontend app/\_layout.tsx using Linking.getInitialURL(): parse claim URL (web or app scheme), extract token, navigate to claim flow with token
- [x] T011 [US1] Subscribe to URL events in Mobile-Frontend app/\_layout.tsx using Linking.addEventListener('url', ...): same parse and navigate when app already open
- [x] T012 [US1] Implement or wire claim flow entry (claim/ route or qr-claim screen with token param) so deep link navigates to claim flow with token in Mobile-Frontend/app/; ensure invalid/expired token shows clear error (e.g. 無效的連結, 連結已過期)
- [x] T013 [US1] Ensure app.json associatedDomains and backend AASA include /claim path; document or add if missing in Mobile-Frontend/app.json

**Checkpoint**: User Story 1 independently testable — scan outside app → app opens to claim flow

---

## Phase 4: User Story 2 — In-App QR Scan Behaviour Unchanged (Priority: P1)

**Goal**: In-app scanner accepts only deep-link URL format; re-scan prevention unchanged (same URL string = same payload).

**Independent Test**: In app, open QR scanner, scan valid coupon QR (URL format), complete claim; scan same QR again and confirm no second claim (re-scan prevention unchanged).

- [x] T014 [US2] In Mobile-Frontend app/EasyUse/qr-claim.tsx accept only URL payload: detect URL (web or app scheme), parse claim token from path or query; reject or show clear error for non-URL payloads (no legacy JSON)
- [x] T015 [US2] Call POST /api/qr-claim/claim/ with body { claim_token } from parsed URL in Mobile-Frontend app/EasyUse/qr-claim.tsx
- [x] T016 [US2] Preserve re-scan prevention in Mobile-Frontend app/EasyUse/qr-claim.tsx: use URL string as payload key so same URL = same payload; do not change existing time/content-based guards

**Checkpoint**: User Story 2 independently testable — in-app scan URL only, re-scan blocked

---

## Phase 5: User Story 3 — No App Installed: Landing Page with Install Guidance (Priority: P2)

**Goal**: When user opens claim URL without app, show landing page (install + store links only; same pattern as collection landing).

**Independent Test**: On device/emulator without app, open claim URL; confirm landing page shows install guidance and store links (no claim form on web).

- [x] T017 [US3] Verify claim landing at GET /claim/<token>/ and GET /cl/<token>/ returns 200 and HTML with install + store links in Backend (view and template from T007–T008)
- [x] T018 [P] [US3] Add claim-specific copy (e.g. "CouPro 優惠券") to Backend/api/templates/claim_landing.html if needed; keep content install + store links only

**Checkpoint**: User Story 3 independently testable — no app → landing page

---

## Phase 6: User Story 4 — QR and Share Link Use Same Claim Parameters (Priority: P2)

**Goal**: Claim via QR and share link use same token model; backend resolves token to template + session; merchant QR encodes claim URL from API.

**Independent Test**: Generate share link and QR with same claim URL; open both and confirm same claim result and validation behaviour.

- [x] T019 [US4] In Mobile-Merchant-Frontend app/(coupons)/[id]/qr-code.tsx encode claim_link_web (or claim_link) from generate API response in QR instead of qr_code_data JSON

**Checkpoint**: User Story 4 independently testable — merchant QR encodes URL; same claim behaviour as share link

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Contract tests and quickstart validation

- [x] T020 [P] Add or extend Backend contract tests for POST /api/qr-claim/claim/ with claim_token (success, invalid token, expired, idempotent) in Backend/tests/contract/
- [x] T021 [P] Add or extend Backend contract tests for generate response including claim_link_web and claim_link in Backend/tests/contract/
- [x] T022 [P] Add Backend contract test for claim landing GET /claim/<token>/ returns 200 and HTML in Backend/tests/contract/
- [x] T023 Run quickstart.md validation from specs/002-qr-deep-linking/quickstart.md (manual or script); optionally verify edge case “no browser, no app” shows best-effort guidance (e.g. store link)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–6)**: All depend on Foundational completion
  - US1 and US2 can proceed in parallel after Phase 2
  - US3 and US4 can proceed in parallel after Phase 2 (US3 deliverable largely done in Phase 2; US4 depends on generate response from Phase 2)
- **Polish (Phase 7)**: Depends on Phases 2–6 complete

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — deep link handling and claim flow entry
- **US2 (P1)**: After Phase 2 — scanner URL-only and claim-by-token call
- **US3 (P2)**: After Phase 2 — verify/polish claim landing (implementation in Phase 2)
- **US4 (P2)**: After Phase 2 — merchant encodes claim URL in QR (generate response from Phase 2)

### Within Each User Story

- US1: T010 → T011 → T012; T013 can run [P] with T010–T012
- US2: T014 → T015, T016 (T016 preserves existing logic in same file)
- US3: T017 then T018 [P]
- US4: Single task T019

### Parallel Opportunities

- Phase 1: T002, T003 [P]
- Phase 2: T004, T007 can run in parallel with others where no file overlap
- Phase 7: T020, T021, T022 [P]

---

## Parallel Example: User Story 1

```text
# After Phase 2, US1 tasks (same file _layout.tsx — sequential for T010, T011, T012):
T010: Handle getInitialURL in _layout.tsx
T011: Add addEventListener('url') in _layout.tsx
T012: Wire claim flow entry (claim route or qr-claim with token)
T013: Verify app.json / AASA (can run in parallel with T010–T012)
```

---

## Parallel Example: User Story 2

```text
# After Phase 2, US2 tasks in qr-claim.tsx:
T014: Accept only URL, parse token
T015: Call claim API with claim_token
T016: Preserve re-scan prevention (same URL = payload key)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: User Story 1 (scan outside app → open app)
4. Complete Phase 4: User Story 2 (in-app scanner URL-only, re-scan unchanged)
5. **STOP and VALIDATE**: Test US1 and US2 independently
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add US1 → test (scan outside → app opens) → demo
3. Add US2 → test (in-app scan, re-scan prevention) → demo
4. Add US3 → verify landing (no app) → demo
5. Add US4 → merchant QR encodes URL → demo
6. Polish (contract tests, quickstart)

### Parallel Team Strategy

- Complete Phase 1 + 2 together
- After Phase 2: Developer A — US1 (Mobile-Frontend \_layout + claim entry); Developer B — US2 (qr-claim.tsx); Developer C — US3 verification + US4 (merchant QR)

---

## Notes

- [P] tasks = different files or no ordering dependency
- [Story] label maps task to user story for traceability
- Each user story is independently completable and testable
- Claim token = session_token (QRCodeSession); no new model
- Re-scan prevention: payload = URL string for deep-link QRs; do not change existing behaviour
- Invalid/expired claim URL: show clear error (e.g. 無效的連結, 連結已過期) per FR-006; no crash
- Commit after each task or logical group; stop at any checkpoint to validate story independently
