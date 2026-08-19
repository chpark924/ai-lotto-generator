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
  onSpinningChange,
}: {
  /** 이번에 확정된(또는 확정될) 숫자. null이면 기본 "45" 로고를 보여준다. */
  number: number | null;
  /** 값이 바뀔 때마다 새로운 굴리기 애니메이션을 1회 재생한다. 0은 최초 마운트를 의미. */
  spinTrigger: number;
  /**
   * 굴리기 애니메이션이 시작/종료될 때 알려준다(QA_LOG 96번). 호출부(dice.tsx)가 이 값으로
   * "한 번 굴리기"/"자동 6회 굴리기" 버튼을 잠깐 비활성화해, 애니메이션이 끝나기 전에 같은
   * 버튼을 연타해서 새 굴리기 사이클이 겹쳐 시작되는 것 자체를 막는다.
   */
  onSpinningChange?: (spinning: boolean) => void;
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

    // QA_LOG 107번 — "자동 6회 굴리기"/번호 재굴리기를 15회 이상 빠르게 연타하면 앱이
    // 점점 느려지다가 완전히 멈춰(뻗어) 강제 종료해야 하는 문제가 있었다. 원인: 굴리기가
    // 끝난 뒤 이어지는 "착지" 연출(scale 튕김 + glow 반짝임)은 isDiceSpinning이 이미
    // false로 풀린 뒤에도 최대 ~700ms 더 재생되는데, 그 사이에 버튼이 다시 눌리면(96번
    // 가드는 스핀 자체의 480ms만 막아줄 뿐, 그 뒤에 이어지는 이 착지 연출까지는 막지
    // 못했다) 새 사이클이 scale/glow 값을 setValue()로 되돌리기만 했다 — RN Animated는
    // setValue를 호출해도 이미 진행 중이던 애니메이션을 자동으로 멈춰주지 않기 때문에,
    // 매 연타마다 이전 애니메이션들이 정리되지 않고 native 쪽에 계속 쌓여 함께 실행됐다.
    // 15번 연타하면 수십 개의 애니메이션이 동시에 쌓여 돌아가며 기기가 느려지다 못해
    // 완전히 멈추는 원인이 됐다. 새 사이클을 시작하기 전에 이 세 Animated.Value에서
    // 진행 중인 애니메이션을 명시적으로 멈춰(stopAnimation) 잔여 애니메이션이 계속
    // 누적되지 않게 한다.
    spinRotate.stopAnimation();
    scale.stopAnimation();
    glow.stopAnimation();

    setIsSpinning(true);
    onSpinningChange?.(true);
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
    }).start((result) => {
      clearInterval(flicker);
      // "자동 6회 굴리기"를 연타하는 등 이 애니메이션이 끝나기 전에 같은 Animated.Value에
      // 새 굴리기가 다시 시작되면, RN이 이 타이밍을 중간에 끊고 콜백을 finished:false로
      // 즉시 호출한다 — 이때 아래 "착지" 연출(확정 숫자 표시, 스케일/글로우 이펙트)까지
      // 그대로 실행해버리면, 방금 막 시작된 새 굴리기 위에 옛날 굴리기의 숫자/이펙트가
      // 뒤늦게 덮어써져서 화면이 버벅이거나 멈춘 것처럼 보였다(QA_LOG 96번, 연타 시 "뻗는"
      // 증상의 원인). 끝까지 완주한 애니메이션의 콜백만 착지 연출을 실행하도록 막는다.
      if (!result.finished) return;
      setDisplayNumber(number);
      setIsSpinning(false);
      onSpinningChange?.(false);
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

  // 이 구슬 자체는 눌러도 아무 반응이 없다(실제 굴리기는 화면 하단의 "한 번 굴리기"/
  // "자동 6회 굴리기" 버튼으로만 동작). 예전엔 여기에 "탭해서 굴려보세요"라고 써놔서
  // 이 구슬을 눌러야 하는 것처럼 오해할 수 있다는 QA 피드백 — 탭 가능하다는 뉘앙스의
  // 문구를 완전히 빼고, 실제 상태(굴리는 중 / 방금 확정)만 안내한다.
  const statusLabel = isSpinning
    ? "45면체 주사위, 굴리는 중"
    : number !== null
      ? `45면체 주사위, 방금 ${number} 확정`
      : "45면체 주사위";

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

      {isSpinning || number !== null ? (
        <Text style={styles.caption}>{isSpinning ? "굴리는 중..." : `방금 ${number} 확정`}</Text>
      ) : null}
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
