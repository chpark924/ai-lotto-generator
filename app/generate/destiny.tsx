import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { DisclaimerCard, NumberGrid } from "../../src/components";
import {
  generateDestinyGame,
  DESTINY_TARGET_LABELS,
  type DestinyTarget,
} from "../../src/lib/lottery/destiny";
import { buildGameMetadata } from "../../src/lib/lottery/pattern";
import { calculateFirstPrizeProbability, PROBABILITY_DISCLAIMER } from "../../src/lib/lottery/probability";
import { buildPopularityHeuristic } from "../../src/lib/draws/drawStats";
import { getGenerationHistory, getPreferences } from "../../src/lib/storage";
import { useGenerationStore } from "../../src/state/generationStore";
import { CONSECUTIVE_RULE_LABELS, DESTINY_TARGET_OPTIONS } from "../../src/constants/lottery";
import type { ConsecutiveRule, GeneratedGame, GenerationRequest } from "../../src/lib/lottery/types";

const GENERATE_BUTTON_LABELS = ["이번 운명을 결정한다", "신의 번호를 내린다", "이번 주 운명을 연다"];

export default function DestinyScreen() {
  const router = useRouter();
  const setResult = useGenerationStore((s) => s.setResult);

  const [target, setTarget] = useState<DestinyTarget>("ONE");
  const [consecutiveRule, setConsecutiveRule] = useState<ConsecutiveRule>("ANY");
  const [usePreferred, setUsePreferred] = useState(true);
  const [excluded, setExcluded] = useState<number[]>([]);
  const [showExclusionPicker, setShowExclusionPicker] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const buttonLabel = useMemo(
    () => GENERATE_BUTTON_LABELS[Math.floor(Math.random() * GENERATE_BUTTON_LABELS.length)],
    []
  );

  function toggleExcluded(n: number) {
    setExcluded((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }

  async function handleGenerate() {
    setIsRunning(true);
    try {
      const [history, prefs] = await Promise.all([getGenerationHistory(), getPreferences()]);
      const popularity = buildPopularityHeuristic();

      const destinyResult = generateDestinyGame({
        target,
        consecutiveRule,
        excludedNumbers: excluded,
        usePreferredNumbers: usePreferred,
        preferredNumbers: prefs.preferredNumbers,
        popularityByNumber: popularity,
        savedCombinations: history,
      });

      const game: GeneratedGame = {
        id: `destiny_${Date.now()}`,
        numbers: destinyResult.numbers,
        mode: "DESTINY_GOD",
        metadata: buildGameMetadata(destinyResult.numbers),
      };

      const request: GenerationRequest = {
        mode: "DESTINY_GOD",
        gameCount: 1,
        excludedNumbers: excluded,
        requiredNumbers: [],
        preferredNumbers: usePreferred ? prefs.preferredNumbers : [],
        consecutiveRule,
      };

      const uniquenessLabel =
        destinyResult.candidatePopularity <= destinyResult.targetPopularity + 10 ? "강함" : "보통";

      const resultNotice = [
        "당신이 설계한 이번 주 운명",
        `목표 시나리오: ${DESTINY_TARGET_LABELS[target]}`,
        `연속번호: ${CONSECUTIVE_RULE_LABELS[consecutiveRule]}`,
        `사용자 겹침 방지: ${uniquenessLabel}`,
      ].join("\n");

      setResult(request, {
        requestId: game.id,
        games: [game],
        probability: calculateFirstPrizeProbability(1),
        disclaimer: `${PROBABILITY_DISCLAIMER} 목표 당첨자 수는 엔터테인먼트용 시나리오이며 실제 당첨자 수를 예측하지 않습니다.`,
        resultNotice,
      });
      router.push("/generate/result");
    } catch (e) {
      Alert.alert("생성 실패", e instanceof Error ? e.message : "조건을 완화해 다시 시도해주세요.");
    } finally {
      setIsRunning(false);
    }
  }

  if (isRunning) {
    return (
      <View style={styles.progressContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.progressLabel}>운명을 계산하는 중...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.sectionTitle}>목표 당첨자 수</Text>
      <View style={styles.row}>
        {DESTINY_TARGET_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            style={[styles.optionButton, target === opt.value && styles.optionButtonActive]}
            onPress={() => setTarget(opt.value)}
          >
            <Text style={[styles.optionButtonText, target === opt.value && styles.optionButtonTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>연속번호 설정</Text>
      <View style={styles.row}>
        {(Object.keys(CONSECUTIVE_RULE_LABELS) as ConsecutiveRule[]).map((rule) => (
          <Pressable
            key={rule}
            style={[styles.optionButton, consecutiveRule === rule && styles.optionButtonActive]}
            onPress={() => setConsecutiveRule(rule)}
          >
            <Text
              style={[
                styles.optionButtonText,
                consecutiveRule === rule && styles.optionButtonTextActive,
              ]}
            >
              {CONSECUTIVE_RULE_LABELS[rule]}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>내 선호번호 반영</Text>
        <Switch value={usePreferred} onValueChange={setUsePreferred} />
      </View>

      <Pressable onPress={() => setShowExclusionPicker((v) => !v)}>
        <Text style={styles.toggleLink}>
          {showExclusionPicker ? "제외번호 설정 닫기" : `제외번호 설정 (${excluded.length}개)`}
        </Text>
      </Pressable>
      {showExclusionPicker ? <NumberGrid selected={excluded} onToggle={toggleExcluded} /> : null}

      <DisclaimerCard text="목표 당첨자 수는 실제 당첨자 수를 예측하거나 통제하지 않는 엔터테인먼트용 시나리오입니다. 인기도 계산은 실제 타 사용자 데이터가 아니라 일반적인 선택 편향을 근사한 값입니다." />

      <Pressable style={styles.generateButton} onPress={handleGenerate}>
        <Text style={styles.generateButtonText}>{buttonLabel}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A", marginTop: 16, marginBottom: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  optionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  optionButtonActive: { backgroundColor: "#7C3AED", borderColor: "#7C3AED" },
  optionButtonText: { fontSize: 12, color: "#334155", fontWeight: "600" },
  optionButtonTextActive: { color: "#fff" },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  switchLabel: { fontSize: 14, color: "#0F172A", fontWeight: "600" },
  toggleLink: { color: "#7C3AED", fontSize: 13, fontWeight: "600", marginVertical: 8 },
  generateButton: {
    backgroundColor: "#7C3AED",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  generateButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  progressContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0F172A" },
  progressLabel: { color: "#fff", fontSize: 15, fontWeight: "700", marginTop: 16 },
});
