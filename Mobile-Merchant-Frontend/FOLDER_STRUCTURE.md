# Folder Structure

This document describes the folder structure of the Mobile-Merchant-Frontend project.

## Overview

```
Mobile-Merchant-Frontend/
├── app/                    # Expo Router app directory
│   ├── (auth)/            # Authentication routes group
│   │   └── login.tsx      # Login screen
│   ├── (tabs)/            # Tab navigation routes (sample code - can be ignored)
│   └── _layout.tsx        # Root layout with Tamagui provider
│
├── components/            # Reusable components
│   └── ui/               # UI component library
│       ├── Button.tsx    # Button component
│       ├── Input.tsx     # Input component
│       └── index.ts      # Barrel export
│
├── constants/             # Constants and configuration
│   ├── colors.ts         # Color constants from Figma design
│   └── tokens.ts         # Tamagui design tokens
│
├── types/                 # TypeScript type definitions
│   └── index.ts          # Common types
│
├── hooks/                 # Custom React hooks (for future use)
├── utils/                 # Utility functions (for future use)
├── services/             # API services (for future use)
│
├── tamagui.config.ts     # Tamagui configuration
├── tamagui-web.css       # Auto-generated CSS for web
├── babel.config.js       # Babel configuration
├── metro.config.js       # Metro bundler configuration
└── package.json          # Dependencies and scripts
```

## Directory Details

### `/app`
Expo Router directory. All routes are defined here using the file-based routing system.

- `(auth)/` - Authentication route group
  - `login.tsx` - Login screen component

- `_layout.tsx` - Root layout that wraps the entire app with TamaguiProvider

### `/components`
Reusable React components organized by category.

- `ui/` - Base UI components built with Tamagui
  - `Button.tsx` - Customizable button component with variants
  - `Input.tsx` - Form input component with label and error support

### `/constants`
Application-wide constants and configuration.

- `colors.ts` - Color palette matching Figma design tokens
- `tokens.ts` - Tamagui design tokens (spacing, sizes, fonts, etc.)

### `/types`
TypeScript type definitions shared across the application.

- `index.ts` - Common types (e.g., LoginFormData, AuthResponse)

### Future Directories

- `/hooks` - Custom React hooks (e.g., useAuth, useForm)
- `/utils` - Utility functions (e.g., validation, formatting)
- `/services` - API service layer (e.g., authService, apiClient)

## Design System

The project uses Tamagui for UI components and follows the Figma design tokens:

- **Colors**: Primary yellow (#FFAD31), Secondary black (#333333), etc.
- **Spacing**: Consistent spacing scale (4px, 8px, 13px, 16px, 18px, 20px, 32px)
- **Typography**: Inter font family with various weights
- **Border Radius**: 9px for inputs and buttons
- **Component Heights**: 44px for inputs and buttons

## Naming Conventions

- **Components**: PascalCase (e.g., `LoginScreen.tsx`)
- **Files**: camelCase for utilities, PascalCase for components
- **Folders**: lowercase with hyphens for multi-word names
- **Types**: PascalCase with descriptive names (e.g., `LoginFormData`)

## Path Aliases

The project uses TypeScript path aliases configured in `tsconfig.json`:

- `@/*` - Maps to project root directory

Example: `import { colors } from '@/constants/colors';`

