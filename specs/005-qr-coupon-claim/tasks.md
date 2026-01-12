# Implementation Tasks: QR Code Coupon Claim

**Feature**: QR Code Coupon Claim  
**Branch**: `005-qr-coupon-claim`  
**Date**: 2026-01-27  
**Status**: Complete - All Tasks Implemented (51/51 tasks completed)

## Overview

This document breaks down the implementation of QR code-based coupon claiming into actionable, dependency-ordered tasks. Tasks are organized by phase, with each user story forming an independently testable increment.

**Total Tasks**: 51  
**Setup**: 3 tasks (3 completed ✓)  
**Foundational**: 8 tasks (8 completed ✓)  
**User Story 1 (P1)**: 12 tasks (12 completed ✓)  
**User Story 2 (P1)**: 17 tasks (17 completed ✓)  
**User Story 3 (P2)**: 4 tasks (4 completed ✓)  
**Polish & Cross-Cutting**: 7 tasks (7 completed ✓)

## Implementation Strategy

**MVP Scope**: User Story 1 + User Story 2 (complete merchant-to-user QR code claim flow)  
**Incremental Delivery**: Each user story phase is independently testable and delivers value  
**Parallel Opportunities**: Backend and frontend tasks can be developed in parallel within each story phase

---

## Phase 1: Setup

**Goal**: Initialize project structure and dependencies

- [x] T001 Create database migration file for QRCodeSession model in Backend/api/migrations/
- [x] T002 Create QR code claim view file Backend/api/views/qr_claim.py with empty view classes
- [x] T003 Create contract test file Backend/tests/contract/test_qr_claim.py with test structure

---

## Phase 2: Foundational

**Goal**: Implement core data models and shared infrastructure required by all user stories

- [x] T004 [P] Add QRCodeSession model to Backend/api/models.py with fields: id, template (ForeignKey), merchant (ForeignKey), session_token (CharField, unique), created_at (DateTimeField), is_active (BooleanField), invalidated_at (DateTimeField, nullable)
- [x] T005 [P] Add 'qr_claim' to Coupon.ACQUISITION_METHOD_CHOICES in Backend/api/models.py
- [x] T006 Run makemigrations and create migration file for QRCodeSession model
- [x] T007 Run migrate to apply database schema changes
- [x] T008 [P] Create GenerateQRSessionSerializer in Backend/api/serializers.py for POST /api/merchant/qr-session/generate/
- [x] T009 [P] Create InvalidateSessionSerializer in Backend/api/serializers.py for POST /api/merchant/qr-session/{session_id}/invalidate/
- [x] T010 [P] Create ClaimCouponRequestSerializer in Backend/api/serializers.py for POST /api/qr-claim/claim/
- [x] T011 [P] Create ClaimCouponResponseSerializer in Backend/api/serializers.py for claim success response

---

## Phase 3: User Story 1 - Merchant Generates QR Code for Coupon Template (P1)

**Goal**: Enable merchants to generate QR codes for coupon templates in Collections detail page. QR codes contain template ID and session token, and are only valid while the merchant keeps the display open.

**Independent Test**: Merchant navigates to coupon detail page, generates QR code, verifies QR code contains correct template ID. QR code becomes invalid when merchant closes display.

**Acceptance Criteria**:
- Merchant can generate QR code for active coupon template
- QR code contains template ID and session token in JSON format
- QR code is displayed clearly on merchant's screen
- QR code becomes invalid when merchant closes display
- QR code generation works even if template has zero remaining quantity (users will get error on claim)

### Backend Implementation

- [x] T012 [US1] Implement generate_qr_session view in Backend/api/views/qr_claim.py: POST /api/merchant/qr-session/generate/ - validates merchant owns template, template is active, creates QRCodeSession with UUID4 token, returns session_id, template_id, session_token, qr_code_data JSON string
- [x] T013 [US1] Implement invalidate_qr_session view in Backend/api/views/qr_claim.py: POST /api/merchant/qr-session/{session_id}/invalidate/ - validates merchant owns session, sets is_active=False, invalidated_at=now(), returns success message
- [x] T014 [US1] Add URL routes for QR session endpoints in Backend/Backend/urls.py: /api/merchant/qr-session/generate/ and /api/merchant/qr-session/<int:session_id>/invalidate/
- [x] T015 [US1] Add IsAuthenticated permission to generate_qr_session and invalidate_qr_session views
- [x] T016 [US1] Add merchant ownership validation in generate_qr_session view: ensure merchant owns template's store
- [x] T017 [US1] Add error handling in generate_qr_session view: return 400 for out-of-stock templates (still allow generation), 404 for non-existent templates, 403 for unauthorized merchants

### Merchant Frontend Implementation

- [x] T018 [P] [US1] Create QR code generation component Mobile-Merchant-Frontend/app/(coupons)/[id]/qr-code.tsx: button to generate QR code, calls POST /api/merchant/qr-session/generate/, displays QR code using existing QRCode component
- [x] T019 [US1] Integrate QR code generation button into coupon detail page Mobile-Merchant-Frontend/app/(coupons)/[id].tsx: add "Generate QR Code" button that opens qr-code.tsx component
- [x] T020 [US1] Implement QR code data encoding in Mobile-Merchant-Frontend/app/(coupons)/[id]/qr-code.tsx: format response as JSON string {"template_id": X, "session_token": "..."} and pass to QRCode component
- [x] T021 [US1] Implement session invalidation on component unmount in Mobile-Merchant-Frontend/app/(coupons)/[id]/qr-code.tsx: call POST /api/merchant/qr-session/{session_id}/invalidate/ in useEffect cleanup function
- [x] T022 [US1] Add error handling in Mobile-Merchant-Frontend/app/(coupons)/[id]/qr-code.tsx: display error messages for API failures, handle network errors gracefully
- [x] T023 [US1] Add loading states in Mobile-Merchant-Frontend/app/(coupons)/[id]/qr-code.tsx: show loading indicator while generating QR code session

---

## Phase 4: User Story 2 - User Scans QR Code to Claim Coupon (P1)

**Goal**: Enable users to scan QR codes and claim coupons. System validates session token, checks template availability, creates coupon with acquisition_method='qr_claim', and displays success message.

**Independent Test**: User scans valid QR code, verifies coupon appears in collection with success notification. Handles invalid QR codes, expired sessions, and out-of-stock templates with appropriate error messages.

**Acceptance Criteria**:
- User can scan QR code from main screen scan button
- System validates session token and template availability
- Coupon is created with acquisition_method='qr_claim'
- Success message displayed after claim
- Error messages for invalid QR codes, expired sessions, out-of-stock templates
- Multiple claims from same template allowed (if quantity available)
- Authentication required for claim

### Backend Implementation

- [x] T024 [US2] Implement claim_coupon_via_qr view in Backend/api/views/qr_claim.py: POST /api/qr-claim/claim/ - validates session_token exists and is_active=True, validates template exists and is_active=True, validates remaining_quantity > 0, atomically decrements template.remaining_quantity using F() expression, creates Coupon with acquisition_method='qr_claim', returns coupon details
- [x] T025 [US2] Add URL route for claim endpoint in Backend/Backend/urls.py: /api/qr-claim/claim/
- [x] T026 [US2] Add IsAuthenticated permission to claim_coupon_via_qr view
- [x] T027 [US2] Add race condition handling in claim_coupon_via_qr view: use atomic transaction with F() expression for remaining_quantity decrement, return 400 error if quantity becomes negative
- [x] T028 [US2] Add comprehensive error handling in claim_coupon_via_qr view: return 400 for invalid/expired session tokens, out-of-stock templates, expired templates, return 404 for non-existent templates/sessions, return 403 for cross-store template access attempts, return clear error messages with specific codes: "QR code session expired or invalid", "Coupon template out of stock", "Coupon template expired", "Template not found", "Unauthorized template access"
- [x] T028a [US2] Add template expiry validation in claim_coupon_via_qr view: check template.expiry_date is None or template.expiry_date > timezone.now(), return 400 error with message "Coupon template expired" if template has expired (implements FR-018)
- [x] T029 [US2] Add validation in claim_coupon_via_qr view: ensure coupon_type='exclusive' for QR-claimed coupons, set current_holder to authenticated user

### User Frontend Implementation

- [x] T030 [P] [US2] Create QR code scanner component Mobile-Frontend/app/EasyUse/qr-claim.tsx: uses expo-camera CameraView, scans QR codes, parses JSON to extract template_id and session_token, calls claim API. Implement duplicate-scan prevention: disable scanner after successful scan, require user to manually reopen scanner for next scan, prevent processing same QR code multiple times within 2 seconds
- [x] T031 [US2] Add "Scan to Claim Coupon" button to main screen Mobile-Frontend/app/EasyUse/index.tsx: button in bottom navigation area, opens QRClaimScanner component, visually distinct from redemption scan button
- [x] T032 [US2] Implement QR code JSON parsing in Mobile-Frontend/app/EasyUse/qr-claim.tsx: parse scanned data as JSON, validate template_id and session_token fields exist and are correct types (template_id is number, session_token is non-empty string), handle invalid JSON format with error message "無效的 QR Code 格式，請掃描正確的優惠券 QR Code", handle missing fields with error message "QR Code 缺少必要資訊"
- [x] T033 [US2] Implement claim API call in Mobile-Frontend/app/utils/authAPI.ts: add claimCouponViaQR(template_id: number, session_token: string): Promise<{message: string, coupon_id: number, coupon_name: string, template_id: number, remaining_quantity: number, acquisition_method: 'qr_claim'}> function that calls POST /api/qr-claim/claim/ with retry logic: retry up to 2 times on network errors (500, 502, 503, 504, timeout) with exponential backoff (1s, 2s delays), do not retry on 4xx errors
- [x] T034 [US2] Add success message display in Mobile-Frontend/app/EasyUse/qr-claim.tsx: show "獲得優惠券" message after successful claim, navigate back to main screen, disable scanner to prevent duplicate scans
- [x] T035 [US2] Add error handling in Mobile-Frontend/app/EasyUse/qr-claim.tsx: display specific error messages for invalid QR codes ("無效的 QR Code"), expired sessions ("QR Code 已過期，請商家重新生成"), out-of-stock templates ("優惠券已領取完畢"), expired templates ("優惠券已過期"), network errors with retry indication ("網路連線失敗，正在重試..." then "無法連線，請檢查網路後重試"), handle camera permission denial gracefully
- [x] T036 [US2] Add camera permission handling in Mobile-Frontend/app/EasyUse/qr-claim.tsx: request camera permission on mount using expo-camera useCameraPermissions hook, handle denial gracefully with user-friendly message "需要相機權限才能掃描 QR Code，請在設定中開啟相機權限" and button to open device settings, disable scanner UI when permission denied

---

## Phase 5: User Story 3 - User Views Claimed Coupon in Collection (P2)

**Goal**: Display QR code-claimed coupons in user's exclusive collection with correct acquisition method label.

**Independent Test**: After scanning QR code, verify coupon appears in collection with acquisition_method displayed as "QR code claim" (or equivalent label).

**Acceptance Criteria**:
- Claimed coupon appears in user's exclusive collection
- Acquisition method is displayed correctly
- User can distinguish QR code-claimed coupons from other types

### Implementation

- [x] T037 [US3] Verify coupon collection display shows acquisition_method in Mobile-Frontend/app/Collection/components/Coupon.tsx: ensure 'qr_claim' coupons display with correct label
- [x] T038 [US3] Add acquisition method label mapping in Mobile-Frontend/app/Collection/utils/couponUtils.ts: map 'qr_claim' to display text "QR Code 領取" or equivalent
- [x] T039 [US3] Test end-to-end flow: generate QR code, scan and claim, verify coupon appears in collection with correct acquisition method
- [x] T040 [US3] Verify backend returns acquisition_method='qr_claim' in coupon list API responses

---

## Phase 6: Polish & Cross-Cutting Concerns

**Goal**: Add tests, error handling improvements, and documentation

- [x] T041 Write contract tests in Backend/tests/contract/test_qr_claim.py: test all three endpoints (generate, invalidate, claim) with valid and invalid inputs, test error cases including expired templates, cross-store access, corrupted session tokens
- [x] T042 Add integration tests for race condition handling: test multiple simultaneous claims for last available coupon, verify atomic quantity decrement prevents negative values
- [x] T043 Update API documentation: ensure all endpoints are documented in contracts/qr-claim-api.yaml and match implementation
- [x] T044 [P] Add performance test for SC-001: measure end-to-end claim time from button tap to success confirmation, verify < 5 seconds under normal network conditions
- [x] T045 [P] Add performance test for SC-002: measure QR code generation time from merchant activation to display, verify < 1 second
- [x] T046 [P] Add performance test for SC-003: run batch of 100 valid QR code scans, calculate success rate (excluding out-of-stock/expired), verify >= 95% success rate
- [x] T047 [P] Add performance test for SC-004: test 50 invalid QR code formats (malformed JSON, missing fields, wrong types), verify 100% handled with appropriate error messages and no crashes

---

## Dependencies

### Story Completion Order

1. **Phase 1 (Setup)** → Must complete before all other phases
2. **Phase 2 (Foundational)** → Must complete before User Story phases (provides models and serializers)
3. **Phase 3 (User Story 1)** → Can start after Phase 2, independent of User Story 2
4. **Phase 4 (User Story 2)** → Can start after Phase 2, depends on Phase 3 for QR code generation (but can develop in parallel)
5. **Phase 5 (User Story 3)** → Depends on Phase 4 completion (needs claimed coupons to exist)
6. **Phase 6 (Polish)** → Depends on all User Story phases completion

### Task Dependencies

- T004-T005 (Models) → T006-T007 (Migrations) → All backend tasks
- T008-T011 (Serializers) → T012-T013, T024 (Views that use serializers)
- T012-T017 (Backend US1) → T018-T023 (Frontend US1) - can develop in parallel but frontend needs backend API
- T024-T028a, T029 (Backend US2) → T030-T036 (Frontend US2) - can develop in parallel but frontend needs backend API
- T044-T047 (Performance tests) → T041-T043 (Contract tests) - performance tests can run after contract tests validate API correctness
- T030-T036 (Frontend US2) → T037-T040 (User Story 3) - need claimed coupons to test display

---

## Parallel Execution Examples

### User Story 1 (Merchant QR Code Generation)

**Backend tasks (can run in parallel)**:
- T012 (generate_qr_session view) and T013 (invalidate_qr_session view) - different endpoints
- T014 (URL routes) - independent file
- T015-T017 (Permissions and validations) - can be added incrementally

**Frontend tasks (can run in parallel)**:
- T018 (QR code component) and T019 (Integration) - component first, then integration
- T020-T023 (Encoding, invalidation, error handling, loading) - can be added incrementally

**Backend + Frontend**: Can develop in parallel once API contract is defined (from contracts/qr-claim-api.yaml)

### User Story 2 (User QR Code Scanning)

**Backend tasks (can run in parallel)**:
- T024 (claim_coupon_via_qr view) - main endpoint
- T025 (URL route) - independent
- T026-T029 (Permissions, race conditions, errors, validation) - can be added incrementally

**Frontend tasks (can run in parallel)**:
- T030 (Scanner component) - core component
- T031 (Button integration) - independent
- T032-T036 (Parsing, API call, success, errors, permissions) - can be added incrementally

**Performance testing tasks (can run in parallel)**:
- T044-T047 (Performance tests for success criteria) - can run after contract tests complete

**Backend + Frontend**: Can develop in parallel once API contract is defined

---

## MVP Scope Recommendation

**Minimum Viable Product**: Phase 1 + Phase 2 + Phase 3 + Phase 4

This delivers the complete merchant-to-user QR code claim flow:
- Merchants can generate QR codes for templates
- Users can scan QR codes to claim coupons
- System validates sessions and creates coupons correctly

**Phase 5 (Collection Display)** can be added in a follow-up iteration if time is limited, as the core functionality is complete without it (coupons will still appear in collection, just without explicit acquisition method label).

**Phase 6 (Tests & Polish)** should be completed before production deployment but can be done incrementally.

---

## Validation Checklist

- [x] All tasks follow checklist format: `- [ ] [TaskID] [P?] [Story?] Description with file path`
- [x] All user story tasks have [US1], [US2], or [US3] labels
- [x] All tasks include specific file paths
- [x] Setup and Foundational phases have no story labels
- [x] Parallelizable tasks marked with [P]
- [x] Each user story phase is independently testable
- [x] Dependencies section shows completion order
- [x] Parallel execution examples provided
- [x] MVP scope clearly defined

---

## Notes

- **QR Code Format**: JSON object `{"template_id": 123, "session_token": "..."}` as per research.md
- **Session Token**: UUID4 format, generated by backend, stored in QRCodeSession model
- **Session Lifecycle**: Active while merchant display is open, invalidated on component unmount
- **Acquisition Method**: `'qr_claim'` added to Coupon.ACQUISITION_METHOD_CHOICES
- **Race Conditions**: Use Django F() expressions for atomic quantity decrement
- **Libraries**: Reuse existing expo-camera (user app) and QRCode component (merchant app)
- **No New Dependencies**: All required libraries already in project
