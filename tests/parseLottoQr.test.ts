import { parseLottoQrText } from "../src/lib/qr/parseLottoQr";

describe("parseLottoQrText (동행복권 QR 파싱)", () => {
  it("5게임짜리 실제 QR URL을 파싱한다 (제1195회)", () => {
    const url =
      "https://m.dhlottery.co.kr/qr.do?method=winQr&v=1195m060713162425m050912202126m051820364243m051427303943m152733343637";
    const result = parseLottoQrText(url);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.drawNumber).toBe(1195);
    expect(result.data.games).toHaveLength(5);
    expect(result.data.games[0]).toEqual({ gameType: "MANUAL", numbers: [6, 7, 13, 16, 24, 25] });
    expect(result.data.games[4]).toEqual({ gameType: "MANUAL", numbers: [15, 27, 33, 34, 36, 37] });
  });

  it("체크섬으로 추정되는 꼬리 문자열이 붙어 있어도 앞의 게임 데이터는 정상 파싱한다", () => {
    const url =
      "https://m.dhlottery.co.kr/qr.do?method=winQr&v=1031m031424333536m223436404245m010814182944m030811121336m07192232353600000006";
    const result = parseLottoQrText(url);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.drawNumber).toBe(1031);
    expect(result.data.games).toHaveLength(5);
    expect(result.data.games[3]).toEqual({ gameType: "MANUAL", numbers: [3, 8, 11, 12, 13, 36] });
  });

  it("게임이 1개뿐인 QR도 파싱한다 (제1107회)", () => {
    const url = "https://m.dhlottery.co.kr/qr.do?method=winQr&v=1107m061430314041";
    const result = parseLottoQrText(url);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.drawNumber).toBe(1107);
    expect(result.data.games).toEqual([{ gameType: "MANUAL", numbers: [6, 14, 30, 31, 40, 41] }]);
  });

  it("www 도메인 / http 스킴도 허용한다", () => {
    const url = "http://www.dhlottery.co.kr/qr.do?method=winQr&v=0843m192130333442";
    const result = parseLottoQrText(url);
    expect(result.status).toBe("success");
  });

  it("qr.dhlottery.co.kr/?v=... 형태(QA_LOG 93번, 2026-08 실기기에서 확인된 최신 QR 발급 방식)도 인식한다", () => {
    // /qr.do 경로도, method=winQr 파라미터도 없는 실제 정품 용지(제1237회, 2026-08-15 추첨분) 형태.
    const url = "https://qr.dhlottery.co.kr/?v=1237m061214182840m010518234144m022026333445";
    const result = parseLottoQrText(url);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.drawNumber).toBe(1237);
    expect(result.data.games).toHaveLength(3);
    expect(result.data.games[0]).toEqual({ gameType: "MANUAL", numbers: [6, 12, 14, 18, 28, 40] });
    expect(result.data.games[1]).toEqual({ gameType: "MANUAL", numbers: [1, 5, 18, 23, 41, 44] });
    expect(result.data.games[2]).toEqual({ gameType: "MANUAL", numbers: [2, 20, 26, 33, 34, 45] });
  });

  it("동행복권 도메인이 아닌 임의의 QR(다른 사이트 URL)은 not_lotto_qr", () => {
    expect(parseLottoQrText("https://example.com/some-page").status).toBe("not_lotto_qr");
  });

  it("완전히 무관한 텍스트 QR도 not_lotto_qr", () => {
    expect(parseLottoQrText("그냥 아무 텍스트").status).toBe("not_lotto_qr");
  });

  it("동행복권 도메인/파라미터는 맞지만 v 값이 회차 4자리 형식이 아니면 unrecognized_data", () => {
    const url = "https://m.dhlottery.co.kr/qr.do?method=winQr&v=abcXYZ";
    expect(parseLottoQrText(url).status).toBe("unrecognized_data");
  });

  it("범위를 벗어난 번호(46 이상)가 있으면 해당 게임에서 중단하고, 그 앞 게임까지만 반환한다", () => {
    // 두 번째 게임의 번호에 46이 섞여 있어 그 블록부터는 파싱을 멈춘다.
    const url = "https://m.dhlottery.co.kr/qr.do?method=winQr&v=1195m060713162425m460912202126";
    const result = parseLottoQrText(url);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.games).toHaveLength(1);
  });

  it("게임 블록 자체가 하나도 유효하지 않으면 unrecognized_data", () => {
    const url = "https://m.dhlottery.co.kr/qr.do?method=winQr&v=1195m460912202126";
    expect(parseLottoQrText(url).status).toBe("unrecognized_data");
  });

  it("URL이 아닌 v 값 원문만 스캔된 경우도 지원한다", () => {
    const raw = "1107m061430314041";
    const result = parseLottoQrText(raw);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.drawNumber).toBe(1107);
  });

  it("한 게임 안에 중복 번호가 있으면(비정상 데이터) 그 게임 앞까지만 반환한다", () => {
    const url = "https://m.dhlottery.co.kr/qr.do?method=winQr&v=1195m060707162425";
    const result = parseLottoQrText(url);
    expect(result.status).toBe("unrecognized_data");
  });
});
