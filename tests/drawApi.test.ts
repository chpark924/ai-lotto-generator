import {
  estimateLatestDrawNumber,
  estimateDrawDate,
  isPlausibleWinningDraw,
  fetchWinningDrawWithStatus,
  buildOfficialPurchasePageUrl,
  type RawDrawListItem,
} from "../src/lib/draws/drawApi";

function validRawItem(overrides: Partial<RawDrawListItem> = {}): RawDrawListItem {
  return {
    ltEpsd: 1235,
    ltRflYmd: "20260808",
    tm1WnNo: 3,
    tm2WnNo: 11,
    tm3WnNo: 19,
    tm4WnNo: 27,
    tm5WnNo: 35,
    tm6WnNo: 44,
    bnsWnNo: 21,
    rnk1WnNope: 10,
    rnk1WnAmt: 2000000000,
    rlvtEpsdSumNtslAmt: 90000000000,
    ...overrides,
  };
}

function mockFetchOnce(list: unknown, ok = true) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    json: async () => ({ resultCode: null, resultMessage: null, data: { list } }),
  }) as unknown as typeof fetch;
}

describe("buildOfficialPurchasePageUrl", () => {
  it("동행복권 공식 도메인(dhlottery.co.kr)의 로또6/45 소개 페이지를 가리킨다", () => {
    expect(buildOfficialPurchasePageUrl()).toBe("https://www.dhlottery.co.kr/lt645/intro");
  });
});

describe("estimateDrawDate / estimateLatestDrawNumber", () => {
  it("estimateDrawDate(1)은 실제 1회차 추첨일(2002-12-07)과 같다", () => {
    const date = estimateDrawDate(1);
    expect(date.getUTCFullYear()).toBe(2002);
    expect(date.getUTCMonth()).toBe(11); // 0-indexed → 12월
    expect(date.getUTCDate()).toBe(6); // KST 00:00은 UTC 전날 15:00
  });

  it("연속된 회차는 정확히 7일 간격이다", () => {
    const d1 = estimateDrawDate(500);
    const d2 = estimateDrawDate(501);
    const diffDays = (d2.getTime() - d1.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBe(7);
  });

  it("estimateDrawDate는 estimateLatestDrawNumber의 정확한 역함수다 (여러 기준일에서 왕복 검증)", () => {
    const sampleDates = [
      new Date("2026-08-03T10:00:00+09:00"), // 오늘 (평일)
      new Date("2026-08-08T10:00:00+09:00"), // 토요일
      new Date("2010-01-01T00:00:00+09:00"),
      new Date("2002-12-07T00:00:00+09:00"), // 1회차 당일
    ];

    for (const now of sampleDates) {
      const latest = estimateLatestDrawNumber(now);
      const latestDate = estimateDrawDate(latest);
      const nextDate = estimateDrawDate(latest + 1);

      // "가장 최근 회차"의 추첨일은 기준 시각보다 미래일 수 없다.
      expect(latestDate.getTime()).toBeLessThanOrEqual(now.getTime());
      // 그다음 회차의 추첨일은 기준 시각보다 반드시 미래여야 한다.
      expect(nextDate.getTime()).toBeGreaterThan(now.getTime());
    }
  });

  it("이번 주/다음 주 빠른 지정 버튼에 쓰이는 회차가 항상 미래(아직 안 뽑힌) 회차다", () => {
    const now = new Date("2026-08-03T10:00:00+09:00");
    const thisWeek = estimateLatestDrawNumber(now) + 1;
    const nextWeek = thisWeek + 1;

    expect(estimateDrawDate(thisWeek).getTime()).toBeGreaterThan(now.getTime());
    expect(estimateDrawDate(nextWeek).getTime()).toBeGreaterThan(estimateDrawDate(thisWeek).getTime());
  });
});

describe("isPlausibleWinningDraw — 아직 추첨 안 한 회차를 당첨번호로 오인하지 않는지", () => {
  it("정상적인 응답은 신뢰한다", () => {
    expect(isPlausibleWinningDraw(validRawItem(), 1235)).toBe(true);
  });

  it("요청한 회차와 응답의 ltEpsd가 다르면 신뢰하지 않는다", () => {
    expect(isPlausibleWinningDraw(validRawItem({ ltEpsd: 1234 }), 1235)).toBe(false);
  });

  it("번호가 전부 0으로 채워진 것처럼 비정상이면 신뢰하지 않는다", () => {
    const zeroed = validRawItem({
      tm1WnNo: 0,
      tm2WnNo: 0,
      tm3WnNo: 0,
      tm4WnNo: 0,
      tm5WnNo: 0,
      tm6WnNo: 0,
      bnsWnNo: 0,
    });
    expect(isPlausibleWinningDraw(zeroed, 1235)).toBe(false);
  });

  it("번호가 1~45 범위를 벗어나면 신뢰하지 않는다", () => {
    expect(isPlausibleWinningDraw(validRawItem({ tm6WnNo: 46 }), 1235)).toBe(false);
  });

  it("번호에 중복이 있으면 신뢰하지 않는다", () => {
    expect(isPlausibleWinningDraw(validRawItem({ tm2WnNo: 3 }), 1235)).toBe(false); // tm1WnNo도 3
  });

  it("보너스번호가 본번호와 겹치면 신뢰하지 않는다", () => {
    expect(isPlausibleWinningDraw(validRawItem({ bnsWnNo: 3 }), 1235)).toBe(false); // tm1WnNo가 3
  });

  it("추첨일 정보가 비어 있거나 형식이 이상하면 신뢰하지 않는다", () => {
    expect(isPlausibleWinningDraw(validRawItem({ ltRflYmd: "" }), 1235)).toBe(false);
    expect(isPlausibleWinningDraw(validRawItem({ ltRflYmd: "2026-08-08" }), 1235)).toBe(false);
  });
});

describe("fetchWinningDrawWithStatus — 회차 상태에 따라 정확히 구분해서 반환하는지", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("아직 추첨되지 않은 미래 회차는 빈 배열로 응답하며, 'not_announced'로 반환하고 당첨번호를 절대 만들어내지 않는다", async () => {
    mockFetchOnce([]);
    const result = await fetchWinningDrawWithStatus(9999999);
    expect(result.status).toBe("not_announced");
    expect(result).not.toHaveProperty("draw");
  });

  it("정상 회차는 'success'와 함께 실제 당첨번호를 반환한다", async () => {
    mockFetchOnce([validRawItem({ ltEpsd: 1235 })]);
    const result = await fetchWinningDrawWithStatus(1235);
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.draw.numbers).toHaveLength(6);
      expect(result.draw.drawNumber).toBe(1235);
      expect(result.draw.drawDate).toBe("2026-08-08");
    }
  });

  it("형식은 정상이지만 내용이 비정상(0으로 채워짐 등)이면 success로 속지 않고 network_error로 안전하게 처리한다", async () => {
    mockFetchOnce([
      validRawItem({
        tm1WnNo: 0,
        tm2WnNo: 0,
        tm3WnNo: 0,
        tm4WnNo: 0,
        tm5WnNo: 0,
        tm6WnNo: 0,
        bnsWnNo: 0,
      }),
    ]);
    const result = await fetchWinningDrawWithStatus(1235);
    // 절대 success가 되어서는 안 된다 — 그러면 화면에 가짜 당첨번호가 뜬다.
    expect(result.status).not.toBe("success");
    expect(result.status).toBe("network_error");
  });

  it("응답 회차가 요청 회차와 다르면 success로 취급하지 않는다", async () => {
    mockFetchOnce([validRawItem({ ltEpsd: 1 })]);
    const result = await fetchWinningDrawWithStatus(1235);
    expect(result.status).not.toBe("success");
  });

  it("응답이 배열이 아닌 이상한 형태면 network_error를 반환한다", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ resultCode: null, resultMessage: null, data: {} }),
    }) as unknown as typeof fetch;
    const result = await fetchWinningDrawWithStatus(1235);
    expect(result.status).toBe("network_error");
  });

  it("네트워크 요청 자체가 실패하면 network_error를 반환한다", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;
    const result = await fetchWinningDrawWithStatus(1235);
    expect(result.status).toBe("network_error");
  });

  it("HTTP 응답이 실패(ok=false)면 network_error를 반환한다", async () => {
    mockFetchOnce([], false);
    const result = await fetchWinningDrawWithStatus(1235);
    expect(result.status).toBe("network_error");
  });

  it("요청 URL이 새 range API 형식(srchStrLtEpsd/srchEndLtEpsd)을 정확히 사용한다", async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ resultCode: null, resultMessage: null, data: { list: [validRawItem({ ltEpsd: 500 })] } }),
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    await fetchWinningDrawWithStatus(500);

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do?srchStrLtEpsd=500&srchEndLtEpsd=500",
      expect.anything()
    );
  });
});
