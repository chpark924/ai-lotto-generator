import React, { useCallback, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { brand } from "../theme";

/**
 * 홈 화면 히어로의 "AI로 번호 만들기" CTA를 하나의 오브젝트가 형태·색상·재질감을 바꿔가며
 * 등장하는 인터랙션으로 구현한다(2026-09-11, 사용자가 GPT로 작성한 상세 스펙 기반).
 *
 * 핵심 원칙: 옅은 샴페인색 "구체"와 최종 "AI로 번호 만들기" 버튼은 **동일한 하나의
 * `Animated.View`**다. 별도의 구체 이미지 + 별도의 버튼을 Crossfade/opacity로 교체하는
 * 방식은 절대 쓰지 않는다 — width/backgroundColor/그림자를 한 progress 값(0→1)에 물려
 * 연속적으로 보간(interpolate)한다. width는 처음엔 작은 원(지름 `ORB_SIZE`)이었다가 오른쪽
 * 으로만 늘어나 트랙 전체 너비를 채우고(왼쪽 끝은 고정, 컨테이너 alignItems:"flex-start"로
 * stretch를 막아 변형 방향을 오른쪽으로만 유지), height는 처음부터 끝까지 고정(`CTA_HEIGHT`)
 * 이라 radius=height/2가 그대로 유지되며 "원 → 캡슐"이 자연스럽게 이어진다.
 *
 * 배경(Layer 1)은 스펙이 요구한 "정적인 기하학적 그래픽 에셋"을 실제 이미지 생성 도구 없이는
 * 그대로 재현할 수 없어, LinearGradient + 반투명 블롭(blob) 2개로 근사했다 — 파스텔 블루~
 * 라벤더 톤의 은은한 배경이라는 방향성은 유지하되, 레퍼런스의 정확한 리본 형태 그래픽은
 * 아니다(README 격 안내를 QA_LOG에 남겨둔다).
 */

const ORB_SIZE = 60;
const CTA_HEIGHT = 60;
const MORPH_DURATION_MS = 750;

// 색상도 형태와 동시에, 같은 progress로 5단계 보간한다 — Crossfade가 아니라 "같은 재질의
// 색이 바뀌는" 느낌을 주기 위해 단일 backgroundColor 보간 하나로만 구현한다(별도 레이어 없음).
// 마지막 두 단계(미디움 블루 / 딥 네이비)는 임의 색 대신 앱의 실제 브랜드 토큰
// (brand.primary/brand.dark)을 그대로 써서, 완성된 버튼이 앱의 다른 CTA들과 같은 톤이 되게 한다.
const COLOR_STOPS_INPUT = [0, 0.22, 0.45, 0.7, 1];
const COLOR_STOPS_OUTPUT = [
  "#F6E7C9", // Pale Champagne
  "#E7D6D6", // Champagne + Lavender
  "#B9C4E8", // Pale Lavender Blue
  brand.primary, // Medium Blue — 브랜드 토큰
  brand.dark, // Deep Navy — 브랜드 토큰
];

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
  // onLayout(트랙의 실제 너비 확정)과 useFocusEffect(탭 진입)는 둘 다 비동기이고 어느 쪽이
  // 먼저 발생할지 보장되지 않는다 — 특히 최초 마운트 시 focus가 layout보다 먼저 올 수 있다.
  // 그 상태에서 바로 애니메이션을 시작하면 maxWidth가 아직 ORB_SIZE로 남아있어 "원 → 캡슐"
  // 너비 변화가 전혀 보이지 않는다(색상만 바뀜). trackWidthRef/pendingPlayRef로 두 이벤트의
  // 도착 순서에 관계없이 "layout을 안 뒤에" 정확히 재생되도록 한다.
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
          // width/backgroundColor/shadowOpacity는 네이티브 드라이버를 지원하지 않는다.
          useNativeDriver: false,
        }).start();
      })
      .catch(() => {
        // Reduce Motion 조회 실패 시에도 최소한 완성된 CTA는 보이게 한다.
        progress.setValue(1);
      });
  }, [progress]);

  const runMorph = useCallback(() => {
    if (trackWidthRef.current > 0) {
      playNow();
    } else {
      // 트랙 너비를 아직 모른다 — onLayout이 들어오는 즉시 재생하도록 예약만 해둔다.
      pendingPlayRef.current = true;
    }
  }, [playNow]);

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
      runMorph();
      return () => {
        // 포커스를 잃은 뒤에는(예: layout이 그제서야 도착) 더 이상 예약된 재생을 실행하지 않는다.
        pendingPlayRef.current = false;
      };
    }, [runMorph])
  );

  const maxWidth = Math.max(trackWidth, ORB_SIZE);
  const width = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [ORB_SIZE, maxWidth],
    extrapolate: "clamp",
  });
  const backgroundColor = progress.interpolate({
    inputRange: COLOR_STOPS_INPUT,
    outputRange: COLOR_STOPS_OUTPUT,
  });
  const shadowOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0.14, 0.3] });
  // 텍스트는 형태 변화가 충분히 진행돼 가로 공간이 확보된 뒤(약 62% 지점)에만 나타난다 —
  // 오브젝트 자체가 처음부터 끝까지 같고, 라벨만 마지막에 얹히는 구조.
  const textOpacity = progress.interpolate({ inputRange: [0, 0.62, 1], outputRange: [0, 0, 1] });
  const textTranslateY = progress.interpolate({ inputRange: [0, 0.62, 1], outputRange: [4, 4, 0] });
  // 왼쪽에 고정된 하이라이트 — 오브젝트가 오른쪽으로 늘어나는 동안에도 "원래 구체의
  // 볼륨감"이 계속 보이게 한다(Crossfade가 아니라 재질 자체가 유지되는 느낌).
  const highlightOpacity = progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 0.5, 0.22] });

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={["#AFC1EF", "#C7B7E6", "#B7CAF1"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.blobA} pointerEvents="none" />
      <View style={styles.blobB} pointerEvents="none" />
      <View style={styles.scrim} pointerEvents="none" />

      <View style={styles.textBlock}>
        {typeof subtitle === "string" ? <Text style={styles.subtitle}>{subtitle}</Text> : subtitle}
        <Text style={styles.title}>{title}</Text>
      </View>

      <View style={styles.track} onLayout={handleTrackLayout}>
        {/* 히트 영역을 트랙 전체 너비로 처음부터 고정해둔다 — 오브젝트가 아직 작은 원일 때도
            "완성될 버튼 자리"를 그대로 누르면 즉시 동작한다. 750ms를 기다리게 하지 않는다. */}
        <Pressable
          style={styles.hitArea}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
        >
          <Animated.View style={[styles.morphObject, { width, backgroundColor, shadowOpacity }]}>
            <Animated.View style={[styles.highlight, { opacity: highlightOpacity }]} />
            <Animated.Text
              style={[styles.ctaText, { opacity: textOpacity, transform: [{ translateY: textTranslateY }] }]}
              numberOfLines={1}
            >
              {ctaLabel}
            </Animated.Text>
          </Animated.View>
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
  blobA: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(255,255,255,0.22)",
    top: -90,
    left: -70,
  },
  blobB: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(255,255,255,0.16)",
    bottom: -140,
    right: -80,
  },
  // 헤드라인 텍스트가 파스텔 배경 위에서도 충분한 대비를 갖도록, 카드 상단에 아주 옅은
  // 어두운 스크림을 깐다(사진/그래픽 위에 흰 글자를 얹는 흔한 기법 — 배경 자체를 어둡게
  // 바꾸지 않고 텍스트 가독성만 보정한다).
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(8,12,30,0.10)" },
  textBlock: { marginBottom: 22 },
  subtitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  track: { height: CTA_HEIGHT },
  // alignItems:"flex-start"가 핵심 — 기본값(stretch)이면 오브젝트가 처음부터 트랙 전체
  // 너비로 늘어나버려 애니메이션이 무의미해진다. flex-start라야 오브젝트 자신의 width
  // 스타일(애니메이션 값)이 그대로 적용되고, 왼쪽에 고정된 채 오른쪽으로만 자란다.
  hitArea: { height: CTA_HEIGHT, width: "100%", alignItems: "flex-start" },
  morphObject: {
    height: CTA_HEIGHT,
    borderRadius: CTA_HEIGHT / 2,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 4,
  },
  highlight: {
    position: "absolute",
    top: 8,
    left: 8,
    width: CTA_HEIGHT * 0.5,
    height: CTA_HEIGHT * 0.5,
    borderRadius: CTA_HEIGHT * 0.25,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  ctaText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
