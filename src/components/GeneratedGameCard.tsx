import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { GeneratedGame } from "../lib/lottery/types";
import { SCORE_EXPLANATION_NOTICE } from "../constants/messages";
import { LottoBall } from "./LottoBall";
import { useAppTheme, type AppColors, type AppTints } from "../theme";

export function GeneratedGameCard({
  game,
  explanation,
  footer,
}: {
  game: GeneratedGame;
  explanation?: string;
  footer?: React.ReactNode;
}) {
  const { colors, tints } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors, tints), [colors, tints]);
  return (
    <View style={styles.card}>
      <View style={styles.ballRow}>
        {game.numbers.map((n) => (
          <LottoBall key={n} number={n} />
        ))}
      </View>

      {game.score ? (
        <View style={styles.scoreBlock}>
          <Text style={styles.score}>추천 적합도 {Math.round(game.score.totalScore)}점</Text>
          <View style={styles.scoreTrack}>
            <View
              style={[
                styles.scoreFill,
                { width: `${Math.max(0, Math.min(100, Math.round(game.score.totalScore)))}%` },
              ]}
            />
          </View>
          <Text style={styles.scoreCaption}>{SCORE_EXPLANATION_NOTICE}</Text>
        </View>
      ) : null}

      <View style={styles.metaRow}>
        <MetaChip styles={styles} label={`홀짝 ${game.metadata.oddCount}:${6 - game.metadata.oddCount}`} />
        <MetaChip styles={styles} label={`합계 ${game.metadata.sum}`} />
        <MetaChip
          styles={styles}
          label={game.metadata.maxConsecutiveLength >= 2 ? "연속번호 있음" : "연속번호 없음"}
        />
      </View>

      {explanation ? <Text style={styles.explanation}>{explanation}</Text> : null}
      {footer}
    </View>
  );
}

function MetaChip({ label, styles }: { label: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

function createStyles(colors: AppColors, tints: AppTints) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
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
    scoreBlock: { marginBottom: 8 },
    score: { fontSize: 13, color: "#2563EB", fontWeight: "700", marginBottom: 4 },
    scoreTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.border,
      overflow: "hidden",
    },
    scoreFill: {
      height: 6,
      borderRadius: 3,
      backgroundColor: "#2563EB",
    },
    scoreCaption: { fontSize: 10, color: colors.textMuted, lineHeight: 14, marginTop: 4 },
    metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: {
      backgroundColor: tints.indigo.bg,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    chipText: { fontSize: 11, color: tints.indigo.fg },
    explanation: { marginTop: 10, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  });
}
