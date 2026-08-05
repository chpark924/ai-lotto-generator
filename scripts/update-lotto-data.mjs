#!/usr/bin/env node
/**
 * 로또 6/45 당첨번호 이력을 동행복권에서 받아와 data/lotto-draws.json에 저장한다.
 *
 * 왜 필요한가 (QA_LOG.md 34번/이전 다수 항목 참고):
 *  - 이 앱은 원래 사용자 기기에서 "직접" dhlottery.co.kr을 호출해 당첨번호를 조회했다.
 *  - 그런데 여러 세션에 걸쳐 "불러오기 실패"/"일부 회차 조회 실패"가 반복적으로 보고됐고,
 *    2026-08 조사 결과 dhlottery.co.kr 자체가 donghanglottery.com으로 개편·이전되며
 *    구 도메인이 더 이상 정상 응답하지 않는 것으로 보인다(이 저장소를 작업하는 개발 환경엔
 *    실인터넷이 없어 100% 확정은 못 했지만, 웹 검색상 "동행복권 인터넷 서비스 개편" 공지와
 *    커뮤니티의 "사이트 리뉴얼" 언급이 다수 확인됨).
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
 * 중요한 한계: 이 스크립트가 사용하는 LEGACY_ENDPOINT(dhlottery.co.kr)가 정말 죽었다면
 * 이 스크립트는 계속 network_error만 반환하고 실패할 것이다. 그 경우 아래 순서로 대응한다.
 *   1. 실인터넷이 되는 환경(로컬 PC 등)에서 이 스크립트를 직접 실행해 실제 응답을 확인한다.
 *   2. donghanglottery.com이 실제로 사용하는 JSON API를 브라우저 개발자도구 Network 탭에서
 *      찾아 LEGACY_ENDPOINT/파싱 로직을 그 응답 형식에 맞게 교체한다.
 *   3. 그때까지는 앱이 기존 방식(기기에서 직접 조회)으로 자동 폴백하므로 완전히 먹통이
 *      되지는 않는다(src/lib/draws/drawCache.ts 참고).
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "..", "data", "lotto-draws.json");

// src/lib/draws/drawApi.ts와 동일한 엔드포인트·헤더를 쓴다(둘이 어긋나지 않도록 이 스크립트를
// 유일한 "진실 공급원"으로 삼고, 엔드포인트가 바뀌면 여기와 drawApi.ts 둘 다 같이 고쳐야 한다).
const LEGACY_ENDPOINT = "https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=";
const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 13; SM-S911N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
  Referer: "https://www.dhlottery.co.kr/gameResult.do?method=byWin",
  Accept: "application/json, text/plain, */*",
};
const REQUEST_TIMEOUT_MS = 10000;
const DELAY_BETWEEN_REQUESTS_MS = 200;
const MAX_CONSECUTIVE_FAILURES = 3;

const FIRST_DRAW_DATE = new Date("2002-12-07T00:00:00+09:00");
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** src/lib/draws/drawApi.ts의 estimateLatestDrawNumber와 동일한 로직. */
function estimateLatestDrawNumber(now = new Date()) {
  const diff = now.getTime() - FIRST_DRAW_DATE.getTime();
  const weeksPassed = Math.floor(diff / WEEK_MS);
  return Math.max(1, weeksPassed + 1);
}

/** src/lib/draws/drawApi.ts의 isPlausibleWinningDraw와 동일한 검증 로직. */
function isPlausibleDraw(data, requestedDrawNumber) {
  if (!data || data.returnValue !== "success") return false;
  if (data.drwNo !== requestedDrawNumber) return false;
  if (!data.drwNoDate) return false;

  const numbers = [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6];
  const allValid1To45 = numbers.every((n) => Number.isInteger(n) && n >= 1 && n <= 45);
  const allDistinct = new Set(numbers).size === 6;
  const bonusValid =
    Number.isInteger(data.bnusNo) && data.bnusNo >= 1 && data.bnusNo <= 45 && !numbers.includes(data.bnusNo);

  return allValid1To45 && allDistinct && bonusValid;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 한 회차를 조회한다.
 * @returns {Promise<{status: "success", draw: object} | {status: "not_announced"} | {status: "network_error", error?: string}>}
 */
async function fetchDraw(drawNumber) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${LEGACY_ENDPOINT}${drawNumber}`, {
      headers: REQUEST_HEADERS,
      signal: controller.signal,
    });
    if (!response.ok) {
      return { status: "network_error", error: `HTTP ${response.status}` };
    }

    let data;
    try {
      data = await response.json();
    } catch {
      return { status: "network_error", error: "JSON 파싱 실패(HTML 등 다른 응답이 온 것으로 보임)" };
    }

    if (data && data.returnValue !== "success") {
      // 아직 추첨 전인 미래 회차 — 정상 상황.
      return { status: "not_announced" };
    }

    if (!isPlausibleDraw(data, drawNumber)) {
      return { status: "network_error", error: "응답 형식은 success지만 내용이 신뢰할 수 없음" };
    }

    return {
      status: "success",
      draw: {
        drawNumber: data.drwNo,
        drawDate: data.drwNoDate,
        numbers: [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6].sort(
          (a, b) => a - b
        ),
        bonusNumber: data.bnusNo,
        firstPrizeWinnerCount: data.firstPrzwnerCo,
        firstPrizeAmount: data.firstWinamnt,
        totalSalesAmount: data.totSellamnt,
      },
    };
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
  // 추정 로직이 실제보다 늦게 잡힐 수도 있으니 여유를 좀 두고 시도한다.
  const tryUpTo = estimatedLatest + 3;

  console.log(`[update-lotto-data] 기존 저장된 최신 회차: ${maxKnown || "없음"}`);
  console.log(`[update-lotto-data] 오늘 날짜 기준 추정 최신 회차: ${estimatedLatest}`);
  console.log(`[update-lotto-data] ${startFrom}회 ~ ${tryUpTo}회 범위를 확인합니다.`);

  let added = 0;
  let consecutiveFailures = 0;
  let sawAnyNetworkError = false;

  for (let n = startFrom; n <= tryUpTo; n += 1) {
    const result = await fetchDraw(n);

    if (result.status === "success") {
      byNumber.set(n, result.draw);
      added += 1;
      consecutiveFailures = 0;
      console.log(`  - ${n}회 확보 (추첨일 ${result.draw.drawDate}, 번호 ${result.draw.numbers.join(",")})`);
    } else if (result.status === "not_announced") {
      console.log(`  - ${n}회는 아직 발표 전으로 응답 — 정상 종료합니다.`);
      break;
    } else {
      sawAnyNetworkError = true;
      consecutiveFailures += 1;
      console.warn(`  ! ${n}회 조회 실패(network_error)${result.error ? `: ${result.error}` : ""}`);
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.warn(
          `[update-lotto-data] 연속 ${consecutiveFailures}회 실패 — 엔드포인트 자체가 응답하지 않는 것으로 보고 중단합니다. LEGACY_ENDPOINT가 더 이상 유효하지 않을 가능성이 있습니다.`
        );
        break;
      }
    }

    await sleep(DELAY_BETWEEN_REQUESTS_MS);
  }

  const merged = [...byNumber.values()].sort((a, b) => a.drawNumber - b.drawNumber);
  await writeFile(DATA_PATH, `${JSON.stringify(merged, null, 2)}\n`, "utf-8");

  console.log(`[update-lotto-data] 완료 — 이번 실행에서 새로 추가: ${added}건, 전체 저장: ${merged.length}건.`);

  if (merged.length === 0) {
    console.error(
      "[update-lotto-data] 단 한 건도 확보하지 못했습니다. LEGACY_ENDPOINT가 바뀌었을 가능성이 큽니다 — 이 스크립트 상단 주석의 대응 순서를 참고해주세요."
    );
    process.exitCode = 1;
    return;
  }
  if (sawAnyNetworkError && added === 0) {
    console.error(
      "[update-lotto-data] 이번 실행에서 네트워크 오류만 있었고 새로 확보한 회차가 없습니다(기존 데이터는 유지됨). 원인 확인이 필요합니다."
    );
    process.exitCode = 1;
    return;
  }
}

main().catch((error) => {
  console.error("[update-lotto-data] 예상치 못한 오류로 중단됨:", error);
  process.exitCode = 1;
});
