import React, { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { DeepPatternIcon } from "../../src/components/deepPattern";
import { StatusBarSafeMask } from "../../src/components";
import { useAppTheme, type AppColors } from "../../src/theme";

const MENU_ITEMS: {
  title: string;
  description: string;
  path: string;
  /** 기존 5개는 PNG 에셋(require) 아이콘. 딥 패턴만 새 이미지 에셋 없이 SVG 컴포넌트로 그린다. */
  icon?: number;
  iconNode?: React.ReactNode;
  recommended?: boolean;
  hot?: boolean;
  isNew?: boolean;
}[] = [
  {
    title: "제외하고 생성",
    description: "나오지 않을 것 같은 번호를 제외한 뒤 무작위로 생성합니다.",
    path: "/generate/exclusion",
    icon: require("../../assets/quick-menu-icons/exclusion.png"),
  },
  {
    title: "AI 조합 탐색",
    description: "기기 안에서 최대 100만 개의 후보를 비교해 조건에 맞는 조합을 찾습니다.",
    path: "/generate/ai-search",
    icon: require("../../assets/quick-menu-icons/ai-search.png"),
    recommended: true,
  },
  {
    title: "나의 행운번호",
    description: "생년월일과 선호번호로 나만의 번호를 만듭니다.",
    path: "/generate/lucky",
    icon: require("../../assets/quick-menu-icons/lucky.png"),
  },
  {
    title: "45면체 주사위",
    description: "가상의 45면체 주사위를 굴려 번호를 정합니다.",
    path: "/generate/dice",
    icon: require("../../assets/quick-menu-icons/dice.png"),
  },
  {
    title: "운명의 신",
    description: "목표 당첨자 수와 번호 성격을 설정하는 게임형 생성입니다.",
    path: "/generate/destiny",
    icon: require("../../assets/quick-menu-icons/destiny.png"),
    hot: true,
  },
  {
    title: "딥 패턴 탐색",
    description: "역사적으로 덜 관측된 패턴 영역의 번호를 찾아드립니다.",
    path: "/generate/deep-pattern",
    iconNode: <DeepPatternIcon size={48} />,
    isNew: true,
  },
];

export default function GenerateHubScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  // 94번 항목 — 탭 상단 네비게이션 헤더를 숨겼기 때문에(app/(tabs)/_layout.tsx) 안전영역
  // 상단 여백을 직접 챙겨줘야 한다.
  const insets = useSafeAreaInsets();

  // 맨 아래 "딥 패턴 탐색" 카드가 화면 하단에 거의 붙어 있어 스크롤로 더 볼 수 있다는 걸
  // 놓치기 쉽다는 QA 피드백. 처음엔 안내 문구를 달았는데, "이런 문구 있는 앱을 못 봤다,
  // 문구 없이 자연스럽게 더 있다는 것만 보이면 좋겠다"는 후속 피드백을 받아 문구 대신
  // 하단 페이드(그러데이션)로 교체 — 리스트가 아직 안 끝났다는 걸 시각적으로만 암시한다.
  // 스크롤 가능한 상태(아직 콘텐츠가 남음)일 때만 보여주고, 맨 아래까지 스크롤하면 사라진다.
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const remainingScroll = contentHeight - viewportHeight - scrollY;
  const showBottomFade = contentHeight > viewportHeight && remainingScroll > 16;

  return (
    <View style={styles.flexFill} onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: 16 }}
        onContentSizeChange={(_w, h) => setContentHeight(h)}
        onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={32}
      >
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
                  : item.isNew
                    ? `신규. ${item.title}. ${item.description}`
                    : `${item.title}. ${item.description}`
            }
          >
            {item.iconNode ? (
              <View style={styles.cardIconWrap}>{item.iconNode}</View>
            ) : (
              <Image source={item.icon} style={styles.cardIcon} resizeMode="contain" />
            )}
            <View style={styles.cardBody}>
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
                {item.isNew ? (
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>NEW</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.cardDesc}>{item.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        ))}
      </ScrollView>
      {showBottomFade ? (
        <LinearGradient
          pointerEvents="none"
          colors={["transparent", colors.background]}
          style={styles.bottomFade}
        />
      ) : null}
      <StatusBarSafeMask />
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    flexFill: { flex: 1 },
    container: { flex: 1, backgroundColor: colors.background },
    header: { fontSize: 22, fontWeight: "800", color: colors.textPrimary, marginBottom: 4 },
    subHeader: { fontSize: 13, color: colors.textMuted, marginBottom: 14 },
    // 리스트가 아직 안 끝났다는 걸 문구 없이 암시하는 하단 페이드. ScrollView 위에 겹쳐서
    // 마지막 카드의 아랫부분이 배경색으로 자연스럽게 흐려지도록(터치는 통과시킴, pointerEvents="none").
    bottomFade: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 36,
    },
    // 카드 6개가 화면 안에 최대한 여러 개 들어오도록(맨 아래 카드가 스크롤 없이도 일부
    // 보이게) 패딩·간격·아이콘 크기를 기존보다 소폭 줄였다.
    card: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
      // 입체감: 은은한 그림자로 카드가 배경 위에 살짝 떠 있는 느낌을 준다.
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 2,
    },
    // QA_LOG 98번 — 기존엔 눌렀을 때 배경이 colors.surfaceAlt(거의 흰색에 가까운
    // 아주 옅은 회색, #F1F5F9)로만 바뀌어서 "정말 눌렸나?" 싶을 만큼 변화가 약했다.
    // 토스처럼 "확실히 눌렀다"는 게 체감되도록, 한 단계 더 진한 colors.border 톤
    // (라이트: #E2E8F0, 다크에서도 surfaceAlt보다 한 톤 밝은 값)을 배경으로 쓰고,
    // 그림자를 눌리는 순간 완전히 없애 카드가 화면 속으로 살짝 눌려 들어가는
    // 느낌을 더했다.
    cardPressed: {
      backgroundColor: colors.border,
      transform: [{ scale: 0.97 }],
      shadowOpacity: 0,
      elevation: 0,
    },
    cardIcon: { width: 48, height: 48, marginRight: 12 },
    cardIconWrap: { marginRight: 12 },
    cardBody: { flex: 1, marginRight: 8 },
    cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" },
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
    newBadge: {
      backgroundColor: "#6C5CE7",
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    newBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  });
}
