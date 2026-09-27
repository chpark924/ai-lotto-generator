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
  totalSalesAmount?: number;
}
