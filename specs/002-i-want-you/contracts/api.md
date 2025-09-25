# API Contracts: Architecture Documentation

**Feature**: 002-i-want-you  
**Date**: 2025年9月25日

## Documentation Endpoints

### GET /api/architecture/overview
**Purpose**: Retrieve high-level system architecture information

**Request**: No parameters
**Response**:
```json
{
  "system": {
    "name": "Coupon_Mobile",
    "version": "1.0.0",
    "architecture": "mobile-api",
    "components": ["frontend", "backend", "database"]
  },
  "frontend": {
    "technology": "React Native + Expo",
    "ui_library": "Tamagui",
    "navigation": "Expo Router"
  },
  "backend": {
    "technology": "Django + DRF",
    "database": "SQLite",
    "authentication": "JWT"
  }
}
```

### GET /api/architecture/components
**Purpose**: List all system components and their relationships

**Response**:
```json
{
  "components": [
    {
      "name": "Mobile Frontend",
      "type": "client",
      "technology": "React Native",
      "dependencies": ["Backend API"],
      "features": ["Authentication", "Coupon Management", "Location Services"]
    },
    {
      "name": "Backend API", 
      "type": "server",
      "technology": "Django",
      "dependencies": ["Database"],
      "endpoints": ["auth", "coupons", "stores", "users"]
    }
  ]
}
```

### GET /api/architecture/data-model
**Purpose**: Retrieve database schema and entity relationships

**Response**:
```json
{
  "entities": [
    {
      "name": "User",
      "fields": ["id", "email", "password", "is_active"],
      "relationships": {
        "has_one": ["StudentProfile"],
        "has_many": ["Coupon", "Log"]
      }
    }
  ],
  "relationships": [
    {
      "from": "User",
      "to": "Coupon", 
      "type": "one_to_many",
      "field": "source_user"
    }
  ]
}
```

## Frontend Component Contracts

### ArchitectureDiagram Component
**Purpose**: Render visual architecture diagrams

**Props**:
```typescript
interface ArchitectureDiagramProps {
  type: 'overview' | 'components' | 'data-flow';
  data: ArchitectureData;
  interactive?: boolean;
  onComponentClick?: (component: string) => void;
}
```

### ComponentTree Component  
**Purpose**: Display hierarchical component structure

**Props**:
```typescript
interface ComponentTreeProps {
  structure: ComponentStructure;
  expandedPaths?: string[];
  onToggle?: (path: string) => void;
}
```

## Data Contracts

### ArchitectureData Interface
```typescript
interface ArchitectureData {
  system: SystemInfo;
  components: Component[];
  relationships: Relationship[];
  technologies: Technology[];
}

interface Component {
  id: string;
  name: string;
  type: 'frontend' | 'backend' | 'database' | 'external';
  description: string;
  dependencies: string[];
  technologies: string[];
}
```

These contracts define the interface between documentation components and ensure consistent data flow throughout the architecture documentation system.