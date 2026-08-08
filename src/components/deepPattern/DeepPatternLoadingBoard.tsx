import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// 장식용 5점 경로(실제 추천 결과와 무관 — 로딩 중에는 아직 결과가 없다). 목업에서 승인된
// "점을 순서대로 이으며 선이 그려지는" 연출을 그대로 재현한다.
const DECORATIVE_PATH = "M45 15 L75 75 L105 45 L135 105 L45 135";
const DECORATIVE_POINTS = [
  { x: 45, y: 15 },
  { x: 75, y: 75 },
  { x: 105, y: 45 },
  { x: 135, y: 105 },
  { x: 45, y: 135 },
];
// 실측 대신 넉넉히 잡은 상한 — 세그먼트 5개 합 실측(~271px)보다 크게 둬서 시작 시 완전히
// 숨겨지도록 한다.
const PATH_DASH_LENGTH = 300;
const CYCLE_MS = 1800;

export function DeepPatternLoadingBoard() {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: CYCLE_MS,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false, // strokeDashoffset은 native driver 미지원
      })
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 0.65, 1],
    outputRange: [PATH_DASH_LENGTH, 0, 0],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.wrap}>
      <Svg width={150} height={150} viewBox="0 0 150 150">
        <AnimatedPath
          d={DECORATIVE_PATH}
          fill="none"
          stroke="#6C5CE7"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${PATH_DASH_LENGTH}`}
          strokeDashoffset={strokeDashoffset}
        />
        {DECORATIVE_POINTS.map((pt, i) => {
          const appearAt = i / DECORATIVE_POINTS.length;
          const opacity = progress.interpolate({
            inputRange: [Math.max(0, appearAt - 0.04), appearAt, 1],
            outputRange: [0, 1, 1],
            extrapolate: "clamp",
          });
          return <AnimatedCircle key={i} cx={pt.x} cy={pt.y} r={4.5} fill="#6C5CE7" opacity={opacity} />;
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", marginBottom: 8 },
});
