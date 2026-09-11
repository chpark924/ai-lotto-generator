import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { getBallColor } from "../constants/lottery";

/**
 * [2026-09-11 원복] Phase 5a(2026-09-10)에서 추가했던 2D 그라디언트 오버레이(가장자리
 * 셰이딩 + 좌상단 하이라이트, 구형 표면 재질감 근사)를 제거하고, 그 이전의 평면 단색 원 +
 * 그림자만 있는 버전으로 되돌렸다. 공식 로또 색상(getBallColor, 1~10 노랑/11~20 파랑/
 * 21~30 빨강/31~40 회색/41~45 초록)은 그대로 유지한다.
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

  return (
    <View
      style={[
        styles.ball,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
      ]}
      accessible={!hideNumber}
      accessibilityLabel={hideNumber ? undefined : `로또 번호 ${number}`}
    >
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
  ball: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  text: {
    fontWeight: "700",
    color: "#1F2937",
  },
});
