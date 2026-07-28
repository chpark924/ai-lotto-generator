/**
 * 기획서 14장 로또 연구소 - 기본 당첨 통계 / 조합 패턴 통계.
 * 기기에 캐시된 과거 당첨번호만으로 전부 클라이언트에서 계산한다 (서버 집계 없음).
 */
import { getOddCount, getLowNumberCount, getMaxConsecutiveLength } from "../lottery/pattern";
import type { WinningDraw } from "./types";

export interface NumberFrequency {
  number: number;
  totalCount: number;
  bonusCount: number;
  lastDrawNumber: number | null;
}

export function computeNumberFrequencies(draws: WinningDraw[]): NumberFrequency[] {
  const totals = new Map<number, number>();
  const bonuses = new Map<number, number>();
  const lastSeen = new Map<number, number>();

  for (const draw of draws) {
    for (const n of draw.numbers) {
      totals.set(n, (totals.get(n) ?? 0) + 1);
      if (!lastSeen.has(n) || draw.drawNumber > (lastSeen.get(n) ?? 0)) {
        lastSeen.set(n, draw.drawNumber);
      }
    }
    bonuses.set(draw.bonusNumber, (bonuses.get(draw.bonusNumber) ?? 0) + 1);
  }

  return Array.from({ length: 45 }, (_, i) => i + 1).map((number) => ({
    number,
    totalCount: totals.get(number) ?? 0,
    bonusCount: bonuses.get(number) ?? 0,
    lastDrawNumber: lastSeen.get(number) ?? null,
  }));
}

/** 장기간 나오지 않은 번호 (미출현 회차 수 기준 내림차순). */
export function getLongestAbsentNumbers(
  frequencies: NumberFrequency[],
  latestDrawNumber: number,
  topN = 10
): { number: number; drawsSinceLastSeen: number }[] {
  return frequencies
    .map((f) => ({
      number: f.number,
      drawsSinceLastSeen: f.lastDrawNumber ? latestDrawNumber - f.lastDrawNumber : latestDrawNumber,
    }))
    .sort((a, b) => b.drawsSinceLastSeen - a.drawsSinceLastSeen)
    .slice(0, topN);
}

export interface CombinationPatternStats {
  averageOddCount: number;
  averageLowCount: number;
  averageSum: number;
  consecutiveRatio: number; // 연속번호를 포함한 회차 비율 (0~1)
}

export function computeCombinationPatternStats(draws: WinningDraw[]): CombinationPatternStats {
  if (draws.length === 0) {
    return { averageOddCount: 0, averageLowCount: 0, averageSum: 0, consecutiveRatio: 0 };
  }

  let oddSum = 0;
  let lowSum = 0;
  let numberSum = 0;
  let consecutiveDraws = 0;

  for (const draw of draws) {
    oddSum += getOddCount(draw.numbers);
    lowSum += getLowNumberCount(draw.numbers);
    numberSum += draw.numbers.reduce((s, n) => s + n, 0);
    if (getMaxConsecutiveLength(draw.numbers) >= 2) consecutiveDraws += 1;
  }

  return {
    averageOddCount: oddSum / draws.length,
    averageLowCount: lowSum / draws.length,
    averageSum: numberSum / draws.length,
    consecutiveRatio: consecutiveDraws / draws.length,
  };
}

/**
 * 점수 엔진의 userUniquenessScore(기획서 7.5, 13.4)에서 쓰는 "흔한 선택" 근사치.
 *
 * 주의: 이 값은 실제 타 사용자 선택 데이터의 서버 집계가 아니다(서버가 없으므로 수집 자체를
 * 하지 않는다). 대신 기획서 11.3/13.4에 설명된 일반적인 번호 선택 편향(생일번호 1~31 쏠림,
 * 보기 좋은 패턴 선호)을 정적 규칙으로 근사한 값이며, 실제 당첨 여부와는 무관하다.
 * UI에는 반드시 "일반적인 선택 편향 근사치"라고 표기해야 한다.
 */
export function buildPopularityHeuristic(): number[] {
  const byNumber = new Array(45).fill(0.3); // 기본값

  for (let n = 1; n <= 45; n += 1) {
    let score = 0.3;
    if (n <= 31) score += 0.35; // 생일번호(1~31) 쏠림
    if (n % 10 === 0) score += 0.1; // 10,20,30,40 같은 정갈한 숫자 선호
    if (n === 7) score += 0.15; // 전통적 행운번호
    if (n === 3 || n === 8) score += 0.05;
    if (n >= 41) score -= 0.1; // 41~45는 상대적으로 덜 선택되는 경향
    byNumber[n - 1] = Math.max(0, Math.min(1, score));
  }
  return byNumber;
}

/** 참고용: 과거 당첨 데이터 내 실제 출현 빈도(무작위 추첨 결과이므로 편향의 증거가 아니다). */
export function buildHistoricalFrequencyRatio(draws: WinningDraw[]): number[] {
  const frequencies = computeNumberFrequencies(draws);
  const max = Math.max(1, ...frequencies.map((f) => f.totalCount));
  const byNumber = new Array(45).fill(0);
  for (const f of frequencies) {
    byNumber[f.number - 1] = f.totalCount / max;
  }
  return byNumber;
}
