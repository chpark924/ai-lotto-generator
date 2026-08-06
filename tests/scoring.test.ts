import {
  stretchScoresForDisplay,
  scoreCandidate,
  isLastDigitSpreadOptimizationActive,
  type ScoringContext,
} from "../src/lib/lottery/scoring";
import type { GenerationRequest } from "../src/lib/lottery/types";

function baseRequest(overrides: Partial<GenerationRequest> = {}): GenerationRequest {
  return {
    mode: "AI_SEARCH",
    gameCount: 5,
    excludedNumbers: [],
    requiredNumbers: [],
    preferredNumbers: [],
    consecutiveRule: "ANY",
    ...overrides,
  };
}

function baseContext(request: GenerationRequest): ScoringContext {
  return {
    request,
    popularityByNumber: new Array(45).fill(0.3),
    savedCombinations: [],
    selectedSoFar: [],
  };
}

describe("isLastDigitSpreadOptimizationActive (끝수 스프레드 최적화 — 내재화된 활성 조건)", () => {
  it("AI_SEARCH 모드의 3만 회/10만 회 탐색에서만 true", () => {
    expect(isLastDigitSpreadOptimizationActive(baseRequest({ searchCount: 30000 }))).toBe(true);
    expect(isLastDigitSpreadOptimizationActive(baseRequest({ searchCount: 100000 }))).toBe(true);
  });

  it("바로 생성(1)/100만 회 부스터 탐색/AI_SEARCH가 아닌 모드는 false", () => {
    expect(isLastDigitSpreadOptimizationActive(baseRequest({ searchCount: 1 }))).toBe(false);
    expect(isLastDigitSpreadOptimizationActive(baseRequest({ searchCount: 1000000 }))).toBe(false);
    expect(
      isLastDigitSpreadOptimizationActive(baseRequest({ mode: "EXCLUSION", searchCount: 30000 }))
    ).toBe(false);
  });
});

describe("scoreCandidate — 끝수 스프레드 반영", () => {
  it("활성화 조건(3만/10만 회)에서만 lastDigitSpreadScore가 채워진다", () => {
    const active = scoreCandidate(
      [1, 2, 3, 4, 5, 6],
      baseContext(baseRequest({ searchCount: 30000 }))
    );
    const inactive = scoreCandidate(
      [1, 2, 3, 4, 5, 6],
      baseContext(baseRequest({ searchCount: 1000000 }))
    );
    expect(active.lastDigitSpreadScore).toBeDefined();
    expect(inactive.lastDigitSpreadScore).toBeUndefined();
  });

  it("끝수가 완전히 분산된 조합이 한 끝수에 몰린 조합보다 더 높은 점수를 받는다", () => {
    // 구간(섹션) 분포를 [2,1,1,1,1]로 동일하게 맞춰서 diversityScore가 두 조합에서
    // 같아지도록 통제했다 — 그래야 총점 차이가 오직 끝수 스프레드 효과만을 반영한다.
    const context = baseContext(baseRequest({ searchCount: 30000 }));
    const spread = scoreCandidate([1, 6, 12, 23, 34, 45], context); // 끝수 1,6,2,3,4,5 전부 다름
    const clustered = scoreCandidate([5, 6, 15, 25, 35, 45], context); // 끝수 5가 5개 몰림

    expect(spread.lastDigitSpreadScore!).toBeGreaterThan(clustered.lastDigitSpreadScore!);
    expect(spread.totalScore).toBeGreaterThan(clustered.totalScore);
  });
});

describe("stretchScoresForDisplay (추천 적합도 표시용 재조정)", () => {
  it("빈 배열은 빈 배열을 반환한다", () => {
    expect(stretchScoresForDisplay([])).toEqual([]);
  });

  it("원점수가 몰려 있어도(예: 87~89) 우열 순서를 유지하며 폭을 넓게 펼친다", () => {
    const result = stretchScoresForDisplay([88.4, 87.9, 88.1, 87.2, 88.8]);
    // 원래 순서: 5번째(88.8)가 최고, 4번째(87.2)가 최저.
    expect(result[4]).toBeGreaterThan(result[3]);
    expect(Math.max(...result)).toBe(98);
    expect(Math.min(...result)).toBe(65);
    // 편차가 최소 몇 점 이상으로 벌어져 사용자가 체감할 수 있어야 한다.
    expect(Math.max(...result) - Math.min(...result)).toBeGreaterThanOrEqual(30);
  });

  it("완전히 동점이면 순위 순서대로 살짝 차등을 준다", () => {
    const result = stretchScoresForDisplay([90, 90, 90]);
    expect(result[0]).toBeGreaterThan(result[1]);
    expect(result[1]).toBeGreaterThan(result[2]);
  });

  it("항목이 1개면 최고점으로 표시한다", () => {
    expect(stretchScoresForDisplay([55])).toEqual([98]);
  });

  it("상대적 우열 순서는 항상 원점수 순서와 같다", () => {
    const raw = [72, 95, 60, 88];
    const result = stretchScoresForDisplay(raw);
    const rawOrder = [...raw].map((v, i) => i).sort((a, b) => raw[b] - raw[a]);
    const resultOrder = [...result].map((v, i) => i).sort((a, b) => result[b] - result[a]);
    expect(resultOrder).toEqual(rawOrder);
  });
});
