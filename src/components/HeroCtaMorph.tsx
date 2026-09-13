import React, { useCallback, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";

/**
 * 홈 화면 히어로의 "AI로 번호 만들기" CTA를 하나의 오브젝트가 형태·색상·재질감을 바꿔가며
 * 등장하는 인터랙션으로 구현한다(2026-09-11, 사용자가 GPT로 작성한 상세 스펙 기반).
 *
 * [2026-09-13 3차 업데이트 — 실제 이미지 에셋을 다시 걷어내고 Native UI로 재구현]
 * 2차 업데이트(같은 날)에서는 사용자가 보내준 실제 구체→캡슐 PNG(`cta-pill.png`)를 와이프
 * 리빌 방식으로 그대로 붙여넣었었다. 그런데 사용자가 다시 피드백을 주며 "짐 제작된 cta
 * 이미지가 적합하지 않다"고, 그 이미지들은 스프라이트로 그대로 쓰라는 게 아니라 재질·형태를
 * 참고하는 레퍼런스일 뿐이니 Native UI로 재현해달라고 요청했다. 그래서 다시 방향을 바꿔서:
 *
 * - CTA 오브젝트는 더 이상 실제 PNG를 크롭/리빌하지 않는다. 1차(135번)처럼 코드로 그린
 *   `Animated.View` 하나의 `width`(구체 지름→트랙 전체 폭)와 `backgroundColor`(오렌지→
 *   블루)를 `progress` 하나로 보간하는 방식으로 되돌아갔다 — 다만 색상 값은 사용자가 보낸
 *   실제 레퍼런스 PNG에서 Python으로 직접 스포이드 추출한 값(`#FFE7A6→#FDBE55→#DCB9F2→
 *   #6E8FFC→#3D79FE`)으로 다시 캘리브레이션했다(1차 버전은 마지막 두 단계가 앱 브랜드
 *   토큰(`brand.primary`/`brand.dark`, 진네이비)이었는데, 레퍼런스의 실제 완성 색은 그보다
 *   훨씬 밝고 선명한 블루라 그쪽에 맞췄다).
 * - 레퍼런스 이미지들(스프라이트 시트, 연속 이미지)을 자세히 보면 단순 단색이 아니라 (1) 왼쪽
 *   위에서 들어오는 대각선 유리질 하이라이트 밴드, (2) 구체였던 왼쪽 부분에 남아있는 작은
 *   스페큘러(반사광) 반점, (3) 오브젝트 테두리 바깥으로 번지는 은은한 색 글로우(bloom) —
 *   이렇게 3가지 "재질" 요소가 있다. 이걸 전부 순수 RN 뷰/`expo-linear-gradient`(이미
 *   설치돼 있음, 새 의존성 추가 없음)만으로 재현했다:
 *     · 대각선 하이라이트 = `LinearGradient`(흰색 투명→반투명→투명, 대각선 방향)를 오브젝트
 *       안쪽에 `overflow:"hidden"`으로 클립해서 얹음.
 *     · 스페큘러 반점 = 왼쪽 위 고정 위치에 반투명 흰 원 3개를 크기/투명도 다르게 겹쳐서
 *       (작고 진한 원 + 크고 옅은 원) 부드러운 하이라이트처럼 보이게 함(진짜 블러 없이도
 *       여러 겹 겹치면 눈에는 충분히 부드럽게 보인다).
 *     · 글로우 = 오브젝트보다 한 단계씩 더 크고(패딩 12/26/44dp) 더 투명한(불투명도
 *       0.22/0.16/0.10) 같은 색의 캡슐 레이어를 오브젝트 "뒤"에 3겹 겹쳐서 바깥으로
 *       갈수록 옅어지는 후광을 흉내낸다(CSS의 다중 box-shadow와 같은 원리) — RN에는
 *       크로스플랫폼으로 동작하는 진짜 가우시안 블러가 없어서(이 프로젝트엔 `expo-blur`/
 *       `reanimated`/Skia 미설치) 완벽히 매끈한 블러는 아니지만, 실제 화면 크기에서는
 *       충분히 은은한 후광으로 보인다. 더 매끈하게 만들려면 나중에 `expo-blur`를 설치해
 *       글로우 레이어에 `BlurView`를 씌우는 걸 고려할 수 있다.
 * - 오브젝트 크기: 실제 PNG 에셋을 안 쓰므로 더 이상 고정 가로세로 비율 제약이 없다 —
 *   1차(135번) 스펙 그대로 트랙 전체 폭(`onLayout`으로 실측)까지 늘어나도록 되돌렸다(2차의
 *   `FINAL_WIDTH=230` 고정폭은 삭제). 사용자가 보낸 3단계 목업 레퍼런스도 완성된 버튼이
 *   카드 폭 거의 전체를 채우고 있어, 이쪽이 실제로도 더 레퍼런스에 가깝다.
 * - `onLayout`/`trackWidthRef`/`pendingPlayRef`로 포커스 이벤트와 레이아웃 이벤트 중 어느
 *   쪽이 먼저 도착하든 최초 진입 시 항상 정상적으로 재생되도록 하는 로직(135번에서 발견/
 *   수정한 타이밍 버그 대응)도 함께 복원했다 — 폭이 다시 화면 폭에 의존하게 됐기 때문.
 */

const CTA_HEIGHT = 60;
const ORB_SIZE = 60; // width === height(=CTA_HEIGHT)일 때 정원(구체)이 되는 시작 크기

const MORPH_DURATION_MS = 750;

const HERO_BG = require("../../assets/hero/hero-bg.jpg");

// 사용자가 보낸 실제 레퍼런스 PNG(구체→캡슐 연속 이미지)에서 Python(PIL)으로 좌표를 찍어
// 직접 추출한 색상 값. 대략 15%/25%/40~55%/70% 지점을 스포이드한 값을 5단계로 정리했다.
const COLOR_STOPS_INPUT = [0, 0.25, 0.5, 0.75, 1];
const COLOR_STOPS_OUTPUT = ["#FFE7A6", "#FDBE55", "#DCB9F2", "#6E8FFC", "#3D79FE"];

// 오브젝트 바깥으로 번지는 글로우(후광) — 패딩이 클수록(더 바깥 레이어일수록) 더 투명하게.
const GLOW_RINGS = [
  { pad: 44, opacity: 0.1 },
  { pad: 26, opacity: 0.16 },
  { pad: 12, opacity: 0.22 },
] as const;

// 왼쪽(구체였던 부분) 위쪽에 고정되는 스페큘러 하이라이트 반점 3겹(큰 원일수록 옅게).
const SPECULAR_CX = CTA_HEIGHT * 0.34;
const SPECULAR_CY = CTA_HEIGHT * 0.3;
const SPECULAR_LAYERS = [
  { radius: CTA_HEIGHT * 0.34, opacity: 0.2 },
  { radius: CTA_HEIGHT * 0.2, opacity: 0.4 },
  { radius: CTA_HEIGHT * 0.11, opacity: 0.65 },
] as const;

export function HeroCtaMorph({
  subtitle,
  title,
  ctaLabel,
  onPress,
  accessibilityLabel,
}: {
  /** 문자열 또는 로딩 중 스켈레톤 같은 커스텀 노드. */
  subtitle: React.ReactNode;
  title: string;
  ctaLabel: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);
  const pendingPlayRef = useRef(false);

  const playNow = useCallback(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (reduced) {
          // 시스템 "동작 줄이기" 설정 — 애니메이션 없이 바로 완성된 CTA 상태로 보여준다.
          // 어떤 경우에도 CTA 기능 자체는 사라지지 않는다.
          progress.setValue(1);
          return;
        }
        progress.setValue(0);
        Animated.timing(progress, {
          toValue: 1,
          duration: MORPH_DURATION_MS,
          // Bounce/Elastic/Overshoot 없는 절제된 ease-out — "정돈된" 느낌 유지.
          easing: Easing.bezier(0.22, 0.61, 0.36, 1),
          // width/backgroundColor는 네이티브 드라이버를 지원하지 않는다.
          useNativeDriver: false,
        }).start();
      })
      .catch(() => {
        // Reduce Motion 조회 실패 시에도 최소한 완성된 CTA는 보이게 한다.
        progress.setValue(1);
      });
  }, [progress]);

  // 트랙의 실제 폭은 화면 크기에 따라 달라지므로 onLayout으로 실측해야 한다. 이 실측값과
  // "탭에 포커스가 들어왔다"는 이벤트는 둘 다 비동기라 어느 쪽이 먼저 도착할지 보장되지
  // 않는다 — layout을 아직 모르는 채로 재생을 시작하면 width가 구체 크기에 머물러버리는
  // 문제(135번에서 발견)가 있어, layout을 아직 모르면 재생을 "예약"만 해두고 onLayout이
  // 도착하는 즉시 재생한다.
  const handleTrackLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number } } }) => {
      const w = e.nativeEvent.layout.width;
      trackWidthRef.current = w;
      setTrackWidth(w);
      if (pendingPlayRef.current) {
        pendingPlayRef.current = false;
        playNow();
      }
    },
    [playNow]
  );

  // 탭에 실제로 "진입"할 때만 재생한다 — react-navigation의 focus 이벤트 기준이라
  // recomposition/스크롤/네트워크 응답에 따른 상태 갱신으로는 재실행되지 않고, 다른 탭에
  // 갔다가 홈으로 돌아올 때마다(포커스를 다시 받을 때마다) 정확히 1회씩 재생된다.
  useFocusEffect(
    useCallback(() => {
      if (trackWidthRef.current > 0) {
        playNow();
      } else {
        pendingPlayRef.current = true;
      }
    }, [playNow])
  );

  const width = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [ORB_SIZE, Math.max(trackWidth, ORB_SIZE)],
    extrapolate: "clamp",
  });
  const animatedColor = progress.interpolate({
    inputRange: COLOR_STOPS_INPUT,
    outputRange: COLOR_STOPS_OUTPUT,
  });
  // 텍스트는 형태 변화가 충분히 진행돼 가로 공간이 확보된 뒤(약 62% 지점)에만 나타난다.
  const textOpacity = progress.interpolate({ inputRange: [0, 0.62, 1], outputRange: [0, 0, 1] });
  const textTranslateY = progress.interpolate({ inputRange: [0, 0.62, 1], outputRange: [4, 4, 0] });

  return (
    <View style={styles.card}>
      {/* 실제 레퍼런스 배경 에셋 — resizeMode="cover"라 카드 실제 비율(기기 화면 너비에 따라
          달라짐)에 맞춰 중앙 기준으로 자동 크롭된다. */}
      <Image source={HERO_BG} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <View style={styles.scrim} pointerEvents="none" />

      <View style={styles.textBlock}>
        {typeof subtitle === "string" ? <Text style={styles.subtitle}>{subtitle}</Text> : subtitle}
        <Text style={styles.title}>{title}</Text>
      </View>

      <View style={styles.track} onLayout={handleTrackLayout}>
        {/* 히트 영역은 트랙 전체 폭 — 오브젝트가 아직 작은 구체일 때도 완성될 버튼 자리를
            그대로 누르면 즉시 동작한다(750ms를 기다리게 하지 않는다). 글로우/오브젝트는 전부
            position:"absolute"로 같은 원점(left:0, top:0)에 겹쳐 중심을 맞춘다. */}
        <Pressable
          style={styles.hitArea}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
        >
          {GLOW_RINGS.map((ring) => (
            <Animated.View
              key={ring.pad}
              pointerEvents="none"
              style={[
                styles.glowRing,
                {
                  width: Animated.add(width, ring.pad),
                  height: CTA_HEIGHT + ring.pad,
                  borderRadius: (CTA_HEIGHT + ring.pad) / 2,
                  marginLeft: -ring.pad / 2,
                  marginTop: -ring.pad / 2,
                  backgroundColor: animatedColor,
                  opacity: ring.opacity,
                },
              ]}
            />
          ))}

          <Animated.View style={[styles.pill, { width, backgroundColor: animatedColor }]}>
            {/* 대각선 유리질 하이라이트 — 왼쪽 위가 밝고 오른쪽 아래로 갈수록 옅어진다. */}
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.32)", "rgba(255,255,255,0)"]}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.65, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {/* 스페큘러(반사광) 반점 — 구체였던 왼쪽 부분에 고정된 위치. */}
            {SPECULAR_LAYERS.map((s) => (
              <View
                key={s.radius}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: SPECULAR_CX - s.radius,
                  top: SPECULAR_CY - s.radius,
                  width: s.radius * 2,
                  height: s.radius * 2,
                  borderRadius: s.radius,
                  backgroundColor: "#fff",
                  opacity: s.opacity,
                }}
              />
            ))}
          </Animated.View>

          <View style={styles.textOverlay} pointerEvents="none">
            <Animated.Text
              style={[styles.ctaText, { opacity: textOpacity, transform: [{ translateY: textTranslateY }] }]}
              numberOfLines={1}
            >
              {ctaLabel}
            </Animated.Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    overflow: "hidden",
    marginBottom: 20,
    paddingTop: 26,
    paddingBottom: 26,
    paddingHorizontal: 22,
  },
  // 헤드라인 텍스트가 실제 배경 에셋의 밝은 영역(카드 상단은 흰색에 가까운 라벤더) 위에서도
  // 충분한 대비를 갖도록, 아주 옅은 어두운 스크림 + 텍스트 자체의 그림자를 함께 쓴다.
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(8,12,30,0.12)" },
  textBlock: { marginBottom: 22 },
  subtitle: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
    textShadowColor: "rgba(15,23,42,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    textShadowColor: "rgba(15,23,42,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  track: { height: CTA_HEIGHT },
  hitArea: { position: "relative", height: CTA_HEIGHT, width: "100%" },
  glowRing: { position: "absolute", left: 0, top: 0 },
  pill: {
    position: "absolute",
    left: 0,
    top: 0,
    height: CTA_HEIGHT,
    borderRadius: CTA_HEIGHT / 2,
    overflow: "hidden",
  },
  textOverlay: {
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: CTA_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  ctaText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
