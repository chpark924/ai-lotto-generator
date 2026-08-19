import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../theme";

/**
 * QA_LOG 105번 — 94번에서 탭 화면들의 헤더를 없애고 `contentContainerStyle`에
 * `paddingTop: insets.top + N`을 줘서 "처음 진입했을 때" 콘텐츠가 상태표시줄과 안 겹치게
 * 만들었는데, 실기기(에지투에지 상태표시줄을 쓰는 최신 Android)에서 보니 그건 스크롤 위치가
 * 맨 위일 때만 유효했다. 상태표시줄은 화면 위에 반투명하게 "얹혀" 있을 뿐 그 아래 콘텐츠를
 * 완전히 가려주지 않기 때문에, 유저가 스크롤을 하면 카드들이 다시 상태표시줄 영역 "밑으로"
 * 지나가면서 시계·배터리 아이콘과 뒤섞여 보였다(특히 짙은 배경의 카드가 지나갈 때 두드러짐 —
 * 로또 연구소의 "이번 주 리포트" 카드가 대표 사례).
 *
 * 이 컴포넌트는 상태표시줄 높이(insets.top)만큼을 화면 배경색으로 칠한 판을 스크롤
 * 콘텐츠 "위에" 고정해 둬서, 스크롤 중 무엇이 그 아래로 지나가든 상태표시줄 영역만큼은
 * 항상 화면 배경색 그대로 보이게 만든다(터치는 pointerEvents="none"으로 그대로 통과시켜
 * 스크롤/탭 동작을 막지 않는다). 각 탭 화면(app/(tabs)/*.tsx)의 최상위 컨테이너 — 스크롤
 * 컴포넌트(ScrollView/SectionList)와 형제 위치, 그리고 JSX상 그 뒤(= 화면상 그 위)에 둔다.
 */
export function StatusBarSafeMask() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  if (insets.top <= 0) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: insets.top,
        backgroundColor: colors.background,
      }}
    />
  );
}
