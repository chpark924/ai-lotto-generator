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
