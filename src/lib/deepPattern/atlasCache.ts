/**
 * 딥 패턴 Atlas의 로컬 캐시 + GitHub 동기화. src/lib/draws/drawCache.ts와 같은 원칙 —
 * "실패해도 절대 throw하지 않고, 항상 조용히 폴백한다."
 *
 * 중요(테스트/엔진 순수성 유지): 이 파일의 함수는 engine.ts의 모듈 최상단이나
 * recommendDeepPatterns() 안에서 자동으로 호출되지 않는다 — 그렇게 하면 tests/
 * deepPatternEngine.test.ts가 매번 실제 네트워크 요청을 시도하게 되어 테스트가 느려지거나
 * (CI에 네트워크가 없으면) 불필요하게 실패 경로를 타게 된다. 대신 화면(app/generate/
 * deep-pattern.tsx)이 마운트될 때 딱 한 번 명시적으로 호출한다 — engine.ts의
 * refreshAtlasIfStale() 참고.
 *
 * 실기기 확인(2026-08) 결과, src/lib/storage/storage.ts의 readJson/writeJson을 그대로 쓰지
 * 않고 AsyncStorage를 직접 쓴다 — storage.ts는 secureStorage.ts(expo-secure-store)까지 같은
 * 파일에서 import하는데, expo-secure-store는 ESM 전용이라 tests/deepPatternEngine.test.ts가
 * 도는 jest "unit" 프로젝트(ts-jest+node, node_modules 변환 없음)에서 "Cannot use import
 * statement outside a module"로 테스트 스위트 전체가 깨지는 걸 실기기에서 재현·확인했다. 이
 * 파일은 AsyncStorage만 있으면 되므로, storage.ts와 같은 네임스페이스("@ai-lotto/")만 맞춰서
 * 직접 쓴다(다른 모듈이 저장한 값과 섞이지 않게).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchAtlasFromGithub } from "./atlasGithubSource";
import type { Atlas } from "./atlasTypes";

const NAMESPACE = "@ai-lotto";

/** storage.ts의 readJson과 동일한 동작(실패 시 항상 fallback) — 여기서만 쓰는 축소판. */
async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(`${NAMESPACE}/${key}`);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** storage.ts의 writeJson과 동일한 동작(실패 시 throw) — 호출부에서 이미 try/catch로 감싼다. */
async function writeJson<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(`${NAMESPACE}/${key}`, JSON.stringify(value));
}

const CACHE_KEY = "deepPatternAtlasCache";
const SYNC_KEY = "deepPatternAtlasSyncedAt";
// Atlas는 주 1회만 갱신되므로(update-deep-pattern-atlas.yml), 당첨 이력 캐시(drawCache.ts)와
// 동일하게 몇 시간에 한 번만 시도해서 화면 진입마다 불필요한 네트워크 요청이 쌓이지 않게 한다.
const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** 이전 세션에 GitHub에서 받아 로컬에 저장해둔 atlas가 있으면 반환한다. 없으면 null. */
export async function getCachedAtlas(): Promise<Atlas | null> {
  return readJson<Atlas | null>(CACHE_KEY, null);
}

/**
 * 동기화 주기가 지났으면 GitHub에서 최신 atlas를 받아와 로컬에 저장한다.
 * baselineThroughDrawNumber(현재 쓰고 있는 atlas의 historyThroughDrawNumber)보다 회차가
 * 더 큰 atlas를 받았을 때만 그 atlas를 반환한다 — 그렇지 않으면(주기가 안 지났거나, 실패했거나,
 * 받아온 게 더 최신이 아니면) null을 반환해 호출부가 기존 atlas를 그대로 쓰게 한다.
 */
export async function refreshAtlasFromGithubIfNeeded(baselineThroughDrawNumber: number): Promise<Atlas | null> {
  const lastSyncedAt = await readJson<number>(SYNC_KEY, 0);
  if (Date.now() - lastSyncedAt < SYNC_INTERVAL_MS) return null;

  const fetched = await fetchAtlasFromGithub();
  // 동기화를 "시도했다"는 사실은 성공 여부와 무관하게 기록한다. 그러지 않으면 GitHub가
  // 응답하지 않는 상황에서 화면에 들어갈 때마다 다시 타임아웃을 기다리게 된다.
  try {
    await writeJson(SYNC_KEY, Date.now());
  } catch {
    // no-op
  }

  if (!fetched) return null;
  if (fetched.historyThroughDrawNumber <= baselineThroughDrawNumber) return null;

  try {
    await writeJson(CACHE_KEY, fetched);
  } catch {
    // no-op: 로컬 저장에 실패해도 이번 세션에서 받아온 값 자체는 호출부가 바로 쓸 수 있다.
  }
  return fetched;
}
