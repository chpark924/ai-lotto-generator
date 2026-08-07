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

export default function TabsLayout() {
  const { colors } = useAppTheme();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#0F172A" },
        headerTintColor: "#fff",
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
            <TabIcon source={require("../../assets/tab-icons/home.png")} size={size} />
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
