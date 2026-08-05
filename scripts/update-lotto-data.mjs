#!/usr/bin/env node
/**
 * 로또 6/45 당첨번호 이력을 동행복권에서 받아와 data/lotto-draws.json에 저장한다.
 *
 * 왜 필요한가 (QA_LOG.md 34/35/36/37번 항목 참고):
 *  - 이 앱은 원래 사용자 기기에서 "직접" dhlottery.co.kr을 호출해 당첨번호를 조회했다.
 *  - 그런데 여러 세션에 걸쳐 "불러오기 실패"/"일부 회차 조회 실패"가 반복적으로 보고됐다.
 *    처음엔 옛 JSON 엔드포인트(`common.do?method=getLottoNumber`)가 응답은 하지만 JSON이
 *    아닌 다른 응답을 주는 것까지만 확인했었다(원인 미상 상태로 남아있었음).
 *  - 정정(36번 항목): 한때 "dhlottery.co.kr이 donghanglottery.com으로 개편됐다"고 오판해
 *    그 도메인을 코드에 반영한 적이 있는데, 이는 명백한 오판이었다 — donghanglottery.com은
 *    한국 정부(방송통신심의위원회)가 "법적 사유"로 차단한 사이트(HTTP 451)로 확인됐다.
 *    **이 도메인은 절대 다시 신뢰하지 않는다.**
 *  - 진짜 원인 확인(37번 항목): 사용자의 실기기(한국 네트워크) Chrome 브라우저로 직접
 *    dhlottery.co.kr에 접속해보니 **사이트 자체는 정상 운영 중**이었다 — 다만 2026년에
 *    프론트엔드가 전면 개편되면서 옛 경로(`common.do`, `gameResult.do`)가 전부 폐지되고
 *    새 경로(`/lt645/result`, API는 `/lt645/selectPstLt645Info.do`)로 바뀐 것이었다.
 *    devtools 네트워크 탭으로 이 새 API를 직접 캡처해 확인했고, 1회차(2002-12-07, 10 23 29
 *    33 37 40 보너스16)까지 과거 기록과 정확히 일치함을 확인해 신뢰도를 검증했다. 이 새 API는
 *    `srchStrLtEpsd`~`srchEndLtEpsd` 범위를 한 번에 조회할 수 있고(1~1235회 전체를 단 한 번의
 *    요청으로도 확인함), 아직 추첨 전인 회차를 포함해도 에러 없이 빈 배열을 반환한다 — 그래서
 *    이 스크립트도 회차 하나하나를 순회하지 않고 필요한 범위를 통째로 한 번에 요청한다.
 *  - 매번 사용자 기기가 직접 스크래핑을 시도하는 대신, 이 스크립트를 GitHub Actions로
 *    매주 1회 돌려서 결과를 이 저장소의 정적 JSON 파일로 커밋해두고, 앱은 그 JSON을
 *    raw.githubusercontent.com에서 받아오기만 하면 되게 만든다. 비용은 0원(GitHub 무료 플랜)
 *    이고, 매주 한 번만 스크래핑을 시도하므로 실패해도 재시도/모니터링이 훨씬 쉽다.
 *
 * 사용법:
 *   node scripts/update-lotto-data.mjs
 *
 * 이 스크립트는 순수 Node(추가 의존성 없음)로 작성했다 — CI에서 npm install 없이
 * 바로 실행 가능하게 하기 위해서다(smoke_test.mjs와 동일한 취지).
 *
 * 남은 불확실성(정직하게 밝혀둠): 이 새 API가 사용자의 실제 브라우저 세션(쿠키 등)이 있는
 * 상태에서는 정상 동작함을 확인했지만, 이 스크립트처럼 세션 없이 서버 환경(GitHub Actions
 * 등)에서 콜드하게 호출했을 때도 똑같이 동작하는지는 아직 검증되지 않았다 — 이 사이트는 봇
 * 차단용 트레이서 스크립트(tracer.dhlottery.co.kr)를 쓰고 있어, 서버 환경에서 다르게 취급될
 * 가능성을 배제할 수 없다. 만약 이 스크립트가 계속 network_error를 반환한다면 아래 순서로
 * 대응한다.
 *   1. 실인터넷이 되는 로컬 환경에서 이 스크립트를 직접 실행해 실제 응답(특히 HTTP 상태 코드,
 *      응답 본문 앞부분)을 확인한다 — 실패 시 응답 본문 일부를 콘솔에 출력하도록 만들어뒀다.
 *   2. 봇 차단으로 의심되면 User-Agent/Referer 헤더를 실제 브라우저 값에 더 가깝게 조정하거나,
 *      요청 간 지연을 늘려본다.
 *   3. 그래도 안 되면 dhlottery.co.kr을 실제 브라우저로 다시 열어 API가 또 바뀌었는지
 *      확인한다 — **검증 안 된 도메인을 절대 추측해서 넣지 않는다.**
 *   4. 그때까지는 앱이 기존 방식(기기에서 직접 조회)으로 자동 폴백하므로 완전히 먹통이
 *      되지는 않는다(src/lib/draws/drawCache.ts 참고).
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "..", "data", "lotto-draws.json");

// src/lib/draws/drawApi.ts와 동일한 엔드포인트·헤더를 쓴다(둘이 어긋나지 않도록 이 스크립트를
// 유일한 "진실 공급원"으로 삼고, 엔드포인트가 바뀌면 여기와 drawApi.ts 둘 다 같이 고쳐야 한다).
const ENDPOINT = "https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do";
const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 13; SM-S911N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
  Referer: "https://www.dhlottery.co.kr/lt645/result",
  Accept: "application/json, text/plain, */*",
};
const REQUEST_TIMEOUT_MS = 15000;

const FIRST_DRAW_DATE = new Date("2002-12-07T00:00:00+09:00");
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** src/lib/draws/drawApi.ts의 estimateLatestDrawNumber와 동일한 로직. */
function estimateLatestDrawNumber(now = new Date()) {
  const diff = now.getTime() - FIRST_DRAW_DATE.getTime();
  const weeksPassed = Math.floor(diff / WEEK_MS);
  return Math.max(1, weeksPassed + 1);
}

/** src/lib/draws/drawApi.ts의 isPlausibleWinningDraw와 동일한 검증 로직(새 API 필드명 기준). */
function isPlausibleDraw(item, requestedDrawNumber) {
  if (!item || item.ltEpsd !== requestedDrawNumber) return false;
  if (!item.ltRflYmd || !/^\d{8}$/.test(item.ltRflYmd)) return false;

  const numbers = [item.tm1WnNo, item.tm2WnNo, item.tm3WnNo, item.tm4WnNo, item.tm5WnNo, item.tm6WnNo];
  const allValid1To45 = numbers.every((n) => Number.isInteger(n) && n >= 1 && n <= 45);
  const allDistinct = new Set(numbers).size === 6;
  const bonusValid =
    Number.isInteger(item.bnsWnNo) && item.bnsWnNo >= 1 && item.bnsWnNo <= 45 && !numbers.includes(item.bnsWnNo);

  return allValid1To45 && allDistinct && bonusValid;
}

/** "YYYYMMDD" → "YYYY-MM-DD" */
function formatYmd(ymd) {
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

/**
 * startDrawNumber ~ endDrawNumber 범위를 한 번의 요청으로 조회한다.
 * @returns {Promise<{status: "success", items: object[]} | {status: "network_error", error: string}>}
 */
async function fetchDrawRange(startDrawNumber, endDrawNumber) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const url = `${ENDPOINT}?srchStrLtEpsd=${startDrawNumber}&srchEndLtEpsd=${endDrawNumber}`;
    const response = await fetch(url, { headers: REQUEST_HEADERS, signal: controller.signal });
    if (!response.ok) {
      return { status: "network_error", error: `HTTP ${response.status}` };
    }

    const rawText = await response.text();
    let body;
    try {
      body = JSON.parse(rawText);
    } catch {
      // 진단을 쉽게 하기 위해 실패 시 응답 본문 앞부분을 그대로 보여준다(이전 세션에서
      // "network_error"라고만 뜨고 실제 응답 내용을 못 봐서 원인 파악이 오래 걸렸던 것을 반영).
      return {
        status: "network_error",
        error: `JSON 파싱 실패. 응답 본문 앞 300자: ${rawText.slice(0, 300)}`,
      };
    }

    const list = body?.data?.list;
    if (!Array.isArray(list)) {
      return { status: "network_error", error: `예상과 다른 응답 구조: ${JSON.stringify(body).slice(0, 300)}` };
    }

    return { status: "success", items: list };
  } catch (error) {
    return { status: "network_error", error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function main() {
  await mkdir(path.dirname(DATA_PATH), { recursive: true });

  let existing = [];
  try {
    const raw = await readFile(DATA_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    existing = Array.isArray(parsed) ? parsed : [];
  } catch {
    existing = [];
  }

  const byNumber = new Map(existing.map((d) => [d.drawNumber, d]));
  const maxKnown = byNumber.size > 0 ? Math.max(...byNumber.keys()) : 0;
  const estimatedLatest = estimateLatestDrawNumber();
  const startFrom = maxKnown + 1;
  // 추정 로직이 실제보다 늦게 잡힐 수도 있으니 여유를 좀 두고 요청한다. 이 API는 존재하지
  // 않거나 아직 추첨 전인 회차를 포함해도 에러 없이 빈 배열을 주므로 넉넉히 요청해도 안전하다.
  const tryUpTo = estimatedLatest + 3;

  console.log(`[update-lotto-data] 기존 저장된 최신 회차: ${maxKnown || "없음"}`);
  console.log(`[update-lotto-data] 오늘 날짜 기준 추정 최신 회차: ${estimatedLatest}`);
  console.log(`[update-lotto-data] ${startFrom}회 ~ ${tryUpTo}회 범위를 한 번의 요청으로 확인합니다.`);

  if (startFrom > tryUpTo) {
    console.log("[update-lotto-data] 이미 최신 상태입니다. 확인할 새 회차가 없습니다.");
    return;
  }

  const result = await fetchDrawRange(startFrom, tryUpTo);

  if (result.status !== "success") {
    console.error(`[update-lotto-data] 조회 실패: ${result.error}`);
    console.error(
      "[update-lotto-data] LEGACY_ENDPOINT가 바뀌었거나 봇 차단에 걸렸을 가능성이 있습니다 — 이 스크립트 상단 주석의 대응 순서를 참고해주세요."
    );
    process.exitCode = 1;
    return;
  }

  let added = 0;
  let skippedInvalid = 0;
  for (const item of result.items) {
    if (!isPlausibleDraw(item, item?.ltEpsd)) {
      skippedInvalid += 1;
      continue;
    }
    if (item.ltEpsd < startFrom || item.ltEpsd > tryUpTo) continue; // 방어적 범위 체크

    const draw = {
      drawNumber: item.ltEpsd,
      drawDate: formatYmd(item.ltRflYmd),
      numbers: [item.tm1WnNo, item.tm2WnNo, item.tm3WnNo, item.tm4WnNo, item.tm5WnNo, item.tm6WnNo].sort(
        (a, b) => a - b
      ),
      bonusNumber: item.bnsWnNo,
      firstPrizeWinnerCount: item.rnk1WnNope,
      firstPrizeAmount: item.rnk1WnAmt,
      totalSalesAmount: item.rlvtEpsdSumNtslAmt,
    };
    byNumber.set(draw.drawNumber, draw);
    added += 1;
    console.log(`  - ${draw.drawNumber}회 확보 (추첨일 ${draw.drawDate}, 번호 ${draw.numbers.join(",")})`);
  }

  if (skippedInvalid > 0) {
    console.warn(`[update-lotto-data] 형식이 이상해 건너뛴 항목: ${skippedInvalid}건.`);
  }

  const merged = [...byNumber.values()].sort((a, b) => a.drawNumber - b.drawNumber);
  await writeFile(DATA_PATH, `${JSON.stringify(merged, null, 2)}\n`, "utf-8");

  console.log(`[update-lotto-data] 완료 — 이번 실행에서 새로 추가: ${added}건, 전체 저장: ${merged.length}건.`);

  if (merged.length === 0) {
    console.error(
      "[update-lotto-data] 단 한 건도 확보하지 못했습니다. 엔드포인트가 다시 바뀌었을 가능성이 큽니다 — 이 스크립트 상단 주석의 대응 순서를 참고해주세요."
    );
    process.exitCode = 1;
    return;
  }
  if (added === 0 && startFrom <= estimatedLatest) {
    // 이번 주 회차가 아직 추첨 전이라 0건인 것은 정상이다(토요일 추첨 전 등). 다만 이미 추첨됐어야
    // 할 회차(estimatedLatest 이하)까지 하나도 못 받았다면 뭔가 잘못됐을 가능성이 있어 경고한다.
    console.warn(
      "[update-lotto-data] 새로 확보한 회차가 없습니다. 아직 추첨 전이라면 정상이지만, 그렇지 않다면 원인 확인이 필요합니다."
    );
  }
}

main().catch((error) => {
  console.error("[update-lotto-data] 예상치 못한 오류로 중단됨:", error);
  process.exitCode = 1;
});
