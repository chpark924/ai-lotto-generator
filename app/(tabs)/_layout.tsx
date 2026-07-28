import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#0F172A" },
        headerTintColor: "#fff",
        tabBarActiveTintColor: "#2563EB",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "홈",
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
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
