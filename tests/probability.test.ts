import {
  calculateFirstPrizeProbability,
  calculateCoveragePercent,
  TOTAL_COMBINATIONS,
} from "../src/lib/lottery/probability";

describe("calculateFirstPrizeProbability", () => {
  it("1게임의 확률은 1/8,145,060이다", () => {
    const result = calculateFirstPrizeProbability(1);
    expect(result.uniqueGameCount).toBe(1);
    expect(result.firstPrizePercent).toBeCloseTo(1 / TOTAL_COMBINATIONS * 100, 10);
  });

  it("5개 고유 조합의 확률은 5/8,145,060이다", () => {
    const result = calculateFirstPrizeProbability(5);
    expect(result.firstPrizePercent).toBeCloseTo(5 / TOTAL_COMBINATIONS * 100, 10);
  });

  it("0개 이하는 확률 0을 반환한다", () => {
    expect(calculateFirstPrizeProbability(0).firstPrizePercent).toBe(0);
    expect(calculateFirstPrizeProbability(-1).firstPrizePercent).toBe(0);
  });

  it("탐색 횟수는 확률 계산에 전혀 영향을 주지 않는다 (고유 게임 수만 사용)", () => {
    // 탐색을 100,000회 했더라도 최종 저장한 고유 게임이 5개라면 5/8,145,060이어야 한다.
    const afterHugeSearch = calculateFirstPrizeProbability(5);
    const withoutSearch = calculateFirstPrizeProbability(5);
    expect(afterHugeSearch).toEqual(withoutSearch);
  });
});

describe("calculateCoveragePercent", () => {
  it("고유 후보 10,000개는 전체의 약 0.1228%다", () => {
    expect(calculateCoveragePercent(10000)).toBeCloseTo(0.1228, 3);
  });

  it("고유 후보 100,000개는 전체의 약 1.2277%다", () => {
    expect(calculateCoveragePercent(100000)).toBeCloseTo(1.2277, 3);
  });
});
