#!/usr/bin/env node
/**
 * 로또 6/45 "이번 회차 1등 예상 총 당첨금"을 동행복권 공개 API에서 받아와
 * data/lotto-jackpot.json에 저장한다.
 *
 * 배경: 홈 화면에 "1등 예상 총 당첨금"을 실시간에 가깝게(1시간 간격) 보여주고 싶었는데,
 * 이 숫자는 원래 로그인한 사용자에게만 보이는 구매 페이지(TotalGame.jsp)에서 확인했었다.
 * 그런데 동행복권 공식 소개 페이지(`/lt645/intro`, 로그인 불필요)를 브라우저 네트워크 탭으로
 * 확인해보니, 그 페이지가 로그인 여부와 무관하게 아래 공개 API를 호출해 같은 값을 받아오고
 * 있는 것을 확인했다. 즉 로그인이나 세션 쿠키 없이도 이 숫자를 가져올 수 있다.
 *
 * data/lotto-draws.json과 완전히 동일한 이유로 이 값도 기기가 직접 부르지 않고 GitHub
 * Actions가 매시간 대신 받아와 정적 JSON으로 커밋해둔다 — 서버 비용 0원, 앱은 그 JSON을
 * raw.githubusercontent.com에서 읽기만 하면 된다(src/lib/jackpot/githubSource.ts 참고).
 * 이 워크플로가 실패해도 홈 화면은 그 줄을 그냥 숨길 뿐 앱은 정상 동작한다 — 단일
 * 장애점이 아니다(update-lotto-data.mjs와 동일한 설계 원칙).
 *
 * 사용법:
 *   node scripts/update-jackpot-data.mjs
 *
 * 순수 Node(추가 의존성 없음) — CI에서 npm install 없이 바로 실행 가능.
 *
 * 남은 불확실성(정직하게 밝혀둠): 이 API가 실제 브라우저 세션에서는 정상 동작함을
 * 확인했지만, 세션 없이 서버 환경(GitHub Actions)에서 콜드하게 호출했을 때도 동일하게
 * 동작하는지는 이 스크립트를 최초 실행하기 전까지는 검증되지 않았다. update-lotto-data.mjs와
 * 같은 봇 차단 이슈가 있을 수 있어 동일한 User-Agent/Referer 헤더를 사용한다. 계속
 * network_error가 나면 update-lotto-data.mjs 상단 주석의 대응 순서를 그대로 따른다.
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "..", "data", "lotto-jackpot.json");

const ENDPOINT = "https://www.dhlottery.co.kr/lt645/selectRnk1ExpcAmt.do";
// update-lotto-data.mjs와 동일한 헤더(같은 사이트, 같은 봇 차단 우려)를 쓴다.
const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 13; SM-S911N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
  Referer: "https://www.dhlottery.co.kr/lt645/intro",
  Accept: "application/json, text/plain, */*",
};
const REQUEST_TIMEOUT_MS = 15000;

/** 응답 구조/값 범위가 그럴듯한지 방어적으로 검증한다(1억 ~ 1000억 원 사이면 정상 범위로 본다). */
function isPlausibleAmount(n) {
  return Number.isInteger(n) && n >= 100_000_000 && n <= 100_000_000_000;
}

async function fetchExpectedJackpot() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${ENDPOINT}?_=${Date.now()}`, {
      headers: REQUEST_HEADERS,
      signal: controller.signal,
    });
    if (!response.ok) {
      return { status: "network_error", error: `HTTP ${response.status}` };
    }

    const rawText = await response.text();
    let body;
    try {
      body = JSON.parse(rawText);
    } catch {
      return {
        status: "network_error",
        error: `JSON 파싱 실패. 응답 본문 앞 300자: ${rawText.slice(0, 300)}`,
      };
    }

    const result = body?.data?.result;
    const expectedRank1Amount = result?.rnk1ExpcAmt;
    const accumulatedSalesAmount = result?.acmlRvnAmt;

    if (!isPlausibleAmount(expectedRank1Amount)) {
      return {
        status: "network_error",
        error: `예상과 다른 응답 구조: ${JSON.stringify(body).slice(0, 300)}`,
      };
    }

    return {
      status: "success",
      expectedRank1Amount,
      accumulatedSalesAmount: Number.isInteger(accumulatedSalesAmount) ? accumulatedSalesAmount : null,
    };
  } catch (error) {
    return { status: "network_error", error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function main() {
  await mkdir(path.dirname(DATA_PATH), { recursive: true });

  const result = await fetchExpectedJackpot();

  if (result.status !== "success") {
    console.error(`[update-jackpot-data] 조회 실패: ${result.error}`);
    console.error(
      "[update-jackpot-data] 엔드포인트가 바뀌었거나 봇 차단에 걸렸을 가능성이 있습니다 — update-lotto-data.mjs 상단 주석의 대응 순서를 참고해주세요."
    );
    process.exitCode = 1;
    return;
  }

  const payload = {
    expectedRank1Amount: result.expectedRank1Amount,
    accumulatedSalesAmount: result.accumulatedSalesAmount,
    fetchedAt: new Date().toISOString(),
  };

  await writeFile(DATA_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  console.log(
    `[update-jackpot-data] 완료 — 1등 예상 총 당첨금 ${payload.expectedRank1Amount.toLocaleString("ko-KR")}원 저장.`
  );
}

main().catch((error) => {
  console.error("[update-jackpot-data] 예상치 못한 오류로 중단됨:", error);
  process.exitCode = 1;
});
