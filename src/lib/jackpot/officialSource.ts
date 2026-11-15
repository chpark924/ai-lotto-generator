/**
 * "1등 예상 총 당첨금"을 동행복권 공식 API에서 기기가 직접 받아오는 계층 (2026-11-15).
 *
 * 왜: 원래는 GitHub Actions(update-jackpot-data.yml)가 매시간 받아 커밋한 JSON만 읽었는데,
 * 실제 갱신 간격을 git 기록으로 재보니 평균 6.8시간·최대 15.8시간이었다(GitHub 예약 실행은
 * 정각 부하로 지연·누락이 잦다). 그래서 사용자가 공식 사이트와 금액이 다르다고 느꼈다.
 * 당첨번호 조회(drawApi.ts)가 이미 기기에서 동행복권 API를 직접 호출하는 구조라, 같은 방식으로
 * 공식 사이트가 쓰는 바로 그 값(selectRnk1ExpcAmt.do의 rnk1ExpcAmt)을 직접 받는다.
 * 비용: 공개 API(키·요금 없음). 실패하면 호출부(index.ts)가 GitHub JSON으로 폴백한다.
 *
 * 중요: 절대 throw하지 않는다 — 무엇이 잘못되든 null.
 */
import type { JackpotInfo } from "./types";

const ENDPOINT = "https://www.dhlottery.co.kr/lt645/selectRnk1ExpcAmt.do";
const REQUEST_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 13; SM-S911N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
  Referer: "https://www.dhlottery.co.kr/lt645/intro",
  Accept: "application/json, text/plain, */*",
};
const FETCH_TIMEOUT_MS = 6000;
/** scripts/update-jackpot-data.mjs의 isPlausibleAmount와 같은 상한(1,000억). */
const MAX_PLAUSIBLE_AMOUNT = 100_000_000_000;

export async function fetchJackpotInfoFromOfficial(): Promise<JackpotInfo | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${ENDPOINT}?_=${Date.now()}`, {
      headers: REQUEST_HEADERS,
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const body = await response.json();
    const result = body?.data?.result;
    const amount = result?.rnk1ExpcAmt;
    // 0원(추첨 직후 새 회차 집계 전)이나 이상한 값은 "없음"으로 취급해 폴백/숨김으로 넘긴다.
    if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_PLAUSIBLE_AMOUNT) return null;
    const sales = result?.acmlRvnAmt;
    return {
      expectedRank1Amount: amount,
      accumulatedSalesAmount: Number.isInteger(sales) && sales >= 0 ? sales : null,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
