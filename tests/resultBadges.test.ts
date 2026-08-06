import {
  getMonteCarloBadge,
  getEvOptimizationBadge,
  getWheelingBadge,
  getLastDigitSpreadBadge,
  getSakaiPatternBadge,
  computeBatchLevelBadges,
  computeGameLevelBadges,
  type SakaiAnalysisInputs,
} from "../src/lib/lottery/resultBadges";
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

describe("getMonteCarloBadge", () => {
  it("AI_SEARCH + 반복 1회 초과면 반복 횟수와 함께 표시한다", () => {
    expect(getMonteCarloBadge(baseRequest({ searchCount: 30000 }))).toEqual({
      key: "MONTE_CARLO",
      label: "몬테카를로 탐색 · 3만 회",
    });
    expect(getMonteCarloBadge(baseRequest({ searchCount: 1000000 }))?.label).toBe(
      "몬테카를로 탐색 · 100만 회"
    );
  });

  it("바로 생성(반복 1회)/AI_SEARCH가 아닌 모드는 null", () => {
    expect(getMonteCarloBadge(baseRequest({ searchCount: 1 }))).toBeNull();
    expect(getMonteCarloBadge(baseRequest({ mode: "EXCLUSION", searchCount: 30000 }))).toBeNull();
  });
});

describe("getEvOptimizationBadge", () => {
  it("인기번호 회피가 켜진 AI_SEARCH 결과에만 표시한다", () => {
    expect(getEvOptimizationBadge(baseRequest({ avoidPopularNumbers: true }))).toEqual({
      key: "EV_OPTIMIZED",
      label: "EV 최적화",
    });
  });

  it("인기번호 회피가 꺼져 있거나 다른 모드면 null", () => {
    expect(getEvOptimizationBadge(baseRequest({ avoidPopularNumbers: false }))).toBeNull();
    expect(
      getEvOptimizationBadge(baseRequest({ mode: "EXCLUSION", avoidPopularNumbers: true }))
    ).toBeNull();
  });
});

describe("getWheelingBadge", () => {
  it("AI_SEARCH + 2게임 이상이면 표시한다", () => {
    expect(getWheelingBadge(baseRequest({ gameCount: 2 }))).toEqual({
      key: "WHEELING",
      label: "휠링 방식 분산",
    });
  });

  it("게임 1개거나 다른 모드면 null", () => {
    expect(getWheelingBadge(baseRequest({ gameCount: 1 }))).toBeNull();
    expect(getWheelingBadge(baseRequest({ mode: "PURE_RANDOM", gameCount: 5 }))).toBeNull();
  });
});

describe("getLastDigitSpreadBadge", () => {
  it("AI_SEARCH + 3만/10만 회 탐색이면 표시한다", () => {
    expect(getLastDigitSpreadBadge(baseRequest({ searchCount: 30000 }))).toEqual({
      key: "LAST_DIGIT_SPREAD",
      label: "끝수 스프레드 최적화",
    });
    expect(getLastDigitSpreadBadge(baseRequest({ searchCount: 100000 }))).toEqual({
      key: "LAST_DIGIT_SPREAD",
      label: "끝수 스프레드 최적화",
    });
  });

  it("그 외 반복 횟수나 다른 모드면 null", () => {
    expect(getLastDigitSpreadBadge(baseRequest({ searchCount: 1000000 }))).toBeNull();
    expect(getLastDigitSpreadBadge(baseRequest({ searchCount: 1 }))).toBeNull();
    expect(
      getLastDigitSpreadBadge(baseRequest({ mode: "EXCLUSION", searchCount: 30000 }))
    ).toBeNull();
  });
});

describe("getSakaiPatternBadge", () => {
  const inputs: SakaiAnalysisInputs = {
    averageFrequencyNumbers: [7, 14],
    previousDrawNumbers: [3, 9, 20, 25, 31, 40],
  };

  it("평균빈도 번호와 직전회차 번호가 각각 1개 이상 포함되면 표시한다", () => {
    expect(getSakaiPatternBadge([7, 9, 11, 22, 33, 44], inputs)).toEqual({
      key: "SAKAI_PATTERN",
      label: "사카이 분석 패턴",
    });
  });

  it("둘 중 하나라도 없으면 null", () => {
    expect(getSakaiPatternBadge([7, 11, 22, 33, 44, 45], inputs)).toBeNull(); // 직전회차 번호 없음
    expect(getSakaiPatternBadge([9, 11, 22, 33, 44, 45], inputs)).toBeNull(); // 평균빈도 번호 없음
  });

  it("데이터가 없으면(null 또는 빈 배열) null", () => {
    expect(getSakaiPatternBadge([1, 2, 3, 4, 5, 6], null)).toBeNull();
    expect(
      getSakaiPatternBadge([1, 2, 3, 4, 5, 6], { averageFrequencyNumbers: [], previousDrawNumbers: [] })
    ).toBeNull();
  });
});

describe("computeBatchLevelBadges", () => {
  it("배치(요청) 조건에 맞는 배지만 모아서 반환한다 — 끝수 스프레드 포함, 사카이는 제외", () => {
    const request = baseRequest({ searchCount: 100000, avoidPopularNumbers: true, gameCount: 5 });
    const keys = computeBatchLevelBadges(request).map((b) => b.key);
    expect(keys).toEqual(["MONTE_CARLO", "EV_OPTIMIZED", "WHEELING", "LAST_DIGIT_SPREAD"]);
  });

  it("아무 조건도 안 맞으면 빈 배열을 반환한다", () => {
    const request = baseRequest({ mode: "PURE_RANDOM", gameCount: 1 });
    expect(computeBatchLevelBadges(request)).toEqual([]);
  });
});

describe("computeGameLevelBadges", () => {
  it("사카이 패턴 조건에 맞으면 게임 단위 배지를 반환한다", () => {
    const sakaiInputs: SakaiAnalysisInputs = {
      averageFrequencyNumbers: [1],
      previousDrawNumbers: [2],
    };
    const keys = computeGameLevelBadges({ numbers: [1, 2, 3, 4, 5, 6] }, sakaiInputs).map(
      (b) => b.key
    );
    expect(keys).toEqual(["SAKAI_PATTERN"]);
  });

  it("사카이 데이터가 없으면 빈 배열을 반환한다", () => {
    expect(computeGameLevelBadges({ numbers: [1, 2, 3, 4, 5, 6] }, null)).toEqual([]);
  });
});
