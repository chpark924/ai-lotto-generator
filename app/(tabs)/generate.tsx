import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

const MENU_ITEMS: { title: string; description: string; path: string }[] = [
  {
    title: "제외하고 생성",
    description: "나오지 않을 것 같은 번호를 제외한 뒤 무작위로 생성합니다.",
    path: "/generate/exclusion",
  },
  {
    title: "AI 조합 탐색",
    description: "기기 안에서 최대 10만 개의 후보를 비교해 조건에 맞는 조합을 찾습니다.",
    path: "/generate/ai-search",
  },
  {
    title: "나의 행운번호",
    description: "생년월일과 선호번호로 나만의 번호를 만듭니다.",
    path: "/generate/lucky",
  },
  {
    title: "45면체 주사위",
    description: "가상의 45면체 주사위를 굴려 번호를 정합니다.",
    path: "/generate/dice",
  },
  {
    title: "운명의 신",
    description: "목표 당첨자 수와 번호 성격을 설정하는 게임형 생성입니다.",
    path: "/generate/destiny",
  },
];

export default function GenerateHubScreen() {
  const router = useRouter();
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.header}>번호 만들기</Text>
      <Text style={styles.subHeader}>모든 번호 생성은 이 기기 안에서만 계산됩니다.</Text>
      {MENU_ITEMS.map((item) => (
        <Pressable key={item.path} style={styles.card} onPress={() => router.push(item.path as never)}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardDesc}>{item.description}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { fontSize: 22, fontWeight: "800", color: "#0F172A", marginBottom: 4 },
  subHeader: { fontSize: 13, color: "#64748B", marginBottom: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginBottom: 4 },
  cardDesc: { fontSize: 12, color: "#64748B", lineHeight: 18 },
});
