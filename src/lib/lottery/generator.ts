/**
 * 공통 번호 생성 엔진 (기획서 5장, 7장).
 *
 * 중요 원칙 (기획서 7.2, 이 프로젝트의 비용 최소화 지침):
 *  - AI 언어모델에 번호 생성을 요청하지 않는다.
 *  - 모든 후보 생성/점수 계산/선별은 기기(클라이언트) 내부의 순수 JS로 수행한다.
 *  - "AI 탐색/AI 정밀 탐색"이라는 이름은 사용자 경험상의 네이밍일 뿐,
 *    실제로는 로컬 난수 엔진 + 규칙 기반 점수 엔진이다.
 */
import { randomInt, secureShuffle } from "./random";
import { buildGameMetadata } from "./pattern";
import { combinationKey, maxOverlapAgainstList } from "./similarity";
import { calculateCoveragePercent, calculateFirstPrizeProbability, PROBABILITY_DISCLAIMER } from "./probability";
import { scoreCandidate, isConsecutiveRuleOk, type ScoringContext } from "./scoring";
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
 */
export function generatePureRandom(
  excludedNumbers: number[] = [],
  requiredNumbers: number[] = []
): number[] {
  const excluded = new Set(excludedNumbers);
  const required = [...new Set(requiredNumbers)];

  const available = Array.from({ length: 45 }, (_, index) => index + 1)
    .filter((n) => !excluded.has(n))
    .filter((n) => !required.includes(n));

  if (required.length > 6) {
    throw new Error("필수번호는 최대 6개까지 설정할 수 있습니다.");
  }
  if (available.length + required.length < 6) {
    throw new Error("번호를 생성할 수 있는 후보가 부족합니다.");
  }

  const remainingCount = 6 - required.length;
  const selected = secureShuffle(available).slice(0, remainingCount);
  return [...required, ...selected].sort((a, b) => a - b);
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
    const numbers = generatePureRandom(request.excludedNumbers, request.requiredNumbers);
    const key = combinationKey(numbers);
    if (seen.has(key)) continue;
    seen.add(key);
    games.push(buildGeneratedGame(numbers, request.mode));
  }

  return games;
}

export interface AiSearchOptions {
  popularityByNumber: number[];
  savedCombinations: number[][];
  /** 배치 단위로 처리 진행 상황을 알려준다 (UI 스레드 블로킹 방지). */
  onProgress?: (completedIterations: number, requestedIterations: number) => void;
  /** 한 번에 동기 처리할 후보 수. 값이 클수록 빠르지만 UI가 잠깐 멈출 수 있다. */
  batchSize?: number;
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
  const requestedIterations = request.searchCount ?? 10000;
  const batchSize = options.batchSize ?? 500;

  const uniqueCandidates = new Map<string, number[]>();
  const validCandidates: number[][] = [];
  let completed = 0;

  while (completed < requestedIterations) {
    const currentBatch = Math.min(batchSize, requestedIterations - completed);
    for (let i = 0; i < currentBatch; i += 1) {
      const numbers = generatePureRandom(request.excludedNumbers, request.requiredNumbers);
      const key = combinationKey(numbers);
      if (!uniqueCandidates.has(key)) {
        uniqueCandidates.set(key, numbers);
        if (isConsecutiveRuleOk(numbers, request.consecutiveRule)) {
          validCandidates.push(numbers);
        }
      }
    }
    completed += currentBatch;
    options.onProgress?.(completed, requestedIterations);
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
  const scored = pool.map((numbers) => ({
    numbers,
    score: scoreCandidate(numbers, scoringContext),
  }));
  scored.sort((a, b) => b.score.totalScore - a.score.totalScore);

  // 상위 1~5% 후보만 남긴다 (최소 gameCount * 3, 최대 전체 pool).
  const topSliceSize = Math.max(
    request.gameCount * 3,
    Math.ceil(scored.length * 0.05)
  );
  const topCandidates = scored.slice(0, Math.min(topSliceSize, scored.length));

  // 서로 4개 이상 겹치는 후보를 제거하며 상위 점수 순으로 채택한다 (기획서 7.6).
  const chosen: typeof topCandidates = [];
  for (const candidate of topCandidates) {
    if (chosen.length >= request.gameCount) break;
    const overlapTooHigh =
      maxOverlapAgainstList(
        candidate.numbers,
        chosen.map((c) => c.numbers)
      ) >= 4;
    if (!overlapTooHigh) {
      chosen.push(candidate);
    }
  }
  // 조건이 너무 강해 gameCount를 못 채운 경우, 남은 후보로 보충한다.
  if (chosen.length < request.gameCount) {
    for (const candidate of topCandidates) {
      if (chosen.length >= request.gameCount) break;
      if (!chosen.includes(candidate)) chosen.push(candidate);
    }
  }

  const games = chosen.map((c) => buildGeneratedGame(c.numbers, request.mode, c.score));

  const coveragePercent = calculateCoveragePercent(uniqueCandidates.size);
  const probability = calculateFirstPrizeProbability(games.length);

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
