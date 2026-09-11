import { useEffect } from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { AppErrorBoundary } from "../src/components";
import { ThemeProvider, brand } from "../src/theme";

// 스플래시(로고) 최소 노출 시간(ms). 앱 초기화 자체는 순간적으로 끝나서
// 기본 동작대로 두면 로고가 거의 안 보이고 바로 사라짐 — 타사 앱들과
// 비슷한 수준으로 로고를 인지할 수 있게 인위적으로 최소 시간을 확보한다.
const MIN_SPLASH_DURATION_MS = 1000;

// 앱이 준비되기 전에 네이티브 스플래시가 자동으로 사라지는 것을 막는다.
// (RootLayout 마운트보다 먼저 실행돼야 하므로 모듈 최상단에서 호출)
SplashScreen.preventAutoHideAsync().catch(() => {
  // Fast Refresh 등으로 중복 호출돼도 무시 가능한 에러
});

// [2026-09-11 원복] Phase 5b에서 여기 있던 Pretendard 4종 useFonts 로딩을 제거했다.
// 처음엔 로딩만 끄고 화면 곳곳의 `fontFamily: fontFamily.bold` 스타일 참조(약 40여 곳)는
// 그대로 뒀었다 — RN이 이름을 못 찾는 커스텀 폰트를 시스템 기본 폰트로 조용히 폴백해주기
// 때문에 겉보기엔 문제가 없어 보였다. 그런데 실기기(Android)에서 재확인한 결과 일부
// 텍스트의 볼드(굵기)가 의도와 다르게 옅어 보이는 문제가 있었다 — Android에서는 미등록
// fontFamily 문자열이 지정된 상태에서 fontWeight를 함께 주면, 폴백 타이프페이스 선택
// 과정에서 fontWeight가 온전히 반영되지 않는 경우가 있다. 그래서 이번엔 로딩만 끄는 데
// 그치지 않고, 화면들에 남아 있던 `fontFamily: fontFamily.bold` 참조 자체를 전부
// 제거했다(그 화면들에 이미 있던 `fontWeight` 값은 그대로 뒀다 — Phase 5b/5c는 항상
// "이미 fontWeight 600 이상이던 제목/버튼급 텍스트"에만 fontFamily를 얹는 방식이었어서,
// fontFamily만 걷어내면 원래 굵기로 정확히 되돌아간다). assets/fonts/*.otf,
// src/theme/typography.ts의 `fontFamily` 토큰 자체는 그대로 남겨뒀다 — 나중에 폰트를
// 다시 도입하고 싶으면 이 파일에 useFonts 호출을 되돌리고, 각 화면에 fontFamily 참조를
// 다시 추가하면 된다.
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
          <Stack
            screenOptions={{
              // [Phase 5c 브랜드 토큰 확장, 2026-09-10] "#0F172A" 하드코딩 → brand.dark
              // (이 컴포넌트가 ThemeProvider 자신이라 useAppTheme()는 못 쓰지만, brand는
              // 테마 무관 고정 상수라 직접 import해 쓸 수 있다).
              headerStyle: { backgroundColor: brand.dark },
              headerTintColor: "#fff",
            }}
          >
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
