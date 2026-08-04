/**
 * 회귀 방지 테스트: expo-crypto의 getRandomBytes는 실기기에서 한 번에 최대 1024바이트까지만
 * 허용한다. 이 상한을 넘겨 요청하면 "expected a valid number from range 0...1024" 에러로
 * 즉시 실패하는데, 테스트용 목(tests/mocks/expo-crypto.ts)은 node:crypto 기반이라 이 제한이
 * 없어서 유닛 테스트만으로는 못 잡고 실기기에서 "생성 실패"로 처음 드러났던 문제다.
 * 여기서는 실제 네이티브 동작(1024 초과 시 예외)을 흉내내는 목으로 교체해서, 같은 실수가
 * 재발하면 유닛 테스트 단계에서 바로 잡히게 한다.
 */
import { randomBytes } from "node:crypto";

jest.mock("expo-crypto", () => ({
  getRandomBytes: jest.fn((byteLength: number) => {
    if (!Number.isInteger(byteLength) || byteLength < 0 || byteLength > 1024) {
      throw new Error(`getRandomBytes(${byteLength}) expected a valid number from range 0...1024`);
    }
    return new Uint8Array(randomBytes(byteLength));
  }),
}));

// 위 mock이 걸린 뒤에 import해야 한다.
import { secureRandomInt, secureShuffle, securePartialShuffle, randomInt } from "../src/lib/lottery/random";
import * as Crypto from "expo-crypto";

describe("random.ts — 실기기의 1024바이트 상한 아래에서도 정상 동작하는지", () => {
  it("실기기와 동일한 1024바이트 상한 mock에서도 secureRandomInt가 절대 실패하지 않는다 (수천 번 호출)", () => {
    for (let i = 0; i < 5000; i += 1) {
      const value = secureRandomInt(45);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(45);
    }
  });

  it("내부적으로 1024바이트를 초과해서 getRandomBytes를 호출하는 일이 없다 (POOL_SIZE 회귀 방지)", () => {
    const mockedGetRandomBytes = Crypto.getRandomBytes as jest.Mock;
    mockedGetRandomBytes.mockClear();

    for (let i = 0; i < 3000; i += 1) {
      secureRandomInt(45);
    }

    expect(mockedGetRandomBytes).toHaveBeenCalled();
    for (const call of mockedGetRandomBytes.mock.calls) {
      const requestedSize = call[0];
      expect(requestedSize).toBeLessThanOrEqual(1024);
    }
  });

  it("secureShuffle/securePartialShuffle이 1024바이트 상한 아래에서도 정상적인 순열을 만든다", () => {
    const items = Array.from({ length: 45 }, (_, i) => i + 1);
    for (let i = 0; i < 200; i += 1) {
      const shuffled = secureShuffle(items);
      expect(new Set(shuffled).size).toBe(45);

      const partial = securePartialShuffle(items, 6);
      expect(partial).toHaveLength(6);
      expect(new Set(partial).size).toBe(6);
      for (const n of partial) expect(items).toContain(n);
    }
  });

  it("randomInt도 1024바이트 상한 아래에서 정상 동작한다", () => {
    for (let i = 0; i < 1000; i += 1) {
      const value = randomInt(10, 20);
      expect(value).toBeGreaterThanOrEqual(10);
      expect(value).toBeLessThan(20);
    }
  });
});
