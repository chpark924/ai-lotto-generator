/**
 * src/lib/jackpot/githubSource.ts 검증.
 *
 * 2026-09-27 QA(실사고): 이 값을 매시간 갱신해야 할 GitHub Actions가 조용히 21시간+
 * 멈춰 있었는데도 이 모듈에 신선도 검사가 없어, 홈 화면이 새 회차 라벨에 하루 전
 * (사실상 직전 회차) 데이터를 그대로 붙여 보여주는 사고가 있었다 — 이 테스트의 핵심은
 * "너무 오래된 값은 null로 취급해 화면에서 숨겨지는지"를 확인하는 것이다.
 */
import { fetchJackpotInfoFromGithub, isGithubJackpotSourceConfigured } from "../src/lib/jackpot/githubSource";

function sampleJackpot(overrides: Partial<{ expectedRank1Amount: number; accumulatedSalesAmount: number | null; fetchedAt: string }> = {}) {
  return {
    expectedRank1Amount: 25_930_177_261,
    accumulatedSalesAmount: 107_814_625_000,
    fetchedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("isGithubJackpotSourceConfigured", () => {
  it("저장소 정보가 채워져 있으면 true다", () => {
    expect(isGithubJackpotSourceConfigured()).toBe(true);
  });
});

describe("fetchJackpotInfoFromGithub", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("raw.githubusercontent.com의 정확한 저장소 경로로 요청한다", async () => {
    const fetchSpy = jest.fn().mockResolvedValue({ ok: true, json: async () => sampleJackpot() });
    global.fetch = fetchSpy as unknown as typeof fetch;

    await fetchJackpotInfoFromGithub();

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://raw.githubusercontent.com/chpark924/ai-lotto-generator/main/data/lotto-jackpot.json",
      expect.anything()
    );
  });

  it("방금(1시간 이내) 받아온 값이면 그대로 반환한다", async () => {
    const fresh = sampleJackpot({ fetchedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString() });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => fresh }) as unknown as typeof fetch;

    await expect(fetchJackpotInfoFromGithub()).resolves.toEqual(fresh);
  });

  it("6시간 이내(버퍼 안)면 신선한 것으로 취급한다", async () => {
    const stillFresh = sampleJackpot({ fetchedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => stillFresh,
    }) as unknown as typeof fetch;

    await expect(fetchJackpotInfoFromGithub()).resolves.toEqual(stillFresh);
  });

  it("6시간을 넘겨 오래된 값이면 null을 반환한다(실제 사고 재현 — 21시간 묵은 값)", async () => {
    const stale = sampleJackpot({ fetchedAt: new Date(Date.now() - 21 * 60 * 60 * 1000).toISOString() });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => stale }) as unknown as typeof fetch;

    await expect(fetchJackpotInfoFromGithub()).resolves.toBeNull();
  });

  it("fetchedAt이 파싱 불가능한 문자열이면 null을 반환한다", async () => {
    const malformed = sampleJackpot({ fetchedAt: "not-a-date" });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => malformed,
    }) as unknown as typeof fetch;

    await expect(fetchJackpotInfoFromGithub()).resolves.toBeNull();
  });

  it("HTTP 오류 응답이면 null을 반환한다(throw하지 않음)", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;

    await expect(fetchJackpotInfoFromGithub()).resolves.toBeNull();
  });

  it("네트워크 자체가 실패해도 null을 반환한다(throw하지 않음)", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    await expect(fetchJackpotInfoFromGithub()).resolves.toBeNull();
  });

  it("구조가 이상한 응답이면 null을 반환한다", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ expectedRank1Amount: -1, fetchedAt: new Date().toISOString() }),
    }) as unknown as typeof fetch;

    await expect(fetchJackpotInfoFromGithub()).resolves.toBeNull();
  });
});
