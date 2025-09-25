# Data Model: Project Architecture Documentation

**Feature**: 002-i-want-you  
**Phase**: 1  
**Date**: 2025年9月25日

## Core Entities

### User Management
- **User**: System user with authentication credentials
- **StudentProfile**: Extended user profile with app-specific data
- **PasswordResetProfile**: Temporary password reset tokens

### Coupon System  
- **Coupon**: Individual coupon instances with redemption tracking
- **CouponTemplate**: Template definitions for daily draw coupons
- **DailyDrawCoupon**: Special coupons available through daily lottery

### Store Management
- **Store**: Physical locations offering coupons
- **Tag**: Category labels for coupons and stores

### Activity Tracking
- **Log**: User activity and coupon usage history
- **CompletedGoal**: Achievement tracking for user milestones
- **CouponShareRequest**: Sharing requests between users

## Entity Relationships

```
User (1) ←→ (1) StudentProfile
User (1) ←→ (*) Coupon [via source_user, redeemed_by, last_holder]
User (1) ←→ (*) CouponShareRequest [via from_user]
User (1) ←→ (*) Log [via user]
User (1) ←→ (*) CompletedGoal [via user]

Store (1) ←→ (*) Coupon [via store]
Store (1) ←→ (*) CouponTemplate [via store]
Store (*) ←→ (*) Tag [many-to-many]

CouponTemplate (1) ←→ (*) DailyDrawCoupon
Coupon (*) ←→ (*) Tag [many-to-many]
```

## Data Flow Patterns

### Authentication Flow
```
Mobile App → Login Request → Django Auth → JWT Token → AsyncStorage
```

### Coupon Lifecycle
```
Template Creation → Daily Draw → Coupon Instance → User Collection → Redemption
```

### Sharing Flow  
```
User A → Share Request → Token Generation → User B → Accept/Decline → Transfer
```

## Key Attributes by Entity

### User
- Authentication: email, password, verification status
- Metadata: date_joined, is_active, last_login

### Coupon
- Identity: coupon_name, coupon_type (store/exclusive)
- Validity: start_date, expiry_date
- Usage: usage_per_day, estimated_savings
- Relationships: store, source_user, tags

### Store
- Identity: store_name, redeem_code
- Location: address, coordinates (if applicable)
- Owner: User reference for management

This data model supports the core functionality while maintaining clear separation of concerns and enabling efficient queries for mobile app consumption.