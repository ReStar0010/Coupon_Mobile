<!--
=== SYNC IMPACT REPORT ===
Version Change: 1.0.1 -> 1.0.2
Modified Principles: None
Modified Sections:
  - Development Workflow: Added Python virtual environment activation requirement for backend work
  - Technology Standards (Backend): Added note about dependency management in venv
Added Sections: None
Removed Sections: None
Templates Status:
  - .specify/templates/plan-template.md: ✅ No updates needed (generic template)
  - .specify/templates/spec-template.md: ✅ No updates needed (generic template)
  - .specify/templates/tasks-template.md: ✅ No updates needed (generic template)
  - .specify/templates/commands/*.md: N/A (directory not present)
Follow-up TODOs: None
===========================
-->

# CouPro Constitution

## Core Principles

### I. Mobile-First Design

All features MUST prioritize mobile user experience. This principle ensures the coupon
system delivers optimal value on the primary consumption platform.

**Non-negotiable rules:**

- UI components MUST be designed for touch interaction first; desktop adaptations are secondary
- Offline capability MUST be considered for critical user flows (viewing owned coupons,
  displaying redemption codes)
- Performance budgets: initial load < 3s on 4G, interaction response < 100ms
- Screen layouts MUST support various device sizes without horizontal scrolling
- Images and assets MUST use responsive loading strategies (lazy load, progressive images)

**Rationale:** CouPro serves students and merchants primarily through mobile apps.
Degraded mobile experience directly impacts user retention and coupon redemption rates.

### II. API-Driven & Type-Safe Architecture

All features MUST be exposed through well-documented REST APIs with strict type contracts
across the full stack.

**Non-negotiable rules:**

- Backend endpoints MUST have complete serializer definitions with field-level validation
- Frontend services MUST define TypeScript interfaces matching backend response schemas
- API changes MUST follow semantic versioning; breaking changes require MAJOR version bump
- All API endpoints MUST return consistent error response structures
- Python backend MUST use type hints for function signatures and model fields
- TypeScript strict mode MUST be enabled in all frontend projects

**Rationale:** A mobile platform with separate consumer and merchant apps requires
predictable API contracts. Type safety catches integration errors at compile time
rather than runtime, reducing production incidents.

### III. Quality Assurance

Critical paths MUST have test coverage. Testing ensures reliability as the codebase
evolves and new contributors join.

**Non-negotiable rules:**

- Authentication flows MUST have integration tests covering success and failure cases
- Coupon redemption logic MUST have unit tests for edge cases (expired, already used,
  wrong user, etc.)
- API endpoints MUST have contract tests validating request/response schemas
- Database migrations MUST be tested for both upgrade and downgrade paths
- Bug fixes MUST include regression tests preventing recurrence

**Rationale:** A coupon system handles real value exchange between merchants and users.
Test coverage protects against financial and trust-breaking bugs in the redemption flow.

## Technology Standards

**Backend (Django/Python):**

- Language: Python 3.10+
- Framework: Django REST Framework
- Database: SQLite (dev), PostgreSQL (prod)
- Authentication: Token-based (DRF TokenAuthentication)
- **Dependency Management**: All dependencies installed in `.venv/` virtual environment

**Mobile Frontend (Consumer & Merchant):**

- Framework: Expo (React Native)
- Language: TypeScript (strict mode)
- UI Library: Tamagui
- State Management: React Context + hooks
- Navigation: Expo Router (file-based)

**API Design:**

- RESTful conventions for resource endpoints
- JSON response format
- ISO 8601 date formatting
- Pagination for list endpoints (offset/limit)

## Development Workflow

**Python Virtual Environment (Backend):**

- All backend work MUST activate the Python virtual environment first
- Activation command: `.venv/Scripts/activate` (Windows) or `source .venv/bin/activate` (Unix/macOS)
- All Python dependencies are installed within `.venv/` and unavailable outside it
- Running backend commands (Django management, pytest, etc.) without activation will fail

**Branch Strategy:**

- `main` branch represents production-ready code
- Feature branches: `feature/###-description` (optional for larger features)
- Bug fix branches: `fix/###-description` (optional)
- Direct commits to `main` permitted for small team workflow

**Quality Checks (Self-Review):**

- Run linting and type checking before pushing
- Test critical paths locally before deployment
- Breaking API changes MUST be communicated to the other developer

**Commit Standards:**

- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- Reference issue numbers where applicable

## Governance

This constitution supersedes conflicting practices found elsewhere in the codebase.
Amendments follow this procedure:

1. **Proposal**: Document proposed change with rationale
2. **Review**: Technical review by maintainers
3. **Approval**: Consensus among active contributors
4. **Migration**: Update affected code/docs within agreed timeframe
5. **Documentation**: Increment version per semantic versioning rules

**Versioning Policy:**

- MAJOR: Principle removal or fundamental redefinition
- MINOR: New principle added or existing principle materially expanded
- PATCH: Clarifications, wording improvements, typo fixes

**Compliance:**

- All changes MUST align with constitution principles
- Violations require explicit justification in commit message or team discussion
- Constitution principles guide architecture decisions and code review discussions

**Version**: 1.0.2 | **Ratified**: 2026-01-05 | **Last Amended**: 2026-01-06
