/**
 * githubDataSource.ts 검증. 35번 항목(QA_LOG.md) — GitHub에 커밋된 정적 JSON을 받아오는 계층.
 * 이 모듈은 "절대 throw하지 않는다"가 핵심 계약이라, 그 부분을 특히 꼼꼼히 확인한다.
 *
 * GITHUB_OWNER/GITHUB_REPO가 실제 저장소(chpark924/ai-lotto-generator)로 채워진 뒤라
 * fetch 로직까지 실제로 검증할 수 있다(이전엔 플레이스홀더라 조기 반환 경로만 테스트했음).
 */
import { fetchAllDrawsFromGithub, isGithubDataSourceConfigured } from "../src/lib/draws/githubDataSource";
import type { WinningDraw } from "../src/lib/draws/types";

function sampleDraw(overrides: Partial<WinningDraw> = {}): WinningDraw {
  return {
    drawNumber: 1000,
    drawDate: "2026-01-01",
    numbers: [1, 2, 3, 4, 5, 6],
    bonusNumber: 7,
    firstPrizeWinnerCount: 10,
    firstPrizeAmount: 2000000000,
    totalSalesAmount: 90000000000,
    ...overrides,
  };
}

describe("isGithubDataSourceConfigured", () => {
  it("저장소 정보가 채워져 있으면 true다", () => {
    expect(isGithubDataSourceConfigured()).toBe(true);
  });
});

describe("fetchAllDrawsFromGithub", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("raw.githubusercontent.com의 정확한 저장소 경로로 요청한다", async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [sampleDraw()],
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    await fetchAllDrawsFromGithub();

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://raw.githubusercontent.com/chpark924/ai-lotto-generator/main/data/lotto-draws.json",
      expect.anything()
    );
  });

  it("정상 응답이면 유효한 항목들을 그대로 반환한다", async () => {
    const draws = [sampleDraw({ drawNumber: 1000 }), sampleDraw({ drawNumber: 1001 })];
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => draws }) as unknown as typeof fetch;

    const result = await fetchAllDrawsFromGithub();

    expect(result).toEqual(draws);
  });

  it("형식이 이상한 항목은 걸러내고 유효한 항목만 남긴다", async () => {
    const valid = sampleDraw({ drawNumber: 1000 });
    const invalidDuplicateNumbers = sampleDraw({ drawNumber: 1001, numbers: [1, 1, 3, 4, 5, 6] });
    const invalidOutOfRange = sampleDraw({ drawNumber: 1002, numbers: [1, 2, 3, 4, 5, 46] });
    const invalidBonusMatchesMain = sampleDraw({ drawNumber: 1003, bonusNumber: 1 });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [valid, invalidDuplicateNumbers, invalidOutOfRange, invalidBonusMatchesMain],
    }) as unknown as typeof fetch;

    const result = await fetchAllDrawsFromGithub();

    expect(result).toEqual([valid]);
  });

  it("HTTP 오류 응답이면 null을 반환한다(throw하지 않음)", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;

    await expect(fetchAllDrawsFromGithub()).resolves.toBeNull();
  });

  it("네트워크 자체가 실패해도 null을 반환한다(throw하지 않음)", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    await expect(fetchAllDrawsFromGithub()).resolves.toBeNull();
  });

  it("배열이 아닌 응답이면 null을 반환한다", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ notAnArray: true }),
    }) as unknown as typeof fetch;

    await expect(fetchAllDrawsFromGithub()).resolves.toBeNull();
  });

  it("유효한 항목이 하나도 없으면 null을 반환한다", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ drawNumber: -1 }],
    }) as unknown as typeof fetch;

    await expect(fetchAllDrawsFromGithub()).resolves.toBeNull();
  });
});
