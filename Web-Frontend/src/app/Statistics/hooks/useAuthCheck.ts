import { devDebug } from "@/app/utils/devLogger";
import { useEffect } from "react";

export const useAuthCheck = (isAuthenticated: boolean, authLoading: boolean) => {
  useEffect(() => {
    // Only check if useRequireAuth says we're not authenticated and not loading
    if (!authLoading && !isAuthenticated) {
      // Check cookies directly
      const hasToken = document.cookie.includes("auth_token=");
      const isLoggedIn = document.cookie.includes("is_logged_in=");
      devDebug("Manual auth check in Statistics:", {
        isAuthenticated,
        authLoading,
        hasToken,
        isLoggedIn,
        cookies: document.cookie,
      });

      // If we do have a token but useRequireAuth failed, force a refresh
      if (hasToken || isLoggedIn) {
        // This will refresh the page, forcing a full reload of auth state
        window.location.reload();
      }
    }
  }, [isAuthenticated, authLoading]);
};
