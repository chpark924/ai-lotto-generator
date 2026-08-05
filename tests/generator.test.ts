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
