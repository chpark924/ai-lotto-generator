import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { BottomActionBar } from "../../src/components";
import { PatternBoard, PatternPositionMap } from "../../src/components/deepPattern";
import { buildGameMetadata } from "../../src/lib/lottery/pattern";
import { estimateLatestDrawNumber } from "../../src/lib/draws/drawApi";
import { saveTicket } from "../../src/lib/storage";
import { useDeepPatternStore } from "../../src/state/deepPatternStore";
import type { DeepPatternLevel } from "../../src/lib/deepPattern/types";
import type { GeneratedGame } from "../../src/lib/lottery/types";
import { useAppTheme, type AppColors, type AppTints } from "../../src/theme";

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
    // 접근성 점검(2026-08-08 종합 재점검): 스크린리더가 라벨/값/점 개수를 3개 별도 요소로 따로
    // 읽어 "구조적 공백... 높음... 점..."처럼 끊겨 들리던 문제. 행 전체를 하나의 접근성 요소로
    // 묶어 "구조적 공백: 높음"으로 한 번에 읽히게 했다(점 3개는 값의 시각적 보조 표현이라 값 자체
    // 텍스트만으로 충분 — 별도로 다시 읽을 필요 없음).
    <View style={styles(colors).metricRow} accessible accessibilityLabel={`${label}: ${LEVEL_LABEL[level]}`}>
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
  const { colors, tints } = useAppTheme();
  const s = styles(colors, tints);
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
          <View style={s.metricRow} accessible accessibilityLabel={`패턴 독창성: 상위 ${rec.noveltyPercentile}%`}>
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
            <Text style={s.vizSub}>전체 조합 중 상대 위치(근사치)</Text>
          </View>
          <PatternPositionMap recommendation={rec} />
        </View>

        <View style={s.disclaimerBox}>
          <Text style={s.disclaimerText}>
            이 지표는 전체 8,145,060개 조합 중 이 번호 조합이 속한 패턴 영역이 역사적으로 얼마나
            적게 관측되었는지를 보여줍니다. 당첨확률과는 무관합니다. 모든 조합은 추첨에서 동일한
            확률을 가집니다.
          </Text>
        </View>
      </ScrollView>

      <BottomActionBar
        label={isSaving ? "저장 중..." : "이 번호 저장하기"}
        onPress={handleSave}
        disabled={isSaving}
        color="#6C5CE7"
        disabledColor="#C9C2FF"
      />
    </View>
  );
}

function styles(colors: AppColors, tints?: AppTints) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    vizCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      marginBottom: 14,
    },
    vizTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    // 다크모드 대비 점검(2026-08-08 종합 재점검) — 고정값 "#5847D6"는 다크 배경(surface)
    // 위에서 대비비 약 2.6:1로 WCAG AA(4.5:1) 미달이었다. tints.purple은 라이트/다크 각각에
    // 맞게 이미 검증된 값(라이트 #5B21B6, 다크 #DDD6FE)이라 이걸로 교체한다. LevelRow처럼
    // 이 스타일을 쓰지 않는 호출부는 tints 없이도(undefined) 그대로 동작하도록 optional로 뒀다.
    vizTitle: { fontSize: 13, fontWeight: "800", color: tints ? tints.purple.fg : "#5847D6" },
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
    disclaimerBox: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
    disclaimerText: { fontSize: 10.5, color: colors.textMuted, lineHeight: 16 },
    emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.background },
    emptyText: { color: colors.textMuted, fontSize: 14, marginBottom: 16 },
    emptyButton: { backgroundColor: "#6C5CE7", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
    emptyButtonText: { color: "#fff", fontWeight: "700" },
  });
}
