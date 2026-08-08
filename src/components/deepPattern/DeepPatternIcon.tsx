import React from "react";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

/**
 * 딥 패턴 탐색 메뉴 아이콘. 다른 5개 메뉴는 PNG 에셋(assets/quick-menu-icons/*)을 쓰지만,
 * 이 기능은 새 이미지 에셋을 추가하는 대신 이미 의존성에 있는 react-native-svg로 벡터
 * 아이콘을 그린다 — 별 모양 점 6개를 선으로 이은, 목업에서 승인된 "패턴" 아이콘 그대로다.
 */
export function DeepPatternIcon({ size = 56 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: "#6C5CE7",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={size * 0.5} height={size * 0.5} viewBox="0 0 26 26" fill="none">
        <Path
          d="M5 6 L10 14 L19 4 L21 16 L6 21 L17 22"
          stroke="#C9C2FF"
          strokeWidth={1.4}
          fill="none"
        />
        <Circle cx={5} cy={6} r={2.2} fill="#fff" />
        <Circle cx={19} cy={4} r={2.2} fill="#fff" />
        <Circle cx={21} cy={16} r={2.2} fill="#fff" />
        <Circle cx={10} cy={14} r={2.2} fill="#fff" />
        <Circle cx={6} cy={21} r={2.2} fill="#fff" />
        <Circle cx={17} cy={22} r={2.2} fill="#fff" />
      </Svg>
    </View>
  );
}
