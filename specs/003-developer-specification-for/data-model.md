# Data Model: Coupon_Mobile Project

**Feature**: Developer Specification Documentation  
**Date**: 2025-09-25  
**Status**: Complete

## Overview

This document defines the data entities, relationships, and validation rules for the Coupon_Mobile project based on the existing Django models and functional requirements.

## Core Entities

### User (Django Built-in + Extensions)
**Purpose**: Authentication and base user management  
**Location**: `django.contrib.auth.models.User`

**Core Fields**:
- `id`: Primary key (auto-generated)
- `username`: Unique username (unused in favor of email)
- `email`: User email address (primary identifier)
- `password`: Hashed password
- `first_name`: Optional first name
- `last_name`: Optional last name
- `is_active`: Account active status
- `date_joined`: Account creation timestamp
- `groups`: User groups (Student/Merchant)

**Validation Rules**:
- Email must be unique and valid format
- Password must meet strength requirements
- Groups determine user type (Student/Merchant)

**Relationships**:
- One-to-One: StudentProfile, MerchantProfile, PasswordResetProfile
- One-to-Many: Store (as owner), CouponRedemption, Log entries
- Foreign Key: Coupon (as original_owner, last_holder, current_holder)

---

### StudentProfile
**Purpose**: Extended profile for student users (coupon consumers)  
**Location**: `Backend/api/models.py`

**Fields**:
- `user`: OneToOneField(User) - linked user account
- `phone_number`: CharField(20) - contact number (unique, optional)
- `verified`: BooleanField - email verification status
- `email_verification_token`: CharField(64) - unique verification token
- `coupons_used_count`: IntegerField - total redemptions counter
- `total_savings`: DecimalField(10,2) - lifetime savings amount
- `monthly_savings`: DecimalField(10,2) - current month savings
- `last_savings_reset`: DateField - last monthly reset date
- `savings_goal_name`: CharField(100) - personal savings goal name
- `savings_goal_amount`: DecimalField(10,2) - target savings amount
- `savings_goal_image`: CharField(200) - goal image URL
- `last_draw_time`: DateTimeField - last daily draw participation
- `last_logged_in`: DateTimeField - last login tracking

**Validation Rules**:
- phone_number must be unique if provided
- email_verification_token must be unique
- savings amounts must be non-negative
- monthly_savings resets automatically each month

**Methods**:
- `update_monthly_savings()`: Resets monthly savings on month change

**State Transitions**:
- Unverified → Verified (via email verification)
- Monthly savings: Accumulated → Reset (monthly cycle)

---

### MerchantProfile  
**Purpose**: Extended profile for merchant users (coupon creators)  
**Location**: `Backend/api/models.py`

**Fields**:
- `user`: OneToOneField(User) - linked user account
- `phone`: CharField(20) - business contact phone
- `contact_person`: CharField(100) - primary contact name
- `contact_info`: CharField(100) - additional contact (Line ID, etc.)

**Validation Rules**:
- All contact fields required for merchant verification
- phone format validation
- contact_person must be provided

**Relationships**:
- Owns multiple Store entities
- Can create CouponTemplate and Coupon entities

---

### Store
**Purpose**: Physical merchant locations for coupon redemption  
**Location**: `Backend/api/models.py`

**Fields**:
- `owner`: ForeignKey(User) - merchant who owns this store
- `name`: CharField(100) - store display name
- `lat`: FloatField - latitude coordinate
- `lng`: FloatField - longitude coordinate  
- `address`: CharField(200) - physical address
- `business_hours`: TextField - operating hours (optional)

**Validation Rules**:
- owner must be in Merchant group
- lat/lng must be valid coordinates
- name and address required
- Unique constraint on (owner, name) to prevent duplicates

**Relationships**:
- Belongs to one Merchant (owner)
- Has many Coupon and CouponTemplate entities

---

### Tag
**Purpose**: Categorization system for coupons  
**Location**: `Backend/api/models.py`

**Fields**:
- `name`: CharField(50) - internal tag identifier (unique)
- `display_name`: CharField(50) - user-friendly display name

**Validation Rules**:
- name must be unique and lowercase
- display_name for UI presentation

**Relationships**:
- Many-to-Many with Coupon and CouponTemplate

**Common Tags**: food, shopping, entertainment, health, education, services

---

### CouponTemplate
**Purpose**: Blueprint for generating multiple exclusive coupons with daily draw mechanics  
**Location**: `Backend/api/models.py`

**Fields**:
- `store`: ForeignKey(Store) - associated store location
- `coupon_name`: CharField(100) - coupon display name
- `coupon_detail`: TextField - detailed description
- `important_notes`: TextField - terms and conditions (optional)
- `image_url`: CharField(255) - promotional image URL (optional)
- `estimated_savings`: DecimalField(10,2) - expected savings amount
- `template_redeem_code`: CharField(6) - shared redeem code (optional)
- `tags`: ManyToManyField(Tag) - categorization tags
- `total_quantity`: PositiveIntegerField - initial coupon quantity
- `remaining_quantity`: PositiveIntegerField - available coupons
- `start_date`: DateTimeField - campaign start time
- `expiry_date`: DateTimeField - campaign end time
- `draw_probability`: FloatField(0-1) - success probability for draws
- `created_at`: DateTimeField - template creation timestamp
- `is_active`: BooleanField - template availability status

**Validation Rules**:
- remaining_quantity ≤ total_quantity
- start_date < expiry_date
- draw_probability between 0.0 and 1.0
- template_redeem_code exactly 6 characters if provided

**Methods**:
- `generate_coupon(recipient)`: Creates new Coupon from template, decreases quantity

**State Transitions**:
- Active → Inactive (when remaining_quantity reaches 0)
- Available → Expired (when expiry_date passes)

---

### Coupon
**Purpose**: Individual coupon instances for redemption  
**Location**: `Backend/api/models.py`

**Fields**:
- `store`: ForeignKey(Store) - redemption location
- `template`: ForeignKey(CouponTemplate) - source template (nullable)
- `coupon_name`: CharField(100) - coupon display name
- `coupon_detail`: TextField - detailed description
- `important_notes`: TextField - terms and conditions (optional)
- `start_date`: DateTimeField - valid from date
- `expiry_date`: DateTimeField - valid until date
- `image_url`: CharField(255) - promotional image URL (optional)
- `coupon_type`: CharField(10) - "store" or "exclusive"
- `estimated_savings`: DecimalField(10,2) - expected savings
- `tags`: ManyToManyField(Tag) - categorization
- `original_owner`: ForeignKey(User) - initial recipient (exclusive only)
- `last_holder`: ForeignKey(User) - previous owner (exclusive only)
- `current_holder`: ForeignKey(User) - current owner (exclusive only)
- `redeem_code`: CharField(6) - unique redemption code (exclusive only)
- `usage_per_day`: CharField(10) - "one-time" or "unlimited"

**Validation Rules**:
- coupon_type in ["store", "exclusive"]
- usage_per_day in ["one-time", "unlimited"] 
- For "store" type: original_owner, last_holder, current_holder, template, redeem_code must be NULL
- For "exclusive" type: current_holder required, redeem_code required
- start_date < expiry_date

**Methods**:
- `is_redeemed()`: Check if exclusive coupon has been redeemed
- `get_redemption_count()`: Count total redemptions
- `get_unique_users_count()`: Count unique users who redeemed

**State Transitions**:
- Available → Expired (when expiry_date passes)
- Unredeemed → Redeemed (for exclusive coupons)
- Owner transfers via CouponShareRequest

---

### CouponRedemption
**Purpose**: Transaction record for coupon usage  
**Location**: `Backend/api/models.py`

**Fields**:
- `coupon`: ForeignKey(Coupon) - redeemed coupon
- `user`: ForeignKey(User) - user who redeemed
- `redeemed_at`: DateTimeField - redemption timestamp
- `savings_amount`: DecimalField(10,2) - actual savings amount (optional)
- `coupon_type`: CharField(20) - denormalized field for constraints

**Validation Rules**:
- For exclusive coupons: unique constraint (coupon, user)
- For store coupons: multiple redemptions allowed
- savings_amount must be non-negative

**Constraints**:
- `unique_exclusive_coupon_redemption`: Prevents duplicate exclusive redemptions

---

### CouponShareRequest
**Purpose**: Peer-to-peer coupon sharing mechanism  
**Location**: `Backend/api/models.py`

**Fields**:
- `coupon`: ForeignKey(Coupon) - coupon being shared
- `from_user`: ForeignKey(User) - sender
- `to_user`: ForeignKey(User) - recipient (nullable)
- `token`: CharField(64) - unique verification token
- `status`: CharField(16) - "pending", "accepted", "declined"
- `created_at`: DateTimeField - request creation time
- `responded_at`: DateTimeField - response timestamp (nullable)

**Validation Rules**:
- token must be unique across all requests
- status must be in valid choices
- Only exclusive coupons can be shared
- from_user must be current_holder

**State Transitions**:
- Pending → Accepted (coupon ownership transfers)
- Pending → Declined (no ownership change)
- Pending → Expired (timeout handling)

---

### Log
**Purpose**: Audit trail for user actions and system events  
**Location**: `Backend/api/models.py`

**Fields**:
- `timestamp`: DateTimeField - event occurrence time
- `action`: CharField(20) - action type ("view", "redeem", "share")
- `user`: ForeignKey(User) - user performing action (nullable)
- `coupon`: ForeignKey(Coupon) - related coupon (nullable)

**Validation Rules**:
- action must be in predefined choices
- timestamp automatically set on creation

**Common Actions**: "view", "redeem", "share", "view EasyUse", "draw"

---

### CompletedGoal
**Purpose**: Achievement tracking for user savings milestones  
**Location**: `Backend/api/models.py`

**Fields**:
- `user`: ForeignKey(User) - goal achiever
- `name`: CharField(100) - goal description
- `amount`: DecimalField(10,2) - target amount achieved
- `image`: CharField(200) - goal image URL (optional)
- `completed_date`: DateTimeField - achievement timestamp

**Validation Rules**:
- amount must be positive
- name required for display

**Ordering**: Most recent goals first (`-completed_date`)

---

### PasswordResetProfile
**Purpose**: Secure password reset token management  
**Location**: `Backend/api/models.py`

**Fields**:
- `user`: OneToOneField(User) - user requesting reset
- `token`: CharField(100) - unique reset token (nullable)
- `token_created_at`: DateTimeField - token generation time (nullable)

**Validation Rules**:
- token expires after configured time period
- token must be unique when generated

**Security**: Token automatically expires for security

## Entity Relationships Summary

```
User (1) ←→ (1) StudentProfile
User (1) ←→ (1) MerchantProfile  
User (1) ←→ (1) PasswordResetProfile
User (1) ←→ (0..n) Store [as owner]
User (1) ←→ (0..n) Coupon [as original_owner, last_holder, current_holder]
User (1) ←→ (0..n) CouponRedemption
User (1) ←→ (0..n) CouponShareRequest [as from_user, to_user]
User (1) ←→ (0..n) Log
User (1) ←→ (0..n) CompletedGoal

Store (1) ←→ (0..n) Coupon
Store (1) ←→ (0..n) CouponTemplate

CouponTemplate (1) ←→ (0..n) Coupon [via template field]
CouponTemplate (0..n) ←→ (0..n) Tag

Coupon (1) ←→ (0..n) CouponRedemption
Coupon (1) ←→ (0..n) CouponShareRequest
Coupon (1) ←→ (0..n) Log
Coupon (0..n) ←→ (0..n) Tag
```

## Data Flow Patterns

### Coupon Lifecycle
1. **Template Creation**: Merchant creates CouponTemplate with quantity
2. **Daily Draw**: Students participate, system calls `generate_coupon()`
3. **Coupon Generated**: New Coupon instance created, template quantity decreases
4. **Sharing** (Optional): CouponShareRequest created, ownership transfers
5. **Redemption**: CouponRedemption record created, user statistics updated
6. **Completion**: Log entry created, savings goals checked

### User Statistics Updates
1. **Redemption Event**: CouponRedemption created
2. **Profile Update**: StudentProfile savings counters incremented
3. **Goal Check**: Compare against savings_goal_amount
4. **Goal Achievement**: CompletedGoal record created if threshold reached
5. **Monthly Reset**: Background task resets monthly_savings

### Sharing Workflow
1. **Share Initiation**: CouponShareRequest created with unique token
2. **Notification**: Recipient receives share notification
3. **Response**: to_user accepts/declines request
4. **Ownership Transfer**: Coupon current_holder updated on acceptance
5. **Audit Trail**: Log entries created for share events

This data model supports the dual coupon ecosystem (store/exclusive), peer-to-peer sharing, location-based discovery, daily draw mechanics, and comprehensive user statistics tracking as defined in the functional requirements.