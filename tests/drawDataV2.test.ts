/**
 * 2026-11-15 — 총판매액 필드 버그 수정(dataVersion 2) 검증.
 *
 * 동행복권 API의 rlvtEpsdSumNtslAmt는 실제 총판매액의 절반 수준이라(1057회: 56,261,943,500 vs
 * wholEpsdSumNtslAmt 112,523,887,000), 로또 연구소 "기대 대비 실제 1등 당첨자 수" 카드가 기대
 * 인원을 절반으로 계산해 비율을 약 2배로 부풀려 보여줬다. 이제 whole 값을 쓰고, 옛 레코드는
 * 같은 당첨번호의 새 레코드로만 보강한다.
 */
import { buildDrawFromApiItem, type RawDrawListItem } from "../src/lib/draws/drawApi";
import { computeFirstPrizeExpectation } from "../src/lib/draws/drawStats";
import type { WinningDraw } from "../src/lib/draws/types";

// 1057회 실제 공식 API 응답(2026-11-15 조회).
const RAW_1057: RawDrawListItem = {
  ltEpsd: 1057,
  ltRflYmd: "20230304",
  tm1WnNo: 8,
  tm2WnNo: 13,
  tm3WnNo: 19,
  tm4WnNo: 27,
  tm5WnNo: 40,
  tm6WnNo: 45,
  bnsWnNo: 12,
  rnk1WnNope: 17,
  rnk1WnAmt: 1616069714,
  rlvtEpsdSumNtslAmt: 56261943500,
  wholEpsdSumNtslAmt: 112523887000,
  rnk2WnNope: 664,
  rnk3WnNope: 2962,
  rnk4WnNope: 146471,
  rnk5WnNope: 2461496,
  rnk2WnAmt: 6895880,
  rnk3WnAmt: 1545870,
  rnk4WnAmt: 50000,
  rnk5WnAmt: 5000,
  winType1: 13,
  winType2: 4,
  winType3: 0,
};

describe("buildDrawFromApiItem", () => {
  it("총판매액은 wholEpsdSumNtslAmt를 쓰고 1~5등 인원·금액·자동/수동을 채운다", () => {
    const draw = buildDrawFromApiItem(RAW_1057);
    expect(draw.totalSalesAmount).toBe(112523887000);
    expect(draw.rankWinnerCounts).toEqual([17, 664, 2962, 146471, 2461496]);
    expect(draw.rankPrizeAmounts).toEqual([1616069714, 6895880, 1545870, 50000, 5000]);
    expect(draw.firstPrizeWinTypes).toEqual({ auto: 13, manual: 4, semiAuto: 0 });
    expect(draw.dataVersion).toBe(2);
    expect(draw.numbers).toEqual([8, 13, 19, 27, 40, 45]);
  });

  it("보강 필드가 없는 옛 응답이면 그 필드만 비워 둔다", () => {
    const { wholEpsdSumNtslAmt: _w, rnk2WnNope: _r, winType1: _t, ...legacy } = RAW_1057;
    const draw = buildDrawFromApiItem(legacy as RawDrawListItem);
    expect(draw.totalSalesAmount).toBeUndefined();
    expect(draw.rankWinnerCounts).toBeUndefined();
    expect(draw.firstPrizeWinTypes).toBeUndefined();
  });
});

describe("computeFirstPrizeExpectation", () => {
  it("dataVersion 2면 실제 총판매액으로 기대 인원을 계산한다(1057회: 약 13.8명)", () => {
    const result = computeFirstPrizeExpectation(buildDrawFromApiItem(RAW_1057));
    expect(result).not.toBeNull();
    expect(result!.estimatedGameCount).toBe(112523887);
    expect(result!.expectedWinnerCount).toBeCloseTo(112523887 / 8145060, 6);
  });

  it("옛 형식(dataVersion 없음) 레코드는 총판매액을 믿을 수 없어 null(카드 숨김)", () => {
    const legacy: WinningDraw = {
      drawNumber: 1057,
      drawDate: "2023-03-04",
      numbers: [8, 13, 19, 27, 40, 45],
      bonusNumber: 12,
      firstPrizeWinnerCount: 17,
      firstPrizeAmount: 1616069714,
      totalSalesAmount: 56261943500,
    };
    expect(computeFirstPrizeExpectation(legacy)).toBeNull();
  });
});

describe("githubDataSource — 보강 필드 검증", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("형식이 깨진 보강 필드는 그 필드와 dataVersion만 지우고 회차는 살린다", async () => {
    const good = buildDrawFromApiItem(RAW_1057);
    const broken = { ...buildDrawFromApiItem({ ...RAW_1057, ltEpsd: 1058 }), rankWinnerCounts: [1, 2, "x"] };
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [good, broken] }) as unknown as typeof fetch;
    const { fetchAllDrawsFromGithub } = await import("../src/lib/draws/githubDataSource");
    const draws = await fetchAllDrawsFromGithub();
    expect(draws).toHaveLength(2);
    expect(draws![0]).toEqual(good);
    expect(draws![1].rankWinnerCounts).toBeUndefined();
    expect(draws![1].dataVersion).toBeUndefined();
    expect(draws![1].numbers).toEqual([8, 13, 19, 27, 40, 45]);
  });
});

describe("drawCache — 옛 레코드 보강", () => {
  function v1(drawNumber: number, numbers: WinningDraw["numbers"]): WinningDraw {
    return {
      drawNumber,
      drawDate: "2023-03-04",
      numbers,
      bonusNumber: 12,
      firstPrizeWinnerCount: 17,
      firstPrizeAmount: 1616069714,
      totalSalesAmount: 56261943500,
    };
  }

  async function run(cached: Record<number, WinningDraw>, github: WinningDraw[]) {
    jest.resetModules();
    const store = new Map<string, string>([["winningDraws", JSON.stringify(cached)]]);
    jest.doMock("../src/lib/storage/storage", () => ({
      readJson: jest.fn(async (key: string, fallback: unknown) => {
        const raw = store.get(key);
        return raw !== undefined ? JSON.parse(raw) : fallback;
      }),
      writeJson: jest.fn(async (key: string, value: unknown) => {
        store.set(key, JSON.stringify(value));
      }),
    }));
    jest.doMock("../src/lib/draws/drawApi", () => ({
      fetchWinningDrawWithStatus: jest.fn(async () => ({ status: "network_error" })),
      fetchWinningDraw: jest.fn(async () => null),
      estimateLatestDrawNumber: jest.fn(() => 1250),
    }));
    jest.doMock("../src/lib/draws/githubDataSource", () => ({
      isGithubDataSourceConfigured: jest.fn(() => true),
      fetchAllDrawsFromGithub: jest.fn(async () => github),
    }));
    const { getDrawByNumber } = await import("../src/lib/draws/drawCache");
    const draw = await getDrawByNumber(1057);
    jest.dontMock("../src/lib/storage/storage");
    jest.dontMock("../src/lib/draws/drawApi");
    jest.dontMock("../src/lib/draws/githubDataSource");
    return draw;
  }

  it("당첨번호가 같으면 옛 레코드를 새 형식으로 보강한다", async () => {
    const upgraded = buildDrawFromApiItem(RAW_1057);
    const draw = await run({ 1057: v1(1057, [8, 13, 19, 27, 40, 45]) }, [upgraded]);
    expect(draw?.dataVersion).toBe(2);
    expect(draw?.totalSalesAmount).toBe(112523887000);
  });

  it("당첨번호가 다르면 절대 덮어쓰지 않는다(먼저 들어온 번호가 진실)", async () => {
    const tampered = { ...buildDrawFromApiItem(RAW_1057), numbers: [1, 2, 3, 4, 5, 6] as WinningDraw["numbers"] };
    const draw = await run({ 1057: v1(1057, [8, 13, 19, 27, 40, 45]) }, [tampered]);
    expect(draw?.numbers).toEqual([8, 13, 19, 27, 40, 45]);
    expect(draw?.dataVersion).toBeUndefined();
  });
});
