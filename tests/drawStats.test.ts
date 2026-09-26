import {
  computeNumberFrequencies,
  getLongestAbsentNumbers,
  getTopFrequentNumbers,
  getNumbersAbsentInLastDraws,
  getSakaiAverageFrequencyNumbers,
  computeCombinationPatternStats,
  computeSumTrend,
  SUM_MIDPOINT,
  calculateNetPrize,
  computeFirstPrizeNetPayout,
  computeConsecutiveNumberStats,
  computeConsecutivePairGapStats,
  describeConsecutiveGap,
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

  it("보너스 번호로만 나온 경우도 lastDrawNumber가 갱신되어 '장기 미출현'에서 즉시 빠진다 (QA_LOG 81번 후속)", () => {
    const draws: WinningDraw[] = [
      // 44번은 이 표본 내내 본번호로는 한 번도 안 나오고, 최신 회차(102)에서 보너스로만 나온다.
      draw({ drawNumber: 100, numbers: [1, 2, 3, 4, 5, 6], bonusNumber: 7 }),
      draw({ drawNumber: 101, numbers: [8, 9, 10, 11, 12, 13], bonusNumber: 14 }),
      draw({ drawNumber: 102, numbers: [15, 16, 17, 18, 19, 20], bonusNumber: 44 }),
    ];
    const freq = computeNumberFrequencies(draws);
    const byNumber = new Map(freq.map((f) => [f.number, f]));

    // totalCount(본번호 출현 빈도)는 여전히 0 — 보너스는 별도 개념이라 여기 안 섞인다.
    expect(byNumber.get(44)?.totalCount).toBe(0);
    expect(byNumber.get(44)?.bonusCount).toBe(1);
    // 반면 lastDrawNumber는 보너스로 나온 102회로 갱신된다.
    expect(byNumber.get(44)?.lastDrawNumber).toBe(102);

    const absent = getLongestAbsentNumbers(freq, 102, 6);
    // 방금(102회) 보너스로 나왔으므로 drawsSinceLastSeen === 0이 되어 "장기 미출현" 상위 6개에
    // 들어가면 안 된다.
    expect(absent.map((a) => a.number)).not.toContain(44);
  });
});

describe("getTopFrequentNumbers (고빈도 당첨번호 상위권 포함 토글용)", () => {
  it("출현 횟수 상위 N개 번호를 내림차순으로 반환한다", () => {
    const draws: WinningDraw[] = [
      draw({ drawNumber: 1, numbers: [1, 2, 3, 4, 5, 6] }),
      draw({ drawNumber: 2, numbers: [1, 2, 3, 4, 5, 7] }),
      draw({ drawNumber: 3, numbers: [1, 2, 3, 4, 8, 9] }),
    ];
    // 1,2,3,4는 3회, 5는 2회, 나머지는 1회씩.
    const top4 = getTopFrequentNumbers(draws, 4);
    expect(top4).toEqual([1, 2, 3, 4]);
  });

  it("동률이면 번호 오름차순으로 안정 정렬한다", () => {
    const draws: WinningDraw[] = [draw({ drawNumber: 1, numbers: [10, 20, 30, 40, 41, 45] })];
    const top3 = getTopFrequentNumbers(draws, 3);
    expect(top3).toEqual([10, 20, 30]);
  });

  it("표본이 비어 있으면 빈 배열을 반환한다", () => {
    expect(getTopFrequentNumbers([], 10)).toEqual([]);
  });
});

describe("getNumbersAbsentInLastDraws (장기 미출현번호 포함 토글용)", () => {
  it("주어진 표본 안에서 한 번도 나오지 않은 번호만 반환한다", () => {
    const draws: WinningDraw[] = [
      draw({ drawNumber: 1, numbers: [1, 2, 3, 4, 5, 6] }),
      draw({ drawNumber: 2, numbers: [1, 2, 3, 4, 5, 7] }),
    ];
    const absent = getNumbersAbsentInLastDraws(draws);
    expect(absent).not.toContain(1);
    expect(absent).not.toContain(7);
    expect(absent).toContain(8);
    expect(absent).toContain(45);
    expect(absent).toHaveLength(45 - 7); // 1,2,3,4,5,6,7 총 7개 번호만 출현
  });

  it("표본이 비어 있으면 빈 배열을 반환한다(전체 45개를 미출현으로 취급하지 않는다)", () => {
    expect(getNumbersAbsentInLastDraws([])).toEqual([]);
  });
});

describe("getSakaiAverageFrequencyNumbers (사카이 분석 패턴 배지용)", () => {
  it("지정 구간(기본 3~4회) 안에 드는 번호만 반환한다", () => {
    const draws: WinningDraw[] = [
      draw({ drawNumber: 1, numbers: [1, 2, 3, 4, 5, 6] }),
      draw({ drawNumber: 2, numbers: [1, 2, 3, 7, 8, 9] }),
      draw({ drawNumber: 3, numbers: [1, 2, 10, 11, 12, 13] }),
      draw({ drawNumber: 4, numbers: [1, 14, 15, 16, 17, 18] }),
    ];
    // 1번은 4회, 2번은 3회, 3번은 2회, 나머지는 1회씩 출현.
    const result = getSakaiAverageFrequencyNumbers(draws);
    expect(result).toContain(1); // 4회
    expect(result).toContain(2); // 3회
    expect(result).not.toContain(3); // 2회(구간 밖)
    expect(result).not.toContain(6); // 1회(구간 밖)
  });

  it("표본이 비어 있으면 빈 배열을 반환한다", () => {
    expect(getSakaiAverageFrequencyNumbers([])).toEqual([]);
  });

  it("band 인자로 구간을 바꿀 수 있다", () => {
    const draws: WinningDraw[] = [
      draw({ drawNumber: 1, numbers: [1, 2, 3, 4, 5, 6] }),
      draw({ drawNumber: 2, numbers: [1, 2, 3, 4, 5, 6] }),
    ];
    expect(getSakaiAverageFrequencyNumbers(draws, [2, 2])).toEqual(
      expect.arrayContaining([1, 2, 3, 4, 5, 6])
    );
    expect(getSakaiAverageFrequencyNumbers(draws, [1, 1])).toEqual([]);
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
describe("calculateNetPrize", () => {
  it("200만원 미만이면 비과세 — 세금 0, 실수령액=세전 그대로", () => {
    expect(calculateNetPrize(1_000_000)).toEqual({ gross: 1_000_000, tax: 0, net: 1_000_000 });
  });

  it("200만원(경계값)부터는 과세 대상 — 22% 적용", () => {
    expect(calculateNetPrize(2_000_000)).toEqual({ gross: 2_000_000, tax: 440_000, net: 1_560_000 });
  });

  it("3억원(경계값)까지는 전액 22%", () => {
    expect(calculateNetPrize(300_000_000)).toEqual({
      gross: 300_000_000,
      tax: 66_000_000,
      net: 234_000_000,
    });
  });

  it("3억원 초과분만 33% — 3억까지는 계속 22%로 유지되는 누진 구조", () => {
    // 3억 * 22% + (4억-3억) * 33% = 66,000,000 + 33,000,000 = 99,000,000
    expect(calculateNetPrize(400_000_000)).toEqual({
      gross: 400_000_000,
      tax: 99_000_000,
      net: 301_000_000,
    });
  });

  it("0 이하이거나 유한하지 않은 값은 전부 0으로 처리한다", () => {
    expect(calculateNetPrize(0)).toEqual({ gross: 0, tax: 0, net: 0 });
    expect(calculateNetPrize(-1)).toEqual({ gross: 0, tax: 0, net: 0 });
    expect(calculateNetPrize(NaN)).toEqual({ gross: 0, tax: 0, net: 0 });
  });
});

describe("computeFirstPrizeNetPayout", () => {
  it("실제 1242회 데이터 기준 1인당 실수령액을 정확히 계산한다", () => {
    // firstPrizeAmount 3,281,029,250원 / 당첨자 9명 = 1인당 364,558,806원(반올림)
    const result = computeFirstPrizeNetPayout(
      draw({ drawNumber: 1242, firstPrizeAmount: 3_281_029_250, firstPrizeWinnerCount: 9 })
    );
    expect(result).toEqual({
      drawNumber: 1242,
      winnerCount: 9,
      grossPerWinner: 364_558_806,
      taxPerWinner: 87_304_406,
      netPerWinner: 277_254_400,
    });
  });

  it("1등 당첨자가 0명(이월)이면 1인당 금액이 정의되지 않으므로 null", () => {
    expect(
      computeFirstPrizeNetPayout(draw({ firstPrizeAmount: 0, firstPrizeWinnerCount: 0 }))
    ).toBeNull();
  });

  it("firstPrizeAmount/firstPrizeWinnerCount가 없으면(데이터 미확보) null", () => {
    expect(computeFirstPrizeNetPayout(draw({}))).toBeNull();
  });
});
describe("computeConsecutiveNumberStats", () => {
  // 연번(2연번 이상) 포함: [1,2,...], 3연번 포함: [1,2,3,...], 연번 없음: 전부 2 이상 차이
  const pairDraw = (n: number) => draw({ drawNumber: n, numbers: [1, 2, 10, 20, 30, 40] }); // 2연번만
  const tripleDraw = (n: number) => draw({ drawNumber: n, numbers: [1, 2, 3, 20, 30, 40] }); // 3연번(2연번도 포함)
  const noPairDraw = (n: number) => draw({ drawNumber: n, numbers: [1, 5, 10, 20, 30, 40] }); // 연번 없음

  it("전체/최근 표본의 연번·3연번 횟수와 비율을 정확히 계산한다", () => {
    // 최신순(내림차순) 5건: 3연번1 + 2연번1 + 무연번3
    const draws = [tripleDraw(5), pairDraw(4), noPairDraw(3), noPairDraw(2), noPairDraw(1)];
    const stats = computeConsecutiveNumberStats(draws, 3);
    expect(stats).toEqual({
      totalDraws: 5,
      pairCount: 2, // tripleDraw도 2연번 조건(maxConsecutive>=2)을 만족
      pairRate: 2 / 5,
      recentSampleSize: 3,
      recentPairCount: 2, // 최근 3건(tripleDraw, pairDraw, noPairDraw) 중 tripleDraw·pairDraw 둘 다 2연번 이상
      recentPairRate: 2 / 3,
      tripleCount: 1,
      tripleRate: 1 / 5,
      recentTripleCount: 1,
    });
  });

  it("빈 배열이면 null을 반환한다", () => {
    expect(computeConsecutiveNumberStats([], 52)).toBeNull();
  });
});

describe("computeConsecutivePairGapStats / describeConsecutiveGap", () => {
  // 과거→최신 순 20회 중 연번(2연번 이상) 발생 위치(0-index): 0, 3, 7, 12
  // gaps = [3, 4, 5] → 평균 4.0, 최장 5 / currentGap = 19 - 12 = 7
  // follow 체크: idx 0,3,7,12 전부 다음 회차가 미발생 → followRate 0, baseRate = 4/20 = 0.2
  const pairFlagsChrono = [
    true, false, false, true, false, false, false, true, false, false,
    false, false, true, false, false, false, false, false, false, false,
  ];

  function buildDrawsLatestFirst(flags: boolean[]): WinningDraw[] {
    // flags는 과거→최신 순. drawNumber도 과거→최신 순으로 부여한 뒤, 함수 계약대로 최신순으로 뒤집어 반환.
    const chrono = flags.map((hasPair, idx) =>
      draw({
        drawNumber: idx + 1,
        numbers: hasPair ? [1, 2, 10, 20, 30, 40] : [1, 5, 10, 20, 30, 40],
      })
    );
    return [...chrono].reverse();
  }

  it("공백 길이(평균/최장/현재)와 직전 회차 대비 독립성을 정확히 계산한다", () => {
    const draws = buildDrawsLatestFirst(pairFlagsChrono);
    const stats = computeConsecutivePairGapStats(draws);
    expect(stats).toEqual({
      currentGap: 7,
      averageGap: 4,
      longestGap: 5,
      followRate: 0,
      baseRate: 0.2,
    });
  });

  it("표본이 20회 미만이면 null(호출부는 카드를 숨겨야 함)", () => {
    const draws = buildDrawsLatestFirst(pairFlagsChrono.slice(0, 19));
    expect(computeConsecutivePairGapStats(draws)).toBeNull();
  });

  it("표본 내 연번이 한 번도 없으면 null", () => {
    const draws = buildDrawsLatestFirst(new Array(25).fill(false));
    expect(computeConsecutivePairGapStats(draws)).toBeNull();
  });

  it("describeConsecutiveGap: 이번 회차 출현/공백 1회/N회를 각각 올바른 문장으로 서술한다", () => {
    expect(
      describeConsecutiveGap({ currentGap: 0, averageGap: 2, longestGap: 5, followRate: 0.5, baseRate: 0.5 })
    ).toBe("이번 회차에 연속번호가 나왔어요.");
    expect(
      describeConsecutiveGap({ currentGap: 1, averageGap: 2, longestGap: 5, followRate: 0.5, baseRate: 0.5 })
    ).toBe("지난 회차부터 연속번호가 안 나왔어요.");
    expect(
      describeConsecutiveGap({ currentGap: 7, averageGap: 2, longestGap: 5, followRate: 0.5, baseRate: 0.5 })
    ).toBe("이번 회차까지 7회째 연속번호가 안 나왔어요.");
  });
});
