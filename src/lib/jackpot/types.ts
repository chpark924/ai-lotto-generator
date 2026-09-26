/**
 * GitHub에 정적 파일로 커밋해둔 "1등 예상 총 당첨금" 데이터(data/lotto-jackpot.json)의 형태.
 * scripts/update-jackpot-data.mjs가 쓰는 필드와 정확히 일치해야 한다.
 */
export interface JackpotInfo {
  /** 1등 예상 총 당첨금(원). */
  expectedRank1Amount: number;
  /** 이번 회차 누적 판매액(원). 동행복권 응답에 없거나 형식이 이상하면 null. */
  accumulatedSalesAmount: number | null;
  /** 이 값을 받아온 시각(ISO 8601). */
  fetchedAt: string;
}
