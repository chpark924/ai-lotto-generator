/**
 * 기획서 15장 확률 표시 로직.
 * 탐색 횟수는 절대 이 계산에 관여하지 않는다 — 오직 "고유하게 저장/구매한 조합 수"만 사용한다.
 */
import type { ProbabilitySummary } from "./types";

export const TOTAL_COMBINATIONS = 8_145_060;

export function calculateFirstPrizeProbability(uniqueGameCount: number): ProbabilitySummary {
  if (uniqueGameCount <= 0) {
    return {
      uniqueGameCount: 0,
      firstPrizeFraction: "0",
      firstPrizePercent: 0,
    };
  }

  return {
    uniqueGameCount,
    firstPrizeFraction: `${uniqueGameCount} / ${TOTAL_COMBINATIONS.toLocaleString("ko-KR")}`,
    firstPrizePercent: (uniqueGameCount / TOTAL_COMBINATIONS) * 100,
  };
}

/** 후보 탐색 범위(당첨 확률이 아님)를 계산한다. */
export function calculateCoveragePercent(uniqueCandidateCount: number): number {
  return (uniqueCandidateCount / TOTAL_COMBINATIONS) * 100;
}

export const PROBABILITY_DISCLAIMER =
  "탐색 범위는 내부적으로 검토한 후보의 비율입니다. 탐색 횟수가 늘어나도 개별 조합의 당첨 확률은 동일합니다. 로또 6/45의 모든 조합은 1/8,145,060의 동일한 확률을 가집니다.";
