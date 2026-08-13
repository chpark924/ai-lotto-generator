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
            {/* "번호 만들기"의 각 기능 화면(제외해보기/AI 조합탐색/행운번호/45면체 주사위/운명의
                신/딥 패턴 탐색/QR당첨확인 등, app/generate/ 폴더 전체)은 홈 화면 "바로가기"나
                빠른 메뉴에서 진입하면 탭바가 사라지고 작은 '‹' 뒤로가기만 남아 "홈으로 돌아갈
                방법이 없다"는 QA 피드백(2026-08-13)으로 이어졌다. 이 폴더를 하나의 중첩
                스택(app/generate/_layout.tsx)으로 묶고, 그 그룹 전체를 여기서 한 번만
                presentation:"modal"로 등록한다 — 진입 시 아래→위로 슬라이드해 올라와 "홈
                위에 작업을 잠깐 얹는다"는 게 시각적으로 분명해지고, 중첩 스택 쪽에 둔 명확한
                "닫기" 버튼으로 바로 홈에 돌아갈 수 있다. 그룹 내부 이동(예: ai-search→result)은
                중첩 스택 안에서 평소처럼 일반 push로 그대로 동작한다. */}
            <Stack.Screen name="generate" options={{ headerShown: false, presentation: "modal" }} />
            <Stack.Screen name="preferences" options={{ title: "선호번호 · 제외번호 세트" }} />
            <Stack.Screen name="privacy" options={{ title: "개인정보처리방침" }} />
          </Stack>
        </SafeAreaProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
