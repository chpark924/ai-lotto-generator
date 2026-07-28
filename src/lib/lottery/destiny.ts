/**
 * 기획서 11장 운명의 신.
 *
 * 목표 당첨자 수는 실제 당첨자 수를 예측/통제하지 않는다. 앱 내부적으로는 이를
 * "조합 인기도 목표값"으로 변환해, 후보 조합 중 목표 인기도에 가장 가까운 것을 고른다.
 * 인기도 계산은 서버 집계가 아니라 기획서 11.3/13.4에 설명된 일반적인 편향
 * (생일번호 쏠림, 보기 좋은 패턴)을 근사한 것이다 — 실제 타 사용자 데이터가 아니다.
 */
import { secureShuffle, randomInt } from "./random";
import { getMaxConsecutiveLength, getSameEndingMaxCount } from "./pattern";
import { maxOverlapAgainstList } from "./similarity";
import { isConsecutiveRuleSatisfied } from "./validators";
import type { ConsecutiveRule } from "./types";

export type DestinyTarget = "ONE" | "FIVE" | "TEN" | "TWENTY" | "CHAOS" | "GODS_WILL";

export const DESTINY_TARGET_LABELS: Record<DestinyTarget, string> = {
  ONE: "단독 당첨자 1명",
  FIVE: "당첨자 5명",
  TEN: "당첨자 10명",
  TWENTY: "당첨자 20명",
  CHAOS: "30명 이상 대혼돈",
  GODS_WILL: "신의 뜻에 맡기기",
};

/** 목표 당첨자 수 -> 목표 인기도(0~100). 값이 낮을수록 "덜 흔한" 조합을 목표로 한다. */
function resolveTargetPopularity(target: DestinyTarget): number {
  switch (target) {
    case "ONE":
      return 12;
    case "FIVE":
      return 32;
    case "TEN":
      return 55;
    case "TWENTY":
      return 78;
    case "CHAOS":
      return 92;
    case "GODS_WILL":
      return randomInt(0, 101);
  }
}

export interface PopularityFeatures {
  numberPopularityScore: number; // 0~100
  birthdayRangeScore: number; // 0~100
  visualPatternScore: number; // 0~100
  savedCombinationSimilarityScore: number; // 0~100
}

/** 기획서 13.4 "보기 좋은 패턴" 근사치. 인기 있다고 단정하지 않고 근사만 한다. */
export function computeVisualPatternScore(numbers: number[]): number {
  let score = 0;
  const maxConsecutive = getMaxConsecutiveLength(numbers);
  if (maxConsecutive >= 3) score += 35;
  else if (maxConsecutive === 2) score += 18;

  const sorted = [...numbers].sort((a, b) => a - b);
  const gaps = new Set<number>();
  for (let i = 1; i < sorted.length; i += 1) gaps.add(sorted[i] - sorted[i - 1]);
  if (gaps.size === 1) score += 20; // 5,10,15 같은 일정 간격

  const sameEndingMax = getSameEndingMaxCount(numbers);
  if (sameEndingMax >= 4) score += 20;
  else if (sameEndingMax === 3) score += 10;

  if (numbers.includes(7)) score += 10; // 전통적 행운번호
  if (numbers.filter((n) => n <= 31).length === 6) score += 15; // 전부 생일번호 범위

  return Math.max(0, Math.min(100, score));
}

export function calculatePopularityScore(features: PopularityFeatures): number {
  return (
    features.numberPopularityScore * 0.4 +
    features.birthdayRangeScore * 0.2 +
    features.visualPatternScore * 0.15 +
    features.savedCombinationSimilarityScore * 0.25
  );
}

export function buildPopularityFeatures(
  numbers: number[],
  popularityByNumber: number[],
  savedCombinations: number[][]
): PopularityFeatures {
  const numberPopularityScore =
    (numbers.reduce((sum, n) => sum + (popularityByNumber[n - 1] ?? 0), 0) / numbers.length) * 100;
  const birthdayRangeScore = (numbers.filter((n) => n <= 31).length / numbers.length) * 100;
  const visualPatternScore = computeVisualPatternScore(numbers);
  const savedCombinationSimilarityScore =
    savedCombinations.length > 0
      ? (maxOverlapAgainstList(numbers, savedCombinations) / 6) * 100
      : 0;

  return { numberPopularityScore, birthdayRangeScore, visualPatternScore, savedCombinationSimilarityScore };
}

export interface DestinyRequest {
  target: DestinyTarget;
  consecutiveRule: ConsecutiveRule;
  excludedNumbers: number[];
  /** true면 선호번호를 후보 풀에서 우대한다. */
  usePreferredNumbers: boolean;
  preferredNumbers: number[];
  popularityByNumber: number[];
  savedCombinations: number[][];
  /** 탐색할 후보 수. 값이 클수록 목표 인기도에 더 가까운 조합을 찾을 확률이 높아진다. */
  candidatePoolSize?: number;
}

export interface DestinyResult {
  numbers: number[];
  targetPopularity: number;
  candidatePopularity: number;
  scenarioFit: number;
}

function generateCandidate(excluded: number[], preferred: number[], usePreferred: boolean): number[] {
  const excludedSet = new Set(excluded);
  const available = Array.from({ length: 45 }, (_, i) => i + 1).filter((n) => !excludedSet.has(n));

  if (usePreferred && preferred.length > 0) {
    const validPreferred = preferred.filter((n) => !excludedSet.has(n));
    const preferredCount = Math.min(validPreferred.length, 2);
    const chosenPreferred = secureShuffle(validPreferred).slice(0, preferredCount);
    const remaining = available.filter((n) => !chosenPreferred.includes(n));
    const rest = secureShuffle(remaining).slice(0, 6 - chosenPreferred.length);
    return [...chosenPreferred, ...rest].sort((a, b) => a - b);
  }

  return secureShuffle(available).slice(0, 6).sort((a, b) => a - b);
}

/**
 * 목표 시나리오에 가장 가까운 인기도를 가진 조합 하나를 선택한다.
 * 실제 당첨자 수를 예측/통제하는 기능이 아니라, 조합의 "흔함 정도"를 목표에 맞추는 재미 요소다.
 */
export function generateDestinyGame(request: DestinyRequest): DestinyResult {
  const targetPopularity = resolveTargetPopularity(request.target);
  const poolSize = request.candidatePoolSize ?? 2000;

  let best: DestinyResult | null = null;

  for (let i = 0; i < poolSize; i += 1) {
    const numbers = generateCandidate(
      request.excludedNumbers,
      request.preferredNumbers,
      request.usePreferredNumbers
    );

    if (!isConsecutiveRuleSatisfied(getMaxConsecutiveLength(numbers), request.consecutiveRule)) {
      continue;
    }

    const features = buildPopularityFeatures(
      numbers,
      request.popularityByNumber,
      request.savedCombinations
    );
    const candidatePopularity = calculatePopularityScore(features);
    const scenarioFit = 100 - Math.abs(candidatePopularity - targetPopularity);

    if (!best || scenarioFit > best.scenarioFit) {
      best = { numbers, targetPopularity, candidatePopularity, scenarioFit };
    }
  }

  if (!best) {
    throw new Error("조건에 맞는 조합을 찾지 못했습니다. 조건을 완화해주세요.");
  }

  return best;
}
