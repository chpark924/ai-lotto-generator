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
      {hideNumber ? null : <Text style={[styles.text, { fontSize: size * 0.42 }]}>{number}</Text>}
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
