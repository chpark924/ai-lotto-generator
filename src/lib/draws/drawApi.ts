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

export interface RawDrawResponse {
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

/**
 * fetchWinningDraw 결과를 세분화한 버전.
 *  - "success": 정상적으로 당첨번호를 받아왔다.
 *  - "not_announced": 서버는 정상 응답했지만 아직 발표 전(또는 존재하지 않는 회차)이다.
 *  - "network_error": 오프라인, 요청 실패, 응답 파싱 실패 등 "확인 자체를 못한" 경우.
 * 이 둘을 구분해야 사용자에게 "아직 미발표"와 "지금 확인 불가"를 다르게 안내할 수 있다.
 */
export type DrawFetchResult =
  | { status: "success"; draw: WinningDraw }
  | { status: "not_announced" }
  | { status: "network_error" };

/**
 * returnValue가 "success"라고 해서 그대로 믿지 않는다. 아직 추첨되지 않은 회차인데도
 * 서버/네트워크 이슈로 형식만 success인 이상한 응답(0으로 채워진 값, 회차 불일치 등)이
 * 오면 그걸 "진짜 당첨번호"로 오인해 사용자에게 등수를 잘못 알려줄 수 있다 — 이건 단순
 * 버그를 넘어 "없는 당첨 결과를 있는 것처럼 보여주는" 심각한 오해를 부를 수 있으므로,
 * 형식상 success여도 내용이 실제 로또 당첨번호로 말이 안 되면 신뢰하지 않는다.
 */
export function isPlausibleWinningDraw(data: RawDrawResponse, requestedDrawNumber: number): boolean {
  if (data.drwNo !== requestedDrawNumber) return false;
  if (!data.drwNoDate) return false;

  const numbers = [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6];
  const allValid1To45 = numbers.every((n) => Number.isInteger(n) && n >= 1 && n <= 45);
  const allDistinct = new Set(numbers).size === 6;
  const bonusValid =
    Number.isInteger(data.bnusNo) && data.bnusNo >= 1 && data.bnusNo <= 45 && !numbers.includes(data.bnusNo);

  return allValid1To45 && allDistinct && bonusValid;
}

// 이 엔드포인트는 브라우저에서 직접 접근하는 걸 전제로 하는 페이지 내 호출이라,
// 일부 네트워크/기기 환경에서는 User-Agent/Referer가 없는 요청을 차단하거나 다른 응답을
// 주는 경우가 있다(진짜 오프라인이 아닌데도 network_error로 보이는 원인 중 하나).
// 브라우저에서 보내는 것과 비슷한 헤더를 실어 이런 오탐을 줄인다.
const REQUEST_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 13; SM-S911N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
  Referer: "https://www.dhlottery.co.kr/gameResult.do?method=byWin",
  Accept: "application/json, text/plain, */*",
};

export async function fetchWinningDrawWithStatus(drawNumber: number): Promise<DrawFetchResult> {
  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}${drawNumber}`, { headers: REQUEST_HEADERS });
  } catch {
    return { status: "network_error" };
  }
  if (!response.ok) {
    return { status: "network_error" };
  }

  let data: RawDrawResponse;
  try {
    data = (await response.json()) as RawDrawResponse;
  } catch {
    // 응답은 왔지만 JSON이 아님(예: 네트워크 차단 시 안내 페이지가 대신 오는 경우) — 확인 불가로 취급.
    return { status: "network_error" };
  }

  if (data.returnValue !== "success") {
    // 아직 추첨 전인 미래 회차를 조회하면 서버가 정상적으로 이렇게 응답한다 — 정상 상황.
    return { status: "not_announced" };
  }

  if (!isPlausibleWinningDraw(data, drawNumber)) {
    // 형식은 success인데 내용이 실제 당첨번호로 신뢰할 수 없다. "아직 미발표"라고
    // 잘못 말하기보다("아직 발표 안 됐으니 나중에 확인" — 실제론 응답이 이상한 것),
    // "지금 확인할 수 없다"고 안전하게 안내해 잘못된 당첨 결과를 보여주는 걸 막는다.
    return { status: "network_error" };
  }

  return {
    status: "success",
    draw: {
      drawNumber: data.drwNo,
      drawDate: data.drwNoDate,
      numbers: [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6]
        .sort((a, b) => a - b) as WinningDraw["numbers"],
      bonusNumber: data.bnusNo,
      firstPrizeWinnerCount: data.firstPrzwnerCo,
      firstPrizeAmount: data.firstWinamnt,
      totalSalesAmount: data.totSellamnt,
    },
  };
}

/** 기존 호출부(통계·홈 화면 등)와의 호환을 위한 단순 버전. 실패 사유를 구분하지 않는다. */
export async function fetchWinningDraw(drawNumber: number): Promise<WinningDraw | null> {
  const result = await fetchWinningDrawWithStatus(drawNumber);
  return result.status === "success" ? result.draw : null;
}

/** 확인이 안 될 때 사용자가 직접 확인할 수 있는 동행복권 공식 결과 페이지 URL. */
export function buildOfficialResultPageUrl(drawNumber: number): string {
  return `https://www.dhlottery.co.kr/gameResult.do?method=byWin&drwNo=${drawNumber}`;
}

const FIRST_DRAW_DATE = new Date("2002-12-07T00:00:00+09:00");
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** 오늘 날짜 기준 가장 최근 회차를 추정한다. 실제 발표 전이면 fetch가 실패하므로 자동 보정한다. */
export function estimateLatestDrawNumber(now: Date = new Date()): number {
  const diff = now.getTime() - FIRST_DRAW_DATE.getTime();
  const weeksPassed = Math.floor(diff / WEEK_MS);
  return Math.max(1, weeksPassed + 1);
}

/**
 * estimateLatestDrawNumber의 역함수: 회차 번호로부터 대략적인 추첨일(토요일)을 역산한다.
 * 사용자는 "제 1235회" 같은 회차 번호보다 "이번 주/8월 8일 추첨"처럼 날짜로 이해하는 게
 * 더 익숙하다는 점을 감안해, 회차 번호를 사람이 읽기 쉬운 날짜로 바꿔 보여줄 때 쓴다.
 */
export function estimateDrawDate(drawNumber: number): Date {
  return new Date(FIRST_DRAW_DATE.getTime() + (drawNumber - 1) * WEEK_MS);
}
