/**
 * ⚠️ MOCK ENGINE — Deep Pattern Engine Master Spec의 Phase 2(Research: 814만 조합 전수
 * Feature 계산) ~ Phase 4(Atlas Builder)가 아직 구현되지 않았다.
 *
 * 이 파일은 화면·네비게이션·저장 연동을 실제로 검증하기 위한 자리표시자다.
 * numbers는 기존 generator.ts의 CSPRNG 기반 함수로 뽑은 "진짜 유효한" 조합이지만,
 * 그 외 지표(패턴 독창성/구조적 공백/공백 지속성/시간 안정성/가장 가까운 과거 당첨)는
 * 전부 그럴듯해 보이는 무작위값일 뿐 실제 Structural Void/Basin 계산 결과가 아니다.
 *
 * 실제 엔진이 준비되면 이 파일 하나만 교체하면 된다 — recommendDeepPatterns()의 시그니처가
 * 명세 §43 DeepPatternFeature.recommend()의 경계와 그대로 대응하도록 맞춰뒀다. 호출부
 * (app/generate/deep-pattern*.tsx)는 이 파일의 내부 구현을 몰라도 되게 짜여 있다.
 */
import { generatePureRandom } from "../lottery/generator";
import { combinationKey } from "../lottery/similarity";
import { randomInt } from "../lottery/random";
import { estimateLatestDrawNumber } from "../draws/drawApi";
import type { DeepPatternBatch, DeepPatternLevel, DeepPatternRecommendation } from "./types";

export const DEEP_PATTERN_MOCK_ENGINE_VERSION = "DPE-MOCK-0.1";
export const DEEP_PATTERN_MOCK_ATLAS_VERSION = "ATLAS-MOCK-0.1";

const LEVELS: DeepPatternLevel[] = ["MID", "HIGH", "HIGH", "MID", "LOW"];

function pickLevel(): DeepPatternLevel {
  return LEVELS[randomInt(0, LEVELS.length)];
}

/** 상위 1.0%~7.0% 사이의 그럴듯한 값 (실제 계산 아님). */
function pickNoveltyPercentile(): number {
  return Math.round((10 + randomInt(0, 60)) * 10) / 100;
}

/**
 * 명세 §43 recommend(count)의 TS/mock 버전. 서로 다른 조합 count개를 만든다
 * (실제 엔진의 Basin diversity 대신, mock 단계에서는 단순 중복 제거로 대체).
 */
export async function recommendDeepPatterns(count = 5): Promise<DeepPatternBatch> {
  const seen = new Set<string>();
  const recommendations: DeepPatternRecommendation[] = [];
  const historyThrough = estimateLatestDrawNumber();
  let guard = 0;

  while (recommendations.length < count && guard < count * 200 + 500) {
    guard += 1;
    const numbers = generatePureRandom();
    const key = combinationKey(numbers);
    if (seen.has(key)) continue;
    seen.add(key);

    // 실기기에서도 "이력이 아직 없어서 null"인 경우를 화면이 제대로 처리하는지 볼 수 있게,
    // 아주 가끔(10분의 1) null을 섞는다.
    const hasNearestHistory = randomInt(0, 10) > 0;

    recommendations.push({
      numbers,
      patternIndex: recommendations.length + 1,
      noveltyPercentile: pickNoveltyPercentile(),
      structuralVoidLevel: pickLevel(),
      scalePersistenceLevel: pickLevel(),
      temporalPersistenceLevel: pickLevel(),
      validationPercentile: randomInt(10, 100), // mock — 실제 Null 시뮬레이션 아님
      nearestHistoricalDrawNumber: hasNearestHistory ? randomInt(1, historyThrough + 1) : null,
      nearestHistoricalSimilarityPercent: hasNearestHistory ? randomInt(30, 71) : null,
      engineVersion: DEEP_PATTERN_MOCK_ENGINE_VERSION,
      atlasVersion: DEEP_PATTERN_MOCK_ATLAS_VERSION,
      historyThroughDrawNumber: historyThrough,
    });
  }

  return {
    requestId: `deep_pattern_${Date.now()}`,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}

/** 명세 §43 status()의 mock 버전. v1은 항상 이 값만 반환한다. */
export function deepPatternEngineStatus(): "MOCK" {
  return "MOCK";
}
