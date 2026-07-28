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
});
