import { useEffect } from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { AppErrorBoundary } from "../src/components";
import { ThemeProvider } from "../src/theme";

// 스플래시(로고) 최소 노출 시간(ms). 앱 초기화 자체는 순간적으로 끝나서
// 기본 동작대로 두면 로고가 거의 안 보이고 바로 사라짐 — 타사 앱들과
// 비슷한 수준으로 로고를 인지할 수 있게 인위적으로 최소 시간을 확보한다.
const MIN_SPLASH_DURATION_MS = 1000;

// 앱이 준비되기 전에 네이티브 스플래시가 자동으로 사라지는 것을 막는다.
// (RootLayout 마운트보다 먼저 실행돼야 하므로 모듈 최상단에서 호출)
SplashScreen.preventAutoHideAsync().catch(() => {
  // Fast Refresh 등으로 중복 호출돼도 무시 가능한 에러
});

export default function RootLayout() {
  // [DESIGN_GUIDE.md 5절 / Phase 5b, 2026-09-10] Pretendard 4종(Regular/Medium/
  // SemiBold/Bold)을 여기서 한 번만 로드한다. 스플래시를 폰트 로딩 완료 전에
  // 내려버리면(또는 화면을 먼저 그려버리면) 시스템 기본 폰트로 잠깐 렌더링됐다가
  // Pretendard로 바뀌는 깜빡임(FOUC)이 생긴다 — 그래서 fontsLoaded(또는 로딩 실패
  // fontError, 실패해도 앱이 영원히 멈추면 안 되니 이 경우도 "준비 완료"로 취급해
  // 시스템 폰트로 폴백)가 true가 되기 전에는 스플래시를 내리지도, 화면을 그리지도
  // 않는다.
  const [fontsLoaded, fontError] = useFonts({
    "Pretendard-Regular": require("../assets/fonts/Pretendard-Regular.otf"),
    "Pretendard-Medium": require("../assets/fonts/Pretendard-Medium.otf"),
    "Pretendard-SemiBold": require("../assets/fonts/Pretendard-SemiBold.otf"),
    "Pretendard-Bold": require("../assets/fonts/Pretendard-Bold.otf"),
  });
  const fontsReady = fontsLoaded || !!fontError;

  useEffect(() => {
    if (!fontsReady) return;
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, MIN_SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, [fontsReady]);

  if (!fontsReady) {
    // 네이티브 스플래시가 여전히 화면을 덮고 있는 상태 — 여기서 null을 반환해도
    // 사용자에게는 그냥 스플래시가 조금 더 떠 있는 것으로 보인다.
    return null;
  }

  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerStyle: { backgroundColor: "#0F172A" }, headerTintColor: "#fff" }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            {/* "번호 만들기"의 각 기능 화면(app/generate/ 폴더 전체)을 하나의 중첩 스택으로 묶어
                등록한다(app/generate/_layout.tsx 참고) — 그 파일 상단 주석에 프레젠테이션 방식을
                모달에서 표준 push로 되돌린 이유(QA_LOG.md 87번)를 정리해 뒀다. 여기서는
                headerShown만 끄고(중첩 스택이 자기 헤더를 그린다) 프레젠테이션은 기본값을 쓴다. */}
            <Stack.Screen name="generate" options={{ headerShown: false }} />
            <Stack.Screen name="preferences" options={{ title: "선호번호 · 제외번호 세트" }} />
            <Stack.Screen name="privacy" options={{ title: "개인정보처리방침" }} />
          </Stack>
        </SafeAreaProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
