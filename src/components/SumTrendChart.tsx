import React, { useEffect, useRef, useState } from "react";
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
// 스크롤 인디케이터 막대가 아무리 콘텐츠가 넓어도(회차가 많아져도) 손가락으로 잡기엔
// 너무 얇아지지 않도록 잡아두는 최소 너비.
const MIN_SCROLL_THUMB_WIDTH = 24;

export function SumTrendChart({ points, midpoint }: { points: SumTrendPoint[]; midpoint: number }) {
  const { colors, tints } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const reveal = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  // 스크롤 가능한 영역(뷰포트)의 실제 너비 — onLayout으로 측정해야 정확하다(화면 크기,
  // 카드 안쪽 여백 등에 따라 달라지므로 고정값을 쓸 수 없다).
  const [viewportWidth, setViewportWidth] = useState(0);

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

  // 콘텐츠(chartWidth)가 뷰포트보다 넓을 때만 스크롤 가능한 상태이므로, 그때만 인디케이터를
  // 보여준다(뷰포트 폭을 아직 측정 못 한 첫 프레임엔 viewportWidth가 0이라 숨긴다).
  const canScroll = viewportWidth > 0 && chartWidth > viewportWidth;
  const scrollThumbWidth = canScroll
    ? Math.max(MIN_SCROLL_THUMB_WIDTH, (viewportWidth / chartWidth) * viewportWidth)
    : viewportWidth;
  const maxScrollX = Math.max(1, chartWidth - viewportWidth);
  const maxThumbTranslate = Math.max(0, viewportWidth - scrollThumbWidth);
  const scrollThumbTranslateX = scrollX.interpolate({
    inputRange: [0, maxScrollX],
    outputRange: [0, maxThumbTranslate],
    extrapolate: "clamp",
  });

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

      {/* 회차가 52개라 그래프 전체 폭(chartWidth)이 화면보다 훨씬 넓어서 원래도 가로 스크롤이
          가능했는데, 흰 카드 배경과 구분이 안 되고 스크롤 인디케이터도 꺼둬서(showsHorizontal
          ScrollIndicator=false) "스크롤할 수 있다"는 걸 알아채기 어려웠다는 QA 피드백. 이 패널만
          카드와 다른 배경(colors.surfaceAlt)을 줘서 "여기는 별도의 스크롤 가능 영역"이라는 걸
          시각적으로 구분한다. 네이티브 스크롤 인디케이터(showsHorizontalScrollIndicator)도
          한 번 다시 켜봤지만, iOS/Android 모두 손을 대기 전까진 아예 안 보이거나 터치 중에만
          잠깐 나타나는 방식이라 "가만히 봤을 때 스크롤 가능 여부를 바로 인지"하는 용도로는
          약하다는 후속 피드백(문구로 안내하는 건 원치 않음, 다른 앱에서 흔히 쓰는 방식 요청).
          그래서 차트 밑에 항상 떠 있는(터치 여부와 무관하게 계속 보이는) 커스텀 스크롤 위치
          막대를 따로 추가했다 — 트랙 전체 대비 막대(thumb) 길이로 "전체 중 지금 보이는 비율"을,
          막대 위치로 "지금 어디를 보고 있는지"를 아이콘/문구 없이도 바로 알 수 있다(주식·헬스
          앱 등에서 가장 흔히 쓰이는 형태). 네이티브 인디케이터와 중복되지 않도록 끈다. */}
      <View style={styles.chartPanel}>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          onLayout={(e) => setViewportWidth(e.nativeEvent.layout.width)}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
            useNativeDriver: false,
          })}
          scrollEventThrottle={16}
          // 기본으로는 가장 오래된 회차(왼쪽)부터 보여서, 정작 가장 궁금해할 최신 회차는
          // 매번 오른쪽으로 스크롤해야 보였다는 QA 피드백 — 그래프 폭이 확정되는 시점
          // (onContentSizeChange, points가 바뀌어 폭이 달라질 때도 다시 호출됨)마다 끝까지
          // 스크롤해서 최신 회차가 기본으로 보이게 한다.
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
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
      </View>

      {canScroll ? (
        <View style={styles.scrollIndicatorTrack}>
          <Animated.View
            style={[
              styles.scrollIndicatorThumb,
              { width: scrollThumbWidth, transform: [{ translateX: scrollThumbTranslateX }] },
            ]}
          />
        </View>
      ) : null}

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
    // 흰 카드 배경(colors.surface)과 구분되도록 이 스크롤 영역만 한 단계 다른 배경을 준다 —
    // "여기는 (카드 전체가 아니라) 이 안쪽만 좌우로 스크롤된다"는 걸 시각적으로 알려준다.
    chartPanel: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 12,
      paddingVertical: 8,
      paddingHorizontal: 6,
    },
    scrollContent: { paddingRight: 4 },
    // 항상 떠 있는 커스텀 스크롤 위치 막대 — 트랙(전체 폭)과 막대(현재 보이는 비율) 두 겹.
    scrollIndicatorTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginTop: 8,
      overflow: "hidden",
    },
    scrollIndicatorThumb: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.textSecondary,
    },
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
