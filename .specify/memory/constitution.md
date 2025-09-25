<!--
Sync Impact Report:
- Version change: none → 1.0.0 (initial constitution)
- Added principles: Mobile-First Architecture, Component Reusability, API-First Design, User Experience Focus, Documentation-Driven Development
- Added sections: Technical Standards, Development Workflow  
- Templates requiring updates: ✅ all templates compatible with new constitution
- Follow-up TODOs: none
-->

# Coupon_Mobile Constitution

## Core Principles

### I. Mobile-First Architecture
All features MUST be designed for mobile consumption first, with responsive design patterns.
Backend APIs MUST be optimized for mobile data constraints and offline scenarios.
Cross-platform compatibility (iOS/Android) is NON-NEGOTIABLE for frontend features.
Performance targets: <500ms API response times, smooth 60fps animations.

### II. Component Reusability (NON-NEGOTIABLE)  
Every UI component MUST be designed for reuse across multiple screens.
Tamagui design system MUST be used consistently throughout the application.
Custom components MUST follow established patterns from existing codebase.
No duplicate UI logic - shared components stored in `/components/` directory.

### III. API-First Design
Backend changes MUST maintain backward compatibility with existing mobile clients.
All new features MUST expose REST API endpoints before frontend implementation.
API responses MUST follow consistent JSON structure with proper error handling.
Authentication via JWT tokens is MANDATORY for protected endpoints.

### IV. User Experience Focus
User workflows MUST be intuitive and require minimal learning curve.
Loading states and error messages MUST provide clear feedback to users.
Offline functionality MUST be preserved for core features (coupon viewing, user data).
Accessibility requirements MUST be considered in all UI implementations.

### V. Documentation-Driven Development
Every new feature MUST begin with specification documentation in `/specs/`.
Code changes MUST be accompanied by updated documentation.
Architecture decisions MUST be documented with rationale and trade-offs.
Agent context files MUST be updated when technology stack changes.

## Technical Standards

**Technology Stack Compliance**:
- Frontend: React Native + Expo Router + Tamagui (no exceptions)
- Backend: Django REST Framework + SQLite/PostgreSQL
- TypeScript MUST be used for all new frontend code
- Python 3.11+ required for backend development

**Code Quality Requirements**:
- ESLint and Prettier MUST pass for TypeScript code
- Django migrations MUST be reviewed before database changes
- Git commits MUST follow conventional commit format
- No direct database queries in frontend code

**Security Standards**:
- JWT tokens MUST have appropriate expiration times
- User input MUST be validated on both client and server
- Sensitive data MUST NOT be logged or stored in plain text
- CORS settings MUST be configured for production deployment

## Development Workflow

**Feature Development Process**:
1. Create feature specification using `.specify/` workflow
2. Generate implementation plan with technical contracts
3. Implement backend API endpoints with proper testing
4. Create frontend components following Tamagui patterns
5. Update documentation and agent context files

**Code Review Requirements**:
- All PRs MUST pass automated linting and formatting checks
- Database migrations MUST be reviewed by senior developer
- UI changes MUST be tested on both iOS and Android platforms
- API changes MUST include updated documentation

**Quality Gates**:
- No direct push to main branch (pull request required)
- All new API endpoints MUST include proper error handling
- Mobile app MUST build successfully for both platforms
- Breaking changes MUST include migration documentation

## Governance

This constitution supersedes all other development practices and guidelines.
All code reviews MUST verify compliance with these principles.
Complexity that violates principles MUST be justified with documented trade-offs.
Constitution amendments require team consensus and updated documentation.

Agent-specific guidance files (e.g., `.github/copilot-instructions.md`) MUST stay synchronized with constitution changes.
Use feature specifications and implementation plans for runtime development guidance.

**Version**: 1.0.0 | **Ratified**: 2025-09-25 | **Last Amended**: 2025-09-25