export interface WinningDraw {
  drawNumber: number;
  drawDate: string; // YYYY-MM-DD
  numbers: [number, number, number, number, number, number];
  bonusNumber: number;
  firstPrizeWinnerCount?: number;
  firstPrizeAmount?: number;
  totalSalesAmount?: number;
}
