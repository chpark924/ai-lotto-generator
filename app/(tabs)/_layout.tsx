import { Image } from "react-native";
import { Tabs } from "expo-router";
import { useAppTheme } from "../../src/theme";

/**
 * 하단 탭 아이콘 전부 입체(글로시) 스타일 풀컬러 PNG로 통일했다(assets/tab-icons/).
 * 토스/카카오뱅크/네이버 등 주요 앱들처럼, 아이콘 자체는 항상 고유 색을 유지하고
 * 선택 상태는 라벨 텍스트 색(tabBarActiveTintColor/InactiveTintColor)만으로 구분한다 —
 * 그래서 여기서는 tintColor를 입히지 않고 원본 색 그대로 렌더링한다.
 */
function TabIcon({ source, size }: { source: number; size: number }) {
  return (
    <Image
      source={source}
      resizeMode="contain"
      style={{ width: size + 6, height: size + 6 }}
    />
  );
}

// 홈 브랜드 로고는 원래 진한 차콜 색이라, 다크모드의 어두운 탭바 배경(#161F32)
// 위에서는 거의 안 보일 만큼 대비가 낮다. 그래서 다크모드 전용으로 톤을 밝게 뒤집은
// 버전을 따로 준비해 스킴에 따라 골라 쓴다(형태·오렌지 포인트는 동일, 명암만 반전).
const homeIconLight = require("../../assets/tab-icons/home.png");
const homeIconDark = require("../../assets/tab-icons/home-dark.png");

export default function TabsLayout() {
  const { colors, scheme } = useAppTheme();
  return (
    <Tabs
      screenOptions={{
        // 62/63번에서 "홈" 등 헤더 타이틀 글자 크기·영역을 줄였는데, 실기기에서 보니 그 작아진
        // 텍스트가 어색하고 깨진 것처럼 보인다는 후속 피드백(94번) — 네비게이션 헤더 자체를
        // 완전히 숨기고 화면을 깔끔하게 쓴다. "번호 만들기"/"로또 연구소" 탭은 이미 화면 콘텐츠
        // 안에 자체 제목(styles.header)이 따로 있어 헤더를 숨겨도 제목이 사라지지 않고, "홈"/
        // "내 번호" 탭은 원래도 화면 콘텐츠 쪽에 별도 제목 텍스트가 없었으므로(홈은 히어로
        // 카드로, 내 번호는 "선호번호·제외번호 세트 관리" 링크로 바로 시작) 헤더를 숨기면
        // 그 화면들은 최상단에 제목 텍스트가 아예 없어진다 — "깨끗하게 쓰자"는 요청에 맞는
        // 의도된 결과.
        headerShown: false,
        tabBarActiveTintColor: "#2563EB",
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "홈",
          tabBarIcon: ({ size }) => (
            <TabIcon source={scheme === "dark" ? homeIconDark : homeIconLight} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="generate"
        options={{
          title: "번호 만들기",
          tabBarIcon: ({ size }) => (
            <TabIcon source={require("../../assets/tab-icons/generate.png")} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="lab"
        options={{
          title: "로또 연구소",
          tabBarIcon: ({ size }) => (
            <TabIcon source={require("../../assets/tab-icons/lab.png")} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: "내 번호",
          tabBarIcon: ({ size }) => (
            <TabIcon source={require("../../assets/tab-icons/tickets.png")} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
