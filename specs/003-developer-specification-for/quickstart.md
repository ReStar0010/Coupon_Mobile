# Coupon_Mobile Developer Quickstart Guide

**Version**: 1.0.0  
**Last Updated**: 2025-09-25  
**Prerequisites**: Node.js 18+, Python 3.11+, Git

## 🚀 Quick Setup (5 minutes)

### 1. Clone and Setup Repository
```bash
# Clone the repository
git clone https://github.com/ReStar0010/Coupon_Mobile.git
cd Coupon_Mobile

# Setup backend environment
cd Backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Setup frontend environment  
cd ../Mobile-Frontend
npm install
```

### 2. Database Setup
```bash
# From Backend directory
cd Backend
python manage.py migrate
python manage.py createsuperuser
python manage.py shell -c "from api.management.create_default_tags import create_default_tags; create_default_tags()"
```

### 3. Start Development Servers
```bash
# Terminal 1: Start Django backend
cd Backend
python manage.py runserver

# Terminal 2: Start React Native frontend
cd Mobile-Frontend
npx expo start
```

### 4. Verify Setup
- Backend API: http://localhost:8000/admin (login with superuser)
- Mobile App: Scan QR code with Expo Go app or use simulator
- API Documentation: http://localhost:8000/api/docs (if configured)

## 📱 First App Experience

### Student User Flow (5 minutes)
1. **Register Account**: Open app → Tap "Register" → Choose "Student" → Enter email/password
2. **Browse Coupons**: Navigate to "Collection" tab → View available store coupons
3. **Daily Draw**: Tap "Daily Draw" banner → Participate in exclusive coupon draws
4. **Redeem Coupon**: Go to "EasyUse" tab → Show QR code to merchant
5. **Check Statistics**: Visit "Statistics" tab → View savings progress

### Merchant User Flow (5 minutes)
1. **Register Account**: Choose "Merchant" during registration
2. **Create Store**: Use Django admin → Add Store with location coordinates
3. **Create Coupon Template**: Add CouponTemplate for daily draws
4. **Create Store Coupons**: Add general Coupon with type="store"
5. **Monitor Usage**: Check CouponRedemption records in admin

## 🏗️ Architecture Overview (2 minutes)

### Technology Stack
```
📱 Mobile Frontend (React Native + Expo)
├── TypeScript + Tamagui UI
├── Expo Router (file-based navigation)
├── AsyncStorage (offline data)
└── JWT Authentication

🔗 API Communication (REST + JSON)
├── HTTP requests via Axios
├── JWT token in headers
└── Offline-first caching

⚙️ Backend (Django REST Framework)
├── Python 3.11 + Django 5.2
├── SQLite (dev) / PostgreSQL (prod)
├── JWT Authentication
└── Admin interface
```

### Project Structure
```
Coupon_Mobile/
├── Mobile-Frontend/           # React Native app
│   ├── app/                  # Expo Router pages
│   │   ├── Collection/       # Coupon browser + daily draws
│   │   ├── EasyUse/         # Store coupon redemption
│   │   ├── Login/           # Authentication
│   │   ├── Statistics/      # User savings dashboard
│   │   └── OptionsMenu/     # Settings + profile
│   ├── components/          # Reusable UI components
│   └── assets/              # Images + icons
└── Backend/                 # Django API server
    ├── api/                 # Main app logic
    │   ├── models.py        # Data models
    │   ├── serializers.py   # API serialization  
    │   ├── views/           # API endpoints
    │   └── migrations/      # Database schema
    └── Backend/             # Django settings
```

## 🔑 Key Concepts (3 minutes)

### Dual Coupon System
- **Store Coupons**: Unlimited use, visible to all users, promote foot traffic
- **Exclusive Coupons**: Single-use, personalized, obtained through daily draws

### Daily Draw Mechanics
1. Merchants create **CouponTemplate** with quantity (e.g., 10 coupons)
2. Students participate in timed draws with probability rates
3. Successful draws generate **Coupon** instances with unique redeem codes
4. Template deactivates when quantity reaches zero

### Peer-to-Peer Sharing
1. Student creates **CouponShareRequest** with unique token
2. Recipient receives notification with share link
3. Accept/decline changes **Coupon.current_holder**
4. Audit trail maintained in **Log** model

### Location-Based Discovery
- Stores have lat/lng coordinates for map display
- Mobile app requests location permissions
- Proximity-based filtering for nearby stores
- Fallback behavior when location unavailable

## 🧪 Testing Strategy (2 minutes)

### Backend Testing
```bash
cd Backend
python manage.py test                    # Run Django tests
python -m pytest contracts/            # Run API contract tests
```

### Frontend Testing
```bash
cd Mobile-Frontend
npm test                                # Run Jest tests
npm run lint                           # Check code style
```

### Contract Testing
- API contracts defined in `specs/contracts/api-spec.yaml`
- Contract tests in `specs/contracts/test_api_contracts.py`
- Tests validate request/response schemas
- Initially FAIL (no implementation), then PASS

## 🔧 Development Workflow (2 minutes)

### Feature Development Process
1. **Specification**: Create feature spec in `/specs/[###-feature-name]/`
2. **Planning**: Generate implementation plan with data models + contracts
3. **TDD Approach**: Write contract tests first (they should fail)
4. **Implementation**: Build features to make tests pass
5. **Validation**: Run tests, check constitution compliance

### Git Workflow
```bash
# Create feature branch
git checkout -b 004-new-feature-name

# Make changes following Tamagui patterns
# Update documentation as needed

# Commit and push
git add .
git commit -m "Add new feature: description"
git push origin 004-new-feature-name
```

### Code Style Requirements
- **Frontend**: TypeScript + Tamagui components only
- **Backend**: Django patterns + DRF serializers
- **Documentation**: Update specs/ directory for changes
- **Constitution**: Follow mobile-first, reusable components principles

## 🐛 Common Issues & Solutions

### Backend Issues
```bash
# Database migration issues
python manage.py makemigrations
python manage.py migrate

# Static files not serving
python manage.py collectstatic

# Port already in use
lsof -ti:8000 | xargs kill -9
```

### Frontend Issues
```bash
# Metro bundler cache issues
npx expo start --clear

# iOS simulator not working
npx expo run:ios

# Android emulator issues
npx expo run:android
```

### Authentication Issues
- Check JWT token expiration in AsyncStorage
- Verify backend CORS headers configuration
- Ensure user groups (Student/Merchant) are set correctly

## 📊 Key Metrics & Monitoring

### User Statistics Tracked
- `coupons_used_count`: Total redemptions per user
- `total_savings`: Lifetime savings amount
- `monthly_savings`: Current month savings (auto-resets)
- Savings goals with progress tracking

### System Analytics
- **Log Model**: Tracks all user actions (view, redeem, share)
- **CouponRedemption**: Detailed transaction records
- **Store Performance**: Redemption counts per location
- **Template Success**: Daily draw participation rates

## 🚀 Deployment Options

### Development Environment
- Django development server (localhost:8000)
- Expo Development Build with live reload
- SQLite database (no external dependencies)

### Production Considerations
- **Backend**: Gunicorn + Uvicorn with PostgreSQL
- **Frontend**: EAS Build + App Store distribution
- **Infrastructure**: Consider Docker containers for scaling
- **Monitoring**: Add logging, error tracking, analytics

## 🔗 Additional Resources

### Documentation
- [Feature Specifications](./spec.md) - Complete requirements
- [Data Model](./data-model.md) - Entity relationships
- [API Contracts](./contracts/api-spec.yaml) - OpenAPI specification
- [Research Document](./research.md) - Architecture decisions

### Development Tools
- **Django Admin**: http://localhost:8000/admin (data management)
- **Expo DevTools**: Real-time debugging and profiling
- **React Native Debugger**: Component inspection
- **Tamagui Studio**: Design system documentation

### Community
- **Expo Documentation**: https://docs.expo.dev/
- **Tamagui Docs**: https://tamagui.dev/
- **Django REST Framework**: https://www.django-rest-framework.org/

---

**Next Steps**: After completing this quickstart, explore the [Implementation Plan](./plan.md) for detailed development tasks, or dive into the [Data Model](./data-model.md) to understand entity relationships.

**Need Help?** Check the troubleshooting section above or review the constitutional principles in `.specify/memory/constitution.md` for development standards.