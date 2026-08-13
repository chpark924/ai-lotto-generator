import React, { useCallback, useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { useAppTheme, type AppColors } from "../../theme";

const TRACK_HEIGHT = 4;
const THUMB_SIZE = 15;
const TRACK_OUTER_HEIGHT = 24;
// 트랙이 화면 양 끝까지 꽉 차면 부담스러워 보인다는 피드백 — 좌우로 여백을 더 둬서
// 콘텐츠 폭보다 살짝 좁게(가운데로 모이는 느낌) 배치한다.
const TRACK_HORIZONTAL_INSET = 22;

/**
 * "덜 관측된 패턴 ↔ 다빈도 패턴" 혼합 비율을 고르는 가로 드래그 슬라이더(음량 조절 바와 같은
 * 손맛). QA 요청대로 숫자(%)는 화면에 보여주지 않는다 — 내부적으로만 0~100 값을 들고 있다가,
 * 실제 계산(recommendDeepPatterns)에 넘길 때 engine.ts의 FREQUENT_PATTERN_RATIO_STEPS 중
 * 가장 가까운 값으로 스냅한다. 별도 슬라이더 라이브러리를 추가하면 네이티브 재빌드(EAS)가
 * 필요해지므로, RN 코어의 PanResponder만으로 구현했다.
 */
export function PatternMixSlider({
  value,
  onChange,
}: {
  /** 0~100. 화면에는 숫자를 표시하지 않고 채움 길이로만 나타낸다. */
  value: number;
  onChange: (value: number) => void;
}) {
  const { colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const trackRef = useRef<View>(null);
  const trackLayout = useRef({ pageX: 0, width: 0 });
  const [trackWidth, setTrackWidth] = useState(0);

  const updateFromPageX = useCallback(
    (pageX: number) => {
      const { pageX: trackX, width } = trackLayout.current;
      if (width <= 0) return;
      const ratio = Math.min(1, Math.max(0, (pageX - trackX) / width));
      onChange(Math.round(ratio * 100));
    },
    [onChange]
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => updateFromPageX(evt.nativeEvent.pageX),
      onPanResponderMove: (evt) => updateFromPageX(evt.nativeEvent.pageX),
    })
  ).current;

  function handleLayout(_e: LayoutChangeEvent) {
    // onLayout 직후에 measure()를 호출하면 화면 좌표(pageX) 기준 위치를 안정적으로 얻을 수
    // 있다 — 터치 이벤트(pageX)와 같은 좌표계라 별도 변환이 필요 없다.
    trackRef.current?.measure((_x, _y, width, _height, pageX) => {
      trackLayout.current = { pageX, width };
      setTrackWidth(width);
    });
  }

  const clampedValue = Math.min(100, Math.max(0, value));
  const thumbLeft =
    trackWidth > 0 ? Math.min(trackWidth - THUMB_SIZE, Math.max(0, (clampedValue / 100) * trackWidth - THUMB_SIZE / 2)) : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>덜 관측된 패턴</Text>
        <Text style={styles.label}>다빈도 패턴</Text>
      </View>
      <View
        ref={trackRef}
        style={styles.trackOuter}
        onLayout={handleLayout}
        hitSlop={{ top: 16, bottom: 16 }}
        {...panResponder.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel="패턴 혼합 비율"
        accessibilityHint="왼쪽은 덜 관측된 패턴, 오른쪽은 다빈도 패턴 위주로 섞입니다"
        accessibilityValue={{ min: 0, max: 100, now: clampedValue }}
      >
        <View style={styles.trackBg}>
          <View style={[styles.trackFill, { width: `${clampedValue}%` }]} />
        </View>
        <View style={[styles.thumb, { left: thumbLeft }]} />
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    wrap: { marginTop: 4, marginBottom: 8, marginHorizontal: TRACK_HORIZONTAL_INSET },
    labelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 7,
    },
    label: { fontSize: 10.5, color: colors.textMuted, fontWeight: "500" },
    trackOuter: {
      height: TRACK_OUTER_HEIGHT,
      justifyContent: "center",
    },
    trackBg: {
      height: TRACK_HEIGHT,
      borderRadius: TRACK_HEIGHT / 2,
      backgroundColor: colors.border,
      overflow: "hidden",
    },
    trackFill: {
      height: "100%",
      borderRadius: TRACK_HEIGHT / 2,
      backgroundColor: "#6C5CE7",
    },
    thumb: {
      position: "absolute",
      top: (TRACK_OUTER_HEIGHT - THUMB_SIZE) / 2,
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: THUMB_SIZE / 2,
      backgroundColor: "#fff",
      borderWidth: 1.5,
      borderColor: "#6C5CE7",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.12,
      shadowRadius: 1.5,
      elevation: 1,
    },
  });
}
