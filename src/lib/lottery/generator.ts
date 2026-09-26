/**
 * 공통 번호 생성 엔진 (기획서 5장, 7장).
 *
 * 중요 원칙 (기획서 7.2, 이 프로젝트의 비용 최소화 지침):
 *  - AI 언어모델에 번호 생성을 요청하지 않는다.
 *  - 모든 후보 생성/점수 계산/선별은 기기(클라이언트) 내부의 순수 JS로 수행한다.
 *  - "AI 탐색/AI 정밀 탐색"이라는 이름은 사용자 경험상의 네이밍일 뿐,
 *    실제로는 로컬 난수 엔진 + 규칙 기반 점수 엔진이다.
 */
import { pickOne, randomInt, securePartialShuffle } from "./random";
import { buildGameMetadata } from "./pattern";
import { combinationKey, maxOverlapAgainstList } from "./similarity";
import { calculateCoveragePercent, calculateFirstPrizeProbability, PROBABILITY_DISCLAIMER } from "./probability";
import { scoreCandidate, isConsecutiveRuleOk, stretchScoresForDisplay, type ScoringContext } from "./scoring";
import { validateGenerationRequest } from "./validators";
import type {
  GeneratedGame,
  GenerationRequest,
  GenerationResult,
} from "./types";

let gameIdCounter = 0;
function nextGameId(): string {
  gameIdCounter += 1;
  return `game_${Date.now()}_${gameIdCounter}`;
}

/**
 * 기획서 5.4 기본 무작위 추출 함수.
 * 제외/필수번호만 반영한, 조건 없는 순수 무작위 6개 추출.
 *
 * `mustIncludeOneOfSets`: 각 원소가 "이 집합 중 최소 1개는 반드시 포함" 제약이다. AI 조합
 * 탐색의 "고빈도 당첨번호 상위권 포함" / "장기 미출현번호 포함" 토글이 이 파라미터를 통해
 * 반영된다. required(필수번호)가 이미 그 세트를 만족하면 추가로 강제하지 않는다. 세트
 * 전체가 제외번호/이미 강제된 번호와 겹쳐 고를 수 있는 후보가 없으면 그 세트의 제약은
 * 조용히 건너뛴다(예: 사용자가 상위 10개 번호를 전부 제외번호로 지정한 극단적인 경우) —
 * 생성 자체가 실패하지 않도록 하는 안전한 폴백이다.
 */
export function generatePureRandom(
  excludedNumbers: number[] = [],
  requiredNumbers: number[] = [],
  mustIncludeOneOfSets: number[][] = []
): number[] {
  const excluded = new Set(excludedNumbers);
  const required = [...new Set(requiredNumbers)];

  if (required.length > 6) {
    throw new Error("필수번호는 최대 6개까지 설정할 수 있습니다.");
  }

  const forced = [...required];
  for (const set of mustIncludeOneOfSets) {
    if (forced.some((n) => set.includes(n))) continue;
    const candidates = set.filter((n) => !excluded.has(n) && !forced.includes(n));
    if (candidates.length === 0) continue;
    forced.push(pickOne(candidates));
  }

  if (forced.length > 6) {
    throw new Error("필수번호와 포함 조건을 합쳐 6개를 초과합니다.");
  }

  const available = Array.from({ length: 45 }, (_, index) => index + 1)
    .filter((n) => !excluded.has(n))
    .filter((n) => !forced.includes(n));

  if (available.length + forced.length < 6) {
    throw new Error("번호를 생성할 수 있는 후보가 부족합니다.");
  }

  const remainingCount = 6 - forced.length;
  const selected = securePartialShuffle(available, remainingCount);
  return [...forced, ...selected].sort((a, b) => a - b);
}

function buildGeneratedGame(
  numbers: number[],
  mode: GenerationRequest["mode"],
  score?: ReturnType<typeof scoreCandidate>
): GeneratedGame {
  return {
    id: nextGameId(),
    numbers,
    mode,
    score,
    metadata: buildGameMetadata(numbers),
  };
}

/** 서로 다른 고유 조합을 gameCount개 생성한다 (완전 무작위 / 제외하고 생성 모드). */
export function generateUniqueBasicGames(request: GenerationRequest): GeneratedGame[] {
  validateGenerationRequest(request);
  const seen = new Set<string>();
  const games: GeneratedGame[] = [];
  let guard = 0;

  while (games.length < request.gameCount && guard < request.gameCount * 200 + 1000) {
    guard += 1;
    const numbers = generatePureRandom(
      request.excludedNumbers,
      request.requiredNumbers,
      request.mustIncludeOneOfSets ?? []
    );
    const key = combinationKey(numbers);
    if (seen.has(key)) continue;
    seen.add(key);
    games.push(buildGeneratedGame(numbers, request.mode));
  }

  return games;
}

/**
 * AI 조합 탐색은 크게 세 단계를 거친다: 후보 생성(GENERATING) → 점수 계산(SCORING) →
 * 정렬/중복조합 제거로 최종 선정(FINALIZING). 예전에는 후보 생성 단계만 진행률을 보고했는데,
 * 탐색 강도가 높을 때(특히 100만 회) 후보 생성이 100%를 찍은 뒤에도 점수 계산·정렬이
 * 수 초간 더 걸려서 화면이 "100%에서 멈춘 것처럼" 보이는 문제가 있었다. 이제는 세 단계를
 * 합쳐 0~100 사이 단조 증가하는 하나의 percent로 보고하고, 실제로 결과가 준비된 시점에만
 * 100에 도달한다.
 */
export type AiSearchPhase = "GENERATING" | "SCORING" | "FINALIZING";

// 단계별 진행률 배분 — 실측 기준은 아니고(기기마다 다름), "멈춘 것처럼 보이지 않게
// 항상 뭔가 움직인다"는 목적에 맞춘 근사치다. 점수 계산은 저장번호 대비 중복 검사 등이
// 있어 후보 1개당 비용이 생성보다 가볍지 않다고 보고 넉넉히 배분했다.
const PROGRESS_WEIGHT = { GENERATING: 70, SCORING: 25, FINALIZING: 5 } as const;

export interface AiSearchOptions {
  popularityByNumber: number[];
  savedCombinations: number[][];
  /** 진행 상황 콜백 (UI 스레드 블로킹 방지 겸용). percent는 0~100 전 구간에서 단조 증가한다. */
  onProgress?: (percent: number, phase: AiSearchPhase) => void;
  /** 한 번에 동기 처리할 후보 수. 값이 클수록 빠르지만 UI가 잠깐 멈출 수 있다. */
  batchSize?: number;
  /**
   * "다음 회차 통계 전략" 게임의 강제 포함 후보 풀(호출부인 ai-search.tsx가 로또연구소
   * "이번 회차 번호 이후 통계"와 동일한 계산으로 미리 구해서 넘긴다 — generator.ts 자체는
   * 당첨 데이터에 접근하지 않는다는 원칙을 그대로 지킨다, mustIncludeOneOfSets와 동일한
   * 이유). 비어 있거나 생략되면(탐색 1회거나 게임 수 1개일 때 등) 이 기능 자체가 꺼진다.
   */
  transitionStrategyPool?: number[];
}

/** "다음 회차 통계 전략" 게임이 pool에서 강제로 포함할 번호 개수 범위(2~4개, 매번 무작위). */
const TRANSITION_STRATEGY_MIN_FROM_POOL = 2;
const TRANSITION_STRATEGY_MAX_FROM_POOL = 4;
/** 연속번호 규칙/다른 게임과의 중복 회피 조건을 만족하는 조합을 찾기 위한 최대 재시도 횟수. */
const TRANSITION_STRATEGY_MAX_ATTEMPTS = 300;

/**
 * "다음 회차 통계 전략" 게임 전용 구성 함수.
 *
 * AI 조합 탐색이 고르는 나머지 게임들과 달리 점수 기반 랭킹으로 선택되지 않는다 — `pool`
 * (로또연구소 "이번 회차 번호 이후 통계"와 동일하게 호출부가 미리 계산해 넘긴, 최신
 * 당첨번호 각각의 다음 회차 상위 후보 번호 집합)에서 2~4개를 강제로 포함시키고, 나머지는
 * 완전 무작위(풀퍼지)로 채운다. 이 통계는 표본 크기가 유한해서 생기는 노이즈일 뿐이라는
 * 점이 코드베이스에서 가장 강하게 강조된 통계라(drawStats.ts의 computeTransitionFrequencies
 * 주석 참고), 점수 계산에는 전혀 관여하지 않는다 — 이 함수가 만든 조합에는 score를 아예
 * 설정하지 않아(generateAiSearchGames 참고) "적합도 순위로 뽑힌 게 아니다"를 명확히 한다.
 *
 * 사용자가 설정한 제외번호·필수번호·연속번호 규칙, 그리고 같은 배치의 다른 게임들과 4개
 * 이상 겹치지 않는 다양성 규칙(generateAiSearchGames와 동일 기준)은 그대로 지킨다. 극단적인
 * 경우(제외번호가 pool 대부분을 잡아먹는 등) 유효한 조합을 못 찾으면 null을 반환한다 —
 * 호출부는 이번 탐색에서 특별 슬롯 없이 나머지 게임만 반환하는 것으로 조용히 폴백한다
 * (mustIncludeOneOfSets와 동일한 안전 원칙 — 생성 자체가 실패하지 않는 게 우선이다).
 */
function generateTransitionStrategyNumbers(
  pool: number[],
  request: Pick<GenerationRequest, "excludedNumbers" | "requiredNumbers" | "consecutiveRule">,
  otherGamesNumbers: number[][]
): number[] | null {
  const excluded = new Set(request.excludedNumbers);
  const required = [...new Set(request.requiredNumbers)];
  if (required.length > 6) return null;

  const availablePoolNumbers = pool.filter((n) => !excluded.has(n) && n >= 1 && n <= 45);
  if (availablePoolNumbers.length === 0) return null;

  for (let attempt = 0; attempt < TRANSITION_STRATEGY_MAX_ATTEMPTS; attempt += 1) {
    const forced = [...required];

    const alreadyFromPool = forced.filter((n) => availablePoolNumbers.includes(n)).length;
    const target = randomInt(TRANSITION_STRATEGY_MIN_FROM_POOL, TRANSITION_STRATEGY_MAX_FROM_POOL + 1);
    const stillNeeded = Math.max(0, target - alreadyFromPool);

    const poolCandidates = availablePoolNumbers.filter((n) => !forced.includes(n));
    const room = 6 - forced.length;
    const toForce = Math.min(stillNeeded, poolCandidates.length, room);
    if (toForce > 0) {
      forced.push(...securePartialShuffle(poolCandidates, toForce));
    }

    const remainingCount = 6 - forced.length;
    const restAvailable = Array.from({ length: 45 }, (_, i) => i + 1)
      .filter((n) => !excluded.has(n))
      .filter((n) => !forced.includes(n));
    if (restAvailable.length < remainingCount) continue;

    const rest = securePartialShuffle(restAvailable, remainingCount);
    const numbers = [...forced, ...rest].sort((a, b) => a - b);

    if (!isConsecutiveRuleOk(numbers, request.consecutiveRule)) continue;
    if (maxOverlapAgainstList(numbers, otherGamesNumbers) >= 4) continue;
    const key = combinationKey(numbers);
    if (otherGamesNumbers.some((g) => combinationKey(g) === key)) continue;

    return numbers;
  }
  return null;
}

/**
 * 기획서 7장 AI 조합 탐색.
 * 방법 B(지정 횟수만 생성)를 사용한다 — MVP에 적합하고 구현이 단순하다 (기획서 7.3).
 */
export async function generateAiSearchGames(
  request: GenerationRequest,
  options: AiSearchOptions
): Promise<GenerationResult> {
  validateGenerationRequest(request);
  const requestedIterations = request.searchCount ?? 30000;
  const batchSize = options.batchSize ?? 500;

  // "다음 회차 통계 전략" 게임은 점수 기반 선택 밖에서 별도로 구성되므로, 아래 후보
  // 생성/점수 계산/선별 단계는 이 슬롯 1개를 뺀 나머지 게임 수만 채우면 된다(게임 수가
  // 1개면 "여러 게임 중 1개만 다르게"라는 전제 자체가 성립하지 않아 자동으로 꺼진다 —
  // ai-search.tsx의 resolveTransitionStrategyPool도 동일 조건으로 이미 걸러서 넘긴다).
  const wantsTransitionStrategySlot =
    (options.transitionStrategyPool?.length ?? 0) > 0 && request.gameCount >= 2;
  const normalGameCount = wantsTransitionStrategySlot ? request.gameCount - 1 : request.gameCount;

  const uniqueCandidates = new Map<string, number[]>();
  const validCandidates: number[][] = [];
  let completed = 0;

  while (completed < requestedIterations) {
    const currentBatch = Math.min(batchSize, requestedIterations - completed);
    for (let i = 0; i < currentBatch; i += 1) {
      const numbers = generatePureRandom(
        request.excludedNumbers,
        request.requiredNumbers,
        request.mustIncludeOneOfSets ?? []
      );
      const key = combinationKey(numbers);
      if (!uniqueCandidates.has(key)) {
        uniqueCandidates.set(key, numbers);
        if (isConsecutiveRuleOk(numbers, request.consecutiveRule)) {
          validCandidates.push(numbers);
        }
      }
    }
    completed += currentBatch;
    const generatingPercent = Math.round((completed / requestedIterations) * PROGRESS_WEIGHT.GENERATING);
    options.onProgress?.(generatingPercent, "GENERATING");
    // 다음 배치 전에 이벤트 루프에 제어권을 양보해 UI 프리징을 방지한다.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const scoringContext: ScoringContext = {
    request,
    popularityByNumber: options.popularityByNumber,
    savedCombinations: options.savedCombinations,
    selectedSoFar: [],
  };

  const pool = validCandidates.length > 0 ? validCandidates : [...uniqueCandidates.values()];

  // 점수 계산도 후보 생성과 마찬가지로 배치+양보 방식으로 처리한다. 예전엔 pool.map()으로
  // 한 번에 전부(최대 100만 개) 동기 계산해서, 후보 생성이 100%를 찍은 뒤에도 화면이
  // 얼어붙은 것처럼 수 초간 반응이 없었다.
  const scored: { numbers: number[]; score: ReturnType<typeof scoreCandidate> }[] = [];
  for (let i = 0; i < pool.length; i += batchSize) {
    const end = Math.min(i + batchSize, pool.length);
    for (let j = i; j < end; j += 1) {
      scored.push({ numbers: pool[j], score: scoreCandidate(pool[j], scoringContext) });
    }
    const scoringPercent =
      PROGRESS_WEIGHT.GENERATING + Math.round((end / Math.max(pool.length, 1)) * PROGRESS_WEIGHT.SCORING);
    options.onProgress?.(scoringPercent, "SCORING");
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  options.onProgress?.(PROGRESS_WEIGHT.GENERATING + PROGRESS_WEIGHT.SCORING, "FINALIZING");
  scored.sort((a, b) => b.score.totalScore - a.score.totalScore);

  // 상위 1~5% 후보만 남긴다 (최소 gameCount * 3, 최대 전체 pool).
  const topSliceSize = Math.max(
    normalGameCount * 3,
    Math.ceil(scored.length * 0.05)
  );
  const topCandidates = scored.slice(0, Math.min(topSliceSize, scored.length));

  // 서로 4개 이상 겹치는 후보를 제거하며 상위 점수 순으로 채택한다 (기획서 7.6).
  const chosen: typeof topCandidates = [];
  for (const candidate of topCandidates) {
    if (chosen.length >= normalGameCount) break;
    const overlapTooHigh =
      maxOverlapAgainstList(
        candidate.numbers,
        chosen.map((c) => c.numbers)
      ) >= 4;
    if (!overlapTooHigh) {
      chosen.push(candidate);
    }
  }
  // 조건이 너무 강해 normalGameCount를 못 채운 경우, 남은 후보로 보충한다.
  if (chosen.length < normalGameCount) {
    for (const candidate of topCandidates) {
      if (chosen.length >= normalGameCount) break;
      if (!chosen.includes(candidate)) chosen.push(candidate);
    }
  }

  // 최종 채택된 후보끼리는 원점수가 서로 몰려 있기 쉬우므로, 화면에 보여줄 총점만
  // 상대적 우열은 유지한 채 체감 가능한 폭으로 펼친다(구성요소별 세부 점수는 그대로 둔다).
  const displayTotals = stretchScoresForDisplay(chosen.map((c) => c.score.totalScore));
  const games = chosen.map((c, i) =>
    buildGeneratedGame(c.numbers, request.mode, { ...c.score, totalScore: displayTotals[i] })
  );

  // 항상 정확히 1개만, 맨 마지막에 덧붙인다 — 게임 수가 5개든 10개든 "특별 전략" 취지가
  // 옅어지지 않도록 개수는 늘리지 않는다. score는 설정하지 않는다(위 함수 주석 참고) —
  // GeneratedGameCard.tsx/accessibilitySummary.ts 둘 다 score가 없는 게임을 이미
  // 정상적으로(적합도 영역만 자연스럽게 숨기고) 처리하므로 UI 쪽 추가 분기가 필요 없다.
  if (wantsTransitionStrategySlot) {
    const transitionNumbers = generateTransitionStrategyNumbers(
      options.transitionStrategyPool!,
      request,
      games.map((g) => g.numbers)
    );
    if (transitionNumbers) {
      games.push({
        id: nextGameId(),
        numbers: transitionNumbers,
        mode: request.mode,
        metadata: buildGameMetadata(transitionNumbers),
        specialStrategy: "TRANSITION_STATS",
      });
    }
    // transitionNumbers가 null이면(극단적인 제외번호 설정 등) 조용히 포기한다 — 이번
    // 탐색은 요청한 gameCount보다 1개 적은 결과를 반환하게 되지만, 생성 자체가 실패하는
    // 것보다는 낫다(mustIncludeOneOfSets와 동일한 폴백 철학).
  }

  const coveragePercent = calculateCoveragePercent(uniqueCandidates.size);
  const probability = calculateFirstPrizeProbability(games.length);

  // 실제로 결과가 준비된 이 시점에만 100%를 보고한다 — 화면이 "100%에서 멈춘 것처럼"
  // 보이던 원인이 바로 이 마무리 단계에 진행률 보고가 전혀 없었던 것이었다.
  options.onProgress?.(100, "FINALIZING");

  return {
    requestId: nextGameId(),
    games,
    simulation: {
      requestedIterations,
      completedIterations: completed,
      uniqueCandidateCount: uniqueCandidates.size,
      validCandidateCount: validCandidates.length,
      coveragePercent,
    },
    probability,
    disclaimer: PROBABILITY_DISCLAIMER,
  };
}

/** 조건 없는 즉시 생성 / 제외번호 기반 생성의 결과 포맷을 통일한다. */
export function buildBasicGenerationResult(request: GenerationRequest): GenerationResult {
  const games = generateUniqueBasicGames(request);
  const probability = calculateFirstPrizeProbability(games.length);
  return {
    requestId: nextGameId(),
    games,
    probability,
    disclaimer: PROBABILITY_DISCLAIMER,
  };
}

export function randomSingleNumberExcluding(excluded: number[]): number {
  const excludedSet = new Set(excluded);
  const available = Array.from({ length: 45 }, (_, i) => i + 1).filter(
    (n) => !excludedSet.has(n)
  );
  if (available.length === 0) {
    throw new Error("선택할 수 있는 번호가 없습니다.");
  }
  return available[randomInt(0, available.length)];
}
