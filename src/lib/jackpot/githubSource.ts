/**
 * GitHub에 정적 파일로 커밋해둔 "1등 예상 총 당첨금"(data/lotto-jackpot.json)을
 * 앱에서 받아오는 계층. src/lib/draws/githubDataSource.ts와 완전히 동일한 설계다.
 *
 * 왜 필요한가: 이 숫자는 원래 동행복권 로그인 후 구매 페이지에서만 보였는데, 같은 값을
 * 공개 소개 페이지(/lt645/intro)가 로그인 없이 호출하는 API(selectRnk1ExpcAmt.do)에서도
 * 받아올 수 있음을 확인했다. 다만 기기가 매시간 직접 그 API를 호출하게 하는 대신,
 * GitHub Actions(.github/workflows/update-jackpot-data.yml)가 1시간 간격으로 대신
 * 받아와 이 저장소에 정적 JSON으로 커밋해두고, 앱은 그 JSON만 raw.githubusercontent.com에서
 * 읽는다 — 서버 비용 0원.
 *
 * 중요: 이 모듈은 절대 throw하지 않는다. 설정이 안 돼 있든, 네트워크가 끊겼든, 응답 형식이
 * 이상하든 항상 null을 반환한다 — 호출부(홈 화면)가 그 줄을 그냥 숨기고 넘어갈 수 있어야
 * 하기 때문이다. 이 데이터 소스는 "있으면 보여주는" 보너스 정보일 뿐, 없다고 앱이 망가지는
 * 단일 장애점이 아니다.
 */
import type { JackpotInfo } from "./types";

// 명시적으로 string 타입을 줘서 TS가 리터럴 타입으로 좁히지 않게 한다(githubDataSource.ts와
// 동일한 이유 — isGithubJackpotSourceConfigured의 "!== PLACEHOLDER" 비교가 "항상 true"라는
// 타입 오류로 잡히는 것을 막는다).
const GITHUB_OWNER: string = "chpark924";
const GITHUB_REPO: string = "ai-lotto-generator";
const GITHUB_BRANCH = "main";
const GITHUB_DATA_PATH = "data/lotto-jackpot.json";

const PLACEHOLDER = "__SET_ME__";

export function isGithubJackpotSourceConfigured(): boolean {
  return GITHUB_OWNER !== PLACEHOLDER && GITHUB_REPO !== PLACEHOLDER;
}

function buildRawUrl(): string {
  return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${GITHUB_DATA_PATH}`;
}

/** githubDataSource.ts의 isPlausibleDraw와 같은 원칙 — 구조적으로 검증한 뒤에만 신뢰한다. */
function isPlausibleJackpot(entry: unknown): entry is JackpotInfo {
  if (!entry || typeof entry !== "object") return false;
  const d = entry as Record<string, unknown>;
  if (!Number.isInteger(d.expectedRank1Amount) || (d.expectedRank1Amount as number) <= 0) return false;
  if (d.accumulatedSalesAmount !== null && !Number.isInteger(d.accumulatedSalesAmount)) return false;
  if (typeof d.fetchedAt !== "string" || d.fetchedAt.length === 0) return false;
  return true;
}

const FETCH_TIMEOUT_MS = 6000;

/**
 * GitHub에 커밋된 정적 JSON에서 "1등 예상 총 당첨금"을 받아온다.
 * 무엇이 잘못되든(미설정, 오프라인, 타임아웃, 형식 오류) null을 반환할 뿐 절대 throw하지 않는다.
 */
export async function fetchJackpotInfoFromGithub(): Promise<JackpotInfo | null> {
  if (!isGithubJackpotSourceConfigured()) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(buildRawUrl(), { signal: controller.signal });
    if (!response.ok) return null;

    const data = await response.json();
    return isPlausibleJackpot(data) ? data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
