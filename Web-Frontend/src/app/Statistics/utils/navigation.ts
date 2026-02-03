import { useRouter } from "next/navigation";
import { useCallback } from "react";

export const useNavigateToOptionsMenu = () => {
  const router = useRouter();
  
  // Navigate to options menu
  const navigateToOptionsMenu = useCallback(() => {
    // Store the current page path in sessionStorage before navigating
    if (typeof window !== "undefined") {
      sessionStorage.setItem("optionsMenuSource", "/Statistics");
    }
    router.push("/OptionsMenu");
  }, [router]);
  
  return navigateToOptionsMenu;
};
