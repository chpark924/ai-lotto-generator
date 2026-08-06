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

describe("buildGameFeatures", () => {
  it("끝수 스프레드 관련 필드를 더 이상 포함하지 않는다 (배치 단위 배지로 이동)", () => {
    const features = buildGameFeatures(game(), new Array(45).fill(0.3), [], null);
    expect(features).not.toHaveProperty("lastDigitSpreadOptimized");
  });

  it("홀짝 비율/합계/연속 여부를 정확히 계산한다", () => {
    const features = buildGameFeatures(game(), new Array(45).fill(0.3), [], null);
    expect(features.oddEven).toBe("3:3");
    expect(features.sum).toBe(21);
    expect(features.hasConsecutive).toBe(true);
  });
});

describe("explainGameLocally", () => {
  it("매 카드 끝에 반복되던 안내 문구('이 설명은 조합의 특징을...')를 더 이상 포함하지 않는다 (DisclaimerCard가 화면당 한 번 표시, QA_LOG 48번)", () => {
    const features = buildGameFeatures(game(), new Array(45).fill(0.3), [], null);
    expect(explainGameLocally(features)).not.toContain("당첨 가능성을 의미하지 않습니다");
  });

  it("끝수 최적화 문구는 더 이상 카드 설명에 포함되지 않는다 (배치 단위 배지로 이동)", () => {
    const features = buildGameFeatures(game(), new Array(45).fill(0.3), [], null);
    expect(explainGameLocally(features)).not.toContain("끝수 최적화");
  });

  it("홀짝 비율과 번호 합계를 설명에 포함한다", () => {
    const features = buildGameFeatures(game(), new Array(45).fill(0.3), [], null);
    expect(explainGameLocally(features)).toContain("홀짝 비율 3:3, 번호 합계 21입니다.");
  });

  it("최근 당첨번호와 겹치는 개수가 있으면 해당 문구를 포함한다", () => {
    const features = buildGameFeatures(game(), new Array(45).fill(0.3), [], [1, 2]);
    expect(explainGameLocally(features)).toContain("최근 4주간 당첨된 번호가 2개 포함되어 있습니다.");
  });
});
