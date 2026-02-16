# Research: Backend Test Coverage and Test Infrastructure

**Feature**: 008-backend-test-coverage  
**Date**: 2026-02-16

## 1. Test runner and two-location layout

**Decision**: Keep Django test runner and the existing two-root layout (project-level `tests/`, app-level `api/tests/`). Single full-suite command: `python manage.py test api tests`.

**Rationale**: No NEEDS CLARIFICATION in Technical Context. The spec and codebase already assume Django test runner and APIClient; introducing pytest or another runner would be out of scope. Running multiple labels in one invocation is standard Django (`test api tests`). Project-level tests cover cross-app/contract flows; app-level tests keep API app behavior localized.

**Alternatives considered**: (a) Migrate to pytest — rejected; spec says existing runner remains. (b) Single test root — rejected; current split matches “project vs app” and is already in use.

## 2. Where to document test commands

**Decision**: Document full-suite and subset commands in Backend README (`Backend/README.md`), per spec clarification.

**Rationale**: Clarification Q1: “Where must the documented full-suite and subset test commands be written? → A: Backend README.” Single place for “how to run the project and tests” keeps onboarding and CI consistent.

**Alternatives considered**: Root README only, CONTRIBUTING.md only, or separate TESTING.md — all rejected by clarification.

## 3. Route coverage definition and error behavior

**Decision**: “Documented error behavior” = any 4xx/5xx response that the test explicitly asserts (status and optionally body/headers). Public routes = all URL patterns in `Backend/Backend/urls.py` except admin, swagger, redoc.

**Rationale**: Clarification Q3. No separate API doc required; the test is the assertion. Route list derived from urlpatterns; excluded: `admin/`, `swagger`, `redoc`.

**Alternatives considered**: Require OpenAPI/Swagger for “documented” errors — rejected; spec chose test-asserted 4xx/5xx.

## 4. Critical flows list and maintenance

**Decision**: Designated list of critical user flows lives in the spec only; extend the list there when new critical flows are added.

**Rationale**: Clarification Q2. Spec is the single source of truth; no separate doc or code registry.

**Alternatives considered**: TESTING.md or code registry — rejected by clarification.

## 5. CI and test output format

**Decision**: CI must run the full backend test suite on every PR (or equivalent); no required test output format (e.g. JUnit XML optional).

**Rationale**: Clarification Q4. Ensures every PR is validated; format left to CI implementation.

**Alternatives considered**: Require machine-parseable output — rejected; “no required output format” chosen.

## 6. Full-suite run time

**Decision**: No numeric target in spec; “predictable/reasonable” retained. Timeouts may be set in CI or plan.

**Rationale**: Clarification Q5. Avoids locking the spec to a number; implementation can set CI timeout or local expectations.

**Alternatives considered**: Specify e.g. &lt;5 min — rejected; “no numeric target” chosen.
