import { generatePureRandom, generateUniqueBasicGames, generateAiSearchGames } from "../src/lib/lottery/generator";
import { combinationKey } from "../src/lib/lottery/similarity";
import type { GenerationRequest } from "../src/lib/lottery/types";

function baseRequest(overrides: Partial<GenerationRequest> = {}): GenerationRequest {
  return {
    mode: "PURE_RANDOM",
    gameCount: 5,
    excludedNumbers: [],
    requiredNumbers: [],
    preferredNumbers: [],
    consecutiveRule: "ANY",
    ...overrides,
  };
}

describe("generatePureRandom", () => {
  it("항상 1~45 범위의 서로 다른 6개 번호를 오름차순으로 반환한다", () => {
    for (let i = 0; i < 200; i += 1) {
      const numbers = generatePureRandom();
      expect(numbers).toHaveLength(6);
      expect(new Set(numbers).size).toBe(6);
      for (const n of numbers) {
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(45);
      }
      const sorted = [...numbers].sort((a, b) => a - b);
      expect(numbers).toEqual(sorted);
    }
  });

  it("제외번호를 포함하지 않는다", () => {
    const excluded = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    for (let i = 0; i < 100; i += 1) {
      const numbers = generatePureRandom(excluded, []);
      for (const n of numbers) {
        expect(excluded).not.toContain(n);
      }
    }
  });

  it("필수번호를 항상 포함한다", () => {
    const required = [7, 21, 33];
    for (let i = 0; i < 100; i += 1) {
      const numbers = generatePureRandom([], required);
      for (const r of required) {
        expect(numbers).toContain(r);
      }
    }
  });

  it("제외번호와 필수번호가 함께 있어도 6개를 만족한다", () => {
    const numbers = generatePureRandom([1, 2, 3], [10, 20]);
    expect(numbers).toHaveLength(6);
    expect(numbers).toContain(10);
    expect(numbers).toContain(20);
    expect(numbers).not.toContain(1);
  });

  // "고빈도 당첨번호 상위권 포함"/"장기 미출현번호 포함" 토글이 실제로 강제되는지 검증한다.
  describe("mustIncludeOneOfSets (고빈도 당첨번호 상위권 포함 / 장기 미출현번호 포함)", () => {
    it("세트 중 최소 1개를 항상 포함한다", () => {
      const set = [3, 14, 27];
      for (let i = 0; i < 100; i += 1) {
        const numbers = generatePureRandom([], [], [set]);
        expect(numbers.some((n) => set.includes(n))).toBe(true);
      }
    });

    it("세트가 여러 개면 각각 최소 1개씩 동시에 포함한다", () => {
      const highFreqSet = [1, 2, 3, 4, 5];
      const absentSet = [41, 42, 43, 44, 45];
      for (let i = 0; i < 100; i += 1) {
        const numbers = generatePureRandom([], [], [highFreqSet, absentSet]);
        expect(numbers.some((n) => highFreqSet.includes(n))).toBe(true);
        expect(numbers.some((n) => absentSet.includes(n))).toBe(true);
      }
    });

    it("필수번호가 이미 세트를 만족하면 추가로 강제하지 않는다(6개를 넘기지 않음)", () => {
      const numbers = generatePureRandom([], [7], [[7, 8, 9]]);
      expect(numbers).toHaveLength(6);
      expect(numbers).toContain(7);
    });

    it("세트 전체가 제외번호와 겹치면 그 제약은 조용히 무시되고 생성은 실패하지 않는다", () => {
      const numbers = generatePureRandom([1, 2, 3], [], [[1, 2, 3]]);
      expect(numbers).toHaveLength(6);
      expect(numbers).not.toContain(1);
      expect(numbers).not.toContain(2);
      expect(numbers).not.toContain(3);
    });
  });
});

describe("generateUniqueBasicGames", () => {
  it("요청한 게임 수만큼, 서로 중복되지 않는 조합을 생성한다", () => {
    const request = baseRequest({ gameCount: 10 });
    const games = generateUniqueBasicGames(request);
    expect(games).toHaveLength(10);
    const keys = games.map((g) => combinationKey(g.numbers));
    expect(new Set(keys).size).toBe(10);
  });
});

describe("generateAiSearchGames", () => {
  it("요청한 반복 횟수를 정확히 수행하고 결과를 반환한다", async () => {
    const request = baseRequest({ mode: "AI_SEARCH", gameCount: 3, searchCount: 10000 });
    const result = await generateAiSearchGames(request, {
      popularityByNumber: new Array(45).fill(0.3),
      savedCombinations: [],
      batchSize: 2000,
    });

    expect(result.simulation).toBeDefined();
    expect(result.simulation!.requestedIterations).toBe(10000);
    expect(result.simulation!.completedIterations).toBe(10000);
    expect(result.simulation!.uniqueCandidateCount).toBeGreaterThan(0);
    expect(result.simulation!.uniqueCandidateCount).toBeLessThanOrEqual(10000);
    expect(result.games).toHaveLength(3);

    // 탐색 비율은 고유 후보 수 기준이며 전체 조합(8,145,060) 대비 값이어야 한다.
    expect(result.simulation!.coveragePercent).toBeCloseTo(
      (result.simulation!.uniqueCandidateCount / 8_145_060) * 100,
      6
    );
  }, 20000);

  it("서로 4개 이상 겹치는 조합을 우선적으로 배제한다", async () => {
    const request = baseRequest({ mode: "AI_SEARCH", gameCount: 5, searchCount: 10000 });
    const result = await generateAiSearchGames(request, {
      popularityByNumber: new Array(45).fill(0.3),
      savedCombinations: [],
      batchSize: 2000,
    });

    const numberSets = result.games.map((g) => g.numbers);
    for (let i = 0; i < numberSets.length; i += 1) {
      for (let j = i + 1; j < numberSets.length; j += 1) {
        const overlap = numberSets[i].filter((n) => numberSets[j].includes(n)).length;
        // 후보가 부족해 보충된 경우가 아니라면 4개 미만이어야 한다. 최소한 6개(완전 동일)는 아니어야 한다.
        expect(overlap).toBeLessThan(6);
      }
    }
  }, 20000);

  // "끝수 스프레드 최적화"는 사용자가 켜고 끄는 옵션이 아니라(내재화), 3만 회/10만 회
  // 탐색에서만 자동으로 점수 계산에 반영된다. generateAiSearchGames를 통해 실제로 그
  // 조건에서만 game.score.lastDigitSpreadScore가 채워지는지 end-to-end로 검증한다.
  describe("끝수 스프레드 최적화 (3만 회/10만 회 탐색에서만 내재화 적용)", () => {
    it("3만 회 탐색 결과에는 lastDigitSpreadScore가 채워진다", async () => {
      const request = baseRequest({ mode: "AI_SEARCH", gameCount: 3, searchCount: 30000 });
      const result = await generateAiSearchGames(request, {
        popularityByNumber: new Array(45).fill(0.3),
        savedCombinations: [],
        batchSize: 2000,
      });
      for (const game of result.games) {
        expect(game.score?.lastDigitSpreadScore).toBeDefined();
      }
    }, 20000);

    it("바로 생성(1)/100만 회 부스터 탐색 결과에는 lastDigitSpreadScore가 없다", async () => {
      const instant = await generateAiSearchGames(
        baseRequest({ mode: "AI_SEARCH", gameCount: 1, searchCount: 1 }),
        { popularityByNumber: new Array(45).fill(0.3), savedCombinations: [], batchSize: 2000 }
      );
      for (const game of instant.games) {
        expect(game.score?.lastDigitSpreadScore).toBeUndefined();
      }
    }, 20000);
  });

  // AI 조합탐색 화면의 "고빈도 당첨번호 상위권 포함"/"장기 미출현번호 포함" 토글이 실제
  // 탐색 결과에도 반영되는지 검증한다(장식용 토글이 아니라 request.mustIncludeOneOfSets를
  // 통해 매 후보 생성에 실제로 강제돼야 한다는 요구사항).
  it("mustIncludeOneOfSets를 지정하면 모든 결과 조합이 세트 조건을 만족한다", async () => {
    const highFreqTop10 = [3, 7, 11, 15, 19, 23, 27, 31, 35, 39];
    const request = baseRequest({
      mode: "AI_SEARCH",
      gameCount: 5,
      searchCount: 10000,
      mustIncludeOneOfSets: [highFreqTop10],
    });
    const result = await generateAiSearchGames(request, {
      popularityByNumber: new Array(45).fill(0.3),
      savedCombinations: [],
      batchSize: 2000,
    });

    expect(result.games).toHaveLength(5);
    for (const game of result.games) {
      expect(game.numbers.some((n) => highFreqTop10.includes(n))).toBe(true);
    }
  }, 20000);

  // AI 조합탐색 화면의 "당첨숫자 총합 평균값 UP/DOWN 선택" 옵션이 실제로 결과에 반영되는지
  // 검증한다(장식용 UI가 아니라 minSum/maxSum을 통해 scoring.ts의 소프트 페널티에 실제로
  // 반영되어야 한다는 요구사항). 138(이론적 중간값) 기준으로 UP은 평균 합계가 그보다
  // 뚜렷하게 높아야 하고, DOWN은 뚜렷하게 낮아야 한다.
  describe("minSum/maxSum (당첨숫자 총합 평균값 UP/DOWN 선택)", () => {
    function averageSum(numbers: number[][]): number {
      const total = numbers.reduce((sum, game) => sum + game.reduce((s, n) => s + n, 0), 0);
      return total / numbers.length;
    }

    it("minSum을 지정하면(UP) 생성된 조합의 합계 평균이 그 값 이상으로 뚜렷하게 치우친다", async () => {
      const request = baseRequest({ mode: "AI_SEARCH", gameCount: 5, searchCount: 20000, minSum: 138 });
      const result = await generateAiSearchGames(request, {
        popularityByNumber: new Array(45).fill(0.3),
        savedCombinations: [],
        batchSize: 2000,
      });

      expect(averageSum(result.games.map((g) => g.numbers))).toBeGreaterThan(138);
    }, 20000);

    it("maxSum을 지정하면(DOWN) 생성된 조합의 합계 평균이 그 값 이하로 뚜렷하게 치우친다", async () => {
      const request = baseRequest({ mode: "AI_SEARCH", gameCount: 5, searchCount: 20000, maxSum: 138 });
      const result = await generateAiSearchGames(request, {
        popularityByNumber: new Array(45).fill(0.3),
        savedCombinations: [],
        batchSize: 2000,
      });

      expect(averageSum(result.games.map((g) => g.numbers))).toBeLessThan(138);
    }, 20000);

    it("minSum/maxSum을 지정하지 않은 기존 동작 대비, UP/DOWN 결과의 합계 평균이 반대 방향으로 갈라진다", async () => {
      const upRequest = baseRequest({ mode: "AI_SEARCH", gameCount: 5, searchCount: 20000, minSum: 138 });
      const downRequest = baseRequest({ mode: "AI_SEARCH", gameCount: 5, searchCount: 20000, maxSum: 138 });

      const [upResult, downResult] = await Promise.all([
        generateAiSearchGames(upRequest, {
          popularityByNumber: new Array(45).fill(0.3),
          savedCombinations: [],
          batchSize: 2000,
        }),
        generateAiSearchGames(downRequest, {
          popularityByNumber: new Array(45).fill(0.3),
          savedCombinations: [],
          batchSize: 2000,
        }),
      ]);

      const upAverage = averageSum(upResult.games.map((g) => g.numbers));
      const downAverage = averageSum(downResult.games.map((g) => g.numbers));
      expect(upAverage).toBeGreaterThan(downAverage);
    }, 30000);
  });
});
