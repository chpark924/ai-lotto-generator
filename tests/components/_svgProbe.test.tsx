/**
 * react-native-svg 목(tests/mocks/react-native-svg.tsx) 자체가 정상적으로 렌더링되는지
 * 확인하는 스모크 테스트. 딥 패턴 탐색 화면 테스트(deepPattern*.test.tsx)들은 전부 이 목에
 * 의존하므로, 목 자체가 깨지면 그 화면 테스트들의 실패 원인이 목 때문인지 화면 코드
 * 때문인지 구분하기 어렵다 — 이 파일이 먼저 통과해야 그 구분이 명확해진다.
 */
import React from "react";
import { render } from "@testing-library/react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

describe("react-native-svg jest mock", () => {
  it("Svg/Circle/Path/Rect 조합이 예외 없이 렌더링된다", () => {
    const result = render(
      <Svg width={10} height={10} viewBox="0 0 10 10">
        <Circle cx={5} cy={5} r={2} fill="#000" />
        <Rect x={0} y={0} width={10} height={10} />
        <Path d="M0 0 L10 10" stroke="#000" />
      </Svg>
    );
    expect(result.toJSON()).toBeTruthy();
  });
});
