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
    const bytes = Crypto.getRandomBytes(byteLength);
    let value = 0;
    for (let i = 0; i < byteLength; i += 1) {
      value = value * 256 + bytes[i];
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

/** 배열에서 하나의 원소를 안전한 난수로 선택한다. */
export function pickOne<T>(items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error("빈 배열에서는 선택할 수 없습니다.");
  }
  return items[secureRandomInt(items.length)];
}
