import {
  generateDestinyGame,
  calculatePopularityScore,
  computeVisualPatternScore,
  buildPopularityFeatures,
  DESTINY_TARGET_LABELS,
} from "../src/lib/lottery/destiny";

const flatPopularity = new Array(45).fill(0.3);

describe("generateDestinyGame", () => {
  it("항상 1~45 범위의 서로 다른 6개 번호를 오름차순으로 반환한다", () => {
    const result = generateDestinyGame({
      target: "ONE",
      consecutiveRule: "ANY",
      excludedNumbers: [],
      usePreferredNumbers: false,
      preferredNumbers: [],
      popularityByNumber: flatPopularity,
      savedCombinations: [],
      candidatePoolSize: 300,
    });

    expect(result.numbers).toHaveLength(6);
    expect(new Set(result.numbers).size).toBe(6);
    for (const n of result.numbers) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(45);
    }
    const sorted = [...result.numbers].sort((a, b) => a - b);
    expect(result.numbers).toEqual(sorted);
  });

  it("제외번호를 포함하지 않는다", () => {
    const excluded = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = generateDestinyGame({
      target: "TWENTY",
      consecutiveRule: "ANY",
      excludedNumbers: excluded,
      usePreferredNumbers: false,
      preferredNumbers: [],
      popularityByNumber: flatPopularity,
      savedCombinations: [],
      candidatePoolSize: 300,
    });
    for (const n of result.numbers) {
      expect(excluded).not.toContain(n);
    }
  });

  it("연속번호 없음 조건을 만족하는 조합만 선택한다", () => {
    const result = generateDestinyGame({
      target: "TEN",
      consecutiveRule: "NONE",
      excludedNumbers: [],
      usePreferredNumbers: false,
      preferredNumbers: [],
      popularityByNumber: flatPopularity,
      savedCombinations: [],
      candidatePoolSize: 500,
    });
    const sorted = [...result.numbers].sort((a, b) => a - b);
    let maxConsecutive = 1;
    let current = 1;
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i] === sorted[i - 1] + 1) {
        current += 1;
        maxConsecutive = Math.max(maxConsecutive, current);
      } else {
        current = 1;
      }
    }
    expect(maxConsecutive).toBeLessThanOrEqual(1);
  });

  it("1명 목표(매우 낮은 인기도)의 목표 인기도가 20명 목표보다 낮다", () => {
    const one = generateDestinyGame({
      target: "ONE",
      consecutiveRule: "ANY",
      excludedNumbers: [],
      usePreferredNumbers: false,
      preferredNumbers: [],
      popularityByNumber: flatPopularity,
      savedCombinations: [],
      candidatePoolSize: 100,
    });
    const twenty = generateDestinyGame({
      target: "TWENTY",
      consecutiveRule: "ANY",
      excludedNumbers: [],
      usePreferredNumbers: false,
      preferredNumbers: [],
      popularityByNumber: flatPopularity,
      savedCombinations: [],
      candidatePoolSize: 100,
    });
    expect(one.targetPopularity).toBeLessThan(twenty.targetPopularity);
  });

  it("모든 DESTINY_TARGET_LABELS 값에 한글 라벨이 존재한다", () => {
    for (const key of Object.keys(DESTINY_TARGET_LABELS)) {
      expect(typeof DESTINY_TARGET_LABELS[key as keyof typeof DESTINY_TARGET_LABELS]).toBe("string");
    }
  });
});

describe("computeVisualPatternScore", () => {
  it("연속 3개 이상 번호는 패턴 점수가 높다", () => {
    const consecutive = computeVisualPatternScore([1, 2, 3, 10, 20, 30]);
    const scattered = computeVisualPatternScore([2, 9, 17, 24, 33, 41]);
    expect(consecutive).toBeGreaterThan(scattered);
  });

  it("일정 간격 조합은 패턴 점수가 있다", () => {
    const evenlySpaced = computeVisualPatternScore([5, 10, 15, 20, 25, 30]);
    expect(evenlySpaced).toBeGreaterThan(0);
  });
});

describe("calculatePopularityScore / buildPopularityFeatures", () => {
  it("가중치 합이 1이 되도록 구성되어 0~100 범위 내 점수를 만든다", () => {
    const features = buildPopularityFeatures([1, 2, 3, 4, 5, 6], flatPopularity, []);
    const score = calculatePopularityScore(features);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("저장 조합과 완전히 같은 조합은 savedCombinationSimilarityScore가 100이다", () => {
    const numbers = [1, 2, 3, 4, 5, 6];
    const features = buildPopularityFeatures(numbers, flatPopularity, [numbers]);
    expect(features.savedCombinationSimilarityScore).toBe(100);
  });
});
