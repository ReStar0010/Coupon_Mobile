import { devDebug } from "../../utils/devLogger";
import { useEffect } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from "expo-router";

export const useAuthCheck = (isAuthenticated: boolean, authLoading: boolean) => {
  const router = useRouter();

  useEffect(() => {
    // Only check if useRequireAuth says we're not authenticated and not loading
    if (!authLoading && !isAuthenticated) {
      checkAuthenticationStatus();
    }
  }, [isAuthenticated, authLoading]);

  const checkAuthenticationStatus = async () => {
    try {
      // Check AsyncStorage for auth tokens
      const authToken = await AsyncStorage.getItem("auth_token");
      const isLoggedIn = await AsyncStorage.getItem("is_logged_in");
      const userInfo = await AsyncStorage.getItem("user_info");

      devDebug("Manual auth check in Statistics:", {
        isAuthenticated,
        authLoading,
        hasToken: !!authToken,
        isLoggedIn: isLoggedIn === "true",
        hasUserInfo: !!userInfo,
      });

      // If we do have a token but useRequireAuth failed, try to restore auth state
      if (authToken || isLoggedIn === "true") {
        // Instead of reloading the page, navigate to login to refresh auth state
        // This will trigger the auth flow again
        router.replace("/login");
      }
    } catch (error) {
      devDebug("Error checking auth status:", error);
    }
  };
};
