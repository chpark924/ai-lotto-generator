/**
 * 과거 당첨번호 조회.
 *
 * 이 앱은 자체 백엔드/DB를 두지 않는다(비용 최소화 원칙). 대신 동행복권이 공개적으로
 * 제공하는 조회용 엔드포인트를 기기(클라이언트)에서 "직접" 호출한다. 모바일 앱은
 * 브라우저 CORS 제약이 없으므로 별도 프록시 서버가 필요 없다.
 *
 * 참고: 이 엔드포인트는 비공식 공개 API로, 서비스 정책 변경 시 응답 형식이 바뀔 수 있다.
 * 실패 시에는 로컬 캐시(drawCache.ts)에 저장된 마지막 데이터로 그레이스풀하게 폴백한다.
 */
import type { WinningDraw } from "./types";

const ENDPOINT = "https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=";

interface RawDrawResponse {
  returnValue: "success" | "fail";
  drwNo: number;
  drwNoDate: string;
  drwtNo1: number;
  drwtNo2: number;
  drwtNo3: number;
  drwtNo4: number;
  drwtNo5: number;
  drwtNo6: number;
  bnusNo: number;
  firstWinamnt: number;
  firstPrzwnerCo: number;
  totSellamnt: number;
}

export async function fetchWinningDraw(drawNumber: number): Promise<WinningDraw | null> {
  try {
    const response = await fetch(`${ENDPOINT}${drawNumber}`);
    if (!response.ok) return null;
    const data = (await response.json()) as RawDrawResponse;
    if (data.returnValue !== "success") return null;

    return {
      drawNumber: data.drwNo,
      drawDate: data.drwNoDate,
      numbers: [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6]
        .sort((a, b) => a - b) as WinningDraw["numbers"],
      bonusNumber: data.bnusNo,
      firstPrizeWinnerCount: data.firstPrzwnerCo,
      firstPrizeAmount: data.firstWinamnt,
      totalSalesAmount: data.totSellamnt,
    };
  } catch {
    return null;
  }
}

const FIRST_DRAW_DATE = new Date("2002-12-07T00:00:00+09:00");
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** 오늘 날짜 기준 가장 최근 회차를 추정한다. 실제 발표 전이면 fetch가 실패하므로 자동 보정한다. */
export function estimateLatestDrawNumber(now: Date = new Date()): number {
  const diff = now.getTime() - FIRST_DRAW_DATE.getTime();
  const weeksPassed = Math.floor(diff / WEEK_MS);
  return Math.max(1, weeksPassed + 1);
}
