import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { NumberGrid, DisclaimerCard, BottomActionBar, LottoBallLoader } from "../../src/components";
import { generateAiSearchGames } from "../../src/lib/lottery/generator";
import type { ConsecutiveRule, GenerationRequest } from "../../src/lib/lottery/types";
import { ValidationError } from "../../src/lib/lottery/validators";
import { getGenerationHistory } from "../../src/lib/storage";
import { buildPopularityHeuristic } from "../../src/lib/draws/drawStats";
import { useGenerationStore } from "../../src/state/generationStore";
import {
  ALL_COMBINATIONS_EQUAL_NOTICE,
  POPULARITY_HEURISTIC_NOTICE,
} from "../../src/constants/messages";
import { CONSECUTIVE_RULE_LABELS, SEARCH_STRENGTH_OPTIONS } from "../../src/constants/lottery";
import { useAppTheme, type AppColors } from "../../src/theme";

export default function AiSearchScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const setResult = useGenerationStore((s) => s.setResult);

  const [searchCount, setSearchCount] = useState<1 | 30000 | 100000 | 1000000>(30000);
  const [excluded, setExcluded] = useState<number[]>([]);
  const [preferred, setPreferred] = useState<number[]>([]);
  const [consecutiveRule, setConsecutiveRule] = useState<ConsecutiveRule>("ANY");
  const [avoidPopular, setAvoidPopular] = useState(true);
  const [avoidMySaved, setAvoidMySaved] = useState(true);
  const [gameCount, setGameCount] = useState(5);

  const [isRunning, setIsRunning] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);

  function toggleExcluded(n: number) {
    setExcluded((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }
  function togglePreferred(n: number) {
    setPreferred((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }

  async function handleGenerate() {
    const request: GenerationRequest = {
      mode: "AI_SEARCH",
      gameCount,
      excludedNumbers: excluded,
      requiredNumbers: [],
      preferredNumbers: preferred,
      consecutiveRule,
      searchCount,
      avoidPopularNumbers: avoidPopular,
      avoidMySavedNumbers: avoidMySaved,
    };

    setIsRunning(true);
    setProgressLabel("무작위 후보 생성 중");
    setProgressPercent(0);

    try {
      const [history, popularity] = await Promise.all([
        avoidMySaved ? getGenerationHistory() : Promise.resolve([]),
        Promise.resolve(buildPopularityHeuristic()),
      ]);

      const result = await generateAiSearchGames(request, {
        popularityByNumber: avoidPopular ? popularity : new Array(45).fill(0),
        savedCombinations: history,
        batchSize: 1000,
        onProgress: (completed, total) => {
          const percent = Math.round((completed / total) * 100);
          setProgressPercent(percent);
          if (percent < 60) setProgressLabel("무작위 후보 생성 중");
          else if (percent < 85) setProgressLabel("조건에 맞지 않는 조합 제외 중");
          else setProgressLabel("최종 조합 선정 중");
        },
      });

      setResult(request, result);
      router.push("/generate/result");
    } catch (e) {
      const message = e instanceof ValidationError ? e.message : "생성 중 문제가 발생했습니다.";
      Alert.alert("생성 실패", message);
    } finally {
      setIsRunning(false);
    }
  }

  if (isRunning) {
    return (
      <View
        style={styles.progressContainer}
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${progressLabel}, ${progressPercent}퍼센트`}
      >
        <LottoBallLoader />
        <Text style={styles.progressLabel}>{progressLabel}</Text>
        <Text style={styles.progressPercent}>{progressPercent}%</Text>
        <Text style={styles.progressCaption}>
          무작위 알고리즘을 통해 조합을 탐색하고 온디바이스로 연산이 이뤄집니다.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
      <Text style={styles.sectionTitle}>탐색 강도</Text>
      <View style={styles.row}>
        {SEARCH_STRENGTH_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            style={[styles.optionButton, searchCount === opt.value && styles.optionButtonActive]}
            onPress={() => setSearchCount(opt.value)}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: searchCount === opt.value }}
          >
            <Text
              style={[
                styles.optionButtonText,
                searchCount === opt.value && styles.optionButtonTextActive,
              ]}
            >
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
            accessibilityRole="button"
            accessibilityLabel={CONSECUTIVE_RULE_LABELS[rule]}
            accessibilityState={{ selected: consecutiveRule === rule }}
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
        <Text style={styles.switchLabel}>인기번호 회피</Text>
        <Switch
          value={avoidPopular}
          onValueChange={setAvoidPopular}
          accessibilityRole="switch"
          accessibilityLabel="인기번호 회피"
        />
      </View>
      {avoidPopular ? <Text style={styles.smallNotice}>{POPULARITY_HEURISTIC_NOTICE}</Text> : null}

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>내 저장번호 회피</Text>
        <Switch
          value={avoidMySaved}
          onValueChange={setAvoidMySaved}
          accessibilityRole="switch"
          accessibilityLabel="내 저장번호 회피"
        />
      </View>

      <Text style={styles.sectionTitle}>제외번호 ({excluded.length}개)</Text>
      <NumberGrid selected={excluded} disabled={preferred} onToggle={toggleExcluded} />

      <Text style={styles.sectionTitle}>선호번호 ({preferred.length}개)</Text>
      <NumberGrid selected={preferred} disabled={excluded} onToggle={togglePreferred} />

      <Text style={styles.sectionTitle}>생성할 게임 수: {gameCount}</Text>
      <View style={styles.row}>
        {[1, 5, 10].map((c) => (
          <Pressable
            key={c}
            style={[styles.optionButton, gameCount === c && styles.optionButtonActive]}
            onPress={() => setGameCount(c)}
            accessibilityRole="button"
            accessibilityLabel={`${c}게임 생성`}
            accessibilityState={{ selected: gameCount === c }}
          >
            <Text style={[styles.optionButtonText, gameCount === c && styles.optionButtonTextActive]}>
              {c}게임
            </Text>
          </Pressable>
        ))}
      </View>

      <DisclaimerCard text={ALL_COMBINATIONS_EQUAL_NOTICE} />
      </ScrollView>

      <BottomActionBar label="탐색 시작" onPress={handleGenerate} />
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary, marginTop: 16, marginBottom: 8 },
    row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
    optionButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionButtonActive: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
    optionButtonText: { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },
    optionButtonTextActive: { color: "#fff" },
    switchRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 8,
    },
    switchLabel: { fontSize: 14, color: colors.textPrimary, fontWeight: "600" },
    smallNotice: { fontSize: 11, color: colors.textMuted, marginBottom: 4, lineHeight: 16 },
    // 진행률 화면은 항상 어두운 브랜드 톤을 유지한다.
    progressContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#0F172A" },
    progressLabel: { color: "#fff", fontSize: 16, fontWeight: "700", marginTop: 16 },
    progressPercent: { color: "#93C5FD", fontSize: 28, fontWeight: "800", marginTop: 8 },
    progressCaption: { color: "#94A3B8", fontSize: 12, marginTop: 16, textAlign: "center" },
  });
}
