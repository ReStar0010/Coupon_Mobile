import React from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import ThemeProvider from "./components/providers/ThemeProvider";
import AuthProvider from "./components/providers/SessionProvider";
import ToastProvider from "./components/providers/ToastProvider";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <Stack screenOptions={{ headerShown: true }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="Login" />
              <Stack.Screen name="EasyUse" />
              <Stack.Screen name="Collection" />
              <Stack.Screen name="Statistics" />
              <Stack.Screen name="OptionsMenu" />
            </Stack>
            <StatusBar style="auto" />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
