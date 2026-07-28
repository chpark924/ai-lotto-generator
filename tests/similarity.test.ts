import { overlapCount, combinationSimilarity, combinationKey } from "../src/lib/lottery/similarity";

describe("유사도 계산", () => {
  it("overlapCount", () => {
    expect(overlapCount([1, 2, 3, 4, 5, 6], [4, 5, 6, 7, 8, 9])).toBe(3);
    expect(overlapCount([1, 2, 3], [4, 5, 6])).toBe(0);
  });

  it("combinationSimilarity", () => {
    expect(combinationSimilarity([1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6])).toBeCloseTo(1);
    expect(combinationSimilarity([1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12])).toBe(0);
  });

  it("combinationKey는 정렬 순서와 무관하게 동일하다", () => {
    expect(combinationKey([6, 5, 4, 3, 2, 1])).toBe(combinationKey([1, 2, 3, 4, 5, 6]));
  });
});
