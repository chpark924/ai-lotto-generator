import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { LottoBall } from "./LottoBall";

/**
 * 로또 6/45 공식 색상 구간(1~10 노랑, 11~20 파랑, 21~30 빨강, 31~40 회색, 41~45 초록)을
 * 대표하는 번호. 실제로 화면에 숫자를 표시하지는 않고(hideNumber) 색상만 빌려 쓴다.
 */
const REPRESENTATIVE_NUMBERS = [5, 15, 25, 35, 45];
const BALL_SIZE = 26;
const BOUNCE_HEIGHT = 22;
const STAGGER_MS = 110;

/** "숫자 없는 로또 공이 통통 튀는" 로딩 인디케이터. AI 조합 탐색처럼 시간이 걸리는 온디바이스 연산 중에 사용한다. */
export function LottoBallLoader() {
  const anims = useRef(REPRESENTATIVE_NUMBERS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = anims.map((anim, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * STAGGER_MS),
          Animated.timing(anim, {
            toValue: 1,
            duration: 320,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 420,
            easing: Easing.bounce,
            useNativeDriver: true,
          }),
          Animated.delay((REPRESENTATIVE_NUMBERS.length - 1 - index) * STAGGER_MS),
        ])
      )
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [anims]);

  return (
    <View style={styles.row}>
      {REPRESENTATIVE_NUMBERS.map((number, index) => {
        const translateY = anims[index].interpolate({
          inputRange: [0, 1],
          outputRange: [0, -BOUNCE_HEIGHT],
        });
        const shadowScale = anims[index].interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.5],
        });
        const shadowOpacity = anims[index].interpolate({
          inputRange: [0, 1],
          outputRange: [0.35, 0.12],
        });
        return (
          <View key={number} style={styles.slot}>
            <Animated.View style={{ transform: [{ translateY }] }}>
              <LottoBall number={number} size={BALL_SIZE} hideNumber />
            </Animated.View>
            <Animated.View
              style={[styles.shadow, { opacity: shadowOpacity, transform: [{ scaleX: shadowScale }] }]}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 10,
    height: BOUNCE_HEIGHT + BALL_SIZE + 14,
  },
  slot: { width: BALL_SIZE, alignItems: "center" },
  shadow: {
    marginTop: 8,
    width: BALL_SIZE * 0.8,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#000",
  },
});
