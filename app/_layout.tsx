import { useEffect } from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { AppErrorBoundary } from "../src/components";
import { ThemeProvider } from "../src/theme";

// 스플래시(로고) 최소 노출 시간(ms). 앱 초기화 자체는 순간적으로 끝나서
// 기본 동작대로 두면 로고가 거의 안 보이고 바로 사라짐 — 타사 앱들과
// 비슷한 수준으로 로고를 인지할 수 있게 인위적으로 최소 시간을 확보한다.
const MIN_SPLASH_DURATION_MS = 1500;

// 앱이 준비되기 전에 네이티브 스플래시가 자동으로 사라지는 것을 막는다.
// (RootLayout 마운트보다 먼저 실행돼야 하므로 모듈 최상단에서 호출)
SplashScreen.preventAutoHideAsync().catch(() => {
  // Fast Refresh 등으로 중복 호출돼도 무시 가능한 에러
});

export default function RootLayout() {
  useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, MIN_SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerStyle: { backgroundColor: "#0F172A" }, headerTintColor: "#fff" }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="generate/exclusion" options={{ title: "제외하고 생성" }} />
            <Stack.Screen name="generate/ai-search" options={{ title: "AI 조합 탐색" }} />
            <Stack.Screen name="generate/lucky" options={{ title: "나의 행운번호" }} />
            <Stack.Screen name="generate/dice" options={{ title: "45면체 주사위" }} />
            <Stack.Screen name="generate/destiny" options={{ title: "운명의 신" }} />
            <Stack.Screen name="generate/deep-pattern" options={{ title: "딥 패턴 탐색" }} />
            <Stack.Screen name="generate/deep-pattern-result" options={{ title: "딥 패턴 탐색 결과" }} />
            <Stack.Screen name="generate/deep-pattern-detail" options={{ title: "패턴 상세" }} />
            <Stack.Screen name="generate/result" options={{ title: "생성 결과" }} />
            <Stack.Screen name="preferences" options={{ title: "선호번호 · 제외번호 세트" }} />
            <Stack.Screen name="privacy" options={{ title: "개인정보처리방침" }} />
          </Stack>
        </SafeAreaProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
