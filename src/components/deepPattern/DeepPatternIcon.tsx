import React from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";
import { accentViolet } from "../../theme";

/**
 * 딥 패턴 탐색 메뉴 아이콘. 다른 5개 메뉴는 PNG 에셋(assets/quick-menu-icons/*)을 쓰지만,
 * 이 기능은 새 이미지 에셋을 추가하는 대신 이미 의존성에 있는 react-native-svg로 벡터
 * 아이콘을 그린다 — 별 모양 점 6개를 선으로 이은, 목업에서 승인된 "패턴" 아이콘 그대로다.
 *
 * [2026-09-11 톤앤매너 조정] 다른 5개 아이콘은 전부 "흰색 라운드 사각형 + 은은한 그림자 +
 * 색감 있는 입체 그래픽" 조합인데, 이 아이콘만 보라 단색 배경 위에 흰 점 + 연보라 선(사실상
 * 무채색에 가까운 배색)이라 목록에서 유독 튀어 보인다는 실기기 피드백을 받았다. 배경을 다른
 * 아이콘들과 같은 흰색 라운드 사각형 + 그림자로 바꾸고, 선·점 자체에 accentViolet 그라디언트를
 * 입혀 옅은 입체감을 더했다 — 단, LottoBall에 있던 두꺼운 하이라이트/셰이딩 수준의 3D 효과는
 * 쓰지 않는다(그건 사용자가 실기기 확인 후 명시적으로 원복을 요청한 스타일이라 같은 방식은
 * 피하고, 그라디언트 정도로 절제했다).
 */
export function DeepPatternIcon({ size = 56 }: { size?: number }) {
  const lineGradientId = "deepPatternLineGradient";
  const dotGradientId = "deepPatternDotGradient";
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        // 다른 5개 PNG 아이콘도 흰 카드 아래 은은한 그림자가 깔려 있다(에셋 자체에 구워짐) —
        // 이 컴포넌트는 라이브 SVG라 View 그림자로 동일한 느낌을 낸다. 중립 회색 대신
        // accentViolet 톤 그림자를 옅게 써서 "보라색 기능"이라는 정체성은 유지했다.
        shadowColor: accentViolet.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.18,
        shadowRadius: 6,
        elevation: 3,
      }}
    >
      <Svg width={size * 0.56} height={size * 0.56} viewBox="0 0 26 26" fill="none">
        <Defs>
          <LinearGradient id={lineGradientId} x1="0" y1="0" x2="26" y2="26" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={accentViolet.primary} />
            <Stop offset="1" stopColor={accentViolet.light} />
          </LinearGradient>
          <RadialGradient id={dotGradientId} cx="35%" cy="35%" r="75%">
            <Stop offset="0" stopColor={accentViolet.light} />
            <Stop offset="1" stopColor={accentViolet.primary} />
          </RadialGradient>
        </Defs>
        <Path
          d="M5 6 L10 14 L19 4 L21 16 L6 21 L17 22"
          stroke={`url(#${lineGradientId})`}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Circle cx={5} cy={6} r={2.3} fill={`url(#${dotGradientId})`} />
        <Circle cx={19} cy={4} r={2.3} fill={`url(#${dotGradientId})`} />
        <Circle cx={21} cy={16} r={2.3} fill={`url(#${dotGradientId})`} />
        <Circle cx={10} cy={14} r={2.3} fill={`url(#${dotGradientId})`} />
        <Circle cx={6} cy={21} r={2.3} fill={`url(#${dotGradientId})`} />
        <Circle cx={17} cy={22} r={2.3} fill={`url(#${dotGradientId})`} />
      </Svg>
    </View>
  );
}
