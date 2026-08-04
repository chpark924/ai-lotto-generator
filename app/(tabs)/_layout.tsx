import { Image } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../src/theme";

/**
 * "홈" 탭만 기본 집 아이콘 대신 브랜드 로고(집+G)를 쓴다 — 브랜드 인지도를 위해서다.
 * 다른 탭 아이콘(Ionicons)과 톤을 맞추려고 tintColor로 활성/비활성 색을 그대로 입힌다.
 * PNG는 투명 배경 + 단색 실루엣에 가까운 형태로 미리 다듬어 둔 것이라(assets/tab-icon-home.png),
 * tintColor를 입혀도 로고 형태(집+G)가 뭉개지지 않고 또렷하게 보인다.
 */
function HomeTabIcon({ color, size }: { color: string; size: number }) {
  return (
    <Image
      source={require("../../assets/tab-icon-home.png")}
      resizeMode="contain"
      style={{ width: size, height: size, tintColor: color }}
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
          tabBarIcon: ({ color, size }) => <HomeTabIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="generate"
        options={{
          title: "번호 만들기",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shuffle" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="lab"
        options={{
          title: "로또 연구소",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: "내 번호",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ticket" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
