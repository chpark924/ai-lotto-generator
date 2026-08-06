import { buildGameFeatures, explainGameLocally } from "../src/lib/ai/explain";
import type { GeneratedGame } from "../src/lib/lottery/types";

function game(overrides: Partial<GeneratedGame> = {}): GeneratedGame {
  return {
    id: "game_1",
    numbers: [1, 2, 3, 4, 5, 6],
    mode: "AI_SEARCH",
    metadata: {
      oddCount: 3,
      lowNumberCount: 6,
      sum: 21,
      maxConsecutiveLength: 6,
      sameEndingMaxCount: 1,
      sectionCounts: [6, 0, 0, 0, 0],
    },
    ...overrides,
  };
}

describe("buildGameFeatures / explainGameLocally — 끝수 최적화 설명 문구", () => {
  it("lastDigitSpreadOptimized가 true면 설명에 '끝수 최적화가 포함되어 있습니다'가 들어간다", () => {
    const features = buildGameFeatures(game(), new Array(45).fill(0.3), [], null, true);
    expect(features.lastDigitSpreadOptimized).toBe(true);
    expect(explainGameLocally(features)).toContain("끝수 최적화가 포함되어 있습니다.");
  });

  it("기본값(인자 생략)이면 lastDigitSpreadOptimized는 false이고 설명에 문구가 없다", () => {
    const features = buildGameFeatures(game(), new Array(45).fill(0.3), []);
    expect(features.lastDigitSpreadOptimized).toBe(false);
    expect(explainGameLocally(features)).not.toContain("끝수 최적화");
  });

  it("false를 명시적으로 넘겨도 문구가 없다", () => {
    const features = buildGameFeatures(game(), new Array(45).fill(0.3), [], null, false);
    expect(explainGameLocally(features)).not.toContain("끝수 최적화");
  });
});
