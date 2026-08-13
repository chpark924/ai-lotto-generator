/**
 * GitHub에 정적 파일로 커밋해둔 최신 딥 패턴 Atlas(data/deep-pattern-atlas.json)를 앱에서
 * 받아오는 계층. src/lib/draws/githubDataSource.ts(당첨 이력용)와 정확히 같은 목적·같은
 * 구조다 — 이 앱은 서버가 없으므로(비용 최소화 원칙), "정적 파일을 GitHub Actions가 주기적으로
 * 갱신 + 커밋해두고, 기기가 그 파일 하나만 raw.githubusercontent.com에서 받아온다"는 같은
 * 패턴을 딥 패턴 Atlas에도 그대로 적용한다.
 *
 * 왜 필요한가(QA_LOG.md 77번 참고): data/deep-pattern-atlas.json은 원래 앱에 정적 import로
 * 번들되는 빌드타임 데이터였다 — 당첨 이력이 매주 자동 갱신돼도 Atlas 재계산 결과는 앱을
 * 다시 빌드해서 배포해야만 사용자에게 반영됐다. 이 계층은 .github/workflows/
 * update-deep-pattern-atlas.yml이 매주 다시 계산해 커밋해두는 최신 atlas를, 앱 재빌드 없이
 * 기기가 직접 받아올 수 있게 해서(=서버리스, 자동화) 그 간극을 없앤다.
 *
 * 중요: 이 모듈도 githubDataSource.ts와 동일하게 절대 throw하지 않는다. 네트워크가 끊겼든,
 * 응답 형식이 이상하든 항상 null을 반환한다 — 실패하면 항상 번들된(또는 이전에 캐시해둔)
 * atlas로 조용히 계속 동작해야 하는, 없어도 앱이 망가지지 않는 보너스 계층이다.
 */
import { isPlausibleAtlas, type Atlas } from "./atlasTypes";

// githubDataSource.ts와 동일한 저장소(같은 owner/repo/branch) — 당첨 이력과 Atlas 둘 다
// 같은 저장소 안의 서로 다른 정적 파일이다.
const GITHUB_OWNER: string = "chpark924";
const GITHUB_REPO: string = "ai-lotto-generator";
const GITHUB_BRANCH = "main";
const GITHUB_ATLAS_PATH = "data/deep-pattern-atlas.json";

function buildRawUrl(): string {
  return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${GITHUB_ATLAS_PATH}`;
}

// Atlas는 당첨 이력 JSON(수십 KB)보다 훨씬 크다(basin별 대표 조합 샘플까지 포함해 수백 KB) —
// githubDataSource.ts의 6초보다 여유를 둔다.
const FETCH_TIMEOUT_MS = 10000;

/**
 * GitHub에 커밋된 정적 JSON에서 최신 Atlas를 받아온다.
 * 무엇이 잘못되든(오프라인, 타임아웃, 형식 오류) null을 반환할 뿐 절대 throw하지 않는다.
 */
export async function fetchAtlasFromGithub(): Promise<Atlas | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(buildRawUrl(), { signal: controller.signal });
    if (!response.ok) return null;

    const data = await response.json();
    if (!isPlausibleAtlas(data)) return null;
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
