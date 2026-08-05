import React, { useEffect, useRef } from "react";
import { Animated, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line as SvgLine, Path } from "react-native-svg";
import type { SumTrendPoint } from "../lib/draws";
import { useAppTheme, type AppColors } from "../theme";

/**
 * 회차별 당첨번호 합계가 중간값(138) 대비 높았는지/낮았는지를 선그래프로 보여준다.
 *
 * 형태: 주식·건강 앱 등에서 흔히 쓰는 "선 + 기준선" 트렌드 그래프 형태를 따른다(사용자 요청 —
 * "가장 일반적으로 타 앱에서 보여주는 형태"). 가운데 점선이 중간값(138)이고, 각 회차의 점은
 * 138 이상이면 빨강, 미만이면 파랑으로 찍힌다. 화면에 처음 나타날 때 왼쪽(과거)에서
 * 오른쪽(최신)으로 그래프가 그려지는 것처럼 보이는 리빌(reveal) 애니메이션을 적용했다.
 *
 * `react-native-svg`(Expo SDK 54 번들 버전 15.12.1, `expo/bundledNativeModules.json` 기준)를
 * 새로 추가해서 그렸다 — 순수 View만으로는 매끄러운 선을 그리기 어렵고(회전시킨 얇은 사각형을
 * 이어붙이는 식이라 각도에 따라 픽셀이 지저분해짐), 이 라이브러리는 Expo Go에도 기본 포함돼 있어
 * 별도 네이티브 빌드 없이 바로 미리보기가 가능하다.
 */

const CHART_HEIGHT = 140;
const CHART_PADDING_Y = 18;
const POINT_GAP = 14;
const REVEAL_DURATION_MS = 900;

export function SumTrendChart({ points, midpoint }: { points: SumTrendPoint[]; midpoint: number }) {
  const { colors, tints } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const reveal = useRef(new Animated.Value(0)).current;

  const pointsKey = points.map((p) => p.drawNumber).join(",");
  useEffect(() => {
    reveal.setValue(0);
    const animation = Animated.timing(reveal, {
      toValue: 1,
      duration: REVEAL_DURATION_MS,
      useNativeDriver: false, // width 애니메이션은 native driver를 쓸 수 없다(레이아웃 속성).
    });
    animation.start();
    // 화면 전환 등으로 애니메이션이 끝나기 전에 컴포넌트가 사라지면 진행 중이던 타이머를 멈춘다
    // (안 그러면 언마운트된 컴포넌트를 향해 계속 업데이트를 시도해 경고가 뜨거나, 테스트 환경에서
    // "act(...) 밖에서 상태 업데이트" 경고의 원인이 된다).
    return () => animation.stop();
  }, [pointsKey, reveal]);

  if (points.length === 0) return null;

  const chartWidth = Math.max((points.length - 1) * POINT_GAP + 20, 160);
  const sums = points.map((p) => p.sum);
  const minSum = Math.min(midpoint, ...sums);
  const maxSum = Math.max(midpoint, ...sums);
  const range = Math.max(1, maxSum - minSum);
  const usableHeight = CHART_HEIGHT - CHART_PADDING_Y * 2;

  const yFor = (sum: number) => CHART_PADDING_Y + usableHeight - ((sum - minSum) / range) * usableHeight;
  const xFor = (index: number) => 10 + index * POINT_GAP;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(p.sum)}`).join(" ");
  const midY = yFor(midpoint);
  const highCount = points.filter((p) => p.isHigh).length;
  const lowCount = points.length - highCount;

  const revealWidth = reveal.interpolate({ inputRange: [0, 1], outputRange: [0, chartWidth] });

  return (
    <View>
      <View style={styles.legendRow}>
        <LegendDot color={tints.red.fg} labelColor={colors.textMuted} label={`${midpoint} 이상 (${highCount}회)`} />
        <LegendDot
          color={tints.indigo.fg}
          labelColor={colors.textMuted}
          label={`${midpoint} 미만 (${lowCount}회)`}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={{ width: chartWidth, height: CHART_HEIGHT }}>
          <Animated.View style={[styles.revealMask, { width: revealWidth, height: CHART_HEIGHT }]}>
            <Svg width={chartWidth} height={CHART_HEIGHT}>
              <SvgLine
                x1={0}
                y1={midY}
                x2={chartWidth}
                y2={midY}
                stroke={colors.border}
                strokeWidth={1}
                strokeDasharray="4,4"
              />
              <Path
                d={linePath}
                stroke={tints.indigo.fg}
                strokeWidth={2}
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {points.map((p, i) => (
                <Circle
                  key={p.drawNumber}
                  cx={xFor(i)}
                  cy={yFor(p.sum)}
                  r={i === points.length - 1 ? 4 : 2.5}
                  fill={p.isHigh ? tints.red.fg : tints.indigo.fg}
                />
              ))}
            </Svg>
          </Animated.View>
          <Text style={[styles.midLineLabel, { top: midY - 14 }]}>{midpoint}</Text>
        </View>
      </ScrollView>

      <View style={styles.axisRow}>
        <Text style={styles.axisText}>{points[0].drawNumber}회</Text>
        <Text style={styles.axisText}>{points[points.length - 1].drawNumber}회 (최신)</Text>
      </View>
    </View>
  );
}

function LegendDot({ color, labelColor, label }: { color: string; labelColor: string; label: string }) {
  return (
    <View style={legendStyles.row}>
      <View style={[legendStyles.dot, { backgroundColor: color }]} />
      <Text style={[legendStyles.label, { color: labelColor }]}>{label}</Text>
    </View>
  );
}

const legendStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 11 },
});

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    legendRow: { flexDirection: "row", gap: 16, marginBottom: 10 },
    scrollContent: { paddingRight: 4 },
    revealMask: {
      overflow: "hidden",
      position: "absolute",
      left: 0,
      top: 0,
    },
    midLineLabel: {
      position: "absolute",
      left: 2,
      fontSize: 9,
      color: colors.textMuted,
    },
    axisRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 6,
    },
    axisText: { fontSize: 10, color: colors.textMuted },
  });
}
