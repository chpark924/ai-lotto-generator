import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LottoBall, LottoBallLoader } from "../../src/components";
import { PatternThumb } from "../../src/components/deepPattern";
import { buildGameMetadata } from "../../src/lib/lottery/pattern";
import { estimateLatestDrawNumber } from "../../src/lib/draws/drawApi";
import { saveTicket } from "../../src/lib/storage";
import { recommendDeepPatterns } from "../../src/lib/deepPattern/engine";
import { useDeepPatternStore } from "../../src/state/deepPatternStore";
import type { DeepPatternRecommendation } from "../../src/lib/deepPattern/types";
import type { GeneratedGame } from "../../src/lib/lottery/types";
import { useAppTheme, type AppColors, type AppTints } from "../../src/theme";

const RECOMMENDATION_COUNT = 5;

function toGeneratedGame(rec: DeepPatternRecommendation): GeneratedGame {
  return {
    id: `deep_pattern_${rec.patternIndex}_${Date.now()}`,
    numbers: rec.numbers,
    mode: "DEEP_PATTERN",
    metadata: buildGameMetadata(rec.numbers),
  };
}

export default function DeepPatternResultScreen() {
  const router = useRouter();
  const { colors, tints } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors, tints), [colors, tints]);
  const { batch, setBatch, selectIndex } = useDeepPatternStore();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);

  if (!batch) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>표시할 딥 패턴 결과가 없습니다.</Text>
        <Pressable
          style={styles.emptyButton}
          onPress={() => router.replace("/generate/deep-pattern")}
          accessibilityRole="button"
          accessibilityLabel="딥 패턴 탐색으로 이동"
        >
          <Text style={styles.emptyButtonText}>딥 패턴 탐색으로 이동</Text>
        </Pressable>
      </View>
    );
  }

  async function handleRegenerate() {
    if (isRegenerating) return;
    setIsRegenerating(true);
    try {
      const next = await recommendDeepPatterns(RECOMMENDATION_COUNT);
      setBatch(next);
    } finally {
      setIsRegenerating(false);
    }
  }

  function handleOpenDetail(index: number) {
    selectIndex(index);
    router.push("/generate/deep-pattern-detail");
  }

  async function handleSaveAll() {
    if (isSavingAll || !batch) return;
    setIsSavingAll(true);
    try {
      const nextDrawNumber = estimateLatestDrawNumber() + 1;
      for (const rec of batch.recommendations) {
        await saveTicket(toGeneratedGame(rec), "SAVED", nextDrawNumber);
      }
      Alert.alert("저장했습니다.", `${batch.recommendations.length}게임을 제 ${nextDrawNumber}회 기준으로 저장했어요.`);
    } catch {
      Alert.alert("저장 실패", "번호를 저장하지 못했어요. 다시 시도해주세요.");
    } finally {
      setIsSavingAll(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
      <Text style={styles.sub}>서로 다른 {batch.recommendations.length}개의 패턴에서 대표 조합을 골랐어요.</Text>

      {isRegenerating ? (
        <View style={styles.regeneratingBox}>
          <LottoBallLoader />
          <Text style={styles.regeneratingText}>다시 탐색하는 중...</Text>
        </View>
      ) : (
        batch.recommendations.map((rec, index) => (
          <Pressable
            key={`${rec.patternIndex}_${rec.numbers.join("-")}`}
            style={({ pressed }) => [styles.card, index === 0 && styles.cardLead, pressed && styles.cardPressed]}
            onPress={() => handleOpenDetail(index)}
            accessibilityRole="button"
            accessibilityLabel={`${rec.patternIndex}번 패턴, 번호 ${rec.numbers.join(", ")}, 패턴 독창성 상위 ${rec.noveltyPercentile}%`}
          >
            <PatternThumb numbers={rec.numbers} highlighted={index === 0} />
            <View style={styles.cardBody}>
              <Text style={styles.basinTag}>{rec.patternIndex}번 패턴</Text>
              <View style={styles.ballsRow}>
                {rec.numbers.map((n) => (
                  <LottoBall key={n} number={n} size={22} />
                ))}
              </View>
              <View style={styles.metricChip}>
                <Text style={styles.metricChipText}>패턴 독창성 상위 {rec.noveltyPercentile}%</Text>
              </View>
            </View>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        ))
      )}

      {/* 2026-08-08 종합 재점검: 이전엔 engineVersion/atlasVersion("DPE-1.1-v3approx" 등) 내부
          식별자를 그대로 노출했다 — src/lib/deepPattern/types.ts의 설계 원칙("Basin/DeepVoid
          같은 엔진 내부 개념은 이 타입 밖으로 나가지 않는다") 및 이 앱의 다른 화면 어디에도
          이런 버전 문자열을 보여주는 곳이 없다는 점과 맞지 않아, 일반 사용자가 이해할 수 있는
          문구로 교체했다. */}
      <Text style={styles.footNote}>
        제{batch.recommendations[0]?.historyThroughDrawNumber}회까지의 당첨 이력을 반영한
        결과예요.
      </Text>

      <View style={styles.btnRow}>
        <Pressable
          style={styles.btnGhost}
          onPress={handleRegenerate}
          disabled={isRegenerating}
          accessibilityRole="button"
          accessibilityLabel="다시 생성"
        >
          <Text style={styles.btnGhostText}>다시 생성</Text>
        </Pressable>
        <Pressable
          style={[styles.btnPrimary, isSavingAll && styles.btnPrimaryDisabled]}
          onPress={handleSaveAll}
          disabled={isSavingAll}
          accessibilityRole="button"
          accessibilityLabel={`${batch.recommendations.length}게임 모두 저장`}
        >
          <Text style={styles.btnPrimaryText}>{isSavingAll ? "저장 중..." : `${batch.recommendations.length}게임 모두 저장`}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function createStyles(colors: AppColors, tints?: AppTints) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    sub: { fontSize: 12.5, color: colors.textMuted, marginBottom: 14 },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      marginBottom: 12,
    },
    cardLead: { borderWidth: 1.5, borderColor: "#6C5CE7" },
    cardPressed: { opacity: 0.85 },
    cardBody: { flex: 1, minWidth: 0 },
    // 다크모드 대비 점검(2026-08-08 종합 재점검) — deep-pattern-detail.tsx의 vizTitle과 동일한
    // 문제: 고정값 "#5847D6"는 다크 배경 위에서 대비비 약 2.6:1로 WCAG AA(4.5:1) 미달이었다.
    // tints.purple(라이트 #5B21B6, 다크 #DDD6FE)로 교체한다.
    basinTag: { fontSize: 11, fontWeight: "700", color: tints ? tints.purple.fg : "#5847D6", marginBottom: 4 },
    ballsRow: { flexDirection: "row", gap: 4, marginBottom: 6, flexWrap: "wrap" },
    metricChip: {
      alignSelf: "flex-start",
      backgroundColor: "#EAF5EE",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    metricChipText: { fontSize: 10.5, fontWeight: "700", color: "#3C7A4E" },
    chev: { color: colors.textMuted, fontSize: 18 },
    footNote: { fontSize: 10, color: colors.textMuted, textAlign: "center", lineHeight: 16, marginVertical: 10 },
    btnRow: { flexDirection: "row", gap: 8, marginTop: 4 },
    btnGhost: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
    },
    btnGhostText: { color: colors.textPrimary, fontWeight: "700", fontSize: 13 },
    btnPrimary: { flex: 1, backgroundColor: "#6C5CE7", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
    btnPrimaryDisabled: { backgroundColor: "#C9C2FF" },
    btnPrimaryText: { color: "#fff", fontWeight: "800", fontSize: 13 },
    regeneratingBox: { alignItems: "center", paddingVertical: 40 },
    regeneratingText: { marginTop: 10, color: colors.textMuted, fontSize: 12, fontWeight: "600" },
    emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.background },
    emptyText: { color: colors.textMuted, fontSize: 14, marginBottom: 16 },
    emptyButton: { backgroundColor: "#6C5CE7", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
    emptyButtonText: { color: "#fff", fontWeight: "700" },
  });
}
