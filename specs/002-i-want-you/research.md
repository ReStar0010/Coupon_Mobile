# Research: Project Architecture Documentation

**Date**: 2025年9月25日  
**Feature**: 002-i-want-you  
**Status**: Phase 0 Complete

## Project Analysis

### Current Structure Analysis
```
Coupon_Mobile/
├── Backend/                    # Django REST API
│   ├── Backend/               # Django project settings
│   ├── api/                   # Main application
│   │   ├── models.py         # Data models (User, Coupon, Store, etc.)
│   │   ├── views/            # API endpoints
│   │   ├── serializers.py    # API serialization
│   │   └── migrations/       # Database migrations
│   ├── db.sqlite3            # SQLite database
│   └── requirements.txt      # Python dependencies
│
├── Mobile-Frontend/           # React Native/Expo app
│   ├── app/                  # Expo Router pages
│   │   ├── Collection/       # Coupon collection features
│   │   ├── EasyUse/         # Store coupon browsing
│   │   ├── Login/           # Authentication
│   │   ├── Statistics/      # User statistics
│   │   └── components/      # Shared UI components
│   ├── assets/              # Images and resources
│   └── package.json         # Node.js dependencies
│
├── .specify/                 # Development workflow
├── specs/                    # Feature specifications
└── .github/                  # GitHub workflows and prompts
```

### Technology Stack Identified
**Frontend**:
- React Native 0.79.5 with Expo 53
- TypeScript for type safety
- Tamagui for UI components
- Expo Router for navigation
- AsyncStorage for local data

**Backend**:
- Django 5.2 with Django REST Framework
- Python 3.11
- SQLite database
- JWT authentication
- CORS enabled for mobile access

### Key Architectural Patterns
1. **Mobile-First Design**: React Native app with REST API backend
2. **Component-Based UI**: Tamagui design system with reusable components
3. **Route-Based Navigation**: Expo Router with file-based routing
4. **MVC Pattern**: Django follows Model-View-Controller architecture
5. **API-First**: Backend provides REST endpoints for mobile consumption

### Data Flow Analysis
```
Mobile App → HTTP Requests → Django API → SQLite Database
    ↑                                           ↓
    ← JSON Responses ← Serializers ← ORM Models ←
```

### Authentication Flow
- JWT-based authentication
- Token storage in AsyncStorage
- Protected routes with auth middleware
- Password reset functionality via email

### Core Features Identified
1. **User Management**: Registration, login, profile management
2. **Coupon System**: Store coupons, exclusive coupons, daily draws
3. **Location Services**: Store mapping and location-based features  
4. **Sharing System**: Coupon sharing between users
5. **Statistics**: Usage tracking and analytics

## Clarifications Resolved
- ✅ **Authentication Methods**: JWT tokens with email/password login
- ✅ **Database System**: SQLite for development, easily scalable
- ✅ **Target Audience**: Developers and maintainers needing codebase understanding
- ✅ **Detail Level**: Comprehensive technical documentation with visual aids

## Documentation Scope Defined
1. **System Overview**: High-level architecture diagram
2. **Component Documentation**: Detailed component relationships  
3. **API Documentation**: Endpoint specifications and data models
4. **Development Setup**: Environment configuration and build processes
5. **Database Schema**: Entity relationships and data structure
6. **Deployment Architecture**: Current and recommended deployment patterns

## Technical Constraints Identified
- Mobile app requires offline capabilities for some features
- Cross-platform compatibility (iOS/Android)
- Real-time location services integration
- Image handling and storage for coupons
- Push notification system (potential future feature)

## Research Complete
All NEEDS CLARIFICATION items from specification have been resolved through codebase analysis.