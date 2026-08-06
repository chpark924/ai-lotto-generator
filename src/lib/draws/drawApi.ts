/**
 * 과거 당첨번호 조회.
 *
 * 이 앱은 자체 백엔드/DB를 두지 않는다(비용 최소화 원칙). 대신 동행복권이 공개적으로
 * 제공하는 조회용 엔드포인트를 기기(클라이언트)에서 "직접" 호출한다. 모바일 앱은
 * 브라우저 CORS 제약이 없으므로 별도 프록시 서버가 필요 없다.
 *
 * 정정(QA_LOG.md 37번 항목, 중요): 기존에 쓰던 `common.do?method=getLottoNumber` 엔드포인트는
 * 더 이상 유효하지 않다(응답은 오지만 JSON이 아님 — 원인은 사이트 자체가 새 프론트엔드로
 * 전면 개편됐기 때문이었다). **도메인(`dhlottery.co.kr`)은 그대로이고, 사칭 사이트로
 * 오인했던 `donghanglottery.com`과는 무관하다** — 실제로는 같은 공식 도메인 안에서 URL
 * 구조만 바뀐 것이었다. 사용자의 실기기(한국 네트워크) Chrome을 통해 정상 접속되는 화면을
 * 직접 확인하고, 그 화면이 실제로 호출하는 새 API를 devtools 네트워크 탭으로 캡처해 찾아냈다
 * (`/lt645/selectPstLt645Info.do?srchStrLtEpsd=N&srchEndLtEpsd=N`) — 1회차(2002-12-07,
 * 10 23 29 33 37 40 보너스16)까지 과거 기록과 정확히 일치함을 확인해 신뢰도를 검증했다.
 * 새 API는 시작~끝 회차 범위를 한 번에 조회할 수 있고(전체 1~1235회를 한 번의 요청으로도
 * 확인함), 아직 추첨 전인 회차를 요청하면 에러 없이 빈 배열을 반환한다.
 *
 * 참고: 이 엔드포인트는 비공식 공개 API로, 서비스 정책 변경 시 응답 형식이 다시 바뀔 수 있다.
 * 실패 시에는 로컬 캐시(drawCache.ts)에 저장된 마지막 데이터로 그레이스풀하게 폴백한다.
 */
import type { WinningDraw } from "./types";

const ENDPOINT = "https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do";

/** 새 API 응답의 회차 하나에 대한 원본 항목 형태. */
export interface RawDrawListItem {
  ltEpsd: number;
  ltRflYmd: string; // "YYYYMMDD" (구 API의 drwNoDate와 달리 하이픈이 없다 — 변환 필요)
  tm1WnNo: number;
  tm2WnNo: number;
  tm3WnNo: number;
  tm4WnNo: number;
  tm5WnNo: number;
  tm6WnNo: number;
  bnsWnNo: number;
  rnk1WnNope: number;
  rnk1WnAmt: number;
  rlvtEpsdSumNtslAmt: number;
}

export interface RawDrawResponse {
  resultCode: string | null;
  resultMessage: string | null;
  data: { list: RawDrawListItem[] };
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
 * 응답에 항목이 있다고 해서 그대로 믿지 않는다. 서버/네트워크 이슈로 회차 불일치나
 * 이상한 값(범위 밖 번호, 중복 번호 등)이 섞여 오면 그걸 "진짜 당첨번호"로 오인해
 * 사용자에게 등수를 잘못 알려줄 수 있다 — 이건 단순 버그를 넘어 "없는 당첨 결과를
 * 있는 것처럼 보여주는" 심각한 오해를 부를 수 있으므로, 내용이 실제 로또 당첨번호로
 * 말이 안 되면 신뢰하지 않는다.
 */
export function isPlausibleWinningDraw(item: RawDrawListItem, requestedDrawNumber: number): boolean {
  if (item.ltEpsd !== requestedDrawNumber) return false;
  if (!item.ltRflYmd || !/^\d{8}$/.test(item.ltRflYmd)) return false;

  const numbers = [item.tm1WnNo, item.tm2WnNo, item.tm3WnNo, item.tm4WnNo, item.tm5WnNo, item.tm6WnNo];
  const allValid1To45 = numbers.every((n) => Number.isInteger(n) && n >= 1 && n <= 45);
  const allDistinct = new Set(numbers).size === 6;
  const bonusValid =
    Number.isInteger(item.bnsWnNo) && item.bnsWnNo >= 1 && item.bnsWnNo <= 45 && !numbers.includes(item.bnsWnNo);

  return allValid1To45 && allDistinct && bonusValid;
}

/** "YYYYMMDD" → "YYYY-MM-DD" (WinningDraw.drawDate가 요구하는 형식). */
function formatYmd(ymd: string): string {
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

// 이 엔드포인트는 브라우저에서 직접 접근하는 걸 전제로 하는 페이지 내 호출이라,
// 일부 네트워크/기기 환경에서는 User-Agent/Referer가 없는 요청을 차단하거나 다른 응답을
// 주는 경우가 있다. 브라우저에서 보내는 것과 비슷한 헤더를 실어 이런 오탐을 줄인다.
//
// 중요: 이 ENDPOINT/헤더는 scripts/update-lotto-data.mjs와 동일하게 맞춰뒀다(둘 중 하나만
// 고치면 어긋난다). QA_LOG.md 37번 항목 참고 — 이 엔드포인트는 사용자의 실기기(한국 네트워크)
// Chrome 브라우저 devtools 네트워크 탭에서 직접 캡처해 확인한, 현재(2026-08) 실제로 동작하는
// 공식 주소다. 다만 이 헤더 없이(즉 브라우저 세션/쿠키 없이) GitHub Actions 같은 서버 환경에서
// 콜드하게 호출했을 때도 똑같이 동작하는지는 아직 검증되지 않았다 — 이 사이트는 봇 차단용
// 트레이서 스크립트(tracer.dhlottery.co.kr)를 쓰고 있어, 서버 환경에서 막힐 가능성을 배제할 수
// 없다. 이 함수는 1순위 데이터 소스가 아니라 drawCache.ts에서 GitHub 정적 JSON
// (githubDataSource.ts)이 실패했을 때만 쓰이는 폴백이다.
const REQUEST_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 13; SM-S911N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
  Referer: "https://www.dhlottery.co.kr/lt645/result",
  Accept: "application/json, text/plain, */*",
};

export async function fetchWinningDrawWithStatus(drawNumber: number): Promise<DrawFetchResult> {
  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}?srchStrLtEpsd=${drawNumber}&srchEndLtEpsd=${drawNumber}`, {
      headers: REQUEST_HEADERS,
    });
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

  const list = data?.data?.list;
  if (!Array.isArray(list)) {
    return { status: "network_error" };
  }
  if (list.length === 0) {
    // 이 API는 아직 추첨 전(또는 존재하지 않는) 회차를 요청하면 에러 없이 빈 배열을 준다.
    return { status: "not_announced" };
  }

  const item = list[0];
  if (!isPlausibleWinningDraw(item, drawNumber)) {
    // 응답은 왔는데 내용이 실제 당첨번호로 신뢰할 수 없다. "아직 미발표"라고
    // 잘못 말하기보다("아직 발표 안 됐으니 나중에 확인" — 실제론 응답이 이상한 것),
    // "지금 확인할 수 없다"고 안전하게 안내해 잘못된 당첨 결과를 보여주는 걸 막는다.
    return { status: "network_error" };
  }

  return {
    status: "success",
    draw: {
      drawNumber: item.ltEpsd,
      drawDate: formatYmd(item.ltRflYmd),
      numbers: [item.tm1WnNo, item.tm2WnNo, item.tm3WnNo, item.tm4WnNo, item.tm5WnNo, item.tm6WnNo].sort(
        (a, b) => a - b
      ) as WinningDraw["numbers"],
      bonusNumber: item.bnsWnNo,
      firstPrizeWinnerCount: item.rnk1WnNope,
      firstPrizeAmount: item.rnk1WnAmt,
      totalSalesAmount: item.rlvtEpsdSumNtslAmt,
    },
  };
}

/** 기존 호출부(통계·홈 화면 등)와의 호환을 위한 단순 버전. 실패 사유를 구분하지 않는다. */
export async function fetchWinningDraw(drawNumber: number): Promise<WinningDraw | null> {
  const result = await fetchWinningDrawWithStatus(drawNumber);
  return result.status === "success" ? result.draw : null;
}

/**
 * 확인이 안 될 때 사용자가 직접 확인할 수 있는 동행복권 공식 결과 페이지 URL.
 *
 * 정정 이력(QA_LOG.md 35/36/37번 항목 참고): 한때 "동행복권이 donghanglottery.com으로
 * 개편됐다"고 오판해 이 URL을 그 도메인으로 바꿨던 적이 있다 — donghanglottery.com은 실제로는
 * 한국 정부(방송통신심의위원회)가 "법적 사유"로 차단한 사이트(HTTP 451)로 확인되어 완전히
 * 배제했다. 그 뒤 원래 도메인(dhlottery.co.kr)의 옛 경로(`gameResult.do?method=byWin`)로
 * 되돌렸지만, 이 경로도 이미 죽어 있었다(ERROR 404) — **진짜 원인은 도메인이 바뀐 게 아니라
 * dhlottery.co.kr 사이트 자체가 새 프론트엔드로 전면 개편되며 URL 구조가 바뀐 것**이었다.
 * 사용자의 실기기(한국 네트워크) Chrome으로 직접 확인해 새 경로(`/lt645/result`, 회차는
 * `?ltEpsd=` 쿼리로 지정 가능)를 찾아냈다 — 같은 공식 도메인 안에서의 정상적인 변경이므로
 * 안전하다.
 */
export function buildOfficialResultPageUrl(drawNumber: number): string {
  return `https://www.dhlottery.co.kr/lt645/result?ltEpsd=${drawNumber}`;
}

/**
 * 생성된 번호를 실제로 구매하러 갈 수 있는 동행복권 공식 로또6/45 페이지.
 *
 * 사용자의 실기기(한국 네트워크) Chrome으로 직접 열어 확인한 내용(2026-08-06): 이 페이지의
 * "바로구매" 버튼은 별도 URL로 이동하는 게 아니라 같은 SPA 안에서 로그인 여부를 확인하는
 * 자바스크립트 다이얼로그를 띄운다 — 즉 구매 페이지 자체를 가리키는 안정적인 URL이나, 특정
 * 번호를 미리 채워 넣는 쿼리 파라미터는 이 사이트에 존재하지 않는다. 그래서 이 URL은 "구매
 * 카트로 바로 이동"이 아니라 "실시간 예상 당첨금 + 바로구매 진입점이 있는 공식 소개 페이지"로
 * 연결하는 것이 이 사이트 구조상 가능한 최선이며, 번호 자동 입력을 암시하는 문구는 UI에서
 * 절대 쓰지 않는다(장식용/과장 문구 금지 원칙, 기획서 23장과 동일).
 */
export function buildOfficialPurchasePageUrl(): string {
  return "https://www.dhlottery.co.kr/lt645/intro";
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
