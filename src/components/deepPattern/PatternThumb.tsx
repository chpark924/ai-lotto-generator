import React from "react";
import Svg, { Circle, Path } from "react-native-svg";
import { buildCanonicalPath } from "../../lib/deepPattern/coordinates";
import { useAppTheme } from "../../theme";

/**
 * 결과 리스트 카드용 미니 패턴 미리보기. 45칸 그리드는 생략하고, canonical path의 점 6개와
 * 연결선만 단순화해서 보여준다(상세 화면의 PatternBoard와 달리 장식/미리보기 목적).
 */
export function PatternThumb({
  numbers,
  size = 60,
  highlighted = false,
}: {
  numbers: number[];
  size?: number;
  highlighted?: boolean;
}) {
  const { colors } = useAppTheme();
  const path = buildCanonicalPath(numbers);
  // 7열×7행 좌표를 size 안에 여백을 두고 정규화한다.
  const padding = size * 0.14;
  const usable = size - padding * 2;
  const points = path.map((p) => ({
    x: padding + ((p.col - 0.5) / 7) * usable,
    y: padding + ((p.row - 0.5) / 7) * usable,
  }));
  const d = points.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" ");
  const lineColor = highlighted ? "#6C5CE7" : colors.textMuted;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Path d={d} stroke={lineColor} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((pt, i) => (
        <Circle key={i} cx={pt.x} cy={pt.y} r={2.6} fill="#6C5CE7" />
      ))}
    </Svg>
  );
}
