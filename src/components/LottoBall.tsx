import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { getBallColor } from "../constants/lottery";

/**
 * [DESIGN_GUIDE.md 9절 / Phase 5a, 2026-09-10] 실제 3D 렌더링 에셋 제작은 이 세션에서
 * 할 수 없지만(8절), 지금 있는 평면 단색 원(그림자만 있던 이전 버전) 대신 2D 그라디언트
 * 오버레이로 "구형 표면"의 재질감만 근사해서 다듬었다. 공식 로또 색상(getBallColor, 1~10
 * 노랑/11~20 파랑/21~30 빨강/31~40 회색/41~45 초록)은 원색 그대로 유지한다 — 채도를
 * 낮추면 실제 로또 용지·추첨 방송에서 보는 색과 달라져 혼란을 줄 수 있다는 판단(가이드
 * 9절)에 따른 것으로, 여기서 바꾸는 건 색이 아니라 "빛을 받는 방식"뿐이다.
 *
 * 구성(바깥→안쪽 3겹):
 *  1) ballShadow — 그림자 전용 바깥 래퍼. 안쪽 원을 overflow:hidden으로 잘라야 해서(아래)
 *     그림자를 같은 View에 두면 같이 잘려버린다(Phase 4 CTA 버튼과 동일한 이유) — 그래서
 *     분리했다.
 *  2) ballSurface — 공식 색 배경 + overflow:hidden(원 밖으로 그라디언트가 삐져나가지 않게).
 *  3) 그 안의 두 그라디언트 — 우하단을 살짝 어둡게 누르는 "가장자리 셰이딩"과, 좌상단의
 *     작은 "하이라이트"(10시 방향 광원, 가이드 8절의 조명 방향 규칙과 동일). 숫자 텍스트는
 *     엠보싱 없이 평평하게(가이드 9절 "인쇄된 듯한 숫자") 유지 — 그 위에 그대로 얹는다.
 */
export function LottoBall({
  number,
  size = 36,
  hideNumber = false,
}: {
  number: number;
  size?: number;
  hideNumber?: boolean;
}) {
  const color = getBallColor(number);
  const highlightSize = size * 0.46;

  return (
    <View
      style={[styles.ballShadow, { width: size, height: size, borderRadius: size / 2 }]}
      accessible={!hideNumber}
      accessibilityLabel={hideNumber ? undefined : `로또 번호 ${number}`}
    >
      <View style={[styles.ballSurface, { borderRadius: size / 2, backgroundColor: color }]}>
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.16)"]}
          start={{ x: 0.2, y: 0.2 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={["rgba(255,255,255,0.55)", "rgba(255,255,255,0)"]}
          start={{ x: 0.15, y: 0.1 }}
          end={{ x: 0.8, y: 0.85 }}
          style={[
            styles.ballHighlight,
            {
              width: highlightSize,
              height: highlightSize,
              borderRadius: highlightSize / 2,
              top: size * 0.1,
              left: size * 0.12,
            },
          ]}
        />
        {hideNumber ? null : (
          // 시스템 큰 글씨 설정이 아주 높아도(예: 200%) 원형 공 밖으로 숫자가 잘리지 않도록
          // 배율을 제한한다 — 공 자체가 이미 색으로 번호를 구분해주므로, 숫자가 다소 작게
          // 보여도 읽는 데 지장이 없는 선에서 잘림 방지를 우선한다.
          <Text maxFontSizeMultiplier={1.3} style={[styles.text, { fontSize: size * 0.42 }]}>
            {number}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ballShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  ballSurface: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ballHighlight: {
    position: "absolute",
  },
  text: {
    fontWeight: "700",
    color: "#1F2937",
  },
});
