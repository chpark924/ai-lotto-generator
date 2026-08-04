import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ProbabilitySummary, SimulationSummary } from "../lib/lottery/types";
import { COVERAGE_NOTICE } from "../constants/messages";

export function ProbabilityCard({
  probability,
  simulation,
}: {
  probability: ProbabilitySummary;
  simulation?: SimulationSummary;
}) {
  return (
    <View style={styles.card}>
      {simulation ? (
        <>
          <Row label="총 생성 횟수" value={`${simulation.completedIterations.toLocaleString("ko-KR")}회`} />
          <Row label="고유 후보 조합" value={`${simulation.uniqueCandidateCount.toLocaleString("ko-KR")}개`} />
          <Row
            label="전체 조합 탐색 범위"
            value={`약 ${simulation.coveragePercent.toFixed(4)}%`}
          />
          <View style={styles.divider} />
        </>
      ) : null}
      <Row label="최종 저장 조합" value={`${probability.uniqueGameCount}게임`} />
      <Row label="1등 당첨 확률" value={probability.firstPrizeFraction} />
      <Row label="확률(%)" value={`약 ${probability.firstPrizePercent.toFixed(8)}%`} />
      {simulation ? <Text style={styles.notice}>{COVERAGE_NOTICE}</Text> : null}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0F172A",
    borderRadius: 14,
    padding: 16,
    marginVertical: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  label: { color: "#94A3B8", fontSize: 13 },
  value: { color: "#F8FAFC", fontSize: 13, fontWeight: "600" },
  divider: { height: 1, backgroundColor: "#1E293B", marginVertical: 8 },
  // 이 텍스트는 어두운 카드(#0F172A) 위에 놓이므로, 밝은 배경용 회색(#64748B)을 쓰면
  // 대비가 오히려 부족해진다(약 3.8:1). 어두운 배경에서는 #94A3B8이 AA 기준(4.5:1)을 만족한다.
  notice: { color: "#94A3B8", fontSize: 11, marginTop: 8, lineHeight: 16 },
});
