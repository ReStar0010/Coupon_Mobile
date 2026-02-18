# Specification Analysis Report

**Feature**: 002-qr-deep-linking  
**Artifacts**: spec.md, plan.md, tasks.md  
**Constitution**: .specify/memory/constitution.md  
**Date**: 2026-02-05

---

## Findings Table

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| C1 | Constitution | MEDIUM | plan.md L19 | Plan states "claim flow response < 200ms"; constitution requires "interaction response < 100ms". | Align plan to ≤100ms or document exception in plan (e.g. "claim flow 200ms per product decision"). |
| U1 | Underspecification | MEDIUM | tasks.md T007 | T007 does not name the view module; plan says claim_landing in sharing_views.py. | Add "in Backend/api/views/sharing_views.py" (or correct module) to T007 description. |
| U2 | Underspecification | MEDIUM | tasks.md T019 | T019 references "app/(coupons)/" only; QR is implemented in app/(coupons)/[id]/qr-code.tsx. | Specify file: Mobile-Merchant-Frontend/app/(coupons)/[id]/qr-code.tsx in T019. |
| U3 | Underspecification | MEDIUM | spec.md FR-009, data-model | "Short-lived" token has no numeric TTL; data-model suggests "e.g. 24h" or after first use. | Add concrete TTL or "after first use" rule in spec or data-model for implementability. |
| U4 | Underspecification | MEDIUM | tasks.md T009 | T009 says add /claim/* to "assetlinks path prefixes"; current assetlinks_json has no path array in payload. | Clarify: either add path handling in Backend assetlinks view or document that Android intent filters in app handle /claim. |
| I1 | Inconsistency | LOW | plan.md L56 | Plan lists "Backend/Backend/urls.py" with space before comma in "Add /claim/<token>/ , extend". | Minor: fix spacing in plan for consistency. |
| G1 | Coverage | LOW | spec.md FR-006, FR-007 | FR-006 (clear error for invalid/expired) and FR-007 (navigate to claim, allow cancel) have no explicit frontend copy task for 無效的連結/連結已過期. | Add optional task or note: ensure deep-link and scanner flows show spec error copy (無效的連結, 連結已過期). |
| G2 | Coverage | LOW | spec.md Edge case | Edge case "device has no browser and no app" (best possible guidance) has no dedicated task. | Accept as best-effort or add one verification step in quickstart/T023. |
| A1 | Ambiguity | LOW | spec.md FR-009 | "Short period" for token expiry is vague. | Resolve via U3 (define TTL or "after first use"). |
| T1 | Terminology | LOW | tasks vs plan | Plan says "claim_landing" in sharing_views; tasks say "claim_landing view" without file. | Resolve via U1 (name file in T007). |

---

## Coverage Summary Table

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|--------|
| FR-001 (open claim from outside app) | Yes | T005, T009, T010–T013 | Backend + deep link + AASA |
| FR-002 (QR and share link equivalent) | Yes | T005, T006, T019 | One endpoint, same token; share link flow assumed to use same endpoint |
| FR-003 (landing when app not installed) | Yes | T007, T008, T017, T018 | |
| FR-004 (re-scan prevention unchanged) | Yes | T016 | |
| FR-005 (web or app-scheme URL) | Yes | T006, T010–T012 | |
| FR-006 (invalid/expired → clear error, no crash) | Partial | T005, T020; frontend copy not explicit | See G1 |
| FR-007 (app launch/foreground → claim flow) | Yes | T010–T012 | |
| FR-008 (duplicate opens handled safely) | Yes | T005, T020 | Idempotency |
| FR-009 (single-use, short-lived token) | Yes | T005 (backend logic) | TTL not specified (U3) |
| FR-010 (scanner only deep-link URL) | Yes | T014, T015 | |
| SC-001 to SC-005 | Yes | Mapped via FRs and US phases | |
| US1 (scan outside → open app) | Yes | T010–T013 | |
| US2 (in-app scan unchanged) | Yes | T014–T016 | |
| US3 (no app → landing) | Yes | T007, T008, T017, T018 | |
| US4 (same params QR/share) | Yes | T005, T006, T019 | |

---

## Constitution Alignment Issues

- **Performance**: Plan allows claim flow response < 200ms; constitution requires interaction response < 100ms (see C1). No other constitution violations identified; Mobile-First, API-Driven & Type-Safe, Quality Assurance (contract tests), and venv are reflected in plan and tasks.

---

## Unmapped Tasks

- All tasks (T001–T023) map to at least one requirement, user story, or phase goal. T001–T003 (Setup) support all stories; T020–T023 (Polish) support Quality Assurance and quickstart.

---

## Metrics

| Metric | Value |
|--------|--------|
| Total requirements (FR + SC) | 15 (10 FR + 5 SC) |
| Total user stories | 4 |
| Total tasks | 23 |
| Coverage % (requirements with ≥1 task) | 100% |
| Ambiguity count | 1 (A1) |
| Duplication count | 0 |
| Critical issues count | 0 |
| High issues count | 0 |
| Medium issues count | 5 (C1, U1–U4) |
| Low issues count | 4 (I1, G1, G2, T1) |

---

## Next Actions

- **No CRITICAL or HIGH issues**: Safe to proceed with `/speckit.implement`; address MEDIUM items as you go or in a short refinement pass.
- **Suggested before or during implementation**:
  1. **C1**: Align plan with constitution on response time (100ms vs 200ms) or document exception.
  2. **U1**: In tasks.md T007, add the view module path (e.g. Backend/api/views/sharing_views.py).
  3. **U2**: In tasks.md T019, set the merchant QR file to `Mobile-Merchant-Frontend/app/(coupons)/[id]/qr-code.tsx`.
  4. **U3**: In spec or data-model, define token TTL or "after first use" for FR-009.
  5. **U4**: In tasks.md T009 or in research/plan, clarify how Android assetlinks handles /claim (Backend path vs app intent filters).
- **Optional**: Add a short task or acceptance note for FR-006 frontend error copy (G1) and for the "no browser, no app" edge case (G2).

---

## Remediation

Would you like me to suggest concrete remediation edits for the top 5 issues (C1, U1–U4)? I will not apply them automatically; you can approve and apply per edit.
