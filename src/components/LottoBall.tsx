import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { getBallColor } from "../constants/lottery";

export function LottoBall({
  number,
  size = 36,
  hideNumber = false,
}: {
  number: number;
  size?: number;
  hideNumber?: boolean;
}) {
  return (
    <View
      style={[
        styles.ball,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: getBallColor(number),
        },
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
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  text: {
    fontWeight: "700",
    color: "#1F2937",
  },
});
