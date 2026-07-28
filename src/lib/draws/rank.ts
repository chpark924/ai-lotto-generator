import { overlapCount } from "../lottery/similarity";
import type { WinningDraw } from "./types";

/** 로또 6/45 공식 등수 규칙. 0은 낙첨을 의미한다. */
export function computeRank(numbers: number[], draw: WinningDraw): 0 | 1 | 2 | 3 | 4 | 5 {
  const matchCount = overlapCount(numbers, draw.numbers);
  const bonusMatch = numbers.includes(draw.bonusNumber);

  if (matchCount === 6) return 1;
  if (matchCount === 5 && bonusMatch) return 2;
  if (matchCount === 5) return 3;
  if (matchCount === 4) return 4;
  if (matchCount === 3) return 5;
  return 0;
}

export const RANK_LABELS: Record<number, string> = {
  0: "낙첨",
  1: "1등",
  2: "2등",
  3: "3등",
  4: "4등",
  5: "5등",
};
