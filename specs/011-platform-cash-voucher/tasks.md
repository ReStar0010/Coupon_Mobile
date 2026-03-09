# Tasks: Platform Cash Voucher

**Input**: Design documents from `/specs/011-platform-cash-voucher/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Per constitution (III. Quality Assurance), platform voucher redemption, share flows, and API endpoints require tests. Backend tests in `Backend/api/tests/` or `Backend/tests/`; full suite: `python manage.py test api tests`.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story (US1–US4)
- Include exact file paths in descriptions

## Path Conventions

- **Backend (CouPro)**: `Backend/api/` for models, views, serializers, admin; `Backend/Backend/urls.py` for routes; tests in `Backend/api/tests/` or `Backend/tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify environment and structure for the feature

- [x] T001 Verify Backend runs and existing migrations apply from Backend root with venv active (`python manage.py migrate`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Store participation flag, platform voucher models, migrations, and voucher code generation. MUST be complete before any user story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Add `accepts_platform_vouchers` (Boolean, default False) to Store in Backend/api/models.py
- [x] T003 [P] Add PlatformVoucher model (face_value, currency_code, start_date, expiry_date, current_holder, original_owner, last_holder, redeem_code, batch_name, acquisition_method, created_at) in Backend/api/models.py
- [x] T004 [P] Add PlatformVoucherRedemption model with UniqueConstraint on voucher (user, store, redeemed_at, amount_used) in Backend/api/models.py
- [x] T005 [P] Add PlatformVoucherShareRequest model (voucher, from_user, to_user, token, status, is_public, created_at, responded_at) with UniqueConstraint for one pending public share per voucher in Backend/api/models.py
- [x] T006 Implement unique 6-character voucher redeem_code generator (distinct from store unified_redeem_code) in Backend/api/utils.py and ensure DB uniqueness
- [x] T007 Create and run migrations for Store and platform voucher models (`python manage.py makemigrations api` then `migrate` from Backend root)
- [x] T008 [P] Add migration tests for platform voucher migrations (upgrade and downgrade) per constitution in Backend/api/tests/test_platform_voucher_migrations.py or Backend/tests/

**Checkpoint**: Foundation ready — user story implementation can begin

---

## Phase 3: User Story 1 – Consumer Redeems at Store (Priority: P1) – MVP

**Goal**: Consumer redeems a platform voucher at a participating store using the store’s 6-digit code; unified redemption screen shows both store coupons and platform vouchers.

**Independent Test**: Holder has one platform voucher; submits valid store code for a participating store; redemption succeeds and voucher cannot be redeemed again. GET unified-redemption/<code> returns available_platform_vouchers when store participates.

### Tests for User Story 1 (required per constitution)

- [x] T009 [P] [US1] Add contract and unit tests for platform voucher redemption in Backend/api/tests/test_platform_voucher_redemption.py: validate request/response schemas against contracts/api.md; cover holder, expiry, already redeemed, store participation, invalid code, and that second redemption is rejected (at most one PlatformVoucherRedemption per voucher)
- [x] T010 [P] [US1] Add tests for validate_unified_redemption_code including available_platform_vouchers when store has accepts_platform_vouchers=True in Backend/api/tests/test_platform_voucher_redemption.py (validate response schema per contract)

### Implementation for User Story 1

- [x] T011 [US1] Add platform voucher redeem request serializer and extend UnifiedRedemptionValidateSerializer with available_platform_vouchers in Backend/api/serializers.py
- [x] T012 [US1] Implement POST redeem (consumer) in Backend/api/views/platform_voucher_views.py: resolve store by body redeem_code, check store.accepts_platform_vouchers, create PlatformVoucherRedemption
- [x] T013 [US1] Extend validate_unified_redemption_code in Backend/api/views/coupon_views.py to add available_platform_vouchers when store participates (current_holder=request.user, not expired, no redemption)
- [x] T014 [US1] Register api/platform-voucher/<id>/redeem/ in Backend/Backend/urls.py

**Checkpoint**: User Story 1 complete — consumer can redeem and unified screen shows platform vouchers

---

## Phase 4: User Story 2 – Consumer Views and Manages Platform Vouchers (Priority: P1)

**Goal**: Consumer can list their platform vouchers (held, not expired, not redeemed) and get voucher detail by id.

**Independent Test**: GET platform-vouchers/ returns only current_holder vouchers; GET platform-vouchers/<id>/ returns detail for holder or 403/404.

### Tests for User Story 2 (required per constitution)

- [x] T015 [P] [US2] Add contract and unit tests for list and detail in Backend/api/tests/test_platform_voucher_views.py: validate request/response schemas against contracts/api.md; cover list (only current_holder, not expired, not redeemed) and detail (holder vs 403/404)

### Implementation for User Story 2

- [x] T016 [P] [US2] Add list and detail serializers for platform vouchers in Backend/api/serializers.py
- [x] T017 [US2] Implement GET list and GET detail views in Backend/api/views/platform_voucher_views.py
- [x] T018 [US2] Register api/platform-vouchers/ and api/platform-vouchers/<id>/ in Backend/Backend/urls.py

**Checkpoint**: User Story 2 complete — list and detail work independently

---

## Phase 5: User Story 3 – Consumer Shares (Private and Public Pool) (Priority: P2)

**Goal**: Consumer can share via private link or public pool; anyone with link can view share info and accept; accept is race-safe; requester can list “my public voucher shares”.

**Independent Test**: Create private share → get share by token → accept → voucher moves to acceptor. Create public share → current_holder null → accept from pool. Concurrent accept assigns voucher to one only.

### Tests for User Story 3 (required per constitution)

- [x] T019 [P] [US3] Add contract and unit tests for share flows in Backend/api/tests/test_platform_voucher_sharing.py: validate request/response schemas against contracts/api.md; cover share create, get_share by token, accept_share (race-safe), share_public, my_public_shares, and self-claim blocked for public

### Implementation for User Story 3

- [x] T020 [US3] Add share request/response serializers in Backend/api/serializers.py
- [x] T021 [US3] Implement POST share (private), GET share/<token>, POST share/<token>/accept (transaction + select_for_update), POST share-public, GET my-public-voucher-shares in Backend/api/views/platform_voucher_views.py
- [x] T022 [US3] Register api/platform-voucher/<id>/share/, api/platform-voucher/<id>/share-public/, api/platform-voucher/share/<token>/, api/platform-voucher/share/<token>/accept/, api/my-public-voucher-shares/ in Backend/Backend/urls.py

**Checkpoint**: User Story 3 complete — share flows work independently

---

## Phase 6: User Story 4 – Platform and Store Staff Manage Vouchers (Priority: P2)

**Goal**: Admin can create and manage platform vouchers and view redemptions/share requests; optional batch issue; optional merchant redeem.

**Independent Test**: Admin creates vouchers (single or batch with unique redeem_code); admin lists/filters vouchers and redemptions. Optional: merchant POST redeem-voucher with consumer_phone creates redemption at merchant’s store.

### Tests for User Story 4 (optional for admin; required if merchant redeem implemented)

- [ ] T023 [P] [US4] Add tests for merchant redeem (when implemented): consumer_phone resolves to current_holder, redemption at merchant store in Backend/api/tests/test_platform_voucher_merchant_redeem.py

### Implementation for User Story 4

- [x] T024 [P] [US4] Register PlatformVoucherAdmin, PlatformVoucherRedemptionAdmin, PlatformVoucherShareRequestAdmin (list_display, list_filter, search_fields, fieldsets per plan) in Backend/api/admin.py
- [x] T025 [US4] Add optional batch issue (batch_name, face_value, quantity, expiry_date) in Backend/api/admin.py (custom action or form creating multiple PlatformVouchers with unique redeem_codes)
- [x] T026 [US4] Implement optional POST api/merchant/redeem-voucher/ (voucher_id, consumer_phone) using get_merchant_store in Backend/api/views/platform_voucher_views.py and register in Backend/Backend/urls.py

**Checkpoint**: User Story 4 complete — admin and optional merchant redeem available

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, validation, and full suite pass

- [x] T027 [P] Ensure Backend/README.md documents the full test suite command (`python manage.py test api tests`) and subset commands (app-only, project-level) per constitution; update specs/011-platform-cash-voucher/quickstart.md if needed
- [x] T028 Run full backend test suite and fix any regressions (`python manage.py test api tests` from Backend root)
- [x] T029 Run quickstart.md validation (migrations, list/detail/redeem/share flows)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — run first.
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories.
- **Phase 3 (US1)**: Depends on Phase 2 — redeem + validate extension.
- **Phase 4 (US2)**: Depends on Phase 2 — list/detail (can follow or overlap with US1).
- **Phase 5 (US3)**: Depends on Phase 2 — share flows (can follow US2).
- **Phase 6 (US4)**: Depends on Phase 2 — admin and optional merchant redeem.
- **Phase 7 (Polish)**: Depends on Phases 3–6 as needed.

### User Story Dependencies

- **US1 (P1)**: After Phase 2 only — no dependency on US2/US3/US4.
- **US2 (P1)**: After Phase 2 only — independent of US1/US3/US4.
- **US3 (P2)**: After Phase 2 only — independent of US1/US2/US4.
- **US4 (P2)**: After Phase 2 only — independent of US1/US2/US3.

### Within Each User Story

- Tests (T009–T010, T015, T019, T023) before or alongside implementation.
- Serializers before views; views before URL registration.

### Parallel Opportunities

- Phase 2: T003, T004, T005, T008 can run in parallel; T006 can run in parallel with T002.
- Phase 3: T009, T010 in parallel.
- Phase 4: T015, T016 in parallel.
- Phase 5: T019; T020 and T021 sequential.
- Phase 6: T024 parallel with T025; T026 optional.
- Phase 7: T027 parallel with T028.

---

## Parallel Example: User Story 1

```bash
# Tests in parallel:
T009: test_platform_voucher_redemption.py (redemption + contract/schema validation)
T010: validate_unified_redemption_code available_platform_vouchers tests

# Then implementation in order:
T011 → T012 → T013 → T014
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup).
2. Complete Phase 2 (Foundational).
3. Complete Phase 3 (US1: redeem + unified validate; includes migration tests in Phase 2).
4. **STOP and VALIDATE**: Test redemption and validate response independently.
5. Deploy/demo if ready.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. Add US1 → test independently → MVP (redeem + unified screen).
3. Add US2 → list/detail → test independently.
4. Add US3 → share flows → test independently.
5. Add US4 → admin + optional merchant redeem → test independently.
6. Polish (Phase 7).

### Parallel Team Strategy

After Phase 2:

- Developer A: US1 (redeem + validate).
- Developer B: US2 (list/detail).
- Developer C: US3 (share) or US4 (admin).

---

## Notes

- [P] = different files, no dependencies.
- [USn] maps task to spec user story for traceability.
- Each user story is independently completable and testable.
- Commit after each task or logical group.
- Verify tests fail before implementing where TDD is applied.
- Optional items (batch issue, merchant redeem) can be skipped for minimal MVP.
