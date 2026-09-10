import React, { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import { AppColors, AppTints, BrandTokens, brand, darkColors, darkTints, lightColors, lightTints } from "./colors";

export interface AppTheme {
  scheme: "light" | "dark";
  colors: AppColors;
  tints: AppTints;
  /** 테마 무관 고정 브랜드 토큰(colors.ts 참고). `brand`를 직접 import해도 되지만,
   *  다른 토큰들처럼 useAppTheme() 한 곳에서 같이 꺼내 쓸 수 있도록 여기도 노출한다. */
  brand: BrandTokens;
}

const ThemeContext = createContext<AppTheme>({
  scheme: "light",
  colors: lightColors,
  tints: lightTints,
  brand,
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
      brand,
    }),
    [scheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): AppTheme {
  return useContext(ThemeContext);
}
