# Login Components Documentation

## Overview
The login page has been successfully translated from web HTML/CSS to React Native components with proper separation of concerns.

## Component Structure

### Main Login Page
- **File**: `app/Login/index.tsx`
- **Purpose**: Main container that orchestrates the login flow
- **Features**: 
  - State management for email and password
  - Navigation handlers for register and forgot password
  - Responsive layout with ScrollView and SafeAreaView

### Individual Components

#### 1. LoginFormContainer
- **File**: `app/Login/components/LoginFormContainer.tsx`
- **Purpose**: Contains the entire login form layout
- **Props**:
  - `email`, `setEmail`: Email state management
  - `password`, `setPassword`: Password state management
  - `handleLogin`: Login submission handler
  - `onRegisterPress`: Navigation to registration
  - `onForgotPasswordPress`: Navigation to password reset

#### 2. LoginHeader
- **File**: `app/Login/components/LoginHeader.tsx`
- **Purpose**: Displays the "登入" (Login) title
- **Features**: Inter font family, custom styling

#### 3. LoginInput
- **File**: `app/Login/LoginInput.tsx`
- **Purpose**: Reusable input component for email and password
- **Props**:
  - `placeholder`: Input placeholder text
  - `secureTextEntry`: For password fields
  - Extends `TextInputProps` for full TextInput functionality

#### 4. LoginButton
- **File**: `app/Login/LoginButton.tsx`
- **Purpose**: Styled login button
- **Props**:
  - `title`: Button text
  - `onPress`: Click handler

#### 5. LinkText
- **File**: `app/Login/LinkText.tsx`
- **Purpose**: Text with clickable links (register/forgot password)
- **Props**:
  - `normalText`: Regular text part
  - `linkText`: Clickable text part
  - `onLinkPress`: Click handler for the link

## Custom Colors Added to Tailwind Config

The following colors were added to support the login design:

```javascript
colors: {
  'login-bg': '#1F1F1F',        // Dark background
  'login-dark': '#2D2D2D',      // Input background
  'login-border': '#404040',    // Input border
  'login-gray': '#FFFFFF',      // Text color
  'login-light-gray': '#9CA3AF', // Placeholder color
  'login-orange': '#FF6B35',    // Accent color for buttons and links
}
```

## Key React Native Adaptations

1. **HTML to React Native Elements**:
   - `<div>` → `<View>`
   - `<input>` → `<TextInput>`
   - `<button>` → `<TouchableOpacity>`
   - `<h1>`, `<span>` → `<Text>`

2. **Layout Components**:
   - Added `SafeAreaView` for proper mobile layout
   - Added `ScrollView` for content that might overflow
   - Used `contentContainerStyle` for proper flex layout

3. **Font Handling**:
   - Applied Inter font family through inline styles
   - Maintained consistent typography across components

4. **Touch Interactions**:
   - Used `TouchableOpacity` with `activeOpacity` for visual feedback
   - Implemented `onPress` handlers for navigation

## Usage Example

```tsx
import React, { useState } from "react";
import { View, ScrollView, SafeAreaView } from "react-native";
import { LoginFormContainer } from "./components/LoginFormContainer";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    // Your login logic here
  };

  return (
    <SafeAreaView className="min-h-screen bg-login-bg">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 items-center justify-center p-4">
          <View className="w-full max-w-[320px] mx-auto">
            <LoginFormContainer
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              handleLogin={handleLogin}
              onRegisterPress={() => {/* Navigate to register */}}
              onForgotPasswordPress={() => {/* Navigate to forgot password */}}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

## Next Steps

1. **Integration**: Connect the login handlers to your authentication API
2. **Navigation**: Implement proper navigation to register and forgot password screens
3. **Validation**: Add form validation for email and password fields
4. **Loading States**: Add loading indicators during authentication
5. **Error Handling**: Display error messages for failed login attempts
