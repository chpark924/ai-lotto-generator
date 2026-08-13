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
import { getCachedAtlas, refreshAtlasFromGithubIfNeeded } from "./atlasCache";
import { kNearestVoidScore } from "./geometricVoid";
import type { Atlas, AtlasBasin } from "./atlasTypes";
import type { DeepPatternBatch, DeepPatternRecommendation } from "./types";

// scripts/build-deep-pattern-atlas.mjs가 만든 JSON을 그대로 타입만 씌운다. 이게 항상 쓸 수
// 있는 "바닥"이다 — 네트워크가 전혀 없어도(§30 "오프라인에서도 핵심 추천은 계속 동작") 이걸로
// 정상 동작한다.
const bundledAtlas = atlasData as unknown as Atlas;

/**
 * 지금 실제로 쓰고 있는 atlas. 기본은 번들된 atlas고, 더 최신(historyThroughDrawNumber가 더
 * 큰) atlas를 로컬 캐시에서 읽었거나 GitHub에서 받아오면 이 값이 교체된다(QA_LOG.md 77/78번
 * 참고 — "제N회까지 반영"이 앱 재빌드 없이도 최신화되게 하기 위함). 이 파일의 나머지 함수는
 * 전부 이 값을 그때그때 읽으므로, 교체된 즉시 다음 recommendDeepPatterns() 호출부터 반영된다.
 */
let activeAtlas: Atlas = bundledAtlas;

/**
 * 모듈이 처음 로드될 때 한 번, 로컬에 이미 캐시된(과거 세션에서 GitHub로부터 받아둔) 더 최신
 * atlas가 있으면 즉시 교체한다 — 네트워크 요청 없이 로컬 저장소만 읽으므로 테스트 환경
 * (Node, AsyncStorage 없음)에서도 안전하게 항상 실패(없음으로 처리)로 끝난다.
 */
async function loadCachedAtlasIfNewer(): Promise<void> {
  try {
    const cached = await getCachedAtlas();
    if (cached && cached.historyThroughDrawNumber > activeAtlas.historyThroughDrawNumber) {
      activeAtlas = cached;
    }
  } catch {
    // no-op — 번들된 atlas로 계속 동작.
  }
}
void loadCachedAtlasIfNewer();

/**
 * GitHub에 커밋된 최신 atlas로 갱신을 시도한다(동기화 주기 안이면 조용히 아무 것도 안 함).
 * 의도적으로 이 파일의 다른 함수(recommendDeepPatterns 등)에서 자동으로 호출하지 않는다 —
 * 실제 네트워크 요청이 필요한 부분이라 화면(app/generate/deep-pattern.tsx)이 마운트될 때
 * 딱 한 번만 명시적으로 호출한다. 이렇게 분리해야 tests/deepPatternEngine.test.ts가 항상
 * 네트워크 없이 결정론적으로 돈다.
 */
export async function refreshAtlasIfStale(): Promise<void> {
  try {
    const fetched = await refreshAtlasFromGithubIfNeeded(activeAtlas.historyThroughDrawNumber);
    if (fetched) activeAtlas = fetched;
  } catch {
    // no-op — 실패하면 지금 쓰던 atlas 그대로 계속 쓴다.
  }
}

/** 밀도비(observed/expected)가 낮은 순 — "구조적으로 가장 덜 관측된" basin부터. */
function rankedBasinsByDeficit(): AtlasBasin[] {
  return [...activeAtlas.basins]
    .filter((b) => b.population > 0)
    .sort((a, b) => (a.densityRatio ?? 1) - (b.densityRatio ?? 1));
}

/**
 * "덜 관측된 패턴 ↔ 다빈도 패턴" 혼합 슬라이더(§ deep-pattern.tsx)가 내부적으로 쓰는 값.
 * 화면에는 %를 보여주지 않고, 사용자가 드래그해서 놓은 지점을 이 중 가장 가까운 값으로
 * 스냅해서만 계산에 반영한다.
 */
export const FREQUENT_PATTERN_RATIO_STEPS = [0, 10, 15, 25, 50, 75, 100] as const;

/** frequentPatternRatio(0~100, 임의값)를 FREQUENT_PATTERN_RATIO_STEPS 중 가장 가까운 값으로 스냅한다. */
export function snapFrequentPatternRatio(value: number): number {
  return FREQUENT_PATTERN_RATIO_STEPS.reduce((closest, step) =>
    Math.abs(step - value) < Math.abs(closest - value) ? step : closest
  );
}

/**
 * frequentPatternRatio(스냅된 0~100)에 맞춰 basin 순회 순서를 만든다.
 * 0이면 기존과 정확히 같은 순서(밀도비 낮은 순 = 덜 관측된 basin부터)를 그대로 반환해서
 * 슬라이더를 건드리지 않은 기본 동작(및 기존 테스트)이 완전히 그대로 유지되게 한다.
 * 100이면 그 반대(밀도비 높은 순 = 다빈도 basin부터)를 반환한다.
 * 그 사이 값이면 두 순서를 ratio 비율로 인터리빙해서, "덜 관측된 패턴"과 "다빈도 패턴"이
 * 사용자가 고른 비율만큼 섞여서 채워지게 한다(같은 basin이 두 번 뽑히지 않도록 dedupe).
 */
function buildBasinTraversalOrder(frequentPatternRatio: number): AtlasBasin[] {
  const leastObservedFirst = rankedBasinsByDeficit();
  if (frequentPatternRatio <= 0) return leastObservedFirst;

  const mostFrequentFirst = [...leastObservedFirst].reverse();
  if (frequentPatternRatio >= 100) return mostFrequentFirst;

  const ratio = frequentPatternRatio / 100;
  const merged: AtlasBasin[] = [];
  const usedKeys = new Set<number>();
  let leastIdx = 0;
  let freqIdx = 0;
  let freqAccumulator = 0;

  // list[fromIdx] 이후로 아직 안 뽑힌 첫 basin과 그 인덱스를 함께 반환한다(같은 basin이 두
  // 목록 모두에 있으므로, 한쪽에서 이미 뽑혔으면 다른 쪽에서도 건너뛰어야 한다).
  const nextUnused = (list: AtlasBasin[], fromIdx: number): [AtlasBasin | undefined, number] => {
    let i = fromIdx;
    while (i < list.length && usedKeys.has(list[i].key)) i += 1;
    return [list[i], i];
  };

  while (merged.length < leastObservedFirst.length) {
    freqAccumulator += ratio;
    const wantFrequent = freqAccumulator >= 1;
    if (wantFrequent) freqAccumulator -= 1;

    const [primary, primaryIdx] = wantFrequent ? nextUnused(mostFrequentFirst, freqIdx) : nextUnused(leastObservedFirst, leastIdx);
    let picked = primary;
    if (wantFrequent) freqIdx = primaryIdx + (primary ? 1 : 0);
    else leastIdx = primaryIdx + (primary ? 1 : 0);

    if (!picked) {
      // 선호하는 쪽 목록이 이미 다 소진됐다면(=나머지가 전부 반대쪽에서 먼저 뽑힘) 남은
      // 다른 쪽에서 채운다.
      const [fallback, fallbackIdx] = wantFrequent ? nextUnused(leastObservedFirst, leastIdx) : nextUnused(mostFrequentFirst, freqIdx);
      if (!fallback) break;
      picked = fallback;
      if (wantFrequent) leastIdx = fallbackIdx + 1;
      else freqIdx = fallbackIdx + 1;
    }

    usedKeys.add(picked.key);
    merged.push(picked);
  }

  return merged;
}

function findNearestHistorical(numbers: number[]): { drawNumber: number; similarityPercent: number } | null {
  let bestDrawNumber: number | null = null;
  let bestSimilarity = -1;
  for (const entry of activeAtlas.history) {
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
    const voidScore = kNearestVoidScore(candidate, activeAtlas.history, K_NEAREST_FOR_VOID);
    if (voidScore > bestVoidScore) {
      bestVoidScore = voidScore;
      best = candidate;
    }
  }
  // activeAtlas(번들되었든, GitHub에서 받아왔든)는 모듈 전역에서 공유하는 단일 객체다. best는
  // 그 안의 sampleCombos 배열 원소를 그대로 가리키므로, 복사본을 반환해 호출부가 실수로라도
  // 원본 Atlas 데이터를 변형하지 못하게 막는다(세션 내내 재사용되는 데이터라 한 번 오염되면
  // 이후 모든 추천에 영향을 준다).
  return [...best];
}

/**
 * 명세 §43 recommend(count)의 실제 구현.
 * 구조적 공백이 가장 큰 basin부터 서로 다른 basin에서 대표 조합을 하나씩 뽑는다(§16 Void
 * Basin diversity) — Basin 자체가 이미 서로 다른 macro pattern(중심 위치/산포도/홀짝 비율)을
 * 뜻하므로, basin을 달리 고르는 것만으로 "비슷한 고득점 번호가 몰리는 문제"를 상당 부분 피한다.
 *
 * frequentPatternRatio(0~100, 기본 0)는 딥 패턴 탐색 인트로 화면의 "덜 관측된 패턴 ↔ 다빈도
 * 패턴" 슬라이더 값이다 — 기본값 0에서는 이전과 동일하게 밀도비가 낮은(=구조적으로 가장 덜
 * 관측된) basin부터만 채운다. 호출부는 이미 FREQUENT_PATTERN_RATIO_STEPS 중 하나로 스냅한
 * 값을 넘겨야 한다(snapFrequentPatternRatio 참고) — 이 함수 자체는 스냅 여부를 검증하지 않는다.
 */
export async function recommendDeepPatterns(count = 5, frequentPatternRatio = 0): Promise<DeepPatternBatch> {
  const ranked = buildBasinTraversalOrder(frequentPatternRatio);
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
      engineVersion: activeAtlas.engineVersion,
      atlasVersion: activeAtlas.atlasVersion,
      historyThroughDrawNumber: activeAtlas.historyThroughDrawNumber,
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
    engineVersion: activeAtlas.engineVersion,
    atlasVersion: activeAtlas.atlasVersion,
    methodology: activeAtlas.methodology,
    historyThroughDrawNumber: activeAtlas.historyThroughDrawNumber,
    totalCombinations: activeAtlas.totalCombinations,
    basinCount: activeAtlas.basins.length,
  };
}
