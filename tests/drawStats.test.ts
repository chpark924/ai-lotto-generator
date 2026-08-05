import {
  computeNumberFrequencies,
  getLongestAbsentNumbers,
  computeCombinationPatternStats,
  computeSumTrend,
  SUM_MIDPOINT,
} from "../src/lib/draws/drawStats";
import type { WinningDraw } from "../src/lib/draws/types";

function draw(overrides: Partial<WinningDraw>): WinningDraw {
  return {
    drawNumber: 1,
    drawDate: "2024-01-01",
    numbers: [1, 2, 3, 4, 5, 6],
    bonusNumber: 7,
    ...overrides,
  };
}

describe("computeCombinationPatternStats", () => {
  it("당첨번호가 없으면 0으로 채워진 통계를 반환한다 (네트워크 실패 시 로또 연구소 화면과 동일한 상황)", () => {
    const stats = computeCombinationPatternStats([]);
    expect(stats).toEqual({
      averageOddCount: 0,
      averageLowCount: 0,
      averageSum: 0,
      consecutiveRatio: 0,
    });
  });

  it("실제 회차 데이터가 있으면 평균값을 정확히 계산한다", () => {
    const draws: WinningDraw[] = [
      draw({ drawNumber: 100, numbers: [1, 2, 3, 4, 5, 6], bonusNumber: 7 }),
      draw({ drawNumber: 101, numbers: [10, 20, 30, 40, 41, 45], bonusNumber: 8 }),
    ];

    const stats = computeCombinationPatternStats(draws);

    // 홀수 개수: [1,3,5]=3개, [41,45]=2개 → 평균 2.5
    expect(stats.averageOddCount).toBeCloseTo(2.5, 6);
    // 저번호(1~22) 개수: [1..6]=6개, [10,20]=2개 → 평균 4.0
    expect(stats.averageLowCount).toBeCloseTo(4.0, 6);
    // 번호 합: 21, 186 → 평균 103.5
    expect(stats.averageSum).toBeCloseTo(103.5, 6);
    // 두 회차 모두 연속번호(1~6은 전체 연속, 40·41은 2연속)를 포함 → 100%
    expect(stats.consecutiveRatio).toBeCloseTo(1, 6);
  });

  it("draws.length가 1이어도 0으로 나누지 않고 정상 계산한다", () => {
    const stats = computeCombinationPatternStats([
      draw({ numbers: [1, 2, 4, 8, 16, 32], bonusNumber: 9 }),
    ]);
    expect(Number.isFinite(stats.averageOddCount)).toBe(true);
    expect(Number.isFinite(stats.averageLowCount)).toBe(true);
    expect(Number.isFinite(stats.averageSum)).toBe(true);
    expect(Number.isFinite(stats.consecutiveRatio)).toBe(true);
  });
});

describe("computeNumberFrequencies / getLongestAbsentNumbers", () => {
  it("출현 횟수와 마지막 출현 회차를 정확히 집계한다", () => {
    const draws: WinningDraw[] = [
      draw({ drawNumber: 100, numbers: [1, 2, 3, 4, 5, 6], bonusNumber: 45 }),
      draw({ drawNumber: 101, numbers: [1, 10, 20, 30, 40, 41], bonusNumber: 6 }),
    ];
    const freq = computeNumberFrequencies(draws);
    const byNumber = new Map(freq.map((f) => [f.number, f]));

    expect(byNumber.get(1)?.totalCount).toBe(2);
    expect(byNumber.get(1)?.lastDrawNumber).toBe(101);
    expect(byNumber.get(6)?.totalCount).toBe(1);
    expect(byNumber.get(6)?.bonusCount).toBe(1);
    expect(byNumber.get(45)?.bonusCount).toBe(1);
    expect(byNumber.get(15)?.totalCount).toBe(0);
    expect(byNumber.get(15)?.lastDrawNumber).toBeNull();
  });

  it("한 번도 안 나온 번호를 장기 미출현 상위에 올린다", () => {
    const draws: WinningDraw[] = [draw({ drawNumber: 100, numbers: [1, 2, 3, 4, 5, 6], bonusNumber: 7 })];
    const freq = computeNumberFrequencies(draws);
    const absent = getLongestAbsentNumbers(freq, 100, 3);
    expect(absent).toHaveLength(3);
    // 100회 동안 한 번도 안 나온 번호는 drawsSinceLastSeen === 100 이어야 한다.
    for (const a of absent) {
      expect(a.drawsSinceLastSeen).toBe(100);
      expect([1, 2, 3, 4, 5, 6]).not.toContain(a.number);
    }
  });
});

describe("computeSumTrend", () => {
  it("이론적 중간값(138)은 최소합(21)과 최대합(255)의 정중앙이다", () => {
    const minSum = 1 + 2 + 3 + 4 + 5 + 6;
    const maxSum = 40 + 41 + 42 + 43 + 44 + 45;
    expect((minSum + maxSum) / 2).toBe(SUM_MIDPOINT);
  });

  it("합계를 정확히 계산하고 중간값 기준으로 고/저를 정확히 분류한다", () => {
    const draws: WinningDraw[] = [
      draw({ drawNumber: 1, numbers: [1, 2, 3, 4, 5, 6] }), // 합 21 → 저
      draw({ drawNumber: 2, numbers: [40, 41, 42, 43, 44, 45] }), // 합 255 → 고
      draw({ drawNumber: 3, numbers: [23, 24, 25, 26, 27, 13] }), // 합 138 → 정확히 138(경계값)은 고로 취급
    ];
    const trend = computeSumTrend(draws);

    const byDraw = new Map(trend.map((p) => [p.drawNumber, p]));
    expect(byDraw.get(1)).toMatchObject({ sum: 21, isHigh: false });
    expect(byDraw.get(2)).toMatchObject({ sum: 255, isHigh: true });
    expect(byDraw.get(3)).toMatchObject({ sum: 138, isHigh: true });
  });

  it("입력 순서와 무관하게 항상 회차 오름차순(과거→최신)으로 반환한다", () => {
    const draws: WinningDraw[] = [
      draw({ drawNumber: 300, numbers: [1, 2, 3, 4, 5, 6] }),
      draw({ drawNumber: 100, numbers: [1, 2, 3, 4, 5, 6] }),
      draw({ drawNumber: 200, numbers: [1, 2, 3, 4, 5, 6] }),
    ];
    const trend = computeSumTrend(draws);
    expect(trend.map((p) => p.drawNumber)).toEqual([100, 200, 300]);
  });

  it("빈 배열이면 빈 배열을 반환한다", () => {
    expect(computeSumTrend([])).toEqual([]);
  });
});
