import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getRecentDrawsSafe,
  computeNumberFrequencies,
  computeCombinationPatternStats,
  computeSumTrend,
  computeTransitionFrequencies,
  computeFirstPrizeExpectation,
  describeFirstPrizeExpectation,
  computeFirstPrizeNetPayout,
  computeConsecutiveNumberStats,
  computeConsecutivePairGapStats,
  computeConsecutiveTripleGapStats,
  describeConsecutiveGapHeadline,
  getLongestAbsentNumbers,
  SUM_MIDPOINT,
  type WinningDraw,
  type NumberFrequency,
  type TransitionFrequencyRow,
} from "../../src/lib/draws";
import { getGenerationHistory, getTickets } from "../../src/lib/storage";
import { getOddCount } from "../../src/lib/lottery/pattern";
import { overlapCount } from "../../src/lib/lottery/similarity";
import { LottoBall, DisclaimerCard, SkeletonBlock, SkeletonBall, SumTrendChart, StatusBarSafeMask } from "../../src/components";
import {
  SUM_TREND_NOTICE,
  TRANSITION_FREQUENCY_NOTICE,
  FIRST_PRIZE_EXPECTATION_NOTICE,
  CONSECUTIVE_GAP_NOTICE,
} from "../../src/constants/messages";
import { useAppTheme, accentViolet, type AppColors, type AppTints, type BrandTokens } from "../../src/theme";

/** 번호별 출현 빈도·패턴 통계의 기준 표본 크기 (최근 52주 = 1년치 회차). */
const RECENT_DRAW_SAMPLE_SIZE = 52;
/**
 * "이번 회차 번호 이후 통계"(computeTransitionFrequencies) 전용 표본 크기. 표본이 작을수록
 * 노이즈가 커지므로 52주가 아니라 최대한 많은 과거 데이터를 쓴다. 로또6/45는 2002년 12월
 * 시작(2026년 기준 약 1,300회차 안팎)이므로 이 값이면 사실상 전체 히스토리를 커버한다.
 */
const FULL_HISTORY_SAMPLE_SIZE = 2000;
/** 이 미만이면 트리거별 표본이 너무 작아 카드 자체를 숨긴다(순위가 사실상 무의미해짐). */
const MIN_TRANSITION_HISTORY_DRAWS = 200;

// ===================== 2026-10-02 "로또 연구소" 레이아웃 개편 전용 헬퍼 =====================
// 이 구간은 전부 화면 표시(프레젠테이션) 전용이다 — src/lib/draws/drawStats.ts의 통계 계산
// 로직은 전혀 건드리지 않고, 이미 계산된 값을 "핵심 발견" 요약 카드에 맞는 짧은 문구로
// 재구성하는 역할만 한다. 화면 개편과 통계 계산 변경을 분리하라는 원칙에 따른 것.

/**
 * 줄바꿈이 절대 되면 안 되는 구(" 자세히 ↓ OOO" 같은 탭 대상 링크 전체)를 만들 때 쓴다.
 * 일반 공백 대신 줄바꿈 불가 공백(NBSP)을 넣어, 이 구 중간이 두 줄로 쪼개지지 않고
 * 통째로만 다음 줄로 내려가게 한다 — 웹 목업에서 "자세히 ↓ 연번" / "통계"처럼 링크 문구
 * 중간이 끊기던 문제와 동일 증상이 RN Text에서도 발생할 수 있어 선제적으로 방지한다.
 */
const NBSP = " ";
function nbspJoin(...parts: string[]): string {
  return parts.join(NBSP);
}

/**
 * latestDraw.numbers(이미 officialCard에 그대로 표시 중인 값) 안에서 연속된 번호 구간을 찾아
 * "43·44"처럼 사람이 읽을 문자열로 반환한다. 새로운 통계가 아니라 이미 화면에 보이는 당첨번호
 * 6개를 다시 훑어 연속 구간만 골라내는 순수 표시용 함수 — getMaxConsecutiveLength(길이만
 * 반환)와 달리 "어떤 번호들인지"가 필요한 핵심 발견 카드 전용으로 추가했다. 연속 구간이
 * 여러 개면(이론상 드묾) 더 긴 쪽을 우선한다.
 */
function getConsecutivePairLabel(numbers: number[]): string | null {
  const sorted = [...numbers].sort((a, b) => a - b);
  const runs: number[][] = [];
  let current: number[] = sorted.length > 0 ? [sorted[0]] : [];
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] === sorted[i - 1] + 1) {
      current.push(sorted[i]);
    } else {
      if (current.length >= 2) runs.push(current);
      current = [sorted[i]];
    }
  }
  if (current.length >= 2) runs.push(current);
  if (runs.length === 0) return null;
  const longest = runs.reduce((a, b) => (b.length > a.length ? b : a));
  return longest.join("·");
}

/** topFrequent(이미 Top6 카드에 쓰는 값) 중 최다 출현 횟수와 동률인 번호들을 "15·31" 형태로 묶는다. */
function getTopFrequencyLabel(topFrequent: NumberFrequency[]): { numbers: string; count: number } | null {
  if (topFrequent.length === 0) return null;
  const maxCount = topFrequent[0].totalCount;
  const numbers = topFrequent
    .filter((f) => f.totalCount === maxCount)
    .map((f) => f.number)
    .join("·");
  return { numbers, count: maxCount };
}

/** longestAbsent(이미 장기 미출현 카드에 쓰는 값) 중 최장 미출현과 동률인 번호들을 묶어 한 문장으로. */
function getLongestAbsentHeadline(
  longestAbsent: { number: number; drawsSinceLastSeen: number }[]
): string | null {
  if (longestAbsent.length === 0) return null;
  const maxGap = longestAbsent[0].drawsSinceLastSeen;
  const numbers = longestAbsent
    .filter((item) => item.drawsSinceLastSeen === maxGap)
    .map((item) => item.number)
    .join("·");
  return `${numbers}번, ${maxGap}회째 미출현 중`;
}

/**
 * describeFirstPrizeExpectation()(원본 함수, 문장 전체를 한 번에 반환)과 완전히 동일한 구간
 * 기준(절대 z-score 1/2)과 어휘("다소"/"꽤 이례적으로", "많이"/"적게")를 그대로 재사용하되,
 * "핵심 발견" 카드의 두 줄(굵은 제목 + 보조 설명)에 맞게 문장을 둘로 쪼갠 버전이다. 새로운
 * 판단 기준을 만든 게 아니라 같은 로직을 문구만 재배치했다.
 */
function describeFirstPrizeExpectationShort(exp: {
  actualWinnerCount: number;
  ratio: number | null;
  zScore: number | null;
}): { headline: string; detail: string } {
  const actual = exp.actualWinnerCount;
  if (exp.zScore === null || exp.ratio === null) {
    return { headline: `1등 당첨자 ${actual}명`, detail: "" };
  }
  const absZ = Math.abs(exp.zScore);
  const pct = Math.round(exp.ratio * 100);
  if (absZ < 1) {
    return {
      headline: `1등 당첨자 ${actual}명, 기대와 비슷한 수준이에요`,
      detail: "판매량 기준 이론적 기대치와 비슷한 수준이에요",
    };
  }
  const directionPast = exp.zScore >= 0 ? "많았어요" : "적었어요";
  const direction = exp.zScore >= 0 ? "많이" : "적게";
  const magnitude = absZ < 2 ? "다소" : "꽤 이례적으로";
  return {
    headline: `1등 당첨자 ${actual}명, 기대보다 ${pct}% ${directionPast}`,
    detail: `판매량 기준 이론적 기대치보다 ${magnitude} ${direction} 나왔어요`,
  };
}

export default function LabScreen() {
  const { colors, tints, brand } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors, tints, brand), [colors, tints, brand]);
  // 94번 항목 — 탭 상단 네비게이션 헤더를 숨겼기 때문에(app/(tabs)/_layout.tsx) 안전영역
  // 상단 여백을 직접 챙겨줘야 한다.
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [draws, setDraws] = useState<WinningDraw[]>([]);
  const [fullHistoryDraws, setFullHistoryDraws] = useState<WinningDraw[]>([]);
  const [frequencies, setFrequencies] = useState<NumberFrequency[]>([]);
  const [myAnalysis, setMyAnalysis] = useState<{
    totalGames: number;
    mostFrequent: { number: number; count: number }[];
    averageOddCount: number;
    averageOverlap: number;
  } | null>(null);
  const [weeklyReport, setWeeklyReport] = useState<{
    gameCount: number;
    topNumbers: { number: number; count: number }[];
    averageOddCount: number;
  } | null>(null);

  // ----- 2026-10-02 개편: "핵심 발견" 카드의 "자세히 ↓" 링크가 같은 화면의 해당 통계 카드로
  // 스크롤 이동하기 위한 참조. sectionOffsets는 state로 두면 onLayout마다 불필요한 리렌더가
  // 생기므로 ref(일반 mutable 객체)로 둔다 — 탭 시점에만 읽으면 충분하다. -----
  const scrollViewRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Record<string, number>>({});
  const registerSection = useCallback(
    (key: string) => (e: LayoutChangeEvent) => {
      sectionOffsets.current[key] = e.nativeEvent.layout.y;
    },
    []
  );
  const scrollToSection = useCallback((key: string) => {
    const y = sectionOffsets.current[key];
    if (y != null) {
      scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
    }
  }, []);

  // ----- 2026-10-02 개편: 길게 설명하는 "통계 해석 시 유의사항" 안내문구를 카드 하단에
  // 접어두고, 탭했을 때만 펼친다(기존 DisclaimerCard 텍스트는 그대로 유지 — 노출 방식만
  // 바뀐다). 카드마다 독립적으로 펼치고 접을 수 있어야 하므로 카드별 state를 따로 둔다. -----
  const [consecutiveGapNoticeOpen, setConsecutiveGapNoticeOpen] = useState(false);
  const [transitionNoticeOpen, setTransitionNoticeOpen] = useState(false);
  const [firstPrizeDetailOpen, setFirstPrizeDetailOpen] = useState(false);
  const [sumTrendNoticeOpen, setSumTrendNoticeOpen] = useState(false);

  const loadLabData = useCallback(async () => {
    // FULL_HISTORY_SAMPLE_SIZE(2000)는 RECENT_DRAW_SAMPLE_SIZE(52)의 상위집합이므로,
    // 별도로 두 번 fetch하지 않고 큰 표본 하나를 받아 앞쪽 52개를 그대로 "최근 52주" 통계에
    // 재사용한다(getRecentDraws는 최신 회차부터 역순으로 채워 반환한다).
    const fullHistoryDraws = await getRecentDrawsSafe(FULL_HISTORY_SAMPLE_SIZE);
    const recentDraws = fullHistoryDraws.slice(0, RECENT_DRAW_SAMPLE_SIZE);
    setFullHistoryDraws(fullHistoryDraws);
    setDraws(recentDraws);
    setFrequencies(computeNumberFrequencies(recentDraws));

    const history = await getGenerationHistory();
    if (history.length > 0) {
      const counts = new Map<number, number>();
      for (const combo of history) {
        for (const n of combo) counts.set(n, (counts.get(n) ?? 0) + 1);
      }
      const mostFrequent = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([number, count]) => ({ number, count }));

      const avgOdd =
        history.reduce((sum, combo) => sum + getOddCount(combo), 0) / history.length;

      let overlapSum = 0;
      let pairCount = 0;
      for (let i = 0; i < history.length; i += 1) {
        for (let j = i + 1; j < history.length; j += 1) {
          overlapSum += overlapCount(history[i], history[j]);
          pairCount += 1;
        }
      }

      setMyAnalysis({
        totalGames: history.length,
        mostFrequent,
        averageOddCount: avgOdd,
        averageOverlap: pairCount > 0 ? overlapSum / pairCount : 0,
      });
    }

    const tickets = await getTickets();
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weeklyTickets = tickets.filter((t) => new Date(t.createdAt).getTime() >= oneWeekAgo);
    if (weeklyTickets.length > 0) {
      const weeklyCounts = new Map<number, number>();
      for (const t of weeklyTickets) {
        for (const n of t.game.numbers) weeklyCounts.set(n, (weeklyCounts.get(n) ?? 0) + 1);
      }
      const topNumbers = [...weeklyCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([number, count]) => ({ number, count }));
      const avgOdd =
        weeklyTickets.reduce((sum, t) => sum + getOddCount(t.game.numbers), 0) / weeklyTickets.length;
      setWeeklyReport({ gameCount: weeklyTickets.length, topNumbers, averageOddCount: avgOdd });
    }

    // 호출부(다시 시도 버튼)가 "이번 시도에서도 당첨번호 데이터를 못 받았는지" 판단할 수 있도록 반환한다.
    // 내 번호 분석/이번 주 리포트 계산이 모두 끝난 뒤에 반환해야 한다 — 예전에는 이 return이
    // 함수 맨 앞(당첨번호 조회 직후)에 있어서 그 아래 두 계산 블록이 전부 도달 불가능한 코드였다.
    return recentDraws;
  }, []);

  useEffect(() => {
    loadLabData().finally(() => setLoading(false));
  }, [loadLabData]);

  async function handleRetry() {
    setRetrying(true);
    try {
      const recentDraws = await loadLabData();
      if (recentDraws.length === 0) {
        // 버튼을 눌러도 화면이 그대로라 "눌렸는지조차" 알기 어렵다는 문제가 있었다.
        // 재시도했는데도 실패했다는 걸 명시적으로 알려준다.
        Alert.alert(
          "불러오기 실패",
          "당첨번호를 다시 불러오지 못했어요. 네트워크 상태를 확인 후 다시 시도해주세요."
        );
      }
    } finally {
      setRetrying(false);
    }
  }

  if (loading) {
    // 중앙 스피너로 화면을 통째로 가리는 대신, 실제 카드 레이아웃을 흐릿하게 먼저
    // 보여준다 — 로딩이 끝나는 순간 "빈 화면 → 카드 등장"으로 튀어 보이지 않는다.
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: 16 }}>
          <Text style={styles.header}>로또 연구소</Text>

          <View style={styles.card}>
            <SkeletonBlock width={140} height={14} style={styles.skeletonMb8} />
            <SkeletonBlock width={90} height={11} style={styles.skeletonMb8} />
            <View style={styles.ballRow}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <SkeletonBall key={i} size={32} />
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <SkeletonBlock width={180} height={14} style={styles.skeletonMb8} />
            <View style={styles.ballRow}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <View key={i} style={styles.freqItem}>
                  <SkeletonBall size={32} />
                  <SkeletonBlock width={20} height={9} />
                </View>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <SkeletonBlock width={160} height={14} style={styles.skeletonMb8} />
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.row}>
                <SkeletonBlock width={110} height={11} />
                <SkeletonBlock width={40} height={11} />
              </View>
            ))}
          </View>
        </ScrollView>
        <StatusBarSafeMask />
      </View>
    );
  }

  const latestDraw = draws[0];
  const patternStats = computeCombinationPatternStats(draws);
  const topFrequent = [...frequencies].sort((a, b) => b.totalCount - a.totalCount).slice(0, 6);
  const longestAbsent = latestDraw
    ? getLongestAbsentNumbers(frequencies, latestDraw.drawNumber, 6)
    : [];
  const sumTrend = computeSumTrend(draws);
  const transitionRows: TransitionFrequencyRow[] =
    latestDraw && fullHistoryDraws.length >= MIN_TRANSITION_HISTORY_DRAWS
      ? computeTransitionFrequencies(fullHistoryDraws, latestDraw.numbers, 3)
      : [];
  const firstPrizeExpectation = latestDraw ? computeFirstPrizeExpectation(latestDraw) : null;
  const firstPrizeNetPayout = latestDraw ? computeFirstPrizeNetPayout(latestDraw) : null;
  const consecutiveStats =
    fullHistoryDraws.length > 0
      ? computeConsecutiveNumberStats(fullHistoryDraws, RECENT_DRAW_SAMPLE_SIZE)
      : null;
  const consecutiveGapStats = computeConsecutivePairGapStats(fullHistoryDraws);
  const consecutiveTripleGapStats = computeConsecutiveTripleGapStats(fullHistoryDraws);
  const consecutiveGapHeadline = consecutiveGapStats ? describeConsecutiveGapHeadline(consecutiveGapStats) : null;

  // ----- 2026-10-02 개편: "핵심 발견" 카드용 요약값. 전부 위에서 이미 계산된 값을 그대로
  // 재사용하며 새 통계를 만들지 않는다(진짜 계산은 drawStats.ts에만 있다). -----
  const topFrequencyLabel = getTopFrequencyLabel(topFrequent);
  const longestAbsentHeadline = getLongestAbsentHeadline(longestAbsent);
  const consecutivePairLabel = latestDraw ? getConsecutivePairLabel(latestDraw.numbers) : null;
  const firstPrizeShort = firstPrizeExpectation ? describeFirstPrizeExpectationShort(firstPrizeExpectation) : null;
  const hasAnyInsight = Boolean(
    (consecutiveStats && consecutiveGapHeadline) || topFrequencyLabel || longestAbsentHeadline || firstPrizeShort
  );

  return (
    <View style={styles.container}>
    <ScrollView
      ref={scrollViewRef}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: 16 }}
    >
      <Text style={styles.header}>로또 연구소</Text>

      {/* 2026-10-02 개편: 섹션 라벨로 "무엇을 보여주는지"부터 먼저 알리고, 화면 전체를
          이번 회차 결과 → 핵심 발견 → 내 번호 → 각 통계 순으로 한 줄짜리 세로 흐름으로 정렬한다.
          기존 11개 콘텐츠는 전부 그대로 유지하고 배치 순서와 강조만 바꿨다. */}
      <SectionLabel styles={styles}>이번 회차 결과</SectionLabel>

      {latestDraw ? (
        // 이 카드만 실제 공식 발표 데이터(정부 추첨 결과)이고, 바로 아래 카드들(출현 빈도/
        // 장기 미출현/패턴 통계 등)은 전부 그 결과를 가공한 통계·분석이다. 예전엔 둘 다 같은
        // 흰색 카드 스타일이라 구분이 안 됐다는 QA 피드백(2026-08-13, #81) — 처음엔 카드 전체를
        // 초록 톤으로 칠했는데 실기기에서 "촌스럽다"는 피드백(#91)을 받아 다른 카드와 완전히
        // 같은 흰 배경으로 바꿨더니 이번엔 "눈에 안 띈다"는 후속 피드백(#92) — 옅은 브랜드 블루
        // 톤 배경 + 그림자(shadow/elevation)로 카드가 화면에서 살짝 떠 보이게 하는 절충안으로
        // 정착. 색으로만 구분하면 색맹 등 접근성 문제가 있으므로 "실제 당첨결과" 배지 텍스트도
        // 함께 넣어 색 없이도 구분되게 한다.
        <View style={styles.officialCard}>
          <View style={styles.officialBadge}>
            <Text style={styles.officialBadgeText}>실제 당첨결과</Text>
          </View>
          <View style={styles.officialTitleRow}>
            <Text style={[styles.cardTitle, styles.noBottomMargin]}>
              제 {latestDraw.drawNumber}회 당첨결과
            </Text>
            <Text style={[styles.cardSub, styles.noBottomMargin]}>{latestDraw.drawDate}</Text>
          </View>
          {/* [2026-09-11] 이 카드만 실제 공식 발표 데이터라, 공 자체에도 살짝 입체감(가장자리
              셰이딩+하이라이트)을 줘서 아래 통계 카드들의 평면 공과 질감으로 구분되게 한다 —
              사용자 요청("실제 당첨결과이므로 차이를 두고 싶다"). LottoBall.tsx 상단 주석 참고. */}
          <View style={styles.ballRow}>
            {latestDraw.numbers.map((n) => (
              <LottoBall key={n} number={n} size={32} variant="glossy" />
            ))}
            <Text style={styles.plusText}>+</Text>
            <LottoBall number={latestDraw.bonusNumber} size={32} variant="glossy" />
          </View>
          {firstPrizeNetPayout ? (
            // [2026-09-26] 1등 1인당 실수령액 — 홈 화면 "1등 예상 총 당첨금"(추첨 전 추정치)과
            // 달리 이미 확정된 실제 당첨자 수를 쓰는 사후 사실이라, 다른 통계 카드들과 달리
            // "예측 아님" DisclaimerCard는 붙이지 않는다. 다만 세전 금액·세율 근거는 helperNote로
            // 짧게 덧붙여 정직성 원칙(§23)을 유지한다.
            <>
              <View style={styles.officialDivider} />
              <Row styles={styles} label="1등 당첨자 수" value={`${firstPrizeNetPayout.winnerCount}명`} />
              <Row
                styles={styles}
                label="1인당 실수령액"
                value={`${firstPrizeNetPayout.netPerWinner.toLocaleString("ko-KR")}원`}
              />
              <Text style={styles.helperNote}>
                세전 {firstPrizeNetPayout.grossPerWinner.toLocaleString("ko-KR")}원 기준, 기타소득세(3억원까지
                22%, 초과분 33%) 원천징수 후 예상 금액이에요. 실제 수령액과 약간 다를 수 있어요.
              </Text>
            </>
          ) : null}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardSub}>
            당첨번호를 불러오지 못했습니다. 네트워크 연결을 확인해주세요.
          </Text>
          <Pressable
            style={styles.retryButton}
            onPress={handleRetry}
            disabled={retrying}
            accessibilityRole="button"
            accessibilityLabel="당첨번호 다시 불러오기"
            accessibilityState={{ disabled: retrying, busy: retrying }}
          >
            {retrying ? (
              <ActivityIndicator size="small" color={brand.primary} />
            ) : (
              <Text style={styles.retryButtonText}>다시 시도</Text>
            )}
          </Pressable>
        </View>
      )}

      {/* 2026-10-02 신규: "핵심 발견" — 아래 각 통계 카드에 이미 있는 값만 모아 먼저 보여주는
          요약 카드. 새 통계를 계산하지 않고 전부 아래 카드들과 같은 값을 재사용하며, 탭하면
          해당 카드로 스크롤 이동한다(링크 동작은 목업 단계에서 Playwright로 확인 완료). */}
      {hasAnyInsight ? (
        <>
          <SectionLabel styles={styles}>핵심 발견</SectionLabel>
          <View style={styles.insightCard}>
            {consecutiveStats && consecutiveGapHeadline ? (
              <Pressable
                style={styles.insightRow}
                onPress={() => scrollToSection(consecutivePairLabel ? "consecutive" : "consecutiveGap")}
              >
                {consecutivePairLabel ? (
                  <LottoBall number={Number(consecutivePairLabel.split("·").pop())} size={36} />
                ) : (
                  <View style={[styles.insightIconBadge, { backgroundColor: tints.indigo.bg }]}>
                    <Text style={[styles.insightIconBadgeText, { color: tints.indigo.fg }]} numberOfLines={1}>
                      {consecutiveGapHeadline.highlight}
                    </Text>
                  </View>
                )}
                <View style={styles.insightTextWrap}>
                  {consecutivePairLabel ? (
                    <Text style={styles.insightTextMain}>이번 회차 연속번호({consecutivePairLabel}) 포함</Text>
                  ) : (
                    <Text style={styles.insightTextMain}>
                      {consecutiveGapHeadline.prefix}
                      {consecutiveGapHeadline.highlight}
                      {consecutiveGapHeadline.suffix}
                    </Text>
                  )}
                  <Text style={styles.insightTextSub}>
                    {consecutivePairLabel ? "이번 회차에 연속번호가 나왔어요 · " : ""}
                    <Text
                      style={styles.insightLink}
                      onPress={() => scrollToSection(consecutivePairLabel ? "consecutive" : "consecutiveGap")}
                    >
                      {consecutivePairLabel
                        ? nbspJoin("자세히", "↓", "연번", "통계")
                        : nbspJoin("자세히", "↓", "연번", "공백", "패턴")}
                    </Text>
                  </Text>
                </View>
              </Pressable>
            ) : null}

            {topFrequencyLabel ? (
              <Pressable style={styles.insightRow} onPress={() => scrollToSection("freq")}>
                <LottoBall number={Number(topFrequencyLabel.numbers.split("·")[0])} size={36} />
                <View style={styles.insightTextWrap}>
                  <Text style={styles.insightTextMain}>
                    최근 {RECENT_DRAW_SAMPLE_SIZE}회 최다 출현은 {topFrequencyLabel.numbers}번 ({topFrequencyLabel.count}
                    회)
                  </Text>
                  <Text style={styles.insightTextSub}>
                    <Text style={styles.insightLink} onPress={() => scrollToSection("freq")}>
                      {nbspJoin("자세히", "↓", "번호별", "출현", "빈도")}
                    </Text>
                  </Text>
                </View>
              </Pressable>
            ) : null}

            {longestAbsentHeadline && longestAbsent.length > 0 ? (
              <Pressable style={styles.insightRow} onPress={() => scrollToSection("longestAbsent")}>
                <LottoBall number={longestAbsent[0].number} size={36} />
                <View style={styles.insightTextWrap}>
                  <Text style={styles.insightTextMain}>{longestAbsentHeadline}</Text>
                  <Text style={styles.insightTextSub}>
                    최근 {RECENT_DRAW_SAMPLE_SIZE}회 동안 가장 오래 안 나왔어요 ·{" "}
                    <Text style={styles.insightLink} onPress={() => scrollToSection("longestAbsent")}>
                      {nbspJoin("자세히", "↓", "장기", "미출현", "번호")}
                    </Text>
                  </Text>
                </View>
              </Pressable>
            ) : null}

            {firstPrizeShort && firstPrizeExpectation ? (
              <Pressable style={styles.insightRow} onPress={() => scrollToSection("firstPrize")}>
                <View style={[styles.insightIconBadge, { backgroundColor: tints.indigo.bg }]}>
                  <Text style={[styles.insightIconBadgeText, { color: tints.indigo.fg }]} numberOfLines={1}>
                    {firstPrizeExpectation.ratio != null ? `${Math.round(firstPrizeExpectation.ratio * 100)}%` : "-"}
                  </Text>
                </View>
                <View style={styles.insightTextWrap}>
                  <Text style={styles.insightTextMain}>{firstPrizeShort.headline}</Text>
                  {firstPrizeShort.detail ? (
                    <Text style={styles.insightTextSub}>
                      {firstPrizeShort.detail} ·{" "}
                      <Text style={styles.insightLink} onPress={() => scrollToSection("firstPrize")}>
                        {nbspJoin("자세히", "↓", "기대", "대비", "실제", "1등", "당첨자", "수")}
                      </Text>
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : null}

      <SectionLabel styles={styles}>내 번호</SectionLabel>

      {weeklyReport ? (
        <View style={styles.weeklyCard}>
          <Text style={styles.weeklyTitle}>이번 주 리포트</Text>
          <Text style={styles.weeklyText}>
            최근 7일 동안 {weeklyReport.gameCount}게임을 저장했어요. 평균 홀수 개수는{" "}
            {weeklyReport.averageOddCount.toFixed(1)}개입니다.
          </Text>
          <View style={styles.ballRow}>
            {weeklyReport.topNumbers.map((item) => (
              <View key={item.number} style={styles.freqItem}>
                <LottoBall number={item.number} size={30} />
                <Text style={styles.freqCountLight}>{item.count}회</Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        // 2026-10-02 추가: 기존엔 weeklyReport가 없으면 이 자리가 통째로 비어 보였다. 바로 아래
        // myAnalysis 카드는 원래부터 빈 상태일 때도 안내문을 보여줬으므로(기존 코드), 그 패턴과
        // 통일해 "내 번호" 구간이 빈 화면처럼 보이지 않게 한다.
        <View style={styles.card}>
          <Text style={styles.cardSub}>
            최근 7일 동안 저장한 번호가 없어요. 번호를 저장하면 이번 주 리포트를 보여드려요.
          </Text>
        </View>
      )}

      {myAnalysis ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>내 번호 분석 (최근 {myAnalysis.totalGames}게임)</Text>
          <Text style={styles.cardSub}>가장 많이 선택한 번호</Text>
          <View style={styles.ballRow}>
            {myAnalysis.mostFrequent.map((item) => (
              <View key={item.number} style={styles.freqItem}>
                <LottoBall number={item.number} size={32} />
                <Text style={styles.freqCount}>{item.count}회</Text>
              </View>
            ))}
          </View>
          <Row styles={styles} label="평균 홀수 개수" value={myAnalysis.averageOddCount.toFixed(2)} />
          <Row
            styles={styles}
            label="저장한 조합끼리 겹치는 번호 수 (평균, 6개 중)"
            value={`${myAnalysis.averageOverlap.toFixed(2)}개`}
          />
          <Text style={styles.helperNote}>
            내가 저장한 조합 2개씩 짝지어 비교했을 때, 평균적으로 몇 개의 번호가 겹치는지를
            나타냅니다. 6개에 가까울수록 서로 비슷한(또는 같은) 조합을 자주 저장했다는 뜻입니다.
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardSub}>
            아직 생성한 번호가 없습니다. 번호를 만들면 내 선택 성향을 분석해드립니다.
          </Text>
        </View>
      )}

      <SectionLabel styles={styles}>각 통계</SectionLabel>

      <View style={styles.card} onLayout={registerSection("freq")}>
        <Text style={styles.cardTitle}>번호별 출현 빈도 Top 6</Text>
        {draws.length > 0 ? (
          <>
            <Text style={styles.cardSub}>최근 {draws.length}회 당첨번호 기준이에요.</Text>
            <View style={styles.ballRow}>
              {topFrequent.map((f) => (
                <View key={f.number} style={styles.freqItem}>
                  <LottoBall number={f.number} size={32} />
                  <Text style={styles.freqCount}>{f.totalCount}회</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.cardSub}>
            당첨번호 데이터를 불러오지 못해 통계를 계산할 수 없어요. 위 "다시 시도"를 눌러주세요.
          </Text>
        )}
      </View>

      {longestAbsent.length > 0 ? (
        <View style={styles.card} onLayout={registerSection("longestAbsent")}>
          <Text style={styles.cardTitle}>장기 미출현 번호</Text>
          <Text style={styles.cardSub}>최근 {RECENT_DRAW_SAMPLE_SIZE}회 동안 가장 오래 안 나온 번호예요.</Text>
          <View style={styles.ballRow}>
            {longestAbsent.map((item) => (
              <View key={item.number} style={styles.freqItem}>
                <LottoBall number={item.number} size={32} />
                <Text style={styles.freqCount}>{item.drawsSinceLastSeen}회째</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {consecutiveStats ? (
        <View style={styles.card} onLayout={registerSection("consecutive")}>
          <Text style={styles.cardTitle}>연번(연속번호) 통계</Text>
          {/* 2026-10-02 신규: "이번 회차 값"을 가장 먼저 보여주는 헤럴드 박스. 아래 cardSub(기존
              역대 비율 문장)와 Row 4개는 전부 원래 있던 내용 그대로다 — 순서만 "이번 회차 값 →
              역대 비교 → 세부 산출 근거"로 재배치했다. */}
          {consecutiveGapHeadline ? (
            <View style={styles.heraldBox}>
              <Text style={styles.heraldLabel}>이번 회차</Text>
              {consecutivePairLabel ? (
                <Text style={styles.heraldValue}>
                  <Text style={styles.heraldValueStrong}>{consecutivePairLabel}</Text> 연속번호 포함
                </Text>
              ) : (
                <Text style={styles.heraldValue}>
                  {consecutiveGapHeadline.prefix}
                  <Text style={styles.heraldValueStrong}>{consecutiveGapHeadline.highlight}</Text>
                  {consecutiveGapHeadline.suffix}
                </Text>
              )}
            </View>
          ) : null}
          <Text style={styles.cardSub}>
            역대 회차 중{" "}
            <Text style={styles.cardSubHighlight}>{Math.round(consecutiveStats.pairRate * 100)}%</Text>에
            연속번호가 포함됐어요.
          </Text>
          <Row
            styles={styles}
            label={`최근 ${consecutiveStats.recentSampleSize}회 연번 출현`}
            value={`${consecutiveStats.recentPairCount}회 (${Math.round(
              consecutiveStats.recentPairRate * 100
            )}%)`}
          />
          <Row
            styles={styles}
            label="역대 연번 출현"
            value={`${consecutiveStats.pairCount}회 (${Math.round(consecutiveStats.pairRate * 100)}%)`}
          />
          <Row
            styles={styles}
            label={`최근 ${consecutiveStats.recentSampleSize}회 3연번 출현`}
            value={`${consecutiveStats.recentTripleCount}회`}
          />
          <Row
            styles={styles}
            label="역대 3연번 출현"
            value={`${consecutiveStats.tripleCount}회 (${(consecutiveStats.tripleRate * 100).toFixed(1)}%)`}
          />
        </View>
      ) : null}

      {consecutiveGapStats ? (
        // [2026-09-26] "연번이 오래 안 나왔으니 곧 나올까?"라는 사용자 메모에서 출발했지만,
        // 실측(공백 길이 분포가 기하분포와 정확히 일치, 직전 회차 연번 여부와도 무관)이 정반대
        // 결론(패턴 없음)을 보여줘서, "패턴을 찾아 확률을 예측"이 아니라 "공백이 길어져도
        // 확률은 그대로다"라는 도박사의 오류 반증 카드로 프레이밍을 뒤집었다(검토 문서
        // consecutive-number-stats-review.md 참고). cardSub는 "지금 몇 회째인지" 실시간
        // 수치로 흥미를 끌고, Row/DisclaimerCard가 "그래도 확률은 안 변한다"는 결론을 보여준다.
        <>
          <View
            style={[styles.card, consecutiveGapNoticeOpen ? styles.cardTight : null]}
            onLayout={registerSection("consecutiveGap")}
          >
            <Text style={styles.cardTitle}>연번 공백 패턴</Text>
            <Text style={styles.cardSub}>
              {consecutiveGapHeadline?.prefix}
              <Text style={styles.cardSubHighlight}>{consecutiveGapHeadline?.highlight}</Text>
              {consecutiveGapHeadline?.suffix}
            </Text>
            <Row
              styles={styles}
              label="역대 평균 공백"
              value={`${consecutiveGapStats.averageGap.toFixed(1)}회`}
            />
            <Row styles={styles} label="역대 최장 공백" value={`${consecutiveGapStats.longestGap}회`} />
            <Row
              styles={styles}
              label="연번 후 연번 확률"
              value={`${Math.round(consecutiveGapStats.followRate * 100)}% (평소 ${Math.round(
                consecutiveGapStats.baseRate * 100
              )}%)`}
            />
            {consecutiveTripleGapStats ? (
              <View style={styles.tripleHighlightBox}>
                <Text style={styles.tripleHighlightText}>
                  3연번은 평균{" "}
                  <Text style={styles.tripleHighlightNumber}>
                    {consecutiveTripleGapStats.averageGap.toFixed(1)}회
                  </Text>
                  에 한 번, 훨씬 드물게 나타나요(이번 회차까지{" "}
                  <Text style={styles.tripleHighlightNumber}>{consecutiveTripleGapStats.currentGap}회째</Text>{" "}
                  공백 중).
                </Text>
              </View>
            ) : null}
            {/* 2026-10-02 개편: 기존엔 DisclaimerCard(CONSECUTIVE_GAP_NOTICE)가 카드 바로 아래
                항상 노출돼 있었다. 문구 자체는 토씨 하나 안 바꾸고 그대로 두되, 기본은 접어두고
                탭했을 때만 펼치게 바꿔 가독성 피드백("안내 문구가 길어서 가독성을 해친다")을
                반영했다. */}
            <Pressable
              style={styles.noticeToggleRow}
              onPress={() => setConsecutiveGapNoticeOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="통계 해석 시 유의사항 보기"
              accessibilityState={{ expanded: consecutiveGapNoticeOpen }}
            >
              <Text style={styles.noticeToggleText}>
                {nbspJoin("통계", "해석", "시", "유의사항")} {consecutiveGapNoticeOpen ? "▴" : "▾"}
              </Text>
            </Pressable>
          </View>
          {consecutiveGapNoticeOpen ? (
            <DisclaimerCard text={CONSECUTIVE_GAP_NOTICE} style={styles.attachedNotice} />
          ) : null}
        </>
      ) : null}

      {transitionRows.length > 0 ? (
        <>
          <View style={[styles.card, transitionNoticeOpen ? styles.cardTight : null]}>
            <Text style={styles.cardTitle}>
              이번 회차 번호 이후 통계 (전체 {fullHistoryDraws.length}회 기준)
            </Text>
            <Text style={styles.cardSub}>
              제 {latestDraw?.drawNumber}회 당첨번호 각각이 과거에 나온 뒤, 그 다음 회차에 어떤
              번호가 자주 나왔는지 보여주는 통계입니다. 예측이 아니에요 — 아래 안내를 꼭
              확인해주세요.
            </Text>
            {transitionRows.map((row) => (
              <View key={row.triggerNumber} style={styles.transitionRow}>
                <LottoBall number={row.triggerNumber} size={28} />
                <Text style={styles.transitionArrow}>다음 회차 →</Text>
                <View style={styles.transitionTopList}>
                  {row.top.length > 0 ? (
                    row.top.map((item) => (
                      <View key={item.number} style={styles.freqItem}>
                        <LottoBall number={item.number} size={26} />
                        <Text style={styles.freqCount}>{item.count}회</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.cardSub}>표본 부족</Text>
                  )}
                </View>
              </View>
            ))}
            <Text style={styles.helperNote}>
              표본 크기(해당 번호가 나온 뒤 다음 회차 데이터가 있는 과거 횟수):{" "}
              {transitionRows.map((r) => `${r.triggerNumber}번 ${r.sampleSize}회`).join(" · ")}
            </Text>
            <Pressable
              style={styles.noticeToggleRow}
              onPress={() => setTransitionNoticeOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="통계 해석 시 유의사항 보기"
              accessibilityState={{ expanded: transitionNoticeOpen }}
            >
              <Text style={styles.noticeToggleText}>
                {nbspJoin("통계", "해석", "시", "유의사항")} {transitionNoticeOpen ? "▴" : "▾"}
              </Text>
            </Pressable>
          </View>
          {transitionNoticeOpen ? (
            <DisclaimerCard text={TRANSITION_FREQUENCY_NOTICE} style={styles.attachedNotice} />
          ) : null}
        </>
      ) : null}

      <View style={styles.card}>
        {draws.length > 0 ? (
          <>
            <Text style={styles.cardTitle}>조합 패턴 통계 (최근 {draws.length}회 평균)</Text>
            <Row styles={styles} label="평균 홀수 개수" value={patternStats.averageOddCount.toFixed(2)} />
            <Row styles={styles} label="평균 저번호(1~22) 개수" value={patternStats.averageLowCount.toFixed(2)} />
            <Row styles={styles} label="평균 번호 합계" value={patternStats.averageSum.toFixed(1)} />
            <Row
              styles={styles}
              label="연속번호 포함 비율"
              value={`${Math.round(patternStats.consecutiveRatio * 100)}%`}
            />
          </>
        ) : (
          <>
            <Text style={styles.cardTitle}>조합 패턴 통계</Text>
            <Text style={styles.cardSub}>
              당첨번호 데이터를 불러오지 못해 통계를 계산할 수 없어요. 위 "다시 시도"를 눌러주세요.
            </Text>
          </>
        )}
      </View>

      {firstPrizeExpectation ? (
        <>
          <View
            style={[styles.card, firstPrizeDetailOpen ? styles.cardTight : null]}
            onLayout={registerSection("firstPrize")}
          >
            <Text style={styles.cardTitle}>
              기대 대비 실제 1등 당첨자 수 (제 {firstPrizeExpectation.drawNumber}회)
            </Text>
            <Text style={styles.cardSub}>{describeFirstPrizeExpectation(firstPrizeExpectation)}</Text>
            {/* 2026-10-02 개편: 기존 Row 5개(총판매액/추정게임수/이론적기대/실제/비율) 중
                비교가 핵심인 두 값(이론적 기대 vs 실제)만 2열로 바로 보여주고, 나머지 3개
                (산출 근거)는 아래 토글 안에 그대로 유지한다 — 전부 보존, 노출 방식만 분리. */}
            <View style={styles.compareRow}>
              <View style={styles.compareCol}>
                <Text style={styles.compareLabel}>실제 1등 당첨자</Text>
                <Text style={styles.compareValue}>{firstPrizeExpectation.actualWinnerCount}명</Text>
              </View>
              <View style={[styles.compareCol, styles.compareColBorder]}>
                <Text style={styles.compareLabel}>이론적 기대 1등 당첨자</Text>
                <Text style={[styles.compareValue, styles.compareValueMuted]}>
                  약 {firstPrizeExpectation.expectedWinnerCount.toFixed(1)}명
                </Text>
              </View>
            </View>
            <Pressable
              style={styles.noticeToggleRow}
              onPress={() => setFirstPrizeDetailOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="계산 기준 및 유의사항 보기"
              accessibilityState={{ expanded: firstPrizeDetailOpen }}
            >
              <Text style={styles.noticeToggleText}>
                {nbspJoin("계산", "기준·유의사항", "보기")} {firstPrizeDetailOpen ? "▴" : "▾"}
              </Text>
            </Pressable>
            {firstPrizeDetailOpen ? (
              <>
                <Row
                  styles={styles}
                  label="총 판매액"
                  value={`${firstPrizeExpectation.totalSalesAmount.toLocaleString("ko-KR")}원`}
                />
                <Row
                  styles={styles}
                  label="추정 구매 게임 수"
                  value={`약 ${Math.round(firstPrizeExpectation.estimatedGameCount).toLocaleString("ko-KR")}게임`}
                />
                {firstPrizeExpectation.ratio !== null ? (
                  <Row
                    styles={styles}
                    label="기대 대비 실제 비율"
                    value={`${Math.round(firstPrizeExpectation.ratio * 100)}%`}
                  />
                ) : null}
              </>
            ) : null}
          </View>
          {firstPrizeDetailOpen ? (
            <DisclaimerCard text={FIRST_PRIZE_EXPECTATION_NOTICE} style={styles.attachedNotice} />
          ) : null}
        </>
      ) : null}

      {/* 2026-10-02: 내 번호 분석 카드는 위쪽 "내 번호" 섹션(weeklyCard 바로 아래)으로
          옮겼다 — 이 자리엔 더 이상 중복 렌더링하지 않는다. */}

      <View style={[styles.card, sumTrendNoticeOpen ? styles.cardTight : null]}>
        {sumTrend.length > 0 ? (
          <>
            <Text style={styles.cardTitle}>당첨번호 합계 추세 (최근 {sumTrend.length}회)</Text>
            <Text style={styles.cardSub}>
              6개 당첨번호를 더한 값이 이론적 중간값({SUM_MIDPOINT}) 대비 높았는지(빨강) 낮았는지(파랑)를
              회차 순서대로 보여줍니다.
            </Text>
            <SumTrendChart points={sumTrend} midpoint={SUM_MIDPOINT} />
            <Pressable
              style={styles.noticeToggleRow}
              onPress={() => setSumTrendNoticeOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="통계 해석 시 유의사항 보기"
              accessibilityState={{ expanded: sumTrendNoticeOpen }}
            >
              <Text style={styles.noticeToggleText}>
                {nbspJoin("통계", "해석", "시", "유의사항")} {sumTrendNoticeOpen ? "▴" : "▾"}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.cardTitle}>당첨번호 합계 추세</Text>
            <Text style={styles.cardSub}>
              당첨번호 데이터를 불러오지 못해 그래프를 그릴 수 없어요. 위 "다시 시도"를 눌러주세요.
            </Text>
          </>
        )}
      </View>
      {sumTrend.length > 0 && sumTrendNoticeOpen ? (
        <DisclaimerCard text={SUM_TREND_NOTICE} style={styles.attachedNotice} />
      ) : null}
    </ScrollView>
    <StatusBarSafeMask />
    </View>
  );
}

function Row({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

/**
 * 2026-10-02 신규: 화면을 "이번 회차 결과 / 핵심 발견 / 내 번호 / 각 통계" 네 구간으로 나누는
 * 섹션 라벨. 오른쪽으로 뻗는 가는 선은 View 하나로 flex:1을 줘서 구현한다(웹 CSS의
 * `::after` 가상 요소에 대응하는 RN 방식).
 */
function SectionLabel({ children, styles }: { children: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.sectionLabelRow}>
      <Text style={styles.sectionLabelText}>{children}</Text>
      <View style={styles.sectionLabelLine} />
    </View>
  );
}

function createStyles(colors: AppColors, tints: AppTints, brand: BrandTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { fontSize: 22, fontWeight: "800", color: colors.textPrimary, marginBottom: 16 },
    skeletonMb8: { marginBottom: 8 },
    // [DESIGN_GUIDE.md Phase 3, 2026-09-10] radius 16→20 — 주요 콘텐츠 카드 티어(20px)로 통일.
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    // QA_LOG 117번 — 카드 바로 아래 그 카드 전용 DisclaimerCard(안내 문구)가 이어지는 자리에서
    // 쓴다. 예전엔 "카드(marginBottom 12) + 안내 문구(marginVertical 8)"가 그대로 합쳐져
    // 카드↔안내 문구 사이가 20px로 벌어지는 반면, 안내 문구↔다음(무관한) 카드 사이는 8px밖에
    // 안 돼서 정작 서로 연관된 카드-안내 쌍보다 무관한 다음 섹션이 더 가까워 보이는 역전
    // 현상이 있었다(사용자 피드백: "간격이 일정하지 않다", "연관성 있는 설명은 좀 더 가깝게").
    // 이 스타일로 카드 쪽 아래 여백을 좁혀(6px) 안내 문구와 밀착시키고, attachedNotice가
    // 안내 문구 쪽 위 여백을 0으로 맞춰 그 둘을 하나의 덩어리처럼 보이게 한다. 대신 안내 문구
    // 아래쪽엔 attachedNotice가 표준 섹션 간격(12px)을 그대로 유지해, 다음(무관한) 카드와의
    // 경계는 화면의 다른 카드-카드 간격과 동일하게 일정히 유지된다.
    cardTight: {
      marginBottom: 6,
    },
    // cardTight와 짝을 이루는 DisclaimerCard 전용 여백 오버라이드. 위는 카드에 밀착(0),
    // 아래는 화면 전체와 동일한 표준 간격(12)으로 다음 섹션과 자연스럽게 분리한다.
    attachedNotice: {
      marginTop: 0,
      marginBottom: 12,
    },
    cardTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary, marginBottom: 8 },
    cardSub: { fontSize: 12, color: colors.textMuted, marginBottom: 8 },
    // cardSub 문장 안에서 핵심 수치만 골라 볼드로 강조할 때 쓴다(2026-09-27, 가독성 피드백).
    // 문장 전체를 볼드로 바꾸면 오히려 스캔하기 어려워져서, 숫자/핵심 구간만 선택적으로 굵게
    // 하고 색도 textPrimary로 올려 muted한 나머지 문장과 대비를 준다. fontSize는 부모 cardSub와
    // 동일하게 둬야 줄바꿈이 자연스럽다.
    cardSubHighlight: { fontWeight: "800", color: colors.textPrimary },
    // "제 N회 당첨결과" 카드 전용 — 채도 높은 초록 박스(91번 이전)는 촌스러웠고, 다른 카드와
    // 완전히 같은 흰 배경(91번)은 반대로 눈에 안 띈다는 후속 피드백 — 그 중간으로, 옅은 브랜드
    // 블루 톤 배경(tints.indigo.bg, 다른 카드의 순백/서피스보다 살짝 톤이 다름) + 카드를 살짝
    // 띄워 보이게 하는 부드러운 그림자(shadow/elevation) + 상단 강조선 + 솔리드 배지를 함께 써서
    // "화면에서 붕 뜬 카드"처럼 도드라지게 하되 채도는 낮게 유지한다.
    // [Phase 3] radius 16→20 (다른 항목과 동일 근거). 강조용 shadow(0.18/10/4)는 이 카드만의
    // 의도된 "붕 뜬" 강조 장치라 Phase 3의 일반 shadow 절제 대상에서는 제외한다.
    officialCard: {
      backgroundColor: tints.indigo.bg,
      borderRadius: 20,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderTopWidth: 3,
      // [Phase 5c 브랜드 토큰 확장, 2026-09-10] borderTopColor·shadowColor 둘 다 브랜드 블루를
      // 그대로 옮겨 "떠 있는" 강조 글로우를 내는 의도된 조합이라 함께 brand.primary로 교체한다
      // (다른 곳의 shadowColor: "#0F172A"는 중립 그림자 용도라 이 교체 대상이 아니다).
      borderTopColor: brand.primary,
      shadowColor: brand.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 10,
      elevation: 4,
    },
    officialBadge: {
      alignSelf: "flex-start",
      backgroundColor: brand.primary,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginBottom: 8,
    },
    officialBadgeText: { fontSize: 10, fontWeight: "700", color: "#fff" },
    officialTitleRow: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    noBottomMargin: { marginBottom: 0 },
    officialDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginTop: 12,
      marginBottom: 8,
    },
    // [Phase 3] radius 10→12 — 칩/배지/작은 링크 버튼 티어(12px)로 통일.
    retryButton: {
      alignSelf: "flex-start",
      backgroundColor: tints.indigo.bg,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 8,
      minWidth: 72,
      alignItems: "center",
    },
    retryButtonText: { color: brand.primary, fontSize: 12, fontWeight: "700" },
    helperNote: { fontSize: 11, color: colors.textMuted, lineHeight: 16, marginTop: 8 },
    // "연번 공백 패턴" 카드에서 3연번 사실(2연번보다 훨씬 드문, 흥미로운 소재)만 다른 Row들과
    // 구분되게 보여준다(2026-09-27, "좋은 주제는 가독성을 높이는 게 맞다" 피드백). 무채색
    // helperNote 대신, 앱이 이미 "흥미롭거나 드문 패턴"에 쓰는 tints.purple(딥 패턴 상세/결과
    // 화면의 vizTitle·noticeCard와 같은 톤)을 재사용해 색으로도 "특별히 드문 사실"임을 전달한다.
    tripleHighlightBox: {
      backgroundColor: tints.purple.bg,
      borderRadius: 12,
      paddingVertical: 8,
      paddingHorizontal: 10,
      marginTop: 8,
    },
    tripleHighlightText: { fontSize: 12, color: tints.purple.fg, fontWeight: "600", lineHeight: 18 },
    tripleHighlightNumber: { fontWeight: "800" },
    ballRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" },
    plusText: { fontSize: 16, color: colors.textMuted, fontWeight: "700" },
    freqItem: { alignItems: "center", gap: 4 },
    freqCount: { fontSize: 10, color: colors.textMuted },
    // [Phase 5c 보라색 통일, 2026-09-10] destiny.tsx의 진행 스피너와 값을 공유하는 토큰으로 교체.
    freqCountLight: { fontSize: 10, color: accentViolet.light },
    transitionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
      flexWrap: "wrap",
    },
    transitionArrow: { fontSize: 11, color: colors.textMuted, fontWeight: "600" },
    transitionTopList: { flexDirection: "row", flexWrap: "wrap", gap: 10, flexShrink: 1 },
    // 이번 주 리포트 카드는 항상 어두운 브랜드 톤을 유지한다.
    // [Phase 3] radius 16→20 (다른 항목과 동일 근거).
    weeklyCard: {
      backgroundColor: brand.dark,
      borderRadius: 20,
      padding: 16,
      marginBottom: 12,
    },
    weeklyTitle: { fontSize: 14, fontWeight: "700", color: "#fff", marginBottom: 6 },
    weeklyText: { fontSize: 12, color: "#CBD5E1", lineHeight: 18, marginBottom: 10 },
    row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
    rowLabel: { fontSize: 12, color: colors.textMuted, flexShrink: 1, marginRight: 8 },
    rowValue: { fontSize: 12, color: colors.textPrimary, fontWeight: "700", flexShrink: 0 },

    // ===================== 2026-10-02 "로또 연구소" 레이아웃 개편 전용 스타일 =====================
    // 섹션 라벨 ("이번 회차 결과" / "핵심 발견" / "내 번호" / "각 통계")
    sectionLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 22,
      marginBottom: 10,
    },
    sectionLabelText: {
      fontSize: 13,
      fontWeight: "800",
      color: brand.primary,
      letterSpacing: 0.2,
    },
    sectionLabelLine: { flex: 1, height: 1, backgroundColor: colors.border },

    // "핵심 발견" 요약 카드
    insightCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
      overflow: "hidden",
    },
    insightRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 13,
      paddingHorizontal: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    insightIconBadge: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    insightIconBadgeText: { fontSize: 13, fontWeight: "800" },
    insightTextWrap: { flex: 1 },
    insightTextMain: { fontSize: 14, fontWeight: "700", color: colors.textPrimary, lineHeight: 19 },
    insightTextSub: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 17 },
    insightLink: { color: brand.primary, fontWeight: "700" },

    // "이번 회차 값"을 가장 먼저 보여주는 헤럴드 박스(연번(연속번호) 통계 카드 등에서 사용)
    heraldBox: {
      backgroundColor: tints.indigo.bg,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 12,
    },
    heraldLabel: { fontSize: 11, fontWeight: "700", color: tints.indigo.fg, marginBottom: 4, letterSpacing: 0.2 },
    heraldValue: { fontSize: 21, fontWeight: "800", color: colors.textPrimary, lineHeight: 27 },
    heraldValueStrong: { color: tints.indigo.fg },

    // 직접 비교가 가능한 두 값(실제 vs 이론적 기대)을 2열로 보여주는 비교 행
    compareRow: { flexDirection: "row", marginTop: 4 },
    compareCol: { flex: 1, alignItems: "center", paddingVertical: 6, paddingHorizontal: 4 },
    compareColBorder: { borderLeftWidth: 1, borderLeftColor: colors.border },
    compareLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
    compareValue: { fontSize: 23, fontWeight: "800", color: colors.textPrimary },
    compareValueMuted: { color: colors.textSecondary },

    // 카드 하단에 접혀 있다가 탭했을 때만 펼쳐지는 "통계 해석 시 유의사항" / "계산 기준" 토글.
    // 토글 문구 자체는 DisclaimerCard의 기존 안내 문구를 그대로 재사용하고, 노출 여부만 바꾼다.
    noticeToggleRow: { marginTop: 12 },
    noticeToggleText: { fontSize: 12, fontWeight: "700", color: brand.primary },
  });
}
