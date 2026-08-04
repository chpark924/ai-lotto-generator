import { computeRank, RANK_LABELS } from "../src/lib/draws/rank";
import type { WinningDraw } from "../src/lib/draws/types";

function makeDraw(numbers: number[], bonusNumber: number): WinningDraw {
  return {
    drawNumber: 1230,
    drawDate: "2026-07-25",
    numbers: numbers as WinningDraw["numbers"],
    bonusNumber,
    firstPrizeWinnerCount: 10,
    firstPrizeAmount: 2_000_000_000,
    totalSalesAmount: 90_000_000_000,
  };
}

describe("computeRank (당첨 확인 등수 계산)", () => {
  const draw = makeDraw([1, 2, 3, 4, 5, 6], 7);

  it("6개 일치 -> 1등", () => {
    expect(computeRank([1, 2, 3, 4, 5, 6], draw)).toBe(1);
  });

  it("5개 일치 + 보너스 일치 -> 2등", () => {
    expect(computeRank([1, 2, 3, 4, 5, 7], draw)).toBe(2);
  });

  it("5개 일치, 보너스 불일치 -> 3등", () => {
    expect(computeRank([1, 2, 3, 4, 5, 8], draw)).toBe(3);
  });

  it("4개 일치 -> 4등", () => {
    expect(computeRank([1, 2, 3, 4, 8, 9], draw)).toBe(4);
  });

  it("3개 일치 -> 5등", () => {
    expect(computeRank([1, 2, 3, 8, 9, 10], draw)).toBe(5);
  });

  it("2개 이하 일치 -> 낙첨(0)", () => {
    expect(computeRank([1, 2, 8, 9, 10, 11], draw)).toBe(0);
    expect(computeRank([8, 9, 10, 11, 12, 13], draw)).toBe(0);
  });

  it("보너스 번호만 일치하고 본번호 5개 미만이면 등수에 영향 없음", () => {
    // 본번호 4개 + 보너스 일치 → 보너스는 2등 조건(5개 일치 시)에서만 의미가 있고
    // 4개 일치에서는 그대로 4등이어야 한다.
    expect(computeRank([1, 2, 3, 4, 7, 9], draw)).toBe(4);
  });

  it("RANK_LABELS가 0~5 모든 등수를 커버한다", () => {
    for (let rank = 0; rank <= 5; rank += 1) {
      expect(RANK_LABELS[rank]).toBeDefined();
    }
  });
});
