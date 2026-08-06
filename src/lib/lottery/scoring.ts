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
import {
  getMaxConsecutiveLength,
  getNumberSum,
  getOddCount,
  getSameEndingMaxCount,
  getSectionCounts,
} from "./pattern";
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

/**
 * "끝수(번호의 1의 자리) 스프레드 최적화" 활성화 여부.
 *
 * 사용자가 화면에서 직접 켜고 끄는 옵션이 아니라(내재화됨), AI 조합 탐색의 3만 회/10만 회
 * 탐색에서만 자동으로 적용된다.
 *  - "바로 생성"(searchCount=1)은 후보가 1개뿐이라 점수 기반 선별 자체가 무의미해서 제외.
 *  - "100만 회 부스터 탐색"(searchCount=1,000,000)은 이미 후보 수 자체가 매우 많아 상위
 *    1~5% 선별 단계의 계산 비용이 크므로, 기존에 검증된 가중치 구성과 성능 특성을 그대로
 *    유지하기 위해 제외한다(제품 결정 — 성능/회귀 리스크 최소화).
 *
 * scoreCandidate()의 가중치 배분과 결과 화면 설명 문구("끝수 최적화가 포함되어 있습니다")
 * 노출 여부가 모두 이 함수 하나를 기준으로 판단하므로, 두 기준이 어긋날 일이 없다.
 */
export function isLastDigitSpreadOptimizationActive(
  request: Pick<GenerationRequest, "mode" | "searchCount">
): boolean {
  return request.mode === "AI_SEARCH" && (request.searchCount === 30000 || request.searchCount === 100000);
}

/**
 * 끝수(번호의 1의 자리) 분산 점수. 같은 끝수를 가진 번호가 많이 몰릴수록(예: 5, 15, 25,
 * 35, 45처럼 끝수 5가 몰림) 감점하고, 6개 번호의 끝수가 최대한 서로 다를수록(완전 분산)
 * 만점을 준다. `getSameEndingMaxCount`(pattern.ts)는 이미 GameMetadata 계산에도 쓰이는
 * "동일 끝수 최대 개수" 지표라 그대로 재사용한다.
 */
function lastDigitSpreadScore(numbers: number[]): number {
  const maxSameEnding = getSameEndingMaxCount(numbers);
  return clamp(100 - (maxSameEnding - 1) * 25);
}

export function scoreCandidate(numbers: number[], context: ScoringContext): CandidateScore {
  const conditionMatch = conditionMatchScore(numbers, context.request);
  const diversity = diversityScore(numbers);
  const userUniqueness = userUniquenessScore(numbers, context.popularityByNumber);
  const personalNovelty = personalNoveltyScore(numbers, context.savedCombinations);
  const balance = balanceScore(numbers);

  const lastDigitSpreadActive = isLastDigitSpreadOptimizationActive(context.request);
  const lastDigitSpread = lastDigitSpreadActive ? lastDigitSpreadScore(numbers) : undefined;

  // 끝수 스프레드가 활성화된 경우에만 가중치를 재배분한다(conditionMatch/userUniqueness에서
  // 각각 0.05씩 덜어 새 항목에 0.1을 배정) — 두 경우 모두 합은 항상 1.0으로 유지된다.
  const total = lastDigitSpreadActive
    ? conditionMatch * 0.3 +
      userUniqueness * 0.2 +
      personalNovelty * 0.15 +
      diversity * 0.15 +
      balance * 0.1 +
      (lastDigitSpread ?? 0) * 0.1
    : conditionMatch * 0.35 +
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
    ...(lastDigitSpread !== undefined
      ? { lastDigitSpreadScore: Math.round(lastDigitSpread) }
      : {}),
  };
}

export function isConsecutiveRuleOk(numbers: number[], rule: ConsecutiveRule): boolean {
  return isConsecutiveRuleSatisfied(getMaxConsecutiveLength(numbers), rule);
}

/**
 * "추천 적합도" 화면 표시용 점수 재조정.
 *
 * AI 조합 탐색은 수천~수만 개 후보 중 상위 1~5%만 골라 보여준다. 순위통계 특성상
 * 이렇게 뽑힌 상위권 후보들의 원점수(totalScore)는 서로 매우 가깝게 몰리기 쉽고,
 * 반올림하면 여러 조합이 우연히 같은 점수로 보이는 경우가 흔하다(예: 88점이 반복).
 * 애초에 이 점수는 당첨 확률이 아니라 상대적 추천 지표이므로, 실제 우열 순서는
 * 그대로 유지한 채 사용자가 체감할 수 있는 폭으로 펼쳐서 보여준다.
 */
export function stretchScoresForDisplay(
  scores: number[],
  targetMin = 65,
  targetMax = 98
): number[] {
  if (scores.length === 0) return [];
  if (scores.length === 1) return [Math.round(targetMax)];

  const max = Math.max(...scores);
  const min = Math.min(...scores);

  if (max - min < 1e-6) {
    // 원점수가 사실상 동점이면, 순위 순서대로만 살짝 차등을 준다(입력 순서 = 우열 순서 가정).
    return scores.map((_, i) => Math.max(targetMin, Math.round(targetMax - i * 2)));
  }

  return scores.map((s) => {
    const ratio = (s - min) / (max - min);
    return Math.round(targetMin + ratio * (targetMax - targetMin));
  });
}
