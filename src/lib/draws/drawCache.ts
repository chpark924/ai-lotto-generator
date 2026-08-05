import { readJson, writeJson } from "../storage/storage";
import { estimateLatestDrawNumber, fetchWinningDraw, fetchWinningDrawWithStatus } from "./drawApi";
import type { DrawFetchResult } from "./drawApi";
import { fetchAllDrawsFromGithub, isGithubDataSourceConfigured } from "./githubDataSource";
import type { WinningDraw } from "./types";

const KEY = "winningDraws";
const GITHUB_SYNC_KEY = "githubDrawsSyncedAt";
// GitHub 정적 JSON은 주 1회만 갱신되므로(update-lotto-data.yml), 화면 진입마다 다시 받아올
// 필요가 없다. 몇 시간에 한 번만 시도해서 앱 실행/화면 전환 때마다 불필요한 네트워크 요청이
// 쌓이지 않게 한다.
const GITHUB_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * 설정돼 있다면(githubDataSource.ts 참고) GitHub에 커밋된 당첨번호 이력을 받아 로컬 캐시에
 * 병합한다. 아직 로컬에 없는 회차만 추가하고(기존 값을 덮어쓰지 않음 — 당첨번호는 한 번
 * 확정되면 바뀌지 않으므로 병합 순서는 상관없다), 실패해도 조용히 넘어간다. 이 함수가 하는
 * 일은 어디까지나 "가능하면 더 풍부한 캐시로 미리 채워두는" 최적화일 뿐, 실패해도 이후 로직
 * (개별 회차 직접 조회)이 그대로 폴백으로 동작한다.
 */
async function syncFromGithubIfNeeded(cache: Record<number, WinningDraw>): Promise<boolean> {
  if (!isGithubDataSourceConfigured()) return false;

  const lastSyncedAt = await readJson<number>(GITHUB_SYNC_KEY, 0);
  if (Date.now() - lastSyncedAt < GITHUB_SYNC_INTERVAL_MS) return false;

  const draws = await fetchAllDrawsFromGithub();
  // 동기화를 "시도했다"는 사실은 성공 여부와 무관하게 기록한다. 그러지 않으면 GitHub가
  // 응답하지 않는 상황에서 화면에 들어갈 때마다 다시 타임아웃을 기다리게 된다.
  try {
    await writeJson(GITHUB_SYNC_KEY, Date.now());
  } catch {
    // no-op
  }

  if (!draws) return false;

  let changed = false;
  for (const draw of draws) {
    if (!cache[draw.drawNumber]) {
      cache[draw.drawNumber] = draw;
      changed = true;
    }
  }
  return changed;
}

async function getCachedMap(): Promise<Record<number, WinningDraw>> {
  const cache = await readJson<Record<number, WinningDraw>>(KEY, {});
  const changed = await syncFromGithubIfNeeded(cache);
  if (changed) {
    try {
      await setCachedMap(cache);
    } catch {
      // no-op: 이번 호출에서 이미 메모리상 cache는 확보했으니, 저장 실패가 이번 조회 결과에
      // 영향을 주지 않는다 — 다음에 다시 시도하면 된다.
    }
  }
  return cache;
}

async function setCachedMap(map: Record<number, WinningDraw>): Promise<void> {
  await writeJson(KEY, map);
}

/** 네트워크 오류(일시적)로 count만큼 채우지 못했을 때 던지는 에러. 호출부에서 사용자에게 안내한다. */
export class RecentDrawsFetchError extends Error {
  constructor(public readonly partialResults: WinningDraw[]) {
    super("최근 당첨번호를 불러오지 못했습니다.");
    this.name = "RecentDrawsFetchError";
  }
}

/**
 * 최근 N회 당첨번호를 반환한다. 기기에 캐시된 데이터를 우선 사용하고,
 * 없는 회차만 네트워크로 보충한다 (매번 전체를 다시 받지 않아 데이터 사용량을 최소화한다).
 */
export async function getRecentDraws(count: number): Promise<WinningDraw[]> {
  const cache = await getCachedMap();
  const latestGuess = estimateLatestDrawNumber();

  // 가장 최신 회차부터 역순으로 캐시/네트워크를 확인한다.
  // latestGuess가 아직 추첨 전(not_announced)인 건 정상 상황이라 조용히 이전 회차로
  // 넘어가지만, network_error는 "회차가 없다"는 뜻이 아니므로 구분해서 기억해둔다.
  let latestConfirmed: number | null = null;
  let sawNetworkErrorWhileFindingLatest = false;
  for (let candidate = latestGuess; candidate >= Math.max(1, latestGuess - 2); candidate -= 1) {
    if (cache[candidate]) {
      latestConfirmed = candidate;
      break;
    }
    // 아래 "과거 회차" 루프와 동일하게, 단발성 네트워크 blip으로 "최신 회차 찾기"
    // 단계에서 곧바로 포기하지 않도록 network_error일 때만 몇 차례 재시도한다.
    let status: DrawFetchResult | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      status = await fetchWinningDrawWithStatus(candidate);
      if (status.status !== "network_error") break;
    }
    if (status?.status === "success") {
      cache[candidate] = status.draw;
      latestConfirmed = candidate;
      break;
    }
    if (status?.status === "network_error") {
      sawNetworkErrorWhileFindingLatest = true;
    }
  }

  if (latestConfirmed === null) {
    // 캐시에 있는 것 중 가장 최신 데이터로 폴백한다.
    const cachedNumbers = Object.keys(cache).map(Number).sort((a, b) => b - a);
    latestConfirmed = cachedNumbers[0] ?? null;
  }

  if (latestConfirmed === null) {
    // 캐시도 없고, 실패 원인이 네트워크 오류였다면(=단순히 "아직 추첨 전"이 아니라면)
    // 조용히 빈 배열을 반환하지 않고 호출부가 사용자에게 알릴 수 있도록 에러를 던진다.
    if (sawNetworkErrorWhileFindingLatest) {
      throw new RecentDrawsFetchError([]);
    }
    return [];
  }

  const results: WinningDraw[] = [];
  let stoppedDueToNetworkError = false;
  for (let n = latestConfirmed; n > 0 && results.length < count; n -= 1) {
    if (cache[n]) {
      results.push(cache[n]);
      continue;
    }

    // 과거 회차이므로 정상적으로는 항상 "success"여야 한다. 일시적 네트워크 오류를
    // "이전 회차가 없다"는 신호(not_announced)와 혼동하지 않도록 몇 차례 재시도한다.
    let status: DrawFetchResult | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      status = await fetchWinningDrawWithStatus(n);
      if (status.status !== "network_error") break;
    }

    if (status?.status === "success") {
      cache[n] = status.draw;
      results.push(status.draw);
    } else if (status?.status === "network_error") {
      // 재시도 후에도 네트워크 오류: 남은 회차를 조용히 건너뛰지 않고 멈춘 뒤
      // 지금까지 모은 결과와 함께 에러를 던져 호출부가 사용자에게 알릴 수 있게 한다.
      stoppedDueToNetworkError = true;
      break;
    } else {
      // not_announced: 더 이전 회차가 없다는 뜻이므로 정상 종료.
      break;
    }
  }

  // 캐시 저장 실패는 이미 확보한 결과를 버릴 이유가 되지 않는다.
  try {
    await setCachedMap(cache);
  } catch {
    // no-op: 다음 조회 때 다시 네트워크에서 받아오면 된다.
  }

  if (stoppedDueToNetworkError) {
    throw new RecentDrawsFetchError(results);
  }

  return results;
}

/**
 * getRecentDraws와 결과는 같지만 실패해도 예외를 던지지 않고, 그때까지 확보한 결과
 * (또는 빈 배열)로 조용히 대체한다. 홈 화면/로또 연구소처럼 사용자가 직접 요청하지 않은
 * 백그라운드 로딩에서 쓴다 — 이런 화면은 예외가 그대로 새어 나가면 이 함수 이후의
 * 다른(당첨번호와 무관한) 데이터 로딩까지 통째로 멈춰버리기 때문이다. 실패를 사용자에게
 * 직접 알려야 하는 화면(제외하고 생성 등)은 getRecentDraws를 그대로 쓰고 호출부에서 처리한다.
 */
export async function getRecentDrawsSafe(count: number): Promise<WinningDraw[]> {
  try {
    return await getRecentDraws(count);
  } catch (e) {
    if (e instanceof RecentDrawsFetchError) return e.partialResults;
    return [];
  }
}

export async function getDrawByNumber(drawNumber: number): Promise<WinningDraw | null> {
  const cache = await getCachedMap();
  if (cache[drawNumber]) return cache[drawNumber];
  const fetched = await fetchWinningDraw(drawNumber);
  if (fetched) {
    cache[drawNumber] = fetched;
    // 캐시 저장은 다음 조회 속도를 위한 최적화일 뿐이다. 실패해도 방금 받아온
    // 결과(fetched)는 이미 확보했으니, 이 조회 자체를 실패로 만들지 않는다.
    try {
      await setCachedMap(cache);
    } catch {
      // no-op
    }
  }
  return fetched;
}

/**
 * getDrawByNumber와 동일하지만 "미발표"와 "확인 불가(네트워크 등)"를 구분해서 반환한다.
 * 당첨 확인처럼 사용자에게 실패 사유를 정확히 안내해야 하는 화면에서 사용한다.
 */
export async function getDrawByNumberWithStatus(drawNumber: number): Promise<DrawFetchResult> {
  const cache = await getCachedMap();
  if (cache[drawNumber]) return { status: "success", draw: cache[drawNumber] };

  const result = await fetchWinningDrawWithStatus(drawNumber);
  if (result.status === "success") {
    cache[drawNumber] = result.draw;
    try {
      await setCachedMap(cache);
    } catch {
      // no-op: 캐시 저장 실패는 조회 결과 자체에 영향을 주지 않는다.
    }
  }
  return result;
}
