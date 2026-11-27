export interface WinningDraw {
  drawNumber: number;
  drawDate: string; // YYYY-MM-DD
  numbers: [number, number, number, number, number, number];
  bonusNumber: number;
  firstPrizeWinnerCount?: number;
  /**
   * ⚠️ 이름과 달리 "1등 총 당첨금"이 아니라 동행복권 API(rnk1WnAmt)가 이미 계산해서 주는
   * "1게임(1인)당 당첨금"이다 — 2026-09-27 QA에서 실제 제1243회 공식 결과 페이지
   * (당첨자 12명, 1게임당 2,592,525,282원)와 앱 표시값을 직접 대조해 확인했다. 총액이
   * 필요하면 firstPrizeAmount * firstPrizeWinnerCount로 역산해야 한다(그 반대가 아님).
   * computeFirstPrizeNetPayout()이 한동안 이걸 총액으로 오인해 firstPrizeWinnerCount로
   * 한 번 더 나눠 실수령액을 winnerCount배만큼 작게 보여준 적이 있다 — 같은 실수를
   * 반복하지 않도록 여기 명시해둔다.
   */
  firstPrizeAmount?: number;
  /**
   * 해당 회차 총 판매금액(원). 동행복권 API의 `wholEpsdSumNtslAmt`.
   * ⚠️ 2026-11-15 이전 데이터는 `rlvtEpsdSumNtslAmt`(실제 총판매액의 정확히 절반)를 이 필드에
   * 넣고 있었다 — 1057회 공식 응답 기준 rlvt 56,261,943,500 / whole 112,523,887,000, 언론 보도
   * "1억 1,252만 게임 판매"와 whole이 일치. dataVersion이 2 미만인 레코드의 이 값은 믿지 말 것.
   */
  totalSalesAmount?: number;
  /** 1~5등 당첨 게임 수 [1등, 2등, 3등, 4등, 5등]. dataVersion 2부터. */
  rankWinnerCounts?: [number, number, number, number, number];
  /** 1~5등 1게임당 당첨금 [1등, 2등, 3등, 4등, 5등](원). dataVersion 2부터. */
  rankPrizeAmounts?: [number, number, number, number, number];
  /**
   * 1등 당첨 게임의 구매 방식. API의 winType1=자동, winType2=수동, winType3=반자동
   * (1057회 공식값 13/4/0이 언론 보도 "17명 중 13명 자동, 4명 수동"과 일치해 매핑 확인).
   */
  firstPrizeWinTypes?: { auto: number; manual: number; semiAuto: number };
  /** 레코드 형식 버전. 2 = 위 필드들이 채워지고 totalSalesAmount가 실제 총판매액인 버전. */
  dataVersion?: number;
}

/** 현재 레코드 형식 버전 — 이보다 낮은 캐시 레코드는 같은 번호의 최신 레코드로 보강 대상. */
export const CURRENT_DRAW_DATA_VERSION = 2;

/**
 * 2026-11-27 — 집계가 끝난 "완전한" 레코드인지.
 *
 * 추첨(토 20:35) 직후 동행복권 API는 당첨번호는 바로 주지만 총판매액·등수별 당첨 게임 수는
 * 집계가 끝난 뒤에야 채워진다. 그 사이에 앱이 회차를 받아 캐시하면 판매액·인원이 0/누락인
 * 레코드가 dataVersion 2로 저장되고, 캐시는 이미 있는 회차를 덮어쓰지 않으므로 영영 그대로
 * 남는다(v10 실기기: 1251회 "기대 대비 실제" 카드가 안 보임). 그래서 "완전함"을 따로 판정해,
 * 불완전한 레코드는 같은 번호의 완전한 레코드로 보강할 수 있게 한다.
 * 5등은 매 회차 수백만 게임이 당첨되므로 0이면 미집계로 본다.
 */
export function isCompleteDraw(d: WinningDraw): boolean {
  return (
    (d.dataVersion ?? 1) >= CURRENT_DRAW_DATA_VERSION &&
    Number.isInteger(d.totalSalesAmount) &&
    (d.totalSalesAmount as number) > 0 &&
    Array.isArray(d.rankWinnerCounts) &&
    d.rankWinnerCounts.length === 5 &&
    d.rankWinnerCounts[4] > 0
  );
}
