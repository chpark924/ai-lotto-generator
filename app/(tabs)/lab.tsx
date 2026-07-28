import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  getRecentDraws,
  computeNumberFrequencies,
  computeCombinationPatternStats,
  getLongestAbsentNumbers,
  type WinningDraw,
  type NumberFrequency,
} from "../../src/lib/draws";
import { getGenerationHistory, getTickets } from "../../src/lib/storage";
import { getOddCount, getSectionCounts } from "../../src/lib/lottery/pattern";
import { overlapCount } from "../../src/lib/lottery/similarity";
import { LottoBall, DisclaimerCard } from "../../src/components";
import { POPULARITY_HEURISTIC_NOTICE } from "../../src/constants/messages";

export default function LabScreen() {
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    (async () => {
      const recentDraws = await getRecentDraws(50);
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

      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>과거 당첨번호를 불러오는 중...</Text>
      </View>
    );
  }

  const latestDraw = draws[0];
  const patternStats = computeCombinationPatternStats(draws);
  const topFrequent = [...frequencies].sort((a, b) => b.totalCount - a.totalCount).slice(0, 6);
  const longestAbsent = latestDraw
    ? getLongestAbsentNumbers(frequencies, latestDraw.drawNumber, 6)
    : [];

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
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>최근 {draws.length}회 - 번호별 출현 빈도 Top 6</Text>
        <View style={styles.ballRow}>
          {topFrequent.map((f) => (
            <View key={f.number} style={styles.freqItem}>
              <LottoBall number={f.number} size={32} />
              <Text style={styles.freqCount}>{f.totalCount}회</Text>
            </View>
          ))}
        </View>
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
        <Text style={styles.cardTitle}>조합 패턴 통계 (최근 {draws.length}회 평균)</Text>
        <Row label="평균 홀수 개수" value={patternStats.averageOddCount.toFixed(2)} />
        <Row label="평균 저번호(1~22) 개수" value={patternStats.averageLowCount.toFixed(2)} />
        <Row label="평균 번호 합계" value={patternStats.averageSum.toFixed(1)} />
        <Row
          label="연속번호 포함 비율"
          value={`${Math.round(patternStats.consecutiveRatio * 100)}%`}
        />
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
          <Row label="평균 홀수 개수" value={myAnalysis.averageOddCount.toFixed(2)} />
          <Row label="내 조합끼리 평균 겹침" value={`${myAnalysis.averageOverlap.toFixed(2)}개`} />
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardSub}>
            아직 생성한 번호가 없습니다. 번호를 만들면 내 선택 성향을 분석해드립니다.
          </Text>
        </View>
      )}

      <DisclaimerCard text={POPULARITY_HEURISTIC_NOTICE} />
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { fontSize: 22, fontWeight: "800", color: "#0F172A", marginBottom: 16 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, color: "#64748B", fontSize: 13 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A", marginBottom: 8 },
  cardSub: { fontSize: 12, color: "#64748B", marginBottom: 8 },
  ballRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" },
  plusText: { fontSize: 16, color: "#94A3B8", fontWeight: "700" },
  freqItem: { alignItems: "center", gap: 4 },
  freqCount: { fontSize: 10, color: "#64748B" },
  freqCountLight: { fontSize: 10, color: "#C4B5FD" },
  weeklyCard: {
    backgroundColor: "#0F172A",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  weeklyTitle: { fontSize: 14, fontWeight: "700", color: "#fff", marginBottom: 6 },
  weeklyText: { fontSize: 12, color: "#CBD5E1", lineHeight: 18, marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  rowLabel: { fontSize: 12, color: "#64748B" },
  rowValue: { fontSize: 12, color: "#0F172A", fontWeight: "700" },
});
