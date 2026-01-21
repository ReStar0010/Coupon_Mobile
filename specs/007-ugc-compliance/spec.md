# Feature Specification: UGC Compliance for Apple Guideline 1.2

**Feature Branch**: `007-ugc-compliance`
**Created**: 2026-01-20
**Status**: Draft
**Input**: User description: "CouPro Merchant App: UGC Compliance Checklist covering Apple's Guideline 1.2 for User-Generated Content. Includes content filtering, report mechanism, block users, contact info, EULA acceptance, and 24-hour response process."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consumer Reports Inappropriate Merchant Content (Priority: P1)

A consumer browsing the app notices a merchant store profile or coupon image that contains inappropriate or offensive material. The consumer needs a way to report this content so the platform can take action.

**Why this priority**: This is the core compliance requirement. Without a report mechanism, the app will be rejected by Apple. It's the foundation of the entire UGC compliance system.

**Independent Test**: Can be fully tested by having a consumer open any merchant store page or coupon, tap the "Report" button, select a reason, and submit. Delivers the ability to flag problematic content.

**Acceptance Scenarios**:

1. **Given** a consumer is viewing a merchant store profile, **When** they tap the "Report" button and select a report reason, **Then** the report is submitted and they see a confirmation message
2. **Given** a consumer is viewing a coupon image, **When** they tap the "Report" button on the image, **Then** they can select a report reason and submit the report
3. **Given** a consumer has submitted a report, **When** they view the same content again, **Then** they see an indication that they have already reported this content
4. **Given** a consumer attempts to report content without selecting a reason, **When** they tap submit, **Then** the system prevents submission and prompts them to select a reason

---

### User Story 2 - Consumer Blocks a Merchant (Priority: P1)

A consumer no longer wishes to see content from a specific merchant (due to past reports, personal preference, or spam). They want to block that merchant so their content is hidden from their feed.

**Why this priority**: Required by Apple for UGC compliance. Consumers must have control over what content they see, especially after reporting inappropriate material.

**Independent Test**: Can be fully tested by having a consumer view a merchant profile, tap "Block Merchant," confirm, and verify the merchant's content no longer appears in their feed or search results.

**Acceptance Scenarios**:

1. **Given** a consumer is viewing a merchant store profile, **When** they tap "Block Merchant" and confirm, **Then** the merchant is added to their block list and a confirmation is shown
2. **Given** a consumer has blocked a merchant, **When** they browse coupons or search, **Then** that merchant's content is hidden from results
3. **Given** a consumer wants to unblock a merchant, **When** they access their blocked list in settings and tap "Unblock", **Then** the merchant's content becomes visible again
4. **Given** a consumer blocks a merchant, **When** they have existing claimed coupons from that merchant, **Then** those coupons remain accessible (blocking affects discovery, not claimed items)

---

### User Story 3 - Merchant Accepts EULA Before First Upload (Priority: P1)

A merchant who is about to upload their first content (store logo, coupon image, or business photos) must agree to the platform's content guidelines and EULA before they can proceed.

**Why this priority**: Apple requires explicit user agreement to content policies before uploading UGC. This establishes the legal foundation for content moderation.

**Independent Test**: Can be fully tested by having a new merchant attempt to upload an image, being presented with EULA/content guidelines, checking "I Agree," and then successfully uploading.

**Acceptance Scenarios**:

1. **Given** a merchant who has never uploaded content attempts to upload, **When** the upload screen appears, **Then** they must first view and accept the EULA with content guidelines
2. **Given** a merchant is viewing the EULA, **When** they scroll to the bottom, **Then** the "I Agree" checkbox becomes enabled
3. **Given** a merchant has not checked "I Agree", **When** they try to proceed with upload, **Then** the system prevents the upload and highlights the required acceptance
4. **Given** a merchant has previously accepted the EULA, **When** they upload subsequent content, **Then** they are not prompted again (unless terms are updated)

---

### User Story 4 - Administrator Reviews Reported Content (Priority: P2)

A platform administrator needs to review reported content, see the report details, and take action (approve, remove content, or suspend merchant) within the 24-hour compliance window.

**Why this priority**: Without moderation capability, the report mechanism is ineffective. Apple requires demonstrated ability to act on reports within 24 hours.

**Independent Test**: Can be fully tested by having an admin log into the moderation dashboard, view a queue of reported content with timestamps, and process a report by taking an action.

**Acceptance Scenarios**:

1. **Given** content has been reported, **When** an admin accesses the moderation dashboard, **Then** they see the reported content in a queue with report reason, timestamp, and reporter info
2. **Given** an admin is reviewing a report, **When** they choose to remove the content, **Then** the content is hidden from all consumers and the merchant is notified
3. **Given** an admin is reviewing a report, **When** they choose to dismiss the report as unfounded, **Then** the report is closed and content remains visible
4. **Given** a merchant has multiple removed content items, **When** they reach 10 violations, **Then** the system flags them for account suspension review
5. **Given** a report was submitted, **When** 20 hours have passed without action, **Then** the system sends an escalation alert to administrators

---

### User Story 5 - Consumer Accesses Support and Privacy Information (Priority: P2)

A consumer needs to find contact information for support or view the privacy policy, which must be accessible without logging in.

**Why this priority**: Apple requires easily accessible support contact info and privacy policies in both apps. This is a compliance requirement that affects all users.

**Independent Test**: Can be fully tested by having a user (logged in or not) navigate to Help/Support section and verify contact methods and privacy policy are accessible.

**Acceptance Scenarios**:

1. **Given** a user is on any screen in the app, **When** they navigate to the Help/Support section, **Then** they see working contact information (email, support URL)
2. **Given** a user has not logged in, **When** they access the app's settings or login screen, **Then** they can view the Privacy Policy without authentication
3. **Given** a user is on the merchant store page, **When** they look for support options, **Then** a link to Help/Support is accessible

---

### User Story 6 - Merchant Views Content Guidelines and Penalties (Priority: P3)

A merchant wants to understand what content is prohibited and what happens if they violate the guidelines before or after uploading content.

**Why this priority**: Supports compliance by ensuring merchants understand the rules. Reduces moderation workload by preventing violations.

**Independent Test**: Can be fully tested by having a merchant navigate to content guidelines from the EULA or settings and verify clear prohibited content list and penalty information are displayed.

**Acceptance Scenarios**:

1. **Given** a merchant is viewing the EULA, **When** they look for content guidelines, **Then** they see a clear list of prohibited content types (offensive material, illegal goods, misleading images)
2. **Given** a merchant wants to review guidelines after acceptance, **When** they navigate to Settings > Content Guidelines, **Then** the full guidelines with penalty information are displayed
3. **Given** a merchant is viewing penalty information, **When** they read the penalties section, **Then** they see clear consequences (content removal, account suspension) for violations

---

### Edge Cases

- What happens when a consumer reports content from a merchant they've already blocked?
  - Report is accepted; content is reviewed regardless of block status
- What happens when a merchant's content is removed while a consumer has a claimed coupon?
  - Claimed coupon remains valid; only new discovery is affected
- How does the system handle a merchant attempting to upload during EULA update review period?
  - Merchant must accept updated terms before new uploads
- What happens when the same content is reported by multiple consumers?
  - Reports are aggregated; moderation queue shows total report count per item
- What happens if an admin fails to act on a report within 24 hours?
  - System sends escalation alerts at 20 hours and 24 hours to all admins

## Requirements *(mandatory)*

### Functional Requirements

#### Consumer App - Reporting

- **FR-001**: System MUST display a "Report" button on all merchant store profile pages
- **FR-002**: System MUST display a "Report" button on all individual coupon images
- **FR-003**: System MUST provide predefined report reason categories (inappropriate content, misleading information, illegal goods, spam, other)
- **FR-004**: System MUST allow consumers to add optional additional details when reporting
- **FR-005**: System MUST confirm report submission to the consumer
- **FR-006**: System MUST prevent duplicate reports on the same content from the same user within 24 hours

#### Consumer App - Blocking

- **FR-007**: System MUST allow consumers to block merchants from the merchant's store profile
- **FR-008**: System MUST hide all content from blocked merchants in feed and search results
- **FR-009**: System MUST maintain claimed coupons from blocked merchants (blocking affects discovery only)
- **FR-010**: System MUST allow consumers to view and manage their block list in Settings
- **FR-011**: System MUST allow consumers to unblock previously blocked merchants

#### Consumer App - Support & Privacy

- **FR-012**: System MUST display Help/Support section with active contact information
- **FR-013**: System MUST make Privacy Policy accessible without requiring login
- **FR-014**: System MUST include support/help link accessible from merchant store pages

#### Merchant App - EULA & Guidelines

- **FR-015**: System MUST require EULA acceptance before first content upload
- **FR-016**: System MUST display content guidelines listing prohibited content types
- **FR-017**: System MUST display penalty warnings (content removal, account suspension)
- **FR-018**: System MUST require explicit "I Agree" checkbox interaction for EULA acceptance
- **FR-019**: System MUST record EULA acceptance timestamp and version
- **FR-020**: System MUST re-prompt EULA acceptance when terms are updated

#### Backend - Moderation Infrastructure

- **FR-021**: System MUST provide a moderation dashboard for administrators
- **FR-022**: System MUST queue reported content with timestamps, report reasons, and reporter information
- **FR-023**: System MUST allow administrators to approve (dismiss report) or remove content
- **FR-024**: System MUST notify merchants when their content is removed
- **FR-025**: System MUST track report history for pattern detection
- **FR-026**: System MUST send email escalation alerts (via Resend API) when reports approach 24-hour deadline
- **FR-027**: System MUST log all moderation actions with admin identity and timestamp
- **FR-028**: System MUST flag merchant accounts for suspension review after 10 content removal violations

#### Backend - Blocking Database

- **FR-029**: System MUST maintain user-specific block lists
- **FR-030**: System MUST filter blocked merchant content in all queries serving consumer feeds/searches
- **FR-031**: System MUST auto-delete resolved content reports and inactive block records after 1 week

### Key Entities

- **ContentReport**: A consumer's report of merchant content, including report reason, timestamp, content reference, reporter reference, status (pending/reviewed/dismissed), and review outcome; retained for 1 week after resolution
- **BlockedMerchant**: A relationship between a consumer and a merchant they've blocked, enabling content filtering
- **EULAAcceptance**: A record of a merchant's agreement to terms, including version accepted, timestamp, and IP address
- **ModerationAction**: An administrator's action on reported content, including action type (approve/remove/suspend), timestamp, admin identity, and notes
- **ContentGuidelines**: The platform's content policy document, versioned for EULA tracking
- **ViolationRecord**: A merchant's history of content removals; 10 violations triggers suspension review

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of merchant content (store profiles, coupon images) have visible and functional report buttons
- **SC-002**: 100% of reported content receives administrative review within 24 hours
- **SC-003**: Consumers can complete the report flow (tap Report > select reason > submit) in under 30 seconds
- **SC-004**: Consumers can block a merchant in 2 taps or fewer from the merchant's profile
- **SC-005**: Privacy Policy is accessible within 2 taps from any screen, including pre-login screens
- **SC-006**: 100% of new merchants see and must accept EULA before their first upload succeeds
- **SC-007**: Support contact information is visible in Help section with no broken links
- **SC-008**: Moderation dashboard displays all pending reports with complete information (timestamp, reason, content preview)
- **SC-009**: App passes Apple App Store review for Guideline 1.2 (User-Generated Content) requirements

## Clarifications

### Session 2026-01-20

- Q: What is the violation threshold for merchant account suspension? → A: 10 violations triggers suspension review
- Q: How long should content reports and block records be retained? → A: 1 week (initial policy, may extend later)
- Q: What channel should be used for escalation alerts? → A: Email only (via existing Resend API)

## Assumptions

- The consumer app and merchant app are separate applications (based on the checklist distinction)
- The moderation dashboard will be a web-based admin interface (not mobile)
- Existing user authentication systems will be used for admin access to moderation tools
- Report escalation alerts will use existing Resend API email infrastructure
- Content removal hides content from consumers but preserves it in the database for audit purposes
- The 24-hour response SLA applies to initial review, not resolution
- Violation thresholds for suspension will be configurable by administrators
- Both apps already have a Settings/Options menu where new features can be added
