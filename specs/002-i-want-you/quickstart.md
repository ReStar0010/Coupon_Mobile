# Quickstart: Project Architecture Documentation

**Feature**: 002-i-want-you  
**Date**: 2025年9月25日  
**Estimated Time**: 30 minutes

## Prerequisites
- Access to Coupon_Mobile repository
- Basic understanding of React Native and Django
- Text editor or IDE

## Quick Setup (5 minutes)

### 1. Clone and Navigate
```bash
git clone https://github.com/ReStar0010/Coupon_Mobile.git
cd Coupon_Mobile
```

### 2. Explore Project Structure
```bash
# View high-level structure
ls -la

# Check frontend structure  
ls -la Mobile-Frontend/app/

# Check backend structure
ls -la Backend/api/
```

## Understanding the Architecture (15 minutes)

### 3. Frontend Analysis
```bash
# Navigate to frontend
cd Mobile-Frontend

# Check package.json for dependencies
cat package.json | grep -A 20 '"dependencies"'

# Explore main app structure
find app/ -name "*.tsx" | head -10
```

**Key Files to Examine**:
- `app/_layout.tsx` - Root layout and navigation setup
- `app/index.tsx` - Main entry point
- `app/Collection/index.tsx` - Coupon collection feature
- `app/components/` - Shared UI components

### 4. Backend Analysis  
```bash
# Navigate to backend
cd ../Backend

# Check Django models
cat api/models.py | grep "^class"

# Check API views
ls -la api/views/

# Check URL routing
cat Backend/urls.py
```

**Key Files to Examine**:
- `api/models.py` - Database models and relationships
- `api/views/` - API endpoint implementations  
- `api/serializers.py` - API data serialization
- `Backend/settings.py` - Django configuration

### 5. Database Schema Understanding
```bash
# Check migrations for database structure
ls -la api/migrations/

# View recent migration
cat api/migrations/0024_*.py
```

## Verify Understanding (10 minutes)

### 6. Architecture Verification
Answer these questions to verify your understanding:

1. **What UI library is the mobile app using?**
   - Answer: Tamagui (check `Mobile-Frontend/package.json`)

2. **What authentication method does the backend use?**
   - Answer: JWT (check `Backend/requirements.txt` for `djangorestframework_simplejwt`)

3. **How many main feature areas are in the mobile app?**
   - Answer: 4 main areas (Collection, EasyUse, Login, Statistics - check `app/` directory)

4. **What database is currently being used?**
   - Answer: SQLite (check `Backend/db.sqlite3` file)

5. **How are mobile app routes structured?**
   - Answer: File-based routing with Expo Router (check `app/` directory structure)

### 7. Quick Test
```bash
# Check if you can identify the main data models
cd Backend
python manage.py shell -c "from api.models import *; print([model.__name__ for model in [User, Coupon, Store, Log]])"
```

## Next Steps
- Explore specific components in detail
- Review API endpoints in `api/views/`  
- Understand data flow between frontend and backend
- Check authentication implementation
- Review mobile app navigation patterns

## Success Criteria
✅ You can identify the main technology stack  
✅ You understand the project directory structure  
✅ You can locate key configuration files  
✅ You can identify the main data models  
✅ You understand the frontend-backend relationship

**Time Taken**: _____ minutes  
**Understanding Level**: ___/10  
**Questions/Notes**: ________________