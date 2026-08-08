import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import Svg, { Circle, Rect } from "react-native-svg";
import { PatternBoard } from "../../src/components/deepPattern";
import { buildGameMetadata } from "../../src/lib/lottery/pattern";
import { estimateLatestDrawNumber } from "../../src/lib/draws/drawApi";
import { saveTicket } from "../../src/lib/storage";
import { useDeepPatternStore } from "../../src/state/deepPatternStore";
import type { DeepPatternLevel } from "../../src/lib/deepPattern/types";
import type { GeneratedGame } from "../../src/lib/lottery/types";
import { useAppTheme, type AppColors } from "../../src/theme";

const LEVEL_LABEL: Record<DeepPatternLevel, string> = { LOW: "낮음", MID: "보통", HIGH: "높음" };
const LEVEL_DOT_COUNT: Record<DeepPatternLevel, number> = { LOW: 1, MID: 2, HIGH: 3 };

/**
 * validationPercentile(§14 Null Simulation + family-wise 다중검정 보정, 0~100)을 기존
 * LOW/MID/HIGH 표시 체계에 맞춰 3단계로 변환한다. 임계값은 "81개 basin을 동시에 봤다는 것까지
 * 감안해도 무작위보다 뚜렷이 드문가"를 기준으로 보수적으로 잡았다 — 대부분의 basin은 여기서
 * LOW로 나온다(정상이다, §17 "랜덤 범위 안이라면 그대로 표시").
 */
function validationLevel(percentile: number): DeepPatternLevel {
  if (percentile >= 90) return "HIGH";
  if (percentile >= 50) return "MID";
  return "LOW";
}

function LevelRow({ label, level, colors }: { label: string; level: DeepPatternLevel; colors: AppColors }) {
  const filled = LEVEL_DOT_COUNT[level];
  return (
    <View style={styles(colors).metricRow}>
      <Text style={styles(colors).metricLabel}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={styles(colors).metricVal}>{LEVEL_LABEL[level]}</Text>
        <View style={{ flexDirection: "row", gap: 3 }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles(colors).levelDot,
                { backgroundColor: i < filled ? "#6C5CE7" : colors.border },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

export default function DeepPatternDetailScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const s = styles(colors);
  const { batch, selectedIndex } = useDeepPatternStore();
  const [isSaving, setIsSaving] = useState(false);

  const rec = batch?.recommendations[selectedIndex];

  if (!batch || !rec) {
    return (
      <View style={s.emptyContainer}>
        <Text style={s.emptyText}>표시할 패턴 상세가 없습니다.</Text>
        <Pressable
          style={s.emptyButton}
          onPress={() => router.replace("/generate/deep-pattern")}
          accessibilityRole="button"
          accessibilityLabel="딥 패턴 탐색으로 이동"
        >
          <Text style={s.emptyButtonText}>딥 패턴 탐색으로 이동</Text>
        </Pressable>
      </View>
    );
  }

  async function handleSave() {
    if (isSaving || !rec) return;
    setIsSaving(true);
    try {
      const nextDrawNumber = estimateLatestDrawNumber() + 1;
      const game: GeneratedGame = {
        id: `deep_pattern_${rec.patternIndex}_${Date.now()}`,
        numbers: rec.numbers,
        mode: "DEEP_PATTERN",
        metadata: buildGameMetadata(rec.numbers),
      };
      await saveTicket(game, "SAVED", nextDrawNumber);
      Alert.alert("번호가 저장되었습니다");
    } catch {
      Alert.alert("저장 실패", "번호를 저장하지 못했어요. 다시 시도해주세요.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={s.container}>
      <Stack.Screen options={{ title: `${rec.patternIndex}번 패턴` }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 16 }}>
        <View style={s.vizCard}>
          <View style={s.vizTitleRow}>
            <Text style={s.vizTitle}>로또 용지 마킹칸 시각화</Text>
            <Text style={s.vizSub}>실제 용지 배열 기준</Text>
          </View>
          <PatternBoard numbers={rec.numbers} />
        </View>

        <View style={s.vizCard}>
          <LevelRow label="구조적 공백" level={rec.structuralVoidLevel} colors={colors} />
          <View style={s.metricRow}>
            <Text style={s.metricLabel}>패턴 독창성</Text>
            <Text style={s.metricVal}>상위 {rec.noveltyPercentile}%</Text>
          </View>
          <LevelRow label="공백 지속성" level={rec.scalePersistenceLevel} colors={colors} />
          <LevelRow label="시간 안정성" level={rec.temporalPersistenceLevel} colors={colors} />
          <LevelRow label="통계적 유의성" level={validationLevel(rec.validationPercentile)} colors={colors} />
          <Text style={s.metricCaption}>
            무작위로 만든 가짜 역사 500개와 비교했을 때도 이 패턴 영역의 결손이 얼마나 드문지를
            나타냅니다. "낮음"은 무작위 변동과 뚜렷이 구분되지 않는다는 뜻이며, 이 역시 정상적인
            결과입니다.
          </Text>

          <View style={s.nearestCard}>
            {rec.nearestHistoricalDrawNumber !== null ? (
              <Text style={s.nearestText}>
                가장 가까운 과거 당첨: <Text style={s.nearestBold}>제{rec.nearestHistoricalDrawNumber}회</Text>
                {"\n"}패턴 유사도 <Text style={s.nearestBold}>{rec.nearestHistoricalSimilarityPercent}%</Text>
              </Text>
            ) : (
              <Text style={s.nearestText}>비교할 만큼 가까운 과거 당첨 패턴을 찾지 못했습니다.</Text>
            )}
          </View>
        </View>

        <View style={s.vizCard}>
          <View style={s.vizTitleRow}>
            <Text style={s.vizTitle}>Pattern Map</Text>
            <Text style={s.vizSub}>전체 조합 중 상대 위치(예시)</Text>
          </View>
          <Svg viewBox="0 0 240 140" width="100%" height={100}>
            <Rect x={0} y={0} width={240} height={140} rx={10} fill={colors.surfaceAlt} />
            <Circle cx={60} cy={40} r={22} fill="#6C5CE7" opacity={0.18} />
            <Circle cx={110} cy={90} r={30} fill="#6C5CE7" opacity={0.25} />
            <Circle cx={170} cy={35} r={18} fill="#6C5CE7" opacity={0.15} />
            <Circle cx={185} cy={100} r={4} fill="#DC2626" />
          </Svg>
          <View style={s.mapLegend}>
            <Text style={s.mapLegendText}>● 과거 밀집 영역 (연보라) · ● 이번 추천 위치 (빨강)</Text>
          </View>
        </View>

        <View style={s.disclaimerBox}>
          <Text style={s.disclaimerText}>
            이 지표는 전체 8,145,060개 조합 중 이 번호 조합이 속한 패턴 영역이 역사적으로 얼마나
            적게 관측되었는지를 보여줍니다. 당첨확률과는 무관합니다. 모든 조합은 추첨에서 동일한
            확률을 가집니다.
          </Text>
        </View>
      </ScrollView>

      <View style={s.bottomBar}>
        <Pressable
          style={[s.saveButton, isSaving && s.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
          accessibilityRole="button"
          accessibilityLabel="이 번호 저장하기"
        >
          <Text style={s.saveButtonText}>{isSaving ? "저장 중..." : "이 번호 저장하기"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function styles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    vizCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      marginBottom: 14,
    },
    vizTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    vizTitle: { fontSize: 13, fontWeight: "800", color: "#5847D6" },
    vizSub: { fontSize: 10.5, color: colors.textMuted },
    metricRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    metricLabel: { fontSize: 12.5, color: colors.textSecondary },
    metricVal: { fontSize: 12.5, fontWeight: "800", color: colors.textPrimary },
    metricCaption: { fontSize: 10.5, color: colors.textMuted, lineHeight: 15, paddingTop: 8, paddingBottom: 2 },
    levelDot: { width: 6, height: 6, borderRadius: 3 },
    nearestCard: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 12,
      padding: 12,
      marginTop: 12,
    },
    nearestText: { fontSize: 11.5, color: colors.textSecondary, lineHeight: 18 },
    nearestBold: { fontWeight: "800", color: colors.textPrimary },
    mapLegend: { marginTop: 8, alignItems: "center" },
    mapLegendText: { fontSize: 10, color: colors.textMuted },
    disclaimerBox: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
    disclaimerText: { fontSize: 10.5, color: colors.textMuted, lineHeight: 16 },
    bottomBar: {
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 20,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    saveButton: { backgroundColor: "#6C5CE7", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
    saveButtonDisabled: { backgroundColor: "#C9C2FF" },
    saveButtonText: { color: "#fff", fontWeight: "800", fontSize: 15 },
    emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.background },
    emptyText: { color: colors.textMuted, fontSize: 14, marginBottom: 16 },
    emptyButton: { backgroundColor: "#6C5CE7", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
    emptyButtonText: { color: "#fff", fontWeight: "700" },
  });
}
