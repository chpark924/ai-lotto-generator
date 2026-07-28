import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { GeneratedGame } from "../lib/lottery/types";
import { LottoBall } from "./LottoBall";

export function GeneratedGameCard({
  game,
  explanation,
  footer,
}: {
  game: GeneratedGame;
  explanation?: string;
  footer?: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.ballRow}>
        {game.numbers.map((n) => (
          <LottoBall key={n} number={n} />
        ))}
      </View>

      {game.score ? (
        <Text style={styles.score}>추천 적합도 {Math.round(game.score.totalScore)}점</Text>
      ) : null}

      <View style={styles.metaRow}>
        <MetaChip label={`홀짝 ${game.metadata.oddCount}:${6 - game.metadata.oddCount}`} />
        <MetaChip label={`합계 ${game.metadata.sum}`} />
        <MetaChip
          label={game.metadata.maxConsecutiveLength >= 2 ? "연속번호 있음" : "연속번호 없음"}
        />
      </View>

      {explanation ? <Text style={styles.explanation}>{explanation}</Text> : null}
      {footer}
    </View>
  );
}

function MetaChip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  ballRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  score: { fontSize: 13, color: "#2563EB", fontWeight: "700", marginBottom: 8 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  chipText: { fontSize: 11, color: "#4338CA" },
  explanation: { marginTop: 10, fontSize: 12, color: "#475569", lineHeight: 18 },
});
