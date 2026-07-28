import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerStyle: { backgroundColor: "#0F172A" }, headerTintColor: "#fff" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="generate/exclusion" options={{ title: "제외하고 생성" }} />
        <Stack.Screen name="generate/ai-search" options={{ title: "AI 조합 탐색" }} />
        <Stack.Screen name="generate/lucky" options={{ title: "나의 행운번호" }} />
        <Stack.Screen name="generate/dice" options={{ title: "45면체 주사위" }} />
        <Stack.Screen name="generate/destiny" options={{ title: "운명의 신" }} />
        <Stack.Screen name="generate/result" options={{ title: "생성 결과" }} />
        <Stack.Screen name="preferences" options={{ title: "선호번호 · 제외번호 세트" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
