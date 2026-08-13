import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
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
import { useAppTheme, type AppColors, type AppTints } from "../../src/theme";

/** 실제 최근 당첨번호 합계 평균을 계산할 때 쓰는 표본 크기 (최근 52주 = 1년치 회차). lab.tsx와 동일 기준. */
const RECENT_SUM_SAMPLE_SIZE = 52;

/** 고빈도 당첨번호 상위권 포함: 최근 1년(52주) 표본에서 출현 빈도 상위 10개 번호 기준. */
const HIGH_FREQ_SAMPLE_WEEKS = 52;
const HIGH_FREQ_TOP_N = 10;

/** 장기 미출현번호 포함: 기본 12주 기준, 100만 회 부스터 탐색일 때만 8주 기준으로 좁힌다. */
const LONG_TERM_ABSENT_WEEKS_DEFAULT = 12;
const LONG_TERM_ABSENT_WEEKS_BOOSTER = 8;

type SumAveragePreference = "NONE" | "UP" | "DOWN";

/**
 * "preferred=5,11,22" 형태의 라우트 파라미터를 1~45 범위의 정수 배열로 변환한다.
 * 홈 화면 "최근 오래 나오지 않은 번호 > 바로가기"에서 이 화면으로 넘어올 때, 해당 번호들을
 * 선호번호로 미리 선택해두는 용도로 쓰인다(exclusion.tsx의 parseExcludeParam과 동일 패턴).
 */
function parsePreferredParam(raw?: string | string[]): number[] {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(",")
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 45)
    ),
  ];
}

// 탐색 단계별 안내 문구. generator.ts가 보고하는 phase에 그대로 매핑한다 —
// percent 임계값(예: 60%, 85%)으로 라벨을 추측하지 않고, 실제 계산 단계와 항상 일치시킨다.
const PHASE_LABELS: Record<AiSearchPhase, string> = {
  GENERATING: "무작위 후보 생성 중",
  SCORING: "조건에 맞지 않는 조합 제외 중",
  FINALIZING: "최종 조합 선정 중",
};

export default function AiSearchScreen() {
  const router = useRouter();
  const { colors, tints } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors, tints), [colors, tints]);
  const setResult = useGenerationStore((s) => s.setResult);
  const params = useLocalSearchParams<{ preferred?: string }>();

  const [searchCount, setSearchCount] = useState<1 | 30000 | 100000 | 1000000>(30000);
  const [excluded, setExcluded] = useState<number[]>([]);
  const [preferred, setPreferred] = useState<number[]>(() => parsePreferredParam(params.preferred));
  // 홈 화면 "최근 오래 나오지 않은 번호 > 바로가기"로 들어왔는지(마운트 시점 값으로 고정,
  // 이후 선택 변경과 무관 — exclusion.tsx의 cameFromShortcut과 동일 패턴).
  const [cameFromShortcut] = useState(() => parsePreferredParam(params.preferred).length > 0);
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
  async function resolveMustIncludeOneOfSets(): Promise<{
    sets: number[][];
    /** 데이터를 못 불러와 이번 탐색에 반영되지 못한 옵션 이름 목록 (호출부가 한 번에 안내한다). */
    unavailableLabels: string[];
  }> {
    const sets: number[][] = [];
    const unavailableLabels: string[] = [];

    if (includeHighFreqTop10) {
      const draws = await getRecentDrawsSafe(HIGH_FREQ_SAMPLE_WEEKS);
      if (draws.length === 0) {
        unavailableLabels.push("고빈도 당첨번호 상위권 포함");
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
        unavailableLabels.push("장기 미출현번호 포함");
      } else {
        const absent = getNumbersAbsentInLastDraws(draws);
        if (absent.length > 0) sets.push(absent);
      }
    }

    return { sets, unavailableLabels };
  }

  function toggleExcluded(n: number) {
    setExcluded((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }
  function togglePreferred(n: number) {
    setPreferred((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }

  async function handleGenerate() {
    // 탐색 시작을 누르면 즉시 로딩 화면부터 보여준다 — 아래 UP/DOWN·고빈도·미출현번호 옵션의
    // 사전 데이터 조회(getRecentDrawsSafe)가 끝나야 실제 후보 생성이 시작되는데, 이 조회를
    // 먼저 마친 뒤에야 로딩 화면을 띄우면(과거 구현) 네트워크가 느릴 때 버튼을 눌러도 한동안
    // 아무 반응이 없는 것처럼 보인다. "무작위 후보 생성 중"은 실제 생성이 시작될 때만 붙인다.
    setIsRunning(true);
    setProgressLabel("탐색 준비 중");
    setProgressPercent(0);

    // "UP" 선택 시 minSum, "DOWN" 선택 시 maxSum을 최근 52주 실제 평균 합계로 설정한다.
    // scoring.ts의 conditionMatchScore()가 이미 minSum/maxSum을 소프트 페널티로 반영하므로,
    // 여기서 값만 정확히 넘겨주면 결과에 실제로 반영된다(하드 필터가 아니라 점수 가중치라
    // 조건이 안 맞는 조합이 완전히 배제되진 않지만, 상위로 랭크되는 조합들은 UP/DOWN 방향에
    // 뚜렷하게 치우치게 된다).
    const unavailableOptionLabels: string[] = [];

    let sumBounds: Pick<GenerationRequest, "minSum" | "maxSum"> = {};
    if (sumAveragePreference !== "NONE") {
      const avg = await resolveRecentAverageSum();
      if (avg !== null) {
        sumBounds = sumAveragePreference === "UP" ? { minSum: avg } : { maxSum: avg };
      } else {
        unavailableOptionLabels.push("당첨숫자 총합 평균값 UP/DOWN 선택");
      }
    }

    const { sets: mustIncludeOneOfSets, unavailableLabels } = await resolveMustIncludeOneOfSets();
    unavailableOptionLabels.push(...unavailableLabels);

    // 실패한 옵션이 여러 개여도 알림을 하나로 모아서 한 번만 띄운다 — 옵션마다 따로
    // Alert.alert를 띄우면(과거 구현) 오프라인 등으로 여러 개가 한꺼번에 실패했을 때
    // 확인 버튼을 2~3번 눌러야 하는 성가신 경험이 된다.
    if (unavailableOptionLabels.length > 0) {
      Alert.alert(
        "일부 옵션을 적용하지 못했습니다",
        `최근 당첨번호 데이터를 불러오지 못해 다음 옵션은 이번 탐색에 적용되지 않았습니다: ${unavailableOptionLabels.join(", ")}`
      );
    }

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

    setProgressLabel("무작위 후보 생성 중");

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
    // 100만 회 부스터 탐색은 다른 옵션보다 훨씬 오래 걸리는데(17번 QA 항목 실측: 3만 회
    // 대비 약 10.8배), 로딩 화면이 뜨자마자 그 사실을 먼저 알려주지 않으면 "왜 이렇게
    // 안 끝나지"라는 인상을 주기 쉽다는 QA 피드백 — 스피너보다 먼저(화면 맨 위) 보이도록
    // 배치하고, 탐색이 끝날 때까지 계속 보여준다(초반에만 잠깐 보이고 사라지면 뒤늦게
    // 오래 걸리는 걸 알게 될 뿐이라 의미가 없다).
    const isBoosterSearch = searchCount === BOOSTER_SEARCH_COUNT;
    return (
      <View
        style={styles.progressContainer}
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${progressLabel}, ${progressPercent}퍼센트`}
      >
        {isBoosterSearch ? (
          <Text style={styles.boosterNotice}>
            100만 회 부스터 탐색은 계산에 시간이 다소 걸릴 수 있어요.
          </Text>
        ) : null}
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
      {cameFromShortcut ? (
        <View style={styles.shortcutBanner}>
          <Text style={styles.shortcutBannerText}>
            홈 화면에서 오래 나오지 않은 번호가 자동으로 선호번호에 추가됐어요. 아래에서 직접 조정할 수 있어요.
          </Text>
        </View>
      ) : null}

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

function createStyles(colors: AppColors, tints: AppTints) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    shortcutBanner: {
      backgroundColor: tints.indigo.bg,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
    shortcutBannerText: { color: tints.indigo.fg, fontSize: 12, fontWeight: "600", lineHeight: 18 },
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
    boosterNotice: {
      color: "#FDBA74",
      fontSize: 13,
      fontWeight: "700",
      textAlign: "center",
      marginBottom: 20,
    },
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
