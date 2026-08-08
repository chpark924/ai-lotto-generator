/**
 * 딥 패턴 탐색 — v3 실제 엔진 (Atlas 기반).
 *
 * scripts/build-deep-pattern-atlas.mjs가 사전 계산한 data/deep-pattern-atlas.json을 그대로
 * 번들해서 쓴다(명세 §18 "Precompute globally, evaluate locally" — 814만 조합 전수 계산은
 * 여기(런타임)가 아니라 빌드 스크립트에서 이미 끝났다). recommend() 호출마다 8,145,060개를
 * 순회하지 않는다.
 *
 * v3 근사치임을 명시한다(atlas.methodology 참고): Multi-scale을 3단계(fine 81/mid 27/
 * coarse 9, §7)로 세분화했고, Temporal(전체/최근 300회), kNN 기반 Geometric Void(§8, basin
 * 내 후보 선택에 사용), Null 시뮬레이션+다중검정 보정(§14, validationPercentile로 노출)까지
 * 실제로 계산한다. **v2 대비 바뀐 부분(§22 latency 대응)**: basin 안에서 후보를 뽑을 때
 * 예전엔 이 파일이 직접 CSPRNG로 무작위 조합을 뽑고 basin이 맞는지 확인하는 rejection
 * sampling을 했는데(basin당 적중 확률 약 1/81이라 pool을 채우는 데 수백~수천 번 시도가
 * 필요했다), 이제는 Atlas가 이미 미리 검증해둔 basin.sampleCombos(basin당 150개, 빌드타임
 * reservoir sampling)에서 가볍게 부분셔플만 한다 — CSPRNG 호출 횟수가 basin당 최대
 * 3,000회에서 20회 안팎으로 줄었다. 여전히 남은 것: §7의 "Exact"(개별 조합) 계층은 kNN
 * 보정이 근사적으로만 대신하고, 실기기 latency 실측치는 없다.
 *
 * 이 파일은 mockEngine.ts와 정확히 같은 시그니처(recommendDeepPatterns/deepPatternEngineStatus,
 * DeepPatternBatch 반환)를 유지한다 — 화면(app/generate/deep-pattern*.tsx)은 어느 쪽을
 * import하는지만 다르고 나머지 코드는 그대로다.
 */
import atlasData from "../../../data/deep-pattern-atlas.json";
import { securePartialShuffle } from "../lottery/random";
import { combinationKey, combinationSimilarity, maxOverlapAgainstList } from "../lottery/similarity";
import { kNearestVoidScore } from "./geometricVoid";
import type { DeepPatternBatch, DeepPatternLevel, DeepPatternRecommendation } from "./types";

interface AtlasBasin {
  key: number;
  rowZone: number;
  colZone: number;
  dispZone: number;
  oddZone: number;
  population: number;
  observedCount: number;
  expectedCount: number;
  densityRatio: number | null;
  structuralVoidLevel: DeepPatternLevel;
  /** mid(27개, 행×열×산포도) 해상도에서의 밀도비 — §7 Multi-scale 세분화. */
  midDensityRatio: number | null;
  coarseDensityRatio: number | null;
  scalePersistenceLevel: DeepPatternLevel;
  recentDensityRatio: number | null;
  temporalPersistenceLevel: DeepPatternLevel;
  noveltyPercentile: number;
  /** Null 시뮬레이션(§14) + 다중검정 보정(family-wise, 81개 basin 중 best 대비) 결과. 0~100. */
  validationPercentile: number;
  /**
   * 빌드타임에 reservoir sampling으로 미리 뽑아둔, 실제로 이 basin에 속하는 대표 조합
   * 목록(최대 150개, basin.population이 이보다 작으면 그만큼만). 런타임은 이 목록에서만
   * 고른다 — 8,145,060개 전체 공간에서 다시 rejection sampling하지 않는다.
   */
  sampleCombos: number[][];
}

interface AtlasHistoryEntry {
  drawNumber: number;
  numbers: number[];
}

interface Atlas {
  engineVersion: string;
  atlasVersion: string;
  methodology: string;
  historyThroughDrawNumber: number;
  totalCombinations: number;
  thresholds: { row: number[]; col: number[]; dispersion: number[] };
  basins: AtlasBasin[];
  history: AtlasHistoryEntry[];
}

// scripts/build-deep-pattern-atlas.mjs가 만든 JSON을 그대로 타입만 씌운다.
const atlas = atlasData as unknown as Atlas;

/** 밀도비(observed/expected)가 낮은 순 — "구조적으로 가장 덜 관측된" basin부터. */
function rankedBasinsByDeficit(): AtlasBasin[] {
  return [...atlas.basins]
    .filter((b) => b.population > 0)
    .sort((a, b) => (a.densityRatio ?? 1) - (b.densityRatio ?? 1));
}

function findNearestHistorical(numbers: number[]): { drawNumber: number; similarityPercent: number } | null {
  let bestDrawNumber: number | null = null;
  let bestSimilarity = -1;
  for (const entry of atlas.history) {
    const similarity = combinationSimilarity(numbers, entry.numbers);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestDrawNumber = entry.drawNumber;
    }
  }
  if (bestDrawNumber === null) return null;
  return { drawNumber: bestDrawNumber, similarityPercent: Math.round(bestSimilarity * 100) };
}

// 이미 뽑은 조합과 5개 이상 겹치면 다양성을 위해 건너뛴다(기존 AI 조합 탐색의 겹침 회피와 같은 기준).
const MAX_OVERLAP_WITH_CHOSEN = 4;
// basin.sampleCombos(빌드타임에 미리 검증해둔 basin당 최대 150개 대표 후보) 중에서 이 개수만큼
// 부분셔플로 뽑은 뒤, kNN Geometric Void(§8)가 가장 큰(=역대 이력과 기하학적으로 가장 먼)
// 후보를 고른다. v2까지는 이 풀을 CSPRNG rejection sampling으로 매번 새로 채웠는데(basin당
// 적중 확률 약 1/81이라 느렸다), v3부터는 Atlas가 이미 검증해둔 목록에서 CSPRNG로 가볍게
// 부분셔플만 한다 — basin 내부 uniform sampling이라는 통계적 성질은 그대로 유지된다
// (sampleCombos 자체가 그 basin 전체 인구 중 uniform reservoir 표본이기 때문).
const CANDIDATE_POOL_SIZE = 20;
const K_NEAREST_FOR_VOID = 10;

/**
 * 지정한 basin의 sampleCombos에서 최대 CANDIDATE_POOL_SIZE개를 무작위로 뽑은 뒤(부분셔플),
 * 겹침 제약을 만족하는 후보 중 kNN Geometric Void(§8, k=10 최근접 이력까지의 median 거리)가
 * 가장 큰 후보를 고른다. "같은 basin"이라도 어떤 걸 대표로 내밀지는 이렇게 한 번 더 걸러서,
 * 역대 이력에 우연히 가까운 조합이 뽑히는 걸 줄인다. 1-NN 취약성을 median-of-k로 보완하는 게
 * 이 단계의 목적이다.
 */
function sampleFromBasin(basin: AtlasBasin, avoid: number[][]): number[] | null {
  const source = basin.sampleCombos;
  if (!source || source.length === 0) return null;

  const shuffled = securePartialShuffle(source, Math.min(CANDIDATE_POOL_SIZE, source.length));
  const pool = shuffled.filter((candidate) => maxOverlapAgainstList(candidate, avoid) <= MAX_OVERLAP_WITH_CHOSEN);
  if (pool.length === 0) return null;

  let best = pool[0];
  let bestVoidScore = -Infinity;
  for (const candidate of pool) {
    const voidScore = kNearestVoidScore(candidate, atlas.history, K_NEAREST_FOR_VOID);
    if (voidScore > bestVoidScore) {
      bestVoidScore = voidScore;
      best = candidate;
    }
  }
  // 번들된 Atlas(atlasData)는 모듈 전역에서 공유하는 단일 객체다. best는 그 안의
  // sampleCombos 배열 원소를 그대로 가리키므로, 복사본을 반환해 호출부가 실수로라도
  // 원본 Atlas 데이터를 변형하지 못하게 막는다(세션 내내 재사용되는 데이터라 한 번 오염되면
  // 이후 모든 추천에 영향을 준다).
  return [...best];
}

/**
 * 명세 §43 recommend(count)의 실제 구현.
 * 구조적 공백이 가장 큰 basin부터 서로 다른 basin에서 대표 조합을 하나씩 뽑는다(§16 Void
 * Basin diversity) — Basin 자체가 이미 서로 다른 macro pattern(중심 위치/산포도/홀짝 비율)을
 * 뜻하므로, basin을 달리 고르는 것만으로 "비슷한 고득점 번호가 몰리는 문제"를 상당 부분 피한다.
 */
export async function recommendDeepPatterns(count = 5): Promise<DeepPatternBatch> {
  const ranked = rankedBasinsByDeficit();
  const chosenNumbers: number[][] = [];
  const recommendations: DeepPatternRecommendation[] = [];
  const seenKeys = new Set<string>();

  for (const basin of ranked) {
    if (recommendations.length >= count) break;
    const numbers = sampleFromBasin(basin, chosenNumbers);
    if (!numbers) continue;
    const key = combinationKey(numbers);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    chosenNumbers.push(numbers);

    const nearest = findNearestHistorical(numbers);

    recommendations.push({
      numbers,
      patternIndex: recommendations.length + 1,
      noveltyPercentile: basin.noveltyPercentile,
      structuralVoidLevel: basin.structuralVoidLevel,
      scalePersistenceLevel: basin.scalePersistenceLevel,
      temporalPersistenceLevel: basin.temporalPersistenceLevel,
      validationPercentile: basin.validationPercentile,
      nearestHistoricalDrawNumber: nearest?.drawNumber ?? null,
      nearestHistoricalSimilarityPercent: nearest?.similarityPercent ?? null,
      engineVersion: atlas.engineVersion,
      atlasVersion: atlas.atlasVersion,
      historyThroughDrawNumber: atlas.historyThroughDrawNumber,
    });
  }

  return {
    requestId: `deep_pattern_${Date.now()}`,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}

/** 명세 §43 status(). Atlas가 정상적으로 번들되어 로드된 상태면 항상 READY다(v1은 다운로드 갱신 없음). */
export function deepPatternEngineStatus(): "READY" {
  return "READY";
}

/** 디버그/테스트 및 향후 QA 화면용으로 Atlas 메타데이터를 읽기 전용으로 노출한다. */
export function getDeepPatternAtlasMeta() {
  return {
    engineVersion: atlas.engineVersion,
    atlasVersion: atlas.atlasVersion,
    methodology: atlas.methodology,
    historyThroughDrawNumber: atlas.historyThroughDrawNumber,
    totalCombinations: atlas.totalCombinations,
    basinCount: atlas.basins.length,
  };
}
