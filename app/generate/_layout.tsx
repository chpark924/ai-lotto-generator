import { Pressable, Text } from "react-native";
import { Stack, useRouter } from "expo-router";

/**
 * "번호 만들기"의 각 기능 화면들(제외해보기/AI 조합탐색/행운번호/45면체 주사위/운명의 신/
 * 딥 패턴 탐색/QR당첨확인 등)을 하나의 중첩 스택으로 묶는다. 루트(app/_layout.tsx)는 이
 * 그룹 전체를 presentation:"modal" 하나로 등록하고(아래→위로 슬라이드해 올라오는 모달),
 * 이 안에서의 이동(예: ai-search → result, deep-pattern → deep-pattern-result →
 * deep-pattern-detail)은 평소처럼 일반 push로 그대로 동작한다.
 *
 * 왜 필요한가(QA_LOG.md 86번): 예전엔 이 화면들이 루트 스택에 개별 등록된 평범한 push
 * 화면이라, 홈 화면 "바로가기"/빠른 메뉴로 들어가면 탭바가 완전히 사라지고 상단의 작은
 * '‹' 뒤로가기 버튼만 남았다 — 탭 전환에 익숙한 유저 입장에선 "홈으로 돌아갈 방법이 없다"로
 * 느껴졌다. 모달 프레젠테이션으로 바꾸면 "홈 위에 작업을 잠깐 얹는다"는 게 시각적으로도
 * 분명해지고, 아래 headerLeft의 "닫기" 버튼으로 뒤로가기를 여러 번 누르지 않고도 바로 홈으로
 * 돌아갈 수 있다(iOS는 위→아래로 스와이프해서 닫는 것도 그대로 가능).
 */
export default function GenerateLayout() {
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0F172A" },
        headerTintColor: "#fff",
        headerLeft: () => (
          <Pressable
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 16 }}
            accessibilityRole="button"
            accessibilityLabel="닫기"
          >
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>닫기</Text>
          </Pressable>
        ),
      }}
    >
      <Stack.Screen name="exclusion" options={{ title: "제외하고 생성" }} />
      <Stack.Screen name="ai-search" options={{ title: "AI 조합 탐색" }} />
      <Stack.Screen name="lucky" options={{ title: "나의 행운번호" }} />
      <Stack.Screen name="dice" options={{ title: "45면체 주사위" }} />
      <Stack.Screen name="destiny" options={{ title: "운명의 신" }} />
      <Stack.Screen name="deep-pattern" options={{ title: "딥 패턴 탐색" }} />
      <Stack.Screen name="deep-pattern-result" options={{ title: "딥 패턴 탐색 결과" }} />
      <Stack.Screen name="deep-pattern-detail" options={{ title: "패턴 상세" }} />
      <Stack.Screen name="result" options={{ title: "생성 결과" }} />
      <Stack.Screen name="qr-check" options={{ title: "QR 당첨 확인" }} />
    </Stack>
  );
}
