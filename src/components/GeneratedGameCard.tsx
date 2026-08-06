import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { GeneratedGame } from "../lib/lottery/types";
import type { ResultBadge } from "../lib/lottery/resultBadges";
import { buildGameAccessibilitySummary } from "../lib/lottery/accessibilitySummary";
import { SCORE_EXPLANATION_NOTICE } from "../constants/messages";
import { LottoBall } from "./LottoBall";
import { useAppTheme, type AppColors, type AppTints } from "../theme";

export function GeneratedGameCard({
  game,
  explanation,
  badges,
  footer,
}: {
  game: GeneratedGame;
  explanation?: string;
  /**
   * 몬테카를로 탐색/EV 최적화/휠링 방식 분산/사카이 분석 패턴처럼, 이 조합이 실제로 만들어진
   * 방식·통계적 속성을 짧게 알려주는 배지(resultBadges.ts). 조건에 안 맞으면 빈 배열이거나
   * undefined일 수 있고, 그런 경우 아무것도 렌더링하지 않는다.
   */
  badges?: ResultBadge[];
  footer?: React.ReactNode;
}) {
  const { colors, tints } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors, tints), [colors, tints]);
  // 로또공 6개(각각 개별 접근성 라벨 보유) + 점수 + 메타 칩 3개 + 배지 최대 4개 + 설명 문단이
  // 전부 따로 초점을 잡으면 스크린리더로 카드 하나를 이해하는 데 스와이프를 15번 넘게 해야
  // 한다. 아래에서 이 "읽기 전용 정보" 구간만 하나의 접근성 그룹으로 묶어 한 번에 요약해
  // 읽어주고, 실제 액션인 footer 버튼들(저장/구매예정/공유)은 지금처럼 개별로 남겨둔다.
  const accessibilitySummary = buildGameAccessibilitySummary(game, badges, explanation);
  return (
    <View style={styles.card}>
      <View accessible accessibilityLabel={accessibilitySummary}>
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

        {badges && badges.length > 0 ? (
          <View style={styles.badgeRow}>
            {badges.map((badge) => (
              <View key={badge.key} style={styles.badgeChip}>
                <Text style={styles.badgeChipText}>{badge.label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {explanation ? <Text style={styles.explanation}>{explanation}</Text> : null}
      </View>
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
    // 기본 메타 정보(홀짝/합계 등)와 구분되도록 초록색 톤을 써서 "전문 분석 배지"임을
    // 은근히 표시한다(별도 헤더 텍스트 없이 색으로만 구분 — UI를 번잡하게 만들지 않기 위함).
    // 보라색(tints.purple)은 이미 result.tsx의 "운명의 신" 시나리오 안내 배너(noticeCard)가
    // 쓰고 있어서 피했다 — 사카이 분석 패턴 배지는 모드 무관하게 뜰 수 있어, 운명의 신
    // 결과 화면에서 상단 안내 배너와 카드 안 배지가 같은 색으로 겹쳐 보일 수 있기 때문.
    badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
    badgeChip: {
      backgroundColor: tints.green.bg,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    badgeChipText: { fontSize: 11, color: tints.green.fg, fontWeight: "600" },
    explanation: { marginTop: 10, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  });
}
