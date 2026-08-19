import React, { useEffect, useState } from "react";
import { Image, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { estimateLatestDrawNumber, getRecentDrawsSafe, getLongestAbsentNumbers, computeNumberFrequencies } from "../../src/lib/draws";
import { getGenerationHistory } from "../../src/lib/storage";
import { ENTERTAINMENT_NOTICE } from "../../src/constants/messages";
import { LottoBall, SettingsSheet, SkeletonBlock, SkeletonBall, StatusBarSafeMask } from "../../src/components";
import { useAppTheme, type AppColors } from "../../src/theme";

function daysUntilNextSaturday(): number {
  const now = new Date();
  const day = now.getDay(); // 0=Sun ... 6=Sat
  const diff = (6 - day + 7) % 7;
  return diff === 0 ? 7 : diff;
}

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  // 94번 항목 — 탭 상단 네비게이션 헤더를 완전히 숨겼기 때문에(app/(tabs)/_layout.tsx),
  // 화면이 상태표시줄/카메라 펀치홀 바로 아래부터 시작하지 않도록 직접 안전영역 상단
  // 여백을 챙겨줘야 한다(예전엔 헤더가 이 역할을 대신 해줬음).
  const insets = useSafeAreaInsets();
  const [latestDrawNumber, setLatestDrawNumber] = useState<number | null>(null);
  const [absentNumbers, setAbsentNumbers] = useState<number[]>([]);
  const [myFrequentNumbers, setMyFrequentNumbers] = useState<number[]>([]);
  const [settingsVisible, setSettingsVisible] = useState(false);
  // 당첨번호 네트워크 조회 + 내 생성 이력 조회가 끝나기 전까지의 상태.
  // 이 값이 true인 동안은 아래 카드들이 스켈레톤으로 표시된다(빈 화면 → 카드가
  // 갑자기 팝업되는 것보다 레이아웃을 미리 보여주는 게 자연스럽다).
  const [loading, setLoading] = useState(true);

  // 홈 화면에서 왼쪽으로 스와이프하면 바로 오른쪽 탭("번호 만들기")으로 이동.
  // 임계값은 RN 스와이프 제스처 구현에서 가장 흔히 쓰이는 값(이동거리 50px, 속도 0.3)을 사용.
  // - onMoveShouldSetPanResponderCapture: 안드로이드 기본 touch slop(≈8~10dp)과 비슷한 최소
  //   이동량(10px)을 넘고, 가로 이동이 세로 이동보다 클 때만 제스처를 가져간다. 세로 스크롤(카드
  //   목록)이나 탭/버튼 누르기(움직임 없음)와 충돌하지 않는다.
  // - onPanResponderRelease: 이동거리(dx)나 손을 뗄 때 속도(vx) 둘 중 하나만 기준을 넘어도
  //   스와이프로 인정 — 길게 천천히 미는 동작과 짧고 빠른 플릭 동작을 모두 자연스럽게 인식한다.
  const SWIPE_DISTANCE_THRESHOLD = 50;
  const SWIPE_VELOCITY_THRESHOLD = 0.3;
  const panResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_evt, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const isLeftSwipe =
          gestureState.dx < -SWIPE_DISTANCE_THRESHOLD || gestureState.vx < -SWIPE_VELOCITY_THRESHOLD;
        if (isLeftSwipe && Math.abs(gestureState.dx) > Math.abs(gestureState.dy)) {
          router.push("/generate");
        }
      },
    })
  ).current;

  useEffect(() => {
    (async () => {
      try {
        const draws = await getRecentDrawsSafe(30);
        if (draws.length > 0) {
          setLatestDrawNumber(draws[0].drawNumber);
          const frequencies = computeNumberFrequencies(draws);
          const absent = getLongestAbsentNumbers(frequencies, draws[0].drawNumber, 6);
          setAbsentNumbers(absent.map((a) => a.number));
        } else {
          setLatestDrawNumber(estimateLatestDrawNumber());
        }

        const history = await getGenerationHistory();
        const counts = new Map<number, number>();
        for (const combo of history) {
          for (const n of combo) counts.set(n, (counts.get(n) ?? 0) + 1);
        }
        const top = [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([n]) => n);
        setMyFrequentNumbers(top);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <View style={styles.swipeArea} {...panResponder.panHandlers}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 20, paddingBottom: 20 }}
      >
        <Pressable
          style={styles.settingsLink}
          onPress={() => setSettingsVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="설정 열기"
        >
          <Text style={styles.settingsLinkText}>설정</Text>
          <Ionicons name="settings-sharp" size={16} color={colors.textMuted} />
        </Pressable>
        <View style={styles.heroCard}>
          {loading ? (
            <SkeletonBlock width={150} height={13} style={styles.heroSkeletonSubtitle} />
          ) : (
            <Text style={styles.heroSubtitle}>
              {latestDrawNumber ? `제 ${latestDrawNumber + 1}회 추첨까지 D-${daysUntilNextSaturday()}` : "이번 주 운명을 만들어보세요"}
            </Text>
          )}
          <Text style={styles.heroTitle}>이번 주 운명을 만들어보세요</Text>
          <Pressable
            style={styles.ctaButtonWrapper}
            android_ripple={{ color: "#0F1F38" }}
            onPress={() => router.push("/generate/ai-search")}
            accessibilityRole="button"
            accessibilityLabel="AI로 번호 만들기, 기기 안에서 계산되는 온디바이스 규칙 엔진"
          >
            {({ pressed }) => (
              <LinearGradient
                colors={["#496DA3", "#20385E"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={[styles.ctaButton, pressed && styles.ctaButtonPressed]}
              >
                <Text style={styles.ctaButtonText}>AI로 번호 만들기</Text>
              </LinearGradient>
            )}
          </Pressable>
        </View>

        <View style={styles.quickMenuRow}>
          <QuickMenuItem
            styles={styles}
            icon={require("../../assets/quick-menu-icons/exclusion.png")}
            label="제외해보기"
            onPress={() => router.push("/generate/exclusion")}
          />
          <QuickMenuItem
            styles={styles}
            icon={require("../../assets/quick-menu-icons/lucky.png")}
            label="행운번호"
            onPress={() => router.push("/generate/lucky")}
          />
          <QuickMenuItem
            styles={styles}
            icon={require("../../assets/quick-menu-icons/dice.png")}
            label="45면체 주사위"
            onPress={() => router.push("/generate/dice")}
          />
          <QuickMenuItem
            styles={styles}
            icon={require("../../assets/quick-menu-icons/qr.png")}
            label="QR당첨확인"
            onPress={() => router.push("/generate/qr-check")}
          />
        </View>

        {loading ? (
          <View style={styles.card}>
            <SkeletonBlock width={140} height={14} style={styles.skeletonTitle} />
            <View style={styles.ballRow}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <SkeletonBall key={i} size={30} />
              ))}
            </View>
          </View>
        ) : myFrequentNumbers.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>내가 자주 선택한 번호</Text>
            <View style={styles.ballRow}>
              {myFrequentNumbers.map((n) => (
                <LottoBall key={n} number={n} size={30} />
              ))}
            </View>
            <View style={styles.cardFooterRow}>
              <Text style={styles.cardCaption}>평소와 다른 조합을 만들어볼까요?</Text>
              <Pressable
                style={({ pressed }) => [styles.shortcutButton, pressed && styles.shortcutButtonPressed]}
                android_ripple={{ color: "#1E293B" }}
                onPress={() =>
                  router.push({
                    pathname: "/generate/exclusion",
                    params: { exclude: myFrequentNumbers.join(",") },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel="자주 선택한 번호를 제외하고 만들기"
              >
                <Text style={styles.shortcutButtonText}>바로가기</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.card}>
            <SkeletonBlock width={180} height={14} style={styles.skeletonTitle} />
            <View style={styles.ballRow}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <SkeletonBall key={i} size={30} />
              ))}
            </View>
          </View>
        ) : absentNumbers.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>최근 오래 나오지 않은 번호</Text>
            <View style={styles.ballRow}>
              {absentNumbers.map((n) => (
                <LottoBall key={n} number={n} size={30} />
              ))}
            </View>
            <View style={styles.cardFooterRow}>
              <Text style={styles.cardCaption}>이번엔 나올지도 모르니 포함해서 만들어볼까요?</Text>
              <Pressable
                style={({ pressed }) => [styles.shortcutButton, pressed && styles.shortcutButtonPressed]}
                android_ripple={{ color: "#1E293B" }}
                onPress={() =>
                  router.push({
                    pathname: "/generate/ai-search",
                    params: { preferred: absentNumbers.join(",") },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel="오래 나오지 않은 번호를 포함해서 만들기"
              >
                <Text style={styles.shortcutButtonText}>바로가기</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Text style={styles.footerNotice}>{ENTERTAINMENT_NOTICE}</Text>
      </ScrollView>
      <StatusBarSafeMask />
      </View>

      <SettingsSheet visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
    </>
  );
}

function QuickMenuItem({
  icon,
  label,
  onPress,
  styles,
}: {
  icon: number;
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.quickMenuItem, pressed && styles.quickMenuItemPressed]}
      android_ripple={{ color: "#E2E8F0" }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Image source={icon} style={styles.quickMenuIcon} resizeMode="contain" />
      <Text
        style={styles.quickMenuText}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    swipeArea: { flex: 1 },
    container: { flex: 1, backgroundColor: colors.background },
    settingsLink: {
      alignSelf: "flex-end",
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginBottom: 12,
    },
    settingsLinkText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
    // 히어로 카드: 어두운 브랜드 카드에서 밝은 카드(제목/부제는 어두운 텍스트)로 변경.
    // CTA 버튼만 남색 그라디언트 필로 어두운 톤을 유지한다(디자인 참고 이미지 반영).
    heroCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 22,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    heroSubtitle: { color: colors.textMuted, fontSize: 13, marginBottom: 8 },
    heroSkeletonSubtitle: { marginBottom: 8 },
    skeletonTitle: { marginBottom: 12 },
    heroTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: "700", marginBottom: 18 },
    ctaButtonWrapper: { borderRadius: 16, overflow: "hidden" },
    ctaButton: {
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: "center",
    },
    ctaButtonPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
    ctaButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    quickMenuRow: { flexDirection: "row", gap: 10, marginBottom: 22 },
    quickMenuItem: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 2,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    quickMenuItemPressed: {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.border,
      transform: [{ scale: 0.97 }],
    },
    quickMenuIcon: { width: 40, height: 40, marginBottom: 6 },
    quickMenuText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textSecondary,
      textAlign: "center",
      width: "100%",
    },
    // 62번 QA에서 화면 전체 여백을 넓혔는데, "내가 자주 선택한 번호"/"최근 오래 나오지 않은
    // 번호" 카드는 오히려 너무 커진 느낌이라는 후속 피드백을 받아 이 두 카드(공용 `card`
    // 스타일)만 다시 소폭 촘촘하게 조정했다(히어로 카드·퀵메뉴 등 다른 영역은 그대로 유지).
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary, marginBottom: 8 },
    cardCaption: { fontSize: 12, color: colors.textMuted, flexShrink: 1 },
    ballRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    // "내가 자주 선택한 번호"·"최근 오래 나오지 않은 번호" 카드가 공용으로 쓰는 하단
    // 안내문구+바로가기 버튼 행.
    cardFooterRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 10,
      gap: 8,
    },
    // 아래 두 버튼도 히어로 카드와 마찬가지로 항상 어두운 브랜드 톤을 유지한다.
    shortcutButton: {
      backgroundColor: "#0F172A",
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    shortcutButtonPressed: { backgroundColor: "#1E293B", transform: [{ scale: 0.97 }] },
    shortcutButtonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
    footerNotice: { fontSize: 11, color: colors.textMuted, textAlign: "center", marginTop: 16, marginBottom: 28 },
  });
}
