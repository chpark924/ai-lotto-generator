import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { getBallColor } from "../constants/lottery";

/**
 * [2026-09-11 원복] Phase 5a(2026-09-10)에서 추가했던 2D 그라디언트 오버레이(가장자리
 * 셰이딩 + 좌상단 하이라이트, 구형 표면 재질감 근사)를 앱 전역에서 제거하고, 평면 단색 원 +
 * 그림자만 있는 버전으로 되돌렸다 — 이게 기본값(`variant="flat"`)이다.
 *
 * [2026-09-11 추가] 다만 "의미가 있는 실제 번호"를 보여주는 카드 두 곳만은 예외로 남겨달라는
 * 요청 — ① 로또 연구소의 "실제 당첨결과" 카드(동행복권 공식 발표 결과. 아래 다른 카드들
 * — 출현 빈도·장기 미출현·패턴 통계 — 은 전부 그 결과를 가공한 통계라 구분하고 싶다는
 * 의도), ② 내 번호 탭의 저장된 번호 카드들(사용자가 직접 선택/저장한 실제 번호라 같은
 * 이유). 그래서 원복은 하되, 지웠던 그라디언트 오버레이(가장자리 셰이딩 + 좌상단 하이라이트)
 * 구현을 `variant="glossy"`라는 별도 옵트인으로 되살렸다 — 기본값은 그대로 "flat"이라 이
 * 컴포넌트를 쓰는 나머지 모든 화면(선호번호·생성 결과·번호 만들기 로딩 등)은 전혀 영향받지
 * 않고, `app/(tabs)/lab.tsx`(실제 당첨결과)와 `app/(tabs)/tickets.tsx`(저장된 번호)에서만
 * 명시적으로 이 prop을 켠다.
 */
export function LottoBall({
  number,
  size = 36,
  hideNumber = false,
  variant = "flat",
}: {
  number: number;
  size?: number;
  hideNumber?: boolean;
  /** "flat"(기본, 평면 단색+그림자) | "glossy"(가장자리 셰이딩+하이라이트가 있는 입체 표면). */
  variant?: "flat" | "glossy";
}) {
  const color = getBallColor(number);
  const radius = size / 2;

  return (
    <View
      style={[
        styles.ballShadow,
        { width: size, height: size, borderRadius: radius, backgroundColor: color },
      ]}
      accessible={!hideNumber}
      accessibilityLabel={hideNumber ? undefined : `로또 번호 ${number}`}
    >
      {variant === "glossy" ? (
        <View style={[styles.glossyClip, { borderRadius: radius }]}>
          {/* 가장자리 셰이딩 — 우하단으로 갈수록 살짝 어두워져 구가 빛을 등지는 쪽처럼 보인다. */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.16)"]}
            start={{ x: 0.3, y: 0.25 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* 좌상단 하이라이트 — 광택이 도는 구형 표면 느낌. */}
          <LinearGradient
            colors={["rgba(255,255,255,0.55)", "transparent"]}
            start={{ x: 0.15, y: 0.1 }}
            end={{ x: 0.75, y: 0.7 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}
      {hideNumber ? null : (
        // 시스템 큰 글씨 설정이 아주 높아도(예: 200%) 원형 공 밖으로 숫자가 잘리지 않도록
        // 배율을 제한한다 — 공 자체가 이미 색으로 번호를 구분해주므로, 숫자가 다소 작게
        // 보여도 읽는 데 지장이 없는 선에서 잘림 방지를 우선한다.
        <Text maxFontSizeMultiplier={1.3} style={[styles.text, { fontSize: size * 0.42 }]}>
          {number}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ballShadow: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  // 그라디언트 오버레이가 원 밖으로 삐져나오지 않도록 같은 radius로 한 번 더 클립한다
  // (바깥 ballShadow에 overflow:hidden을 직접 주면 그림자까지 같이 잘리기 때문에, 그림자는
  // 그대로 두고 그 안쪽에 클리핑 전용 레이어를 하나 더 둔다).
  glossyClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  text: {
    fontWeight: "700",
    color: "#1F2937",
    zIndex: 1,
  },
});
