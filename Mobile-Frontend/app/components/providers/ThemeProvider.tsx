import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme as useRNColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Define ThemeContext type
type ThemeContextType = {
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;
  effectiveTheme: "light" | "dark";
};

// Create ThemeContext
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Export useTheme hook
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

// Create ThemeProvider component
const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const systemColorScheme = useRNColorScheme();
  const [theme, setThemeState] = useState<"light" | "dark" | "system">("system");
  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">("light");

  // Load saved theme from AsyncStorage
  useEffect(() => {
    const loadTheme = async () => {
      const savedTheme = (await AsyncStorage.getItem("theme")) as
        | "light"
        | "dark"
        | "system"
        | null;
      if (savedTheme) {
        setThemeState(savedTheme);
      }
    };
    loadTheme();
  }, []);

  // Update effective theme based on current theme and system preference
  useEffect(() => {
    const newEffectiveTheme = theme === "system"
      ? (systemColorScheme ?? "light")
      : theme;

    setEffectiveTheme(newEffectiveTheme);

    // Apply theme to document root for CSS-based theming
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.classList.remove('t_light', 't_dark');
      root.classList.add(`t_${newEffectiveTheme}`);
    }
  }, [theme, systemColorScheme]);

  // Handle theme changes
  const handleSetTheme = async (newTheme: "light" | "dark" | "system") => {
    setThemeState(newTheme);
    await AsyncStorage.setItem("theme", newTheme);
  };

  const contextValue: ThemeContextType = {
    theme,
    setTheme: handleSetTheme,
    effectiveTheme,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;
