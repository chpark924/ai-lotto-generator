/**
 * 기기 내 안전한 난수 생성.
 *
 * 기획서 2.4 원칙: Math.random()을 핵심 번호 추첨에 사용하지 않는다.
 * 서버가 없으므로 node:crypto 대신 expo-crypto의 동기 CSPRNG(getRandomBytes)를
 * 사용해 100% 기기(클라이언트) 내부에서 계산한다. 네트워크 호출이 없다.
 *
 * 테스트 환경(Jest/Node)에서는 jest.config.js의 moduleNameMapper가
 * "expo-crypto" -> tests/mocks/expo-crypto.ts 로 치환되어
 * node:crypto 기반의 동일한 인터페이스를 제공한다.
 */
import * as Crypto from "expo-crypto";

/**
 * expo-crypto의 getRandomBytes는 매번 JS<->네이티브 브릿지를 왕복하는 동기 호출이라
 * 호출 1회당 비용이 크다. AI 조합 탐색처럼 짧은 시간에 수만~수십만 번 난수를 뽑아야 하는
 * 경로에서는 이 브릿지 왕복 횟수 자체가 병목이 된다. 그래서 필요한 바이트를 한 번에
 * 큼직하게(POOL_SIZE) 미리 받아두고, 그 풀에서 조금씩 소비하는 방식으로 브릿지 호출
 * 횟수를 수천 분의 1로 줄인다. 풀이 바닥나면 다시 채운다(이때만 네이티브 호출 발생).
 * CSPRNG 품질은 그대로 유지된다 — 어차피 getRandomBytes가 만들어낸 바이트를 나눠 쓸 뿐이다.
 *
 * 주의: expo-crypto의 getRandomBytes는 네이티브 구현상 한 번에 최대 1024바이트까지만
 * 허용한다(그 이상 요청하면 "expected a valid number from range 0...1024" 에러로 즉시
 * 실패한다). 테스트 환경의 목(mock)은 node:crypto 기반이라 이 제한이 없어 실기기에서만
 * 드러나는 문제였다 — 실제 앱(AI 조합 탐색, 운명의 신, 행운번호 등 난수를 쓰는 모든 화면)이
 * "생성 실패"로 죽는 걸 실기기 테스트에서 확인하고 나서야 발견했다. 그래서 상한을 지키는
 * 동시에, 혹시 플랫폼별로 실제 허용치가 더 낮더라도 안전하게 동작하도록 여러 크기로
 * 재시도하는 폴백을 둔다.
 */
const POOL_SIZE_CANDIDATES = [1024, 256, 64, 16, 1];
let bytePool: Uint8Array = new Uint8Array(0);
let poolOffset = 0;

function refillPool(): void {
  let lastError: unknown;
  for (const size of POOL_SIZE_CANDIDATES) {
    try {
      bytePool = Crypto.getRandomBytes(size);
      poolOffset = 0;
      return;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("난수를 생성하지 못했습니다.");
}

function nextRandomByte(): number {
  if (poolOffset >= bytePool.length) {
    refillPool();
  }
  return bytePool[poolOffset++];
}

/** 0 이상 maxExclusive 미만의 균등분포 정수를 반환한다 (rejection sampling). */
export function secureRandomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error("maxExclusive는 1 이상의 정수여야 합니다.");
  }
  if (maxExclusive === 1) return 0;

  // maxExclusive를 표현하는 데 필요한 바이트 수를 계산한다.
  const bitsNeeded = Math.ceil(Math.log2(maxExclusive));
  const byteLength = Math.max(1, Math.ceil(bitsNeeded / 8));
  const range = 2 ** (byteLength * 8);
  // 균등분포를 보장하기 위해 range를 maxExclusive로 나눈 나머지 구간은 버린다.
  const limit = range - (range % maxExclusive);

  // 이론상 무한루프 가능하지만 limit/range 비율이 항상 50% 이상이므로
  // 재시도 횟수는 매우 낮게 수렴한다. 방어적으로 최대 반복 횟수를 둔다.
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    let value = 0;
    for (let i = 0; i < byteLength; i += 1) {
      value = value * 256 + nextRandomByte();
    }
    if (value < limit) {
      return value % maxExclusive;
    }
  }
  throw new Error("난수 생성에 실패했습니다. 다시 시도해주세요.");
}

/** min 이상 max 미만의 정수를 반환한다 (node:crypto randomInt와 동일한 시그니처). */
export function randomInt(min: number, max: number): number {
  return min + secureRandomInt(max - min);
}

/** Fisher-Yates shuffle. 원본 배열은 변경하지 않는다. */
export function secureShuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = secureRandomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Fisher-Yates의 앞쪽 count칸만 섞어 서로 다른 count개를 뽑는다.
 * 전체를 섞고 앞에서 잘라내는 것(secureShuffle(items).slice(0, count))과 통계적으로
 * 완전히 동일한 결과 분포를 보장하면서, 필요한 난수 호출 횟수만 items.length-1에서
 * count로 줄인다 (예: 45개 중 6개를 뽑을 때 44회 → 6회).
 */
export function securePartialShuffle<T>(items: T[], count: number): T[] {
  const result = [...items];
  const take = Math.min(Math.max(count, 0), result.length);
  for (let i = 0; i < take; i += 1) {
    const j = i + secureRandomInt(result.length - i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result.slice(0, take);
}

/** 배열에서 하나의 원소를 안전한 난수로 선택한다. */
export function pickOne<T>(items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error("빈 배열에서는 선택할 수 없습니다.");
  }
  return items[secureRandomInt(items.length)];
}
