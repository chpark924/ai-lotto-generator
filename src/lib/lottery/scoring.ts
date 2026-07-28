/**
 * 기획서 7.5 점수 계산 (추천 적합도 — 당첨 확률이 아니다).
 *
 * 원래 기획서는 "다른 사용자와의 차별성"을 서버에 쌓인 전체 사용자 집계로 계산하지만,
 * 이 빌드는 서버가 없으므로(비용 최소화 원칙) 다음 두 가지 로컬 데이터만 사용한다.
 *  1) 기기에 캐시된 과거 당첨번호 통계에서 파생한 "생일번호(1~31) 편중 / 보기 좋은 패턴" 휴리스틱
 *  2) 사용자가 이 기기에 저장한 나의 번호 목록
 * 따라서 userUniquenessScore는 "실제 타 사용자 데이터"가 아니라 "일반적으로 많이 쓰이는
 * 번호 선택 패턴을 얼마나 피했는가"를 의미하는 근사치임을 UI 상에서 분명히 표기해야 한다.
 */
import type { CandidateScore, ConsecutiveRule, GenerationRequest } from "./types";
import { getMaxConsecutiveLength, getNumberSum, getOddCount, getSectionCounts } from "./pattern";
import { isConsecutiveRuleSatisfied } from "./validators";
import { maxOverlapAgainstList } from "./similarity";

export interface ScoringContext {
  request: GenerationRequest;
  /** 1~45번 각각의 "흔한 선택" 정도 (0~1). 값이 클수록 통상적으로 많이 선택되는 번호. */
  popularityByNumber: number[];
  /** 사용자가 기기에 저장해 둔 기존 조합들 (최근 50개 이하 권장). */
  savedCombinations: number[][];
  /** 이번 실행에서 지금까지 선택된 후보들 (조합 간 차별성 계산용). */
  selectedSoFar: number[][];
}

function conditionMatchScore(numbers: number[], request: GenerationRequest): number {
  let score = 100;

  if (request.oddCount !== undefined) {
    const diff = Math.abs(getOddCount(numbers) - request.oddCount);
    score -= diff * 12;
  }

  if (request.minSum !== undefined || request.maxSum !== undefined) {
    const sum = getNumberSum(numbers);
    const min = request.minSum ?? 0;
    const max = request.maxSum ?? 999;
    if (sum < min) score -= (min - sum) * 0.6;
    if (sum > max) score -= (sum - max) * 0.6;
  }

  const maxConsecutive = getMaxConsecutiveLength(numbers);
  if (!isConsecutiveRuleSatisfied(maxConsecutive, request.consecutiveRule)) {
    score -= 30;
  }

  if (request.preferredNumbers.length > 0) {
    const included = numbers.filter((n) => request.preferredNumbers.includes(n)).length;
    score += included * 5;
  }

  return clamp(score);
}

function diversityScore(numbers: number[]): number {
  // 구간(1~10,11~20,...,41~45)에 고르게 퍼져 있을수록 높은 점수.
  const sections = getSectionCounts(numbers);
  const mean = numbers.length / sections.length;
  const variance = sections.reduce((sum, c) => sum + (c - mean) ** 2, 0) / sections.length;
  // variance가 낮을수록(고르게 분포) 높은 점수
  return clamp(100 - variance * 20);
}

function userUniquenessScore(numbers: number[], popularityByNumber: number[]): number {
  const avgPopularity =
    numbers.reduce((sum, n) => sum + (popularityByNumber[n - 1] ?? 0), 0) / numbers.length;
  // 인기도가 낮을수록(=흔하지 않을수록) 높은 점수
  return clamp((1 - avgPopularity) * 100);
}

function personalNoveltyScore(numbers: number[], savedCombinations: number[][]): number {
  if (savedCombinations.length === 0) return 100;
  const maxOverlap = maxOverlapAgainstList(numbers, savedCombinations);
  return clamp(100 - maxOverlap * 20);
}

function balanceScore(numbers: number[]): number {
  // 극단적 편향(전부 홀수/짝수, 전부 저번호 등) 페널티
  const oddCount = getOddCount(numbers);
  const oddBalancePenalty = Math.abs(oddCount - 3) * 8;
  const sections = getSectionCounts(numbers);
  const emptySections = sections.filter((c) => c === 0).length;
  const sectionPenalty = emptySections * 6;
  return clamp(100 - oddBalancePenalty - sectionPenalty);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function scoreCandidate(numbers: number[], context: ScoringContext): CandidateScore {
  const conditionMatch = conditionMatchScore(numbers, context.request);
  const diversity = diversityScore(numbers);
  const userUniqueness = userUniquenessScore(numbers, context.popularityByNumber);
  const personalNovelty = personalNoveltyScore(numbers, context.savedCombinations);
  const balance = balanceScore(numbers);

  const total =
    conditionMatch * 0.35 +
    userUniqueness * 0.25 +
    personalNovelty * 0.15 +
    diversity * 0.15 +
    balance * 0.1;

  return {
    totalScore: Math.round(total * 100) / 100,
    conditionMatchScore: Math.round(conditionMatch),
    diversityScore: Math.round(diversity),
    userUniquenessScore: Math.round(userUniqueness),
    personalNoveltyScore: Math.round(personalNovelty),
    balanceScore: Math.round(balance),
  };
}

export function isConsecutiveRuleOk(numbers: number[], rule: ConsecutiveRule): boolean {
  return isConsecutiveRuleSatisfied(getMaxConsecutiveLength(numbers), rule);
}
