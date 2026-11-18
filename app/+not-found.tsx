/**
 * 알 수 없는 주소로 앱이 열렸을 때의 화면 (2026-11-18).
 * 기본 "Unmatched Route" 화면(영어, 내부 화면 목록 "Sitemap" 링크 노출) 대신 보여준다.
 * 카카오 링크는 +native-intent.tsx에서 이미 홈으로 보내지만, 다른 예상 못 한 링크에 대한 안전망이다.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useAppTheme, type AppColors, type BrandTokens } from "../src/theme";

export default function NotFoundScreen() {
  const router = useRouter();
  const { colors, brand } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors, brand), [colors, brand]);
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <Text style={styles.title}>페이지를 찾을 수 없어요</Text>
        <Text style={styles.body}>요청하신 화면이 없거나 주소가 바뀌었어요.</Text>
        <Pressable
          style={styles.button}
          onPress={() => router.replace("/")}
          accessibilityRole="button"
          accessibilityLabel="홈으로 가기"
        >
          <Text style={styles.buttonText}>홈으로 가기</Text>
        </Pressable>
      </View>
    </>
  );
}

function createStyles(colors: AppColors, brand: BrandTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      backgroundColor: colors.background,
    },
    title: { fontSize: 18, fontWeight: "800", color: colors.textPrimary, marginBottom: 8 },
    body: { fontSize: 14, color: colors.textSecondary, marginBottom: 20, textAlign: "center" },
    button: { backgroundColor: brand.dark, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
    buttonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  });
}
