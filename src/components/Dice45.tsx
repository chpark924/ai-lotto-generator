import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

const SIZE = 132;
const GLOW_SIZE = SIZE + 44;

/** 장식용 "다른 면" 숫자들의 배치 각도 (실제 주사위 사진처럼 여러 면이 살짝씩 보이는 느낌을 준다). */
const GHOST_FACE_ANGLES = [18, 61, 104, 148, 191, 234, 277, 320];
/** 면 경계선을 흉내 내는 얇은 선들의 각도. */
const FACET_LINE_ANGLES = [8, 47, 92, 133, 176, 214, 251, 296, 332];

/**
 * 45면체 주사위를 화면 상단에서 실제로 돌아가는 것처럼 보여주는 배지.
 * 외부 3D/그래픽 라이브러리 없이 RN 코어 Animated + transform만으로 구현한다.
 * - 평소에는 천천히 계속 자전한다 (idle spin).
 * - 굴리기 동작이 일어나면 빠르게 여러 바퀴 회전하며 숫자가 빠르게 바뀌다가(flicker)
 *   최종값에 착지하는 연출을 보여준다.
 */
export function Dice45({
  number,
  spinTrigger,
}: {
  /** 이번에 확정된(또는 확정될) 숫자. null이면 기본 "45" 로고를 보여준다. */
  number: number | null;
  /** 값이 바뀔 때마다 새로운 굴리기 애니메이션을 1회 재생한다. 0은 최초 마운트를 의미. */
  spinTrigger: number;
}) {
  const idleRotate = useRef(new Animated.Value(0)).current;
  const spinRotate = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  const [displayNumber, setDisplayNumber] = useState<number | null>(number);
  const [isSpinning, setIsSpinning] = useState(false);
  const isFirstRun = useRef(true);

  // 평소에도 계속 살짝 자전하는 느낌 (무한 루프).
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(idleRotate, {
        toValue: 1,
        duration: 7000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [idleRotate]);

  // 굴리기 트리거가 바뀔 때마다 빠른 회전 + 숫자 플리커 후 착지.
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      setDisplayNumber(number);
      return;
    }
    if (spinTrigger === 0) return;

    setIsSpinning(true);
    spinRotate.setValue(0);
    scale.setValue(1);
    glow.setValue(0);

    const flicker = setInterval(() => {
      setDisplayNumber(Math.floor(Math.random() * 45) + 1);
    }, 38);

    Animated.timing(spinRotate, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      clearInterval(flicker);
      setDisplayNumber(number);
      setIsSpinning(false);
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.18, duration: 120, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 550, useNativeDriver: true }),
      ]).start();
    });

    return () => clearInterval(flicker);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinTrigger]);

  const idleSpin = idleRotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const rollSpin = spinRotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "1104deg"] });
  const tilt = spinRotate.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["0deg", "16deg", "0deg"] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] });

  const statusLabel = isSpinning
    ? "45면체 주사위, 굴리는 중"
    : number !== null
      ? `45면체 주사위, 방금 ${number} 확정`
      : "45면체 주사위, 탭해서 굴려보세요";

  return (
    <View style={styles.wrap} accessible accessibilityLabel={statusLabel}>
      <Animated.View pointerEvents="none" style={[styles.glow, { opacity: glowOpacity }]} />

      <Animated.View
        style={[
          styles.sphere,
          {
            transform: [
              { perspective: 700 },
              { rotateY: idleSpin },
              { rotateY: rollSpin },
              { rotateX: tilt },
              { scale },
            ],
          },
        ]}
      >
        <View style={styles.shine} />

        {FACET_LINE_ANGLES.map((angle, i) => (
          <View key={i} style={[styles.facetLine, { transform: [{ rotate: `${angle}deg` }] }]} />
        ))}

        {GHOST_FACE_ANGLES.map((angle, i) => (
          <Text
            key={i}
            style={[styles.ghostNumber, { transform: [{ rotate: `${angle}deg` }, { translateY: -50 }] }]}
          >
            {((i * 11) % 45) + 1}
          </Text>
        ))}

        <View style={styles.centerFace}>
          {/* 132px 원 안에 고정 배치되는 숫자라, 큰 글씨 설정에서도 원 밖으로 잘리지 않게 제한한다. */}
          <Text maxFontSizeMultiplier={1.3} style={styles.centerNumber}>
            {displayNumber ?? 45}
          </Text>
        </View>
      </Animated.View>

      <Text style={styles.caption}>
        {isSpinning ? "굴리는 중..." : number !== null ? `방금 ${number} 확정` : "탭해서 굴려보세요"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", marginBottom: 14 },
  glow: {
    position: "absolute",
    top: -6,
    left: "50%",
    marginLeft: -GLOW_SIZE / 2,
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_SIZE / 2,
    backgroundColor: "#38BDF8",
  },
  sphere: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: "#0B1220",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#1E293B",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  shine: {
    position: "absolute",
    top: -SIZE * 0.3,
    left: -SIZE * 0.16,
    width: SIZE * 0.9,
    height: SIZE * 0.9,
    borderRadius: SIZE * 0.45,
    backgroundColor: "#FFFFFF",
    opacity: 0.08,
  },
  facetLine: {
    position: "absolute",
    width: SIZE * 1.15,
    height: 1,
    backgroundColor: "#38BDF8",
    opacity: 0.16,
  },
  ghostNumber: {
    position: "absolute",
    fontSize: 10,
    fontWeight: "700",
    color: "#38BDF8",
    opacity: 0.3,
  },
  centerFace: { alignItems: "center", justifyContent: "center" },
  centerNumber: {
    fontSize: 42,
    fontWeight: "800",
    color: "#7DD3FC",
    textShadowColor: "#38BDF8",
    textShadowRadius: 16,
    textShadowOffset: { width: 0, height: 0 },
  },
  caption: { marginTop: 10, fontSize: 12, fontWeight: "600", color: "#64748B" },
});
