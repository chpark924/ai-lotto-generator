/**
 * GitHub에 정적 파일로 커밋해둔 당첨번호 이력(data/lotto-draws.json)을 앱에서 받아오는 계층.
 *
 * 왜 필요한가: 기존엔 기기가 매번 dhlottery.co.kr을 "직접" 호출했는데, 이 방식이 여러 세션에
 * 걸쳐 "당첨번호를 불러오지 못했다"는 문제를 반복적으로 일으켰다(QA_LOG.md 참고 — 2026-08 조사
 * 결과 동행복권이 donghanglottery.com으로 사이트를 개편하며 구 도메인이 죽은 것으로 보임).
 * 이제는 이 저장소의 GitHub Actions(.github/workflows/update-lotto-data.yml)가 주 1회
 * 당첨번호를 받아와 data/lotto-draws.json에 커밋해두고, 앱은 그 정적 파일 하나만
 * raw.githubusercontent.com에서 받아온다 — 서버 비용 없이, 기기에서의 불안정한 스크래핑
 * 의존도를 크게 줄인다.
 *
 * 중요: 이 모듈은 절대 throw하지 않는다. 설정이 안 돼 있든, 네트워크가 끊겼든, 응답 형식이
 * 이상하든 항상 null을 반환한다 — 호출부(drawCache.ts)가 기존 방식(기기에서 직접 조회)으로
 * 그대로 폴백할 수 있어야 하기 때문이다. 이 데이터 소스는 어디까지나 "있으면 더 빠르고
 * 안정적인" 보너스 계층이지, 없으면 앱이 망가지는 단일 장애점이 아니다.
 */
import type { WinningDraw } from "./types";

// 명시적으로 string 타입을 줘서 TS가 리터럴 타입으로 좁히지 않게 한다 — 그러지 않으면 아래
// isGithubDataSourceConfigured의 "!== PLACEHOLDER" 비교가 "항상 true"라는 타입 오류로 잡힌다.
const GITHUB_OWNER: string = "chpark924";
const GITHUB_REPO: string = "ai-lotto-generator";
const GITHUB_BRANCH = "main";
const GITHUB_DATA_PATH = "data/lotto-draws.json";

const PLACEHOLDER = "__SET_ME__";

export function isGithubDataSourceConfigured(): boolean {
  return GITHUB_OWNER !== PLACEHOLDER && GITHUB_REPO !== PLACEHOLDER;
}

function buildRawUrl(): string {
  return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${GITHUB_DATA_PATH}`;
}

/**
 * 응답에 있는 항목이라고 그대로 믿지 않는다. drawApi.ts의 isPlausibleWinningDraw와 같은
 * 원칙 — GitHub JSON도 결국 스크래핑 결과물이라 형식이 깨진 항목이 섞여 들어올 수 있으니,
 * 항목 하나하나를 구조적으로 검증한 뒤에만 신뢰한다.
 */
function isPlausibleDraw(entry: unknown): entry is WinningDraw {
  if (!entry || typeof entry !== "object") return false;
  const d = entry as Record<string, unknown>;
  if (!Number.isInteger(d.drawNumber) || (d.drawNumber as number) <= 0) return false;
  if (typeof d.drawDate !== "string" || d.drawDate.length === 0) return false;
  if (!Array.isArray(d.numbers) || d.numbers.length !== 6) return false;

  const numbers = d.numbers as unknown[];
  const allValid1To45 = numbers.every((n) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 45);
  const allDistinct = new Set(numbers).size === 6;
  const bonusValid =
    Number.isInteger(d.bonusNumber) &&
    (d.bonusNumber as number) >= 1 &&
    (d.bonusNumber as number) <= 45 &&
    !numbers.includes(d.bonusNumber);

  return allValid1To45 && allDistinct && bonusValid;
}

const FETCH_TIMEOUT_MS = 6000;

/**
 * GitHub에 커밋된 정적 JSON에서 전체 당첨번호 이력을 받아온다.
 * 무엇이 잘못되든(미설정, 오프라인, 타임아웃, 형식 오류) null을 반환할 뿐 절대 throw하지 않는다.
 */
export async function fetchAllDrawsFromGithub(): Promise<WinningDraw[] | null> {
  if (!isGithubDataSourceConfigured()) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(buildRawUrl(), { signal: controller.signal });
    if (!response.ok) return null;

    const data = await response.json();
    if (!Array.isArray(data)) return null;

    // 이상한 항목은 조용히 걸러낼 뿐, 하나 때문에 전체를 버리지 않는다.
    const valid = data.filter(isPlausibleDraw);
    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
