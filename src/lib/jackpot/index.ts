export * from "./types";
export * from "./githubSource";
export * from "./officialSource";

import { fetchJackpotInfoFromGithub } from "./githubSource";
import { fetchJackpotInfoFromOfficial } from "./officialSource";
import type { JackpotInfo } from "./types";

/**
 * 공식 API를 먼저 직접 조회하고(실시간, 공식 사이트와 같은 값), 실패할 때만 GitHub에 커밋된
 * 정적 JSON(최대 6시간 신선도 검사)으로 폴백한다. 둘 다 실패하면 null — 홈 화면은 줄을 숨긴다.
 */
export async function fetchJackpotInfo(): Promise<JackpotInfo | null> {
  const official = await fetchJackpotInfoFromOfficial();
  if (official) return official;
  return fetchJackpotInfoFromGithub();
}
