import { Stack } from "expo-router";

/**
 * "번호 만들기"의 각 기능 화면들(제외해보기/AI 조합탐색/행운번호/45면체 주사위/운명의 신/
 * 딥 패턴 탐색/QR당첨확인 등)을 하나의 중첩 스택으로 묶는다. 이 안에서의 이동(예:
 * ai-search → result, deep-pattern → deep-pattern-result → deep-pattern-detail)은
 * 평소처럼 일반 push로 동작한다.
 *
 * 프레젠테이션 방식(QA_LOG.md 86→87번 히스토리): 처음엔(86번) 이 화면들이 탭바 밖의 별도
 * push 화면이라 홈에서 들어가면 돌아갈 방법이 안 보인다는 피드백에 아래→위 모달로 바꿨는데,
 * 사용자가 실기기에서 써본 뒤 "이게 정말 일반적인 패턴이냐"고 재차 확인 요청(87번). 검토
 * 결과: 모달(아래→위 슬라이드)은 보통 '작성/설정/필터'처럼 짧고 일회성인 작업에 쓰는 패턴이고,
 * 이 화면들은 "번호 만들기" 탭의 핵심 기능 그 자체라 다단계로 오래 머무를 수 있다 — 대부분의
 * 앱(토스·카카오뱅크 등)이 이런 "다른 섹션의 기능으로 이동"에는 오른쪽에서 들어오는 일반
 * push + 표준 뒤로가기 버튼을 쓰지, 모달을 쓰지 않는다. 그래서 프레젠테이션은 기본값(오른쪽에서
 * 슬라이드 인)으로 되돌리고, 원래 문제였던 "홈으로 돌아갈 방법이 안 보인다"는 부분은 여기서
 * headerLeft를 커스텀하지 않고 React Navigation이 기본 제공하는 표준 '‹' 뒤로가기 버튼에
 * 맡긴다 — 이 화면들이 중첩 스택으로 묶여 있어도, 그 안의 첫 화면(예: 홈에서 막 들어온
 * ai-search)에서 뒤로가기를 누르면 표준 동작대로 이 그룹 전체가 pop되어 정확히 홈으로
 * 돌아간다(react-navigation 공식 동작 — 자식 스택의 첫 화면에서 더 갈 곳이 없으면 부모
 * 스택까지 pop됨). 커스텀 버튼 없이도 모든 유저가 이미 알고 있는 가장 표준적인 뒤로가기라
 * 오히려 더 안정적이고 예측 가능하다.
 */
export default function GenerateLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0F172A" },
        headerTintColor: "#fff",
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
