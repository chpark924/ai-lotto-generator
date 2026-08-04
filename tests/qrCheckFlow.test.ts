/**
 * "QR 스캔 → 파싱 → 당첨 등수 계산" 전체 파이프라인을 화면(qr-check.tsx)이 실제로 호출하는
 * 것과 동일한 함수(parseLottoQrText, buildCheckedLottoQrGames)로 검증한다.
 * 목적: 카메라 프리뷰/터치 상호작용 같은 UI 렌더링이 아니라, "QR을 읽으면 화면에 맞는
 * 등수/번호가 정확히 계산되는가"라는 결과 표시의 핵심 로직을 실기기 없이 보증하기 위함.
 */
import { parseLottoQrText } from "../src/lib/qr/parseLottoQr";
import { buildCheckedLottoQrGames } from "../src/lib/qr/checkLottoQrGames";
import { RANK_LABELS } from "../src/lib/draws/rank";
import type { WinningDraw } from "../src/lib/draws/types";

function buildQrUrl(drawNumber: string, games: { type: "m" | "a" | "b"; numbers: string }[]): string {
  const v = drawNumber + games.map((g) => `${g.type}${g.numbers}`).join("");
  return `https://m.dhlottery.co.kr/qr.do?method=winQr&v=${v}`;
}

describe("QR 당첨확인 전체 파이프라인 (스캔 원문 → 등수 계산)", () => {
  const draw: WinningDraw = {
    drawNumber: 1234,
    drawDate: "2026-08-01",
    numbers: [1, 2, 3, 4, 5, 6],
    bonusNumber: 7,
    firstPrizeWinnerCount: 3,
    firstPrizeAmount: 2_000_000_000,
    totalSalesAmount: 90_000_000_000,
  };

  const qrUrl = buildQrUrl("1234", [
    { type: "m", numbers: "010203040506" }, // 1,2,3,4,5,6 -> 1등
    { type: "a", numbers: "010203040507" }, // 1,2,3,4,5,7 -> 5개+보너스 -> 2등
    { type: "b", numbers: "010203040508" }, // 1,2,3,4,5,8 -> 5개, 보너스 불일치 -> 3등
    { type: "m", numbers: "010203040809" }, // 1,2,3,4,8,9 -> 4개 -> 4등
    { type: "m", numbers: "010203080910" }, // 1,2,3,8,9,10 -> 3개 -> 5등
  ]);

  it("스캔 원문을 파싱하면 회차와 5게임 번호가 QR에 인코딩한 그대로 나온다", () => {
    const parsed = parseLottoQrText(qrUrl);
    expect(parsed.status).toBe("success");
    if (parsed.status !== "success") return;
    expect(parsed.data.drawNumber).toBe(1234);
    expect(parsed.data.games).toHaveLength(5);
    expect(parsed.data.games[0]).toEqual({ gameType: "MANUAL", numbers: [1, 2, 3, 4, 5, 6] });
    expect(parsed.data.games[1]).toEqual({ gameType: "AUTO", numbers: [1, 2, 3, 4, 5, 7] });
    expect(parsed.data.games[2]).toEqual({ gameType: "SEMI_AUTO", numbers: [1, 2, 3, 4, 5, 8] });
  });

  it("실제 당첨번호와 대조하면 화면에 표시될 등수가 게임별로 정확히 계산된다", () => {
    const parsed = parseLottoQrText(qrUrl);
    expect(parsed.status).toBe("success");
    if (parsed.status !== "success") return;

    const checked = buildCheckedLottoQrGames(parsed.data.games, draw);
    expect(checked.map((g) => g.rank)).toEqual([1, 2, 3, 4, 5]);
    // 화면은 rank를 그대로 RANK_LABELS에 넣어 문구를 만든다 — 그 매핑까지 확인.
    expect(checked.map((g) => RANK_LABELS[g.rank])).toEqual(["1등", "2등", "3등", "4등", "5등"]);
  });

  it("당첨 번호와 전혀 겹치지 않는 게임은 낙첨(0)으로 표시된다", () => {
    const missUrl = buildQrUrl("1234", [{ type: "m", numbers: "202530354045" }]); // 20,25,30,35,40,45
    const parsed = parseLottoQrText(missUrl);
    expect(parsed.status).toBe("success");
    if (parsed.status !== "success") return;

    const checked = buildCheckedLottoQrGames(parsed.data.games, draw);
    expect(checked[0].rank).toBe(0);
    expect(RANK_LABELS[checked[0].rank]).toBe("낙첨");
  });

  it("서로 다른 회차 번호로 스캔하면 그 회차의 draw와 대조해야 하므로, 엉뚱한 회차의 draw를 넣으면 결과가 달라진다(회차 불일치 방지 확인용 대비 케이스)", () => {
    const otherDraw: WinningDraw = { ...draw, drawNumber: 1234, numbers: [10, 20, 30, 40, 41, 42], bonusNumber: 43 };
    const parsed = parseLottoQrText(qrUrl);
    expect(parsed.status).toBe("success");
    if (parsed.status !== "success") return;

    const checked = buildCheckedLottoQrGames(parsed.data.games, otherDraw);
    // 당첨번호가 완전히 바뀌었으니 원래 1등이었던 게임도 더 이상 1등이 아니어야 한다.
    expect(checked[0].rank).toBe(0);
  });
});
