/**
 * 공통 번호 생성 엔진 (기획서 5장, 7장).
 *
 * 중요 원칙 (기획서 7.2, 이 프로젝트의 비용 최소화 지침):
 *  - AI 언어모델에 번호 생성을 요청하지 않는다.
 *  - 모든 후보 생성/점수 계산/선별은 기기(클라이언트) 내부의 순수 JS로 수행한다.
 *  - "AI 탐색/AI 정밀 탐색"이라는 이름은 사용자 경험상의 네이밍일 뿐,
 *    실제로는 로컬 난수 엔진 + 규칙 기반 점수 엔진이다.
 */
import { randomInt, securePartialShuffle } from "./random";
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
  const selected = securePartialShuffle(available, remainingCount);
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

  // 최종 채택된 후보끼리는 원점수가 서로 몰려 있기 쉬우므로, 화면에 보여줄 총점만
  // 상대적 우열은 유지한 채 체감 가능한 폭으로 펼친다(구성요소별 세부 점수는 그대로 둔다).
  const displayTotals = stretchScoresForDisplay(chosen.map((c) => c.score.totalScore));
  const games = chosen.map((c, i) =>
    buildGeneratedGame(c.numbers, request.mode, { ...c.score, totalScore: displayTotals[i] })
  );

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
