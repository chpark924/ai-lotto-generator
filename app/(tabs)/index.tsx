import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { estimateLatestDrawNumber, getRecentDrawsSafe, getLongestAbsentNumbers, computeNumberFrequencies } from "../../src/lib/draws";
import { getGenerationHistory } from "../../src/lib/storage";
import { ENTERTAINMENT_NOTICE } from "../../src/constants/messages";
import { LottoBall, SettingsSheet, SkeletonBlock, SkeletonBall } from "../../src/components";
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
  const [latestDrawNumber, setLatestDrawNumber] = useState<number | null>(null);
  const [absentNumbers, setAbsentNumbers] = useState<number[]>([]);
  const [myFrequentNumbers, setMyFrequentNumbers] = useState<number[]>([]);
  const [settingsVisible, setSettingsVisible] = useState(false);
  // 당첨번호 네트워크 조회 + 내 생성 이력 조회가 끝나기 전까지의 상태.
  // 이 값이 true인 동안은 아래 카드들이 스켈레톤으로 표시된다(빈 화면 → 카드가
  // 갑자기 팝업되는 것보다 레이아웃을 미리 보여주는 게 자연스럽다).
  const [loading, setLoading] = useState(true);

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
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
        <Pressable
          style={styles.settingsLink}
          onPress={() => setSettingsVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="설정 열기"
        >
          <Text style={styles.settingsLinkText}>설정</Text>
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
            style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaButtonPressed]}
            android_ripple={{ color: "#1D4ED8" }}
            onPress={() => router.push("/generate/ai-search")}
            accessibilityRole="button"
            accessibilityLabel="AI로 번호 만들기, 기기 안에서 계산되는 온디바이스 규칙 엔진"
          >
            <Text style={styles.ctaButtonText}>AI로 번호 만들기</Text>
          </Pressable>
        </View>

        <View style={styles.quickMenuRow}>
          <QuickMenuItem styles={styles} label="제외하고 만들기" onPress={() => router.push("/generate/exclusion")} />
          <QuickMenuItem styles={styles} label="행운번호" onPress={() => router.push("/generate/lucky")} />
          <QuickMenuItem styles={styles} label="45면체 주사위" onPress={() => router.push("/generate/dice")} />
          {/* QA 피드백: 기존 생성 기능 그룹과 아래 "자주 선택한 번호" 사이 위치에 당첨 확인 진입점을 추가.
              나머지 3개와 형태·톤은 동일하게 유지하고, 테두리 색만 살짝 인디고 톤으로 차등을 줘서
              "생성"이 아니라 "조회" 기능이라는 걸 은근히 구분되게 한다(variant prop으로 스타일만 분리). */}
          <QuickMenuItem
            styles={styles}
            label="QR 당첨확인"
            variant="qr"
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
            <View style={styles.frequentFooterRow}>
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
          </View>
        ) : null}

        <Text style={styles.footerNotice}>{ENTERTAINMENT_NOTICE}</Text>
      </ScrollView>

      <SettingsSheet visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
    </>
  );
}

function QuickMenuItem({
  label,
  onPress,
  styles,
  variant,
}: {
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  variant?: "qr";
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.quickMenuItem,
        variant === "qr" && styles.quickMenuItemQr,
        pressed && styles.quickMenuItemPressed,
      ]}
      android_ripple={{ color: "#E2E8F0" }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.quickMenuText}>{label}</Text>
    </Pressable>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    settingsLink: { alignSelf: "flex-end", marginBottom: 8 },
    settingsLinkText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
    // 히어로 카드는 시스템 테마와 무관하게 항상 어두운 브랜드 카드로 고정한다.
    heroCard: {
      backgroundColor: "#0F172A",
      borderRadius: 20,
      padding: 20,
      marginBottom: 16,
    },
    heroSubtitle: { color: "#94A3B8", fontSize: 13, marginBottom: 6 },
    heroSkeletonSubtitle: { marginBottom: 6, backgroundColor: "#293045" },
    skeletonTitle: { marginBottom: 10 },
    heroTitle: { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 16 },
    ctaButton: {
      backgroundColor: "#2563EB",
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    ctaButtonPressed: { backgroundColor: "#1D4ED8", transform: [{ scale: 0.98 }] },
    ctaButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    quickMenuRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
    quickMenuItem: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    quickMenuItemPressed: {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.border,
      transform: [{ scale: 0.97 }],
    },
    // "생성" 계열 3개와 형태는 동일하게 두고 테두리 색만 살짝 인디고 톤으로 바꿔
    // "조회" 기능이라는 기능적 차이를 은근히 드러낸다. 톤앤매너를 해치지 않도록
    // 배경/텍스트 색은 건드리지 않는다.
    quickMenuItemQr: {
      borderColor: "#A5B4FC",
      borderWidth: 1.5,
    },
    quickMenuText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary, textAlign: "center" },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary, marginBottom: 10 },
    cardCaption: { fontSize: 12, color: colors.textMuted, flexShrink: 1 },
    ballRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    frequentFooterRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 12,
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
    footerNotice: { fontSize: 11, color: colors.textMuted, textAlign: "center", marginTop: 8, marginBottom: 24 },
  });
}
