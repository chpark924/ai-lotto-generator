import { readJson, writeJson } from "../storage/storage";
import { estimateLatestDrawNumber, fetchWinningDraw } from "./drawApi";
import type { WinningDraw } from "./types";

const KEY = "winningDraws";

async function getCachedMap(): Promise<Record<number, WinningDraw>> {
  return readJson<Record<number, WinningDraw>>(KEY, {});
}

async function setCachedMap(map: Record<number, WinningDraw>): Promise<void> {
  await writeJson(KEY, map);
}

/**
 * 최근 N회 당첨번호를 반환한다. 기기에 캐시된 데이터를 우선 사용하고,
 * 없는 회차만 네트워크로 보충한다 (매번 전체를 다시 받지 않아 데이터 사용량을 최소화한다).
 */
export async function getRecentDraws(count: number): Promise<WinningDraw[]> {
  const cache = await getCachedMap();
  const latestGuess = estimateLatestDrawNumber();

  // 가장 최신 회차부터 역순으로 캐시/네트워크를 확인한다.
  let latestConfirmed: number | null = null;
  for (let candidate = latestGuess; candidate >= Math.max(1, latestGuess - 2); candidate -= 1) {
    if (cache[candidate]) {
      latestConfirmed = candidate;
      break;
    }
    const fetched = await fetchWinningDraw(candidate);
    if (fetched) {
      cache[candidate] = fetched;
      latestConfirmed = candidate;
      break;
    }
  }

  if (latestConfirmed === null) {
    // 네트워크 실패: 캐시에 있는 것 중 가장 최신 데이터로 폴백한다.
    const cachedNumbers = Object.keys(cache).map(Number).sort((a, b) => b - a);
    latestConfirmed = cachedNumbers[0] ?? null;
  }

  if (latestConfirmed === null) {
    return [];
  }

  const results: WinningDraw[] = [];
  for (let n = latestConfirmed; n > 0 && results.length < count; n -= 1) {
    if (cache[n]) {
      results.push(cache[n]);
      continue;
    }
    const fetched = await fetchWinningDraw(n);
    if (fetched) {
      cache[n] = fetched;
      results.push(fetched);
    } else {
      break;
    }
  }

  await setCachedMap(cache);
  return results;
}

export async function getDrawByNumber(drawNumber: number): Promise<WinningDraw | null> {
  const cache = await getCachedMap();
  if (cache[drawNumber]) return cache[drawNumber];
  const fetched = await fetchWinningDraw(drawNumber);
  if (fetched) {
    cache[drawNumber] = fetched;
    await setCachedMap(cache);
  }
  return fetched;
}
