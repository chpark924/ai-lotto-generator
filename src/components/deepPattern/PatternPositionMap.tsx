import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Rect } from "react-native-svg";
import type { DeepPatternLevel, DeepPatternRecommendation } from "../../lib/deepPattern/types";
import { useAppTheme, type AppColors } from "../../theme";

const CHART_WIDTH = 240;
const CHART_HEIGHT = 140;
const PADDING = 22;

const LEVEL_SCORE: Record<DeepPatternLevel, number> = { LOW: 0, MID: 50, HIGH: 100 };

/**
 * 구조적 공백/공백 지속성/시간 안정성(전부 상세 화면 위쪽 카드에서 이미 LOW/MID/HIGH로
 * 보여주는 값) 3개를 0~100 점수 하나로 합쳐서 Pattern Map의 가로축(공백 강도)에 쓴다.
 * 새로운 내부 개념을 추가하는 게 아니라, 이미 사용자에게 노출한 세 값을 좌표 하나로 다시
 * 표현하는 것뿐이다 — DeepPatternRecommendation 타입에 새 필드를 얹지 않는다.
 */
export function structuralIntensityScore(
  rec: Pick<DeepPatternRecommendation, "structuralVoidLevel" | "scalePersistenceLevel" | "temporalPersistenceLevel">
): number {
  return Math.round(
    (LEVEL_SCORE[rec.structuralVoidLevel] + LEVEL_SCORE[rec.scalePersistenceLevel] + LEVEL_SCORE[rec.temporalPersistenceLevel]) / 3
  );
}

/**
 * 딥 패턴 상세 화면의 "Pattern Map". 예전엔 고정된 장식용 원 몇 개(라벨도 "예시")를 보여줘서
 * 이 패턴이 실제로 어디쯤 있는지는 전혀 알 수 없었다 — QA 피드백대로, 이 추천이 실제로 가진
 * 두 지표(가로: 구조적 공백 강도, 세로: 통계적 유의성 validationPercentile)를 좌표로 써서
 * 점 하나의 위치가 패턴마다 실제 값에 따라 달라지게 한다. 정확한 기하학적 좌표(Atlas의
 * rowZone/colZone 등 basin 내부 개념)는 타입 설계 원칙상 화면에 노출하지 않으므로 "근사치"다.
 */
export function PatternPositionMap({ recommendation }: { recommendation: DeepPatternRecommendation }) {
  const { colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const xScore = structuralIntensityScore(recommendation);
  const yScore = Math.max(0, Math.min(100, recommendation.validationPercentile));
  const usableW = CHART_WIDTH - PADDING * 2;
  const usableH = CHART_HEIGHT - PADDING * 2;
  const dotX = PADDING + (xScore / 100) * usableW;
  const dotY = CHART_HEIGHT - PADDING - (yScore / 100) * usableH;

  return (
    <View>
      <Svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} width="100%" height={110}>
        <Rect x={0} y={0} width={CHART_WIDTH} height={CHART_HEIGHT} rx={10} fill={colors.surfaceAlt} />
        <Line
          x1={PADDING}
          y1={CHART_HEIGHT / 2}
          x2={CHART_WIDTH - PADDING}
          y2={CHART_HEIGHT / 2}
          stroke={colors.border}
          strokeWidth={1}
          strokeDasharray="3,3"
        />
        <Line
          x1={CHART_WIDTH / 2}
          y1={PADDING}
          x2={CHART_WIDTH / 2}
          y2={CHART_HEIGHT - PADDING}
          stroke={colors.border}
          strokeWidth={1}
          strokeDasharray="3,3"
        />
        <Circle cx={dotX} cy={dotY} r={11} fill="#6C5CE7" opacity={0.18} />
        <Circle cx={dotX} cy={dotY} r={4.5} fill="#DC2626" />
      </Svg>
      <View style={styles.legendCol}>
        <Text style={styles.legendText}>→ 오른쪽일수록 구조적 공백이 강한 패턴</Text>
        <Text style={styles.legendText}>↑ 위쪽일수록 통계적으로 뚜렷한 패턴</Text>
        <Text style={styles.legendDot}>● 이 패턴의 실제 위치</Text>
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    legendCol: { marginTop: 8, alignItems: "center", gap: 2 },
    legendText: { fontSize: 10, color: colors.textMuted },
    legendDot: { fontSize: 10, color: "#DC2626", fontWeight: "700", marginTop: 2 },
  });
}
