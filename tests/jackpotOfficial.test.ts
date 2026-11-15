/**
 * 2026-11-15 — 예상 당첨금을 공식 API에서 직접 조회하고, 실패할 때만 GitHub JSON으로 폴백.
 */
import { fetchJackpotInfo, fetchJackpotInfoFromOfficial } from "../src/lib/jackpot";

describe("fetchJackpotInfoFromOfficial", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("공식 응답의 rnk1ExpcAmt를 그대로 쓴다", async () => {
    const spy = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { result: { rnk1ExpcAmt: 819019577, acmlRvnAmt: 3405387000 } } }),
    });
    global.fetch = spy as unknown as typeof fetch;
    const info = await fetchJackpotInfoFromOfficial();
    expect(info?.expectedRank1Amount).toBe(819019577);
    expect(info?.accumulatedSalesAmount).toBe(3405387000);
    expect(String(spy.mock.calls[0][0])).toContain("https://www.dhlottery.co.kr/lt645/selectRnk1ExpcAmt.do");
  });

  it("0원(추첨 직후)·이상한 값·오류는 null", async () => {
    for (const body of [{ data: { result: { rnk1ExpcAmt: 0 } } }, { data: {} }, { data: { result: { rnk1ExpcAmt: "1" } } }]) {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => body }) as unknown as typeof fetch;
      await expect(fetchJackpotInfoFromOfficial()).resolves.toBeNull();
    }
    global.fetch = jest.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;
    await expect(fetchJackpotInfoFromOfficial()).resolves.toBeNull();
  });
});

describe("fetchJackpotInfo", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("공식 조회가 실패하면 GitHub JSON으로 폴백한다", async () => {
    const githubPayload = { expectedRank1Amount: 777, accumulatedSalesAmount: null, fetchedAt: new Date().toISOString() };
    global.fetch = jest.fn(async (url: string) => {
      if (String(url).includes("dhlottery")) return { ok: false, json: async () => ({}) };
      return { ok: true, json: async () => githubPayload };
    }) as unknown as typeof fetch;
    await expect(fetchJackpotInfo()).resolves.toEqual(githubPayload);
  });

  it("공식 조회가 성공하면 GitHub은 부르지 않는다", async () => {
    const spy = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { result: { rnk1ExpcAmt: 123456789 } } }),
    });
    global.fetch = spy as unknown as typeof fetch;
    const info = await fetchJackpotInfo();
    expect(info?.expectedRank1Amount).toBe(123456789);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
