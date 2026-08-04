import React, { useEffect, useRef } from "react";
import { Animated, DimensionValue, StyleSheet } from "react-native";
import { useAppTheme } from "../theme";

/**
 * 데이터 로딩 중에 콘텐츠의 대략적인 모양(카드/텍스트 줄/동그란 번호 등)을 미리
 * 보여주는 자리표시자.
 *
 * 왜 필요한가: 이 앱의 홈/로또 연구소 화면은 dhlottery.co.kr 네트워크 조회가 끝나야
 * 실제 콘텐츠(당첨번호, 통계 카드 등)를 보여줄 수 있다. 그 사이를 빈 화면이나 화면
 * 중앙의 스피너로 채우면, 로딩이 끝나는 순간 레이아웃이 갑자기 "튀어" 보이거나(빈
 * 화면 → 카드 등장), 화면이 멈춘 것 같은 인상을 준다. 완성됐을 때의 레이아웃을 흐릿한
 * 회색 블록으로 먼저 보여주면 그 두 문제를 모두 줄일 수 있다.
 */
export function SkeletonBlock({
  width = "100%",
  height = 16,
  borderRadius = 8,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: object;
}) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  const { colors } = useAppTheme();

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[styles.base, { width, height, borderRadius, backgroundColor: colors.skeleton, opacity }, style]}
    />
  );
}

/** LottoBall 자리에 들어가는 동그란 스켈레톤 (번호 원과 같은 크기 규칙 사용). */
export function SkeletonBall({ size = 32 }: { size?: number }) {
  return <SkeletonBlock width={size} height={size} borderRadius={size / 2} />;
}

const styles = StyleSheet.create({
  base: {},
});
