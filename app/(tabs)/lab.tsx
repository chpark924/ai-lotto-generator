import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  getRecentDrawsSafe,
  computeNumberFrequencies,
  computeCombinationPatternStats,
  computeSumTrend,
  getLongestAbsentNumbers,
  SUM_MIDPOINT,
  type WinningDraw,
  type NumberFrequency,
} from "../../src/lib/draws";
import { getGenerationHistory, getTickets } from "../../src/lib/storage";
import { getOddCount } from "../../src/lib/lottery/pattern";
import { overlapCount } from "../../src/lib/lottery/similarity";
import { LottoBall, DisclaimerCard, SkeletonBlock, SkeletonBall, SumTrendChart } from "../../src/components";
import { POPULARITY_HEURISTIC_NOTICE, SUM_TREND_NOTICE } from "../../src/constants/messages";
import { useAppTheme, type AppColors, type AppTints } from "../../src/theme";

/** 번호별 출현 빈도·패턴 통계의 기준 표본 크기 (최근 52주 = 1년치 회차). */
const RECENT_DRAW_SAMPLE_SIZE = 52;

export default function LabScreen() {
  const { colors, tints } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors, tints), [colors, tints]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [draws, setDraws] = useState<WinningDraw[]>([]);
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

  const loadLabData = useCallback(async () => {
    const recentDraws = await getRecentDrawsSafe(RECENT_DRAW_SAMPLE_SIZE);
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
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
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
    );
  }

  const latestDraw = draws[0];
  const patternStats = computeCombinationPatternStats(draws);
  const topFrequent = [...frequencies].sort((a, b) => b.totalCount - a.totalCount).slice(0, 6);
  const longestAbsent = latestDraw
    ? getLongestAbsentNumbers(frequencies, latestDraw.drawNumber, 6)
    : [];
  const sumTrend = computeSumTrend(draws);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.header}>로또 연구소</Text>

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
      ) : null}

      {latestDraw ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>제 {latestDraw.drawNumber}회 당첨결과</Text>
          <Text style={styles.cardSub}>{latestDraw.drawDate}</Text>
          <View style={styles.ballRow}>
            {latestDraw.numbers.map((n) => (
              <LottoBall key={n} number={n} size={32} />
            ))}
            <Text style={styles.plusText}>+</Text>
            <LottoBall number={latestDraw.bonusNumber} size={32} />
          </View>
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
              <ActivityIndicator size="small" color="#2563EB" />
            ) : (
              <Text style={styles.retryButtonText}>다시 시도</Text>
            )}
          </Pressable>
        </View>
      )}

      <View style={styles.card}>
        {draws.length > 0 ? (
          <>
            <Text style={styles.cardTitle}>최근 {draws.length}회 - 번호별 출현 빈도 Top 6</Text>
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
          <>
            <Text style={styles.cardTitle}>번호별 출현 빈도 Top 6</Text>
            <Text style={styles.cardSub}>
              당첨번호 데이터를 불러오지 못해 통계를 계산할 수 없어요. 위 "다시 시도"를 눌러주세요.
            </Text>
          </>
        )}
      </View>

      {longestAbsent.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>장기 미출현 번호</Text>
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

      <View style={styles.card}>
        {sumTrend.length > 0 ? (
          <>
            <Text style={styles.cardTitle}>당첨번호 합계 추세 (최근 {sumTrend.length}회)</Text>
            <Text style={styles.cardSub}>
              6개 당첨번호를 더한 값이 이론적 중간값({SUM_MIDPOINT}) 대비 높았는지(빨강) 낮았는지(파랑)를
              회차 순서대로 보여줍니다.
            </Text>
            <SumTrendChart points={sumTrend} midpoint={SUM_MIDPOINT} />
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
      {sumTrend.length > 0 ? <DisclaimerCard text={SUM_TREND_NOTICE} /> : null}

      <DisclaimerCard text={POPULARITY_HEURISTIC_NOTICE} />
    </ScrollView>
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

function createStyles(colors: AppColors, tints: AppTints) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { fontSize: 22, fontWeight: "800", color: colors.textPrimary, marginBottom: 16 },
    skeletonMb8: { marginBottom: 8 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary, marginBottom: 8 },
    cardSub: { fontSize: 12, color: colors.textMuted, marginBottom: 8 },
    retryButton: {
      alignSelf: "flex-start",
      backgroundColor: tints.indigo.bg,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
      minWidth: 72,
      alignItems: "center",
    },
    retryButtonText: { color: "#2563EB", fontSize: 12, fontWeight: "700" },
    helperNote: { fontSize: 11, color: colors.textMuted, lineHeight: 16, marginTop: 8 },
    ballRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" },
    plusText: { fontSize: 16, color: colors.textMuted, fontWeight: "700" },
    freqItem: { alignItems: "center", gap: 4 },
    freqCount: { fontSize: 10, color: colors.textMuted },
    freqCountLight: { fontSize: 10, color: "#C4B5FD" },
    // 이번 주 리포트 카드는 항상 어두운 브랜드 톤을 유지한다.
    weeklyCard: {
      backgroundColor: "#0F172A",
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
    },
    weeklyTitle: { fontSize: 14, fontWeight: "700", color: "#fff", marginBottom: 6 },
    weeklyText: { fontSize: 12, color: "#CBD5E1", lineHeight: 18, marginBottom: 10 },
    row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
    rowLabel: { fontSize: 12, color: colors.textMuted, flexShrink: 1, marginRight: 8 },
    rowValue: { fontSize: 12, color: colors.textPrimary, fontWeight: "700", flexShrink: 0 },
  });
}
