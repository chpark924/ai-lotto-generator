import React, { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import { AppColors, AppTints, darkColors, darkTints, lightColors, lightTints } from "./colors";

export interface AppTheme {
  scheme: "light" | "dark";
  colors: AppColors;
  tints: AppTints;
}

const ThemeContext = createContext<AppTheme>({
  scheme: "light",
  colors: lightColors,
  tints: lightTints,
});

/**
 * app.json의 userInterfaceStyle이 "automatic"이므로 시스템 다크모드 여부를
 * useColorScheme()으로 그대로 따라간다. 별도의 수동 토글 UI는 없다(요청 범위 밖).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const scheme: "light" | "dark" = systemScheme === "dark" ? "dark" : "light";

  const value = useMemo<AppTheme>(
    () => ({
      scheme,
      colors: scheme === "dark" ? darkColors : lightColors,
      tints: scheme === "dark" ? darkTints : lightTints,
    }),
    [scheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): AppTheme {
  return useContext(ThemeContext);
}
