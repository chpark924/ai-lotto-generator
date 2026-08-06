import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { NumberGrid, DisclaimerCard, BottomActionBar, LottoBallLoader } from "../../src/components";
import { generateAiSearchGames, type AiSearchPhase } from "../../src/lib/lottery/generator";
import type { ConsecutiveRule, GenerationRequest } from "../../src/lib/lottery/types";
import { ValidationError } from "../../src/lib/lottery/validators";
import { getGenerationHistory } from "../../src/lib/storage";
import {
  buildPopularityHeuristic,
  getTopFrequentNumbers,
  getNumbersAbsentInLastDraws,
} from "../../src/lib/draws/drawStats";
import { getRecentDrawsSafe, computeCombinationPatternStats } from "../../src/lib/draws";
import { useGenerationStore } from "../../src/state/generationStore";
import {
  ALL_COMBINATIONS_EQUAL_NOTICE,
  HIGH_FREQUENCY_TOP10_NOTICE,
  POPULARITY_HEURISTIC_NOTICE,
  SUM_AVERAGE_PREFERENCE_NOTICE,
} from "../../src/constants/messages";
import {
  BOOSTER_SEARCH_COUNT,
  CONSECUTIVE_RULE_LABELS,
  SEARCH_STRENGTH_OPTIONS,
  SUM_AVERAGE_PREFERENCE_OPTIONS,
} from "../../src/constants/lottery";
import { useAppTheme, type AppColors } from "../../src/theme";

/** 실제 최근 당첨번호 합계 평균을 계산할 때 쓰는 표본 크기 (최근 52주 = 1년치 회차). lab.tsx와 동일 기준. */
const RECENT_SUM_SAMPLE_SIZE = 52;

/** 고빈도 당첨번호 상위권 포함: 최근 1년(52주) 표본에서 출현 빈도 상위 10개 번호 기준. */
const HIGH_FREQ_SAMPLE_WEEKS = 52;
const HIGH_FREQ_TOP_N = 10;

/** 장기 미출현번호 포함: 기본 12주 기준, 100만 회 부스터 탐색일 때만 8주 기준으로 좁힌다. */
const LONG_TERM_ABSENT_WEEKS_DEFAULT = 12;
const LONG_TERM_ABSENT_WEEKS_BOOSTER = 8;

type SumAveragePreference = "NONE" | "UP" | "DOWN";

// 탐색 단계별 안내 문구. generator.ts가 보고하는 phase에 그대로 매핑한다 —
// percent 임계값(예: 60%, 85%)으로 라벨을 추측하지 않고, 실제 계산 단계와 항상 일치시킨다.
const PHASE_LABELS: Record<AiSearchPhase, string> = {
  GENERATING: "무작위 후보 생성 중",
  SCORING: "조건에 맞지 않는 조합 제외 중",
  FINALIZING: "최종 조합 선정 중",
};

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
  const [includeHighFreqTop10, setIncludeHighFreqTop10] = useState(false);
  const [includeLongTermAbsent, setIncludeLongTermAbsent] = useState(false);
  const [gameCount, setGameCount] = useState(5);

  const [sumAveragePreference, setSumAveragePreference] = useState<SumAveragePreference>("NONE");
  const [recentAverageSum, setRecentAverageSum] = useState<number | null>(null);
  const [avgSumStatus, setAvgSumStatus] = useState<"loading" | "ready" | "error">("loading");

  const [isRunning, setIsRunning] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);

  // 화면 진입 시 미리 최근 52주 평균 합계를 계산해 UI에 보여준다("최근 52주 기준"이라는
  // 설명이 실제 숫자와 함께 표시돼야 사용자가 뭘 근거로 UP/DOWN을 고르는지 신뢰할 수 있다).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const recentDraws = await getRecentDrawsSafe(RECENT_SUM_SAMPLE_SIZE);
        if (cancelled) return;
        if (recentDraws.length === 0) {
          setAvgSumStatus("error");
          return;
        }
        const { averageSum } = computeCombinationPatternStats(recentDraws);
        setRecentAverageSum(averageSum);
        setAvgSumStatus("ready");
      } catch {
        if (!cancelled) setAvgSumStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // handleGenerate()에서 이 값을 그대로 믿지 않고 한 번 더 확인한다 — 화면 진입 직후 곧바로
  // "탐색 시작"을 눌러 위 useEffect fetch가 아직 안 끝났을 수도 있기 때문에, 아직 없으면
  // 여기서 다시 한번 실제로 가져와서 UP/DOWN 선택이 "실제로" 반영되도록 보장한다.
  async function resolveRecentAverageSum(): Promise<number | null> {
    if (recentAverageSum !== null) return recentAverageSum;
    try {
      const recentDraws = await getRecentDrawsSafe(RECENT_SUM_SAMPLE_SIZE);
      if (recentDraws.length === 0) return null;
      const { averageSum } = computeCombinationPatternStats(recentDraws);
      setRecentAverageSum(averageSum);
      setAvgSumStatus("ready");
      return averageSum;
    } catch {
      return null;
    }
  }

  // "고빈도 당첨번호 상위권 포함"/"장기 미출현번호 포함" 토글이 켜져 있을 때만 해당 당첨번호
  // 표본을 가져와 실제 번호 집합으로 변환한다(GenerationRequest.mustIncludeOneOfSets). 두
  // 조건은 서로 독립적이라 둘 다 켜져 있으면 두 세트 모두 최소 1개씩 포함되도록 동시에
  // 반영된다(generator.ts 참고). 데이터를 불러오지 못하면 조합 자체가 실패하지 않도록
  // 그 조건만 조용히 건너뛰되, 토글을 켠 사용자가 "적용 안 됐다"는 걸 알 수 있게 안내한다.
  async function resolveMustIncludeOneOfSets(): Promise<number[][]> {
    const sets: number[][] = [];

    if (includeHighFreqTop10) {
      const draws = await getRecentDrawsSafe(HIGH_FREQ_SAMPLE_WEEKS);
      if (draws.length === 0) {
        Alert.alert(
          "고빈도 당첨번호를 불러오지 못했습니다",
          "최근 당첨번호 데이터를 불러오지 못해 '고빈도 당첨번호 상위권 포함' 옵션이 이번 탐색에는 적용되지 않았습니다."
        );
      } else {
        sets.push(getTopFrequentNumbers(draws, HIGH_FREQ_TOP_N));
      }
    }

    if (includeLongTermAbsent) {
      // 100만 회 부스터 탐색일 때만 8주 기준, 그 외에는 12주 기준.
      const weeks =
        searchCount === BOOSTER_SEARCH_COUNT
          ? LONG_TERM_ABSENT_WEEKS_BOOSTER
          : LONG_TERM_ABSENT_WEEKS_DEFAULT;
      const draws = await getRecentDrawsSafe(weeks);
      if (draws.length === 0) {
        Alert.alert(
          "미출현번호를 불러오지 못했습니다",
          "최근 당첨번호 데이터를 불러오지 못해 '장기 미출현번호 포함' 옵션이 이번 탐색에는 적용되지 않았습니다."
        );
      } else {
        const absent = getNumbersAbsentInLastDraws(draws);
        if (absent.length > 0) sets.push(absent);
      }
    }

    return sets;
  }

  function toggleExcluded(n: number) {
    setExcluded((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }
  function togglePreferred(n: number) {
    setPreferred((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }

  async function handleGenerate() {
    // "UP" 선택 시 minSum, "DOWN" 선택 시 maxSum을 최근 52주 실제 평균 합계로 설정한다.
    // scoring.ts의 conditionMatchScore()가 이미 minSum/maxSum을 소프트 페널티로 반영하므로,
    // 여기서 값만 정확히 넘겨주면 결과에 실제로 반영된다(하드 필터가 아니라 점수 가중치라
    // 조건이 안 맞는 조합이 완전히 배제되진 않지만, 상위로 랭크되는 조합들은 UP/DOWN 방향에
    // 뚜렷하게 치우치게 된다).
    let sumBounds: Pick<GenerationRequest, "minSum" | "maxSum"> = {};
    if (sumAveragePreference !== "NONE") {
      const avg = await resolveRecentAverageSum();
      if (avg !== null) {
        sumBounds = sumAveragePreference === "UP" ? { minSum: avg } : { maxSum: avg };
      } else {
        Alert.alert(
          "평균값을 불러오지 못했습니다",
          "최근 당첨번호 데이터를 불러오지 못해 UP/DOWN 옵션이 이번 탐색에는 적용되지 않았습니다."
        );
      }
    }

    const mustIncludeOneOfSets = await resolveMustIncludeOneOfSets();

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
      mustIncludeOneOfSets,
      ...sumBounds,
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
        onProgress: (percent, phase) => {
          setProgressPercent(percent);
          setProgressLabel(PHASE_LABELS[phase]);
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
    // 탐색 강도가 높을 때(특히 100만 회)는 몇 초 이상 걸릴 수 있어서, 퍼센트 숫자만으로는
    // "멈춘 것 같다"는 인상을 주기 쉽다. 그래서 (1) 실제 진행 단계와 항상 일치하는 라벨,
    // (2) 눈으로 계속 움직임이 보이는 막대 바, (3) 막바지에는 안심시키는 문구로 바꿔
    // 오래 걸리는 연산이라는 걸 자연스럽게 체감시킨다.
    const isAlmostDone = progressPercent >= 95;
    return (
      <View
        style={styles.progressContainer}
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${progressLabel}, ${progressPercent}퍼센트`}
      >
        <LottoBallLoader />
        <Text style={styles.progressLabel}>{progressLabel}</Text>
        <Text style={styles.progressPercent}>{progressPercent}%</Text>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>
        <Text style={styles.progressCaption}>
          {isAlmostDone
            ? "거의 다 됐어요, 조금만 기다려주세요."
            : "무작위 알고리즘을 통해 조합을 탐색하고 온디바이스로 연산이 이뤄집니다."}
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
        <Text style={styles.switchLabel}>고빈도 당첨번호 상위권 포함</Text>
        <Switch
          value={includeHighFreqTop10}
          onValueChange={setIncludeHighFreqTop10}
          accessibilityRole="switch"
          accessibilityLabel="고빈도 당첨번호 상위권 포함"
        />
      </View>
      {includeHighFreqTop10 ? (
        <Text style={styles.smallNotice}>{HIGH_FREQUENCY_TOP10_NOTICE}</Text>
      ) : null}

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>장기 미출현번호 포함</Text>
        <Switch
          value={includeLongTermAbsent}
          onValueChange={setIncludeLongTermAbsent}
          accessibilityRole="switch"
          accessibilityLabel="장기 미출현번호 포함"
        />
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

      <Text style={styles.sectionTitle}>당첨숫자 총합 평균값 UP/DOWN 선택</Text>
      <View style={styles.row}>
        {SUM_AVERAGE_PREFERENCE_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            style={[
              styles.optionButton,
              sumAveragePreference === opt.value && styles.optionButtonActive,
            ]}
            onPress={() => setSumAveragePreference(opt.value)}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: sumAveragePreference === opt.value }}
          >
            <Text
              style={[
                styles.optionButtonText,
                sumAveragePreference === opt.value && styles.optionButtonTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.smallNotice}>
        {SUM_AVERAGE_PREFERENCE_NOTICE}
        {avgSumStatus === "ready" && recentAverageSum !== null
          ? ` (최근 52주 평균 합계: ${recentAverageSum.toFixed(1)})`
          : avgSumStatus === "loading"
            ? " (평균값 불러오는 중…)"
            : " (평균값을 불러오지 못했습니다.)"}
      </Text>

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
    progressBarTrack: {
      width: "100%",
      height: 6,
      borderRadius: 3,
      backgroundColor: "#1E293B",
      marginTop: 14,
      overflow: "hidden",
    },
    progressBarFill: { height: "100%", borderRadius: 3, backgroundColor: "#3B82F6" },
    progressCaption: { color: "#94A3B8", fontSize: 12, marginTop: 16, textAlign: "center" },
  });
}
