import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "nativewind";
import AsyncStorage from "@react-native-async-storage/async-storage";

// 定義 ThemeContext 的類型
type ThemeContextType = {
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;
  effectiveTheme: "light" | "dark";
};

// 創建 ThemeContext
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// 導出 useTheme hook
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

// 創建 ThemeProvider 組件
const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const { colorScheme, setColorScheme } = useColorScheme();
  const [theme, setThemeState] = useState<"light" | "dark" | "system">("system");

  // 1. 從 AsyncStorage 加載保存的主題
  useEffect(() => {
    const loadTheme = async () => {
      const savedTheme = (await AsyncStorage.getItem("theme")) as
        | "light"
        | "dark"
        | "system"
        | null;
      if (savedTheme) {
        setThemeState(savedTheme);
        setColorScheme(savedTheme);
      }
    };
    loadTheme();
  }, [setColorScheme]);

  // 2. 處理主題變更
  const handleSetTheme = async (newTheme: "light" | "dark" | "system") => {
    setThemeState(newTheme);
    setColorScheme(newTheme);
    await AsyncStorage.setItem("theme", newTheme);
  };

  const contextValue: ThemeContextType = {
    theme,
    setTheme: handleSetTheme,
    effectiveTheme: colorScheme ?? "light",
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;