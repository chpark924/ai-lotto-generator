/**
 * react-native-svg jest 목(mock) — "components" 프로젝트(jest-expo) 전용.
 *
 * react-native-svg는 iOS/Android 네이티브 뷰(RNSVGSvgView 등)에 의존하는데, jest-expo
 * 테스트 환경은 JS만 실행하고 실제 네이티브 브릿지가 없다. 이 프로젝트의 딥 패턴 탐색 화면
 * 3개(app/generate/deep-pattern*.tsx)와 그 하위 컴포넌트(PatternBoard/PatternThumb/
 * DeepPatternLoadingBoard/DeepPatternIcon)가 전부 react-native-svg로 그려지기 때문에,
 * 렌더링 테스트를 추가하려면 이 의존성을 안전하게 다룰 방법이 필요하다.
 *
 * 여기서는 SVG 프리미티브를 얇은 View 래퍼로 치환한다 — 실제 그림은 안 그리지만(테스트
 * 목적상 필요 없음), 트리 구조·props 전달은 그대로 유지해 "렌더링이 죽지 않고 끝까지
 * 끝난다"를 보장한다. DeepPatternLoadingBoard.tsx가 Animated.createAnimatedComponent로
 * Path/Circle을 감싸 쓰기 때문에, forwardRef로 만들어 ref를 전달받을 수 있게 했다.
 */
import React from "react";
import { View } from "react-native";

function makeStub(displayName: string) {
  const Stub = React.forwardRef<View, Record<string, unknown>>((props, ref) => <View ref={ref} {...props} />);
  Stub.displayName = displayName;
  return Stub;
}

export const Circle = makeStub("Svg.Circle");
export const Rect = makeStub("Svg.Rect");
export const Path = makeStub("Svg.Path");
export const Line = makeStub("Svg.Line");
export const Text = makeStub("Svg.Text");
export const G = makeStub("Svg.G");
export const Defs = makeStub("Svg.Defs");
export const Stop = makeStub("Svg.Stop");
export const LinearGradient = makeStub("Svg.LinearGradient");

const Svg = makeStub("Svg");
export default Svg;
