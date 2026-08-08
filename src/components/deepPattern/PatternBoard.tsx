import React from "react";
import Svg, { Path, Rect, Text as SvgText } from "react-native-svg";
import { getAllPaperCells, buildCanonicalPath, getPaperPosition, toPixel, getBoardSize } from "../../lib/deepPattern/coordinates";
import { getBallColor } from "../../constants/lottery";
import { useAppTheme } from "../../theme";

const CELL = 26;
const GAP = 4;
const MARGIN = 14;
const CELL_SIZE = CELL + GAP;

/** 선택된 번호 6개의 공 배경 위에서 잘 읽히는 텍스트 색 (LottoBall과 동일한 구간 기준). */
function ballTextColor(n: number): string {
  if (n <= 10) return "#5C4400"; // 노랑
  if (n <= 20) return "#00435C"; // 파랑
  if (n <= 40) return "#fff"; // 빨강/회색
  return "#3C4F00"; // 초록
}

/**
 * 딥 패턴 상세 화면의 "로또 용지 마킹칸 시각화". 실제 로또 마킹 용지 배열(7열×7행, 43~45는
 * 마지막 줄 3칸만 사용)을 그대로 재현하고, 선택된 6개 번호를 강조한 뒤 canonical path로 잇는다.
 */
export function PatternBoard({ numbers }: { numbers: number[] }) {
  const { colors } = useAppTheme();
  const size = getBoardSize(CELL_SIZE, MARGIN);
  const selected = new Set(numbers);
  const cells = getAllPaperCells();
  const path = buildCanonicalPath(numbers);
  const pathD = path
    .map((p, i) => {
      const { x, y } = toPixel(p, CELL_SIZE, MARGIN);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const sortedNumbers = [...numbers].sort((a, b) => a - b);

  return (
    <Svg viewBox={`0 0 ${size} ${size}`} width="100%" height={size}>
      {cells
        .filter((cell) => !selected.has(cell.number))
        .map((cell) => {
          const { x, y } = toPixel(cell, CELL_SIZE, MARGIN);
          return (
            <React.Fragment key={cell.number}>
              <Rect
                x={x - CELL / 2}
                y={y - CELL / 2}
                width={CELL}
                height={CELL}
                rx={5}
                fill={colors.surface}
                stroke={colors.border}
                strokeWidth={1}
              />
              <SvgText x={x} y={y + 3} fontSize={9} textAnchor="middle" fill={colors.textMuted}>
                {String(cell.number).padStart(2, "0")}
              </SvgText>
            </React.Fragment>
          );
        })}

      <Path d={pathD} fill="none" stroke="#6C5CE7" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

      {sortedNumbers.map((n) => {
        const { x, y } = toPixel(getPaperPosition(n), CELL_SIZE, MARGIN);
        return (
          <React.Fragment key={n}>
            <Rect
              x={x - CELL / 2 - 1}
              y={y - CELL / 2 - 1}
              width={CELL + 2}
              height={CELL + 2}
              rx={6}
              fill={getBallColor(n)}
            />
            <SvgText
              x={x}
              y={y + 3.5}
              fontSize={10.5}
              fontWeight="700"
              textAnchor="middle"
              fill={ballTextColor(n)}
            >
              {String(n).padStart(2, "0")}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}
