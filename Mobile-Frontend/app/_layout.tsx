import ThemeProvider from "./components/providers/ThemeProvider";
import AuthProvider from "./components/providers/SessionProvider";
import ToastProvider from "./components/providers/ToastProvider";
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <Stack screenOptions={{ headerShown: true }}>
            {/* ... your screens ... */}
          </Stack>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
