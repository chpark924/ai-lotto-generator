import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAppTheme, type AppColors } from "../../src/theme";

const MENU_ITEMS: { title: string; description: string; path: string; recommended?: boolean; hot?: boolean }[] = [
  {
    title: "제외하고 생성",
    description: "나오지 않을 것 같은 번호를 제외한 뒤 무작위로 생성합니다.",
    path: "/generate/exclusion",
  },
  {
    title: "AI 조합 탐색",
    description: "기기 안에서 최대 100만 개의 후보를 비교해 조건에 맞는 조합을 찾습니다.",
    path: "/generate/ai-search",
    recommended: true,
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
    hot: true,
  },
];

export default function GenerateHubScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.header}>번호 만들기</Text>
      <Text style={styles.subHeader}>모든 번호 생성은 이 기기 안에서만 계산됩니다.</Text>
      {MENU_ITEMS.map((item) => (
        <Pressable
          key={item.path}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          android_ripple={{ color: "#E2E8F0" }}
          onPress={() => router.push(item.path as never)}
          accessibilityRole="button"
          accessibilityLabel={
            item.recommended
              ? `추천. ${item.title}. ${item.description}`
              : item.hot
                ? `HOT. ${item.title}. ${item.description}`
                : `${item.title}. ${item.description}`
          }
        >
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {item.recommended ? (
              <View style={styles.recommendedBadge}>
                <Text style={styles.recommendedBadgeText}>추천</Text>
              </View>
            ) : null}
            {item.hot ? (
              <View style={styles.hotBadge}>
                <Text style={styles.hotBadgeText}>HOT</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.cardDesc}>{item.description}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { fontSize: 22, fontWeight: "800", color: colors.textPrimary, marginBottom: 4 },
    subHeader: { fontSize: 13, color: colors.textMuted, marginBottom: 16 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardPressed: {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.border,
      transform: [{ scale: 0.98 }],
    },
    cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
    cardTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
    cardDesc: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
    recommendedBadge: {
      backgroundColor: "#2563EB",
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    recommendedBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
    hotBadge: {
      backgroundColor: "#DC2626",
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    hotBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  });
}
