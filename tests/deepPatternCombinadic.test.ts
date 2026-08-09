/**
 * `src/lib/deepPattern/combinadic.ts` 검증 — Master Spec §34(Exhaustive/Golden/Property Test)
 * 원칙에 따라, 8,145,060개 전체를 순회하지는 못하더라도(비용 문제) golden value(손으로 미리
 * 계산해둔 값)와 대량의 property 기반 round-trip 검증, 그리고 실제 Atlas 데이터와의
 * 교차검증으로 정확성을 뒷받침한다.
 */
import { TOTAL_LOTTO_COMBINATIONS, rankCombination, unrankCombination } from "../src/lib/deepPattern/combinadic";
import atlasData from "../data/deep-pattern-atlas.json";

describe("combinadic (조합 순위 rank/unrank)", () => {
  it("TOTAL_LOTTO_COMBINATIONS는 로또 6/45 전체 조합 개수(8,145,060)와 같다", () => {
    expect(TOTAL_LOTTO_COMBINATIONS).toBe(8_145_060);
  });

  describe("golden value — Atlas 빌더의 6중 for문 순회 순서와 손으로 맞춰본 경계값", () => {
    it("사전순 첫 조합(1,2,3,4,5,6)은 순위 0이다", () => {
      expect(rankCombination([1, 2, 3, 4, 5, 6])).toBe(0);
    });

    it("사전순 마지막 조합(40,41,42,43,44,45)은 순위 8,145,059(TOTAL-1)이다", () => {
      expect(rankCombination([40, 41, 42, 43, 44, 45])).toBe(TOTAL_LOTTO_COMBINATIONS - 1);
    });

    it("f(마지막 자리)만 1 증가한 다음 조합은 순위가 1 증가한다", () => {
      expect(rankCombination([1, 2, 3, 4, 5, 7])).toBe(1);
    });

    it("a=1 구간의 마지막 조합과 a=2 구간의 첫 조합 — C(44,5)=1,086,008개 경계", () => {
      // a=1로 시작하는 조합 개수는 나머지 5자리를 {2..45}(44개)에서 고르는 경우의 수인
      // C(44,5)=1,086,008개다. 따라서 a=1 구간의 마지막 조합(1,41,42,43,44,45)은 순위
      // 1,086,007이고, 바로 다음(a=2로 넘어가는 첫 조합, 2,3,4,5,6,7)은 순위 1,086,008이다.
      expect(rankCombination([1, 41, 42, 43, 44, 45])).toBe(1_086_007);
      expect(rankCombination([2, 3, 4, 5, 6, 7])).toBe(1_086_008);
    });

    it("a=1,b=2 구간의 마지막 조합과 a=1,b=3 구간의 첫 조합 — C(43,4)=123,410개 경계", () => {
      // a=1,b=2로 고정했을 때 나머지 4자리를 {3..45}(43개)에서 고르는 경우의 수는
      // C(43,4)=123,410개다. 이 구간은 a=1 구간(오프셋 0)의 맨 앞이므로 절대 순위도 그대로
      // 적용된다 — 마지막 조합(1,2,42,43,44,45)은 순위 123,409, 다음(1,3,4,5,6,7)은 123,410.
      expect(rankCombination([1, 2, 42, 43, 44, 45])).toBe(123_409);
      expect(rankCombination([1, 3, 4, 5, 6, 7])).toBe(123_410);
    });

    it("unrankCombination은 위 golden value들의 정확한 역함수다", () => {
      expect(unrankCombination(0)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(unrankCombination(TOTAL_LOTTO_COMBINATIONS - 1)).toEqual([40, 41, 42, 43, 44, 45]);
      expect(unrankCombination(1)).toEqual([1, 2, 3, 4, 5, 7]);
      expect(unrankCombination(1_086_007)).toEqual([1, 41, 42, 43, 44, 45]);
      expect(unrankCombination(1_086_008)).toEqual([2, 3, 4, 5, 6, 7]);
      expect(unrankCombination(123_409)).toEqual([1, 2, 42, 43, 44, 45]);
      expect(unrankCombination(123_410)).toEqual([1, 3, 4, 5, 6, 7]);
    });
  });

  describe("사전순 순차 일치 — Atlas 빌더와 동일한 6중 for문으로 앞부분 다수 조합을 직접 생성", () => {
    // Atlas 빌더(scripts/build-deep-pattern-atlas.mjs)와 정확히 같은 루프 구조(a<=40,
    // b<=41, ..., f<=45)를 여기서도 그대로 재현해, 처음 12,000개 조합에 대해
    // rankCombination(combo) === idx, unrankCombination(idx) === combo를 전수 확인한다.
    // 12,000개면 a=1, b=2..14 구간 정도까지 자리(자릿수) 캐리(carry)가 여러 번 발생해
    // e/d/c 자리의 넘어감까지 충분히 exercise한다(전체 8,145,060개를 여기서 다 도는 건
    // 테스트 비용상 비현실적이라, 앞부분 촘촘한 순차 검증 + 위 golden 경계값 + 아래 무작위
    // round-trip으로 나눠서 검증 범위를 채운다).
    const combos: number[][] = [];
    outer: for (let a = 1; a <= 40; a += 1) {
      for (let b = a + 1; b <= 41; b += 1) {
        for (let c = b + 1; c <= 42; c += 1) {
          for (let d = c + 1; d <= 43; d += 1) {
            for (let e = d + 1; e <= 44; e += 1) {
              for (let f = e + 1; f <= 45; f += 1) {
                combos.push([a, b, c, d, e, f]);
                if (combos.length >= 12_000) break outer;
              }
            }
          }
        }
      }
    }

    it("처음 12,000개 조합 전부 rank(combo) === idx다", () => {
      expect(combos.length).toBe(12_000);
      for (let idx = 0; idx < combos.length; idx += 1) {
        expect(rankCombination(combos[idx])).toBe(idx);
      }
    });

    it("처음 12,000개 순위 전부 unrank(idx) === combo다", () => {
      for (let idx = 0; idx < combos.length; idx += 1) {
        expect(unrankCombination(idx)).toEqual(combos[idx]);
      }
    });
  });

  describe("property 기반 round-trip (무작위 대량 샘플)", () => {
    // 결정론적 PRNG(mulberry32, 이 프로젝트의 다른 딥 패턴 테스트/빌드 스크립트와 동일 계열)로
    // 무작위 순위 2,000개를 뽑아 unrank→rank round-trip을, 무작위 조합 2,000개를 뽑아
    // rank→unrank round-trip을 확인한다. §33(결정론) 원칙에 맞춰 매번 같은 값이 나오도록
    // 고정 seed를 쓴다.
    function mulberry32(seed: number) {
      let state = seed | 0;
      return function next() {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    it("무작위 순위 2,000개: unrank → rank가 원래 순위로 되돌아온다", () => {
      const rng = mulberry32(20260810);
      for (let i = 0; i < 2000; i += 1) {
        const rank = Math.floor(rng() * TOTAL_LOTTO_COMBINATIONS);
        const combo = unrankCombination(rank);
        expect(combo).toHaveLength(6);
        expect(new Set(combo).size).toBe(6); // 중복 없음
        expect(combo.every((n) => n >= 1 && n <= 45)).toBe(true);
        expect(rankCombination(combo)).toBe(rank);
      }
    });

    it("무작위 조합 2,000개: rank → unrank가 원래 조합(정렬됨)으로 되돌아온다", () => {
      const rng = mulberry32(20260811);
      for (let i = 0; i < 2000; i += 1) {
        const pool = Array.from({ length: 45 }, (_, k) => k + 1);
        for (let j = 0; j < 6; j += 1) {
          const k = j + Math.floor(rng() * (45 - j));
          [pool[j], pool[k]] = [pool[k], pool[j]];
        }
        const combo = pool.slice(0, 6).sort((x, y) => x - y);
        const rank = rankCombination(combo);
        expect(rank).toBeGreaterThanOrEqual(0);
        expect(rank).toBeLessThan(TOTAL_LOTTO_COMBINATIONS);
        expect(unrankCombination(rank)).toEqual(combo);
      }
    });

    it("조합을 아무 순서로나 넣어도(정렬 안 된 입력) 정렬된 것과 같은 순위를 반환한다", () => {
      expect(rankCombination([6, 5, 4, 3, 2, 1])).toBe(rankCombination([1, 2, 3, 4, 5, 6]));
      expect(rankCombination([45, 1, 44, 2, 43, 3])).toBe(rankCombination([1, 2, 3, 43, 44, 45]));
    });
  });

  describe("실제 Atlas 데이터와의 교차검증", () => {
    // 매번 전체 basin을 다 훑으면 비용이 크므로, basin 몇 개(처음/중간/마지막)에서 sampleCombos
    // 앞부분 몇 개씩만 뽑아 rank→unrank round-trip을 확인한다. 이 프로젝트가 반복적으로
    // 강조해온 "파일이 깨지지 않았는지"를 이 신규 유틸 관점에서도 재확인하는 셈이다.
    const basins = (atlasData as { basins: { key: number; sampleCombos: number[][] }[] }).basins;

    it("Atlas basins 배열이 비어있지 않다(사전 조건)", () => {
      expect(basins.length).toBeGreaterThan(0);
    });

    it("basin 대표 후보(sampleCombos)들의 rank → unrank round-trip이 전부 원본과 일치한다", () => {
      const picks = [basins[0], basins[Math.floor(basins.length / 2)], basins[basins.length - 1]];
      let checked = 0;
      for (const basin of picks) {
        for (const combo of basin.sampleCombos.slice(0, 20)) {
          const rank = rankCombination(combo);
          expect(unrankCombination(rank)).toEqual(combo);
          checked += 1;
        }
      }
      expect(checked).toBeGreaterThan(0);
    });
  });

  describe("입력 검증 (오류 처리)", () => {
    it("6개가 아닌 개수를 넣으면 에러를 던진다", () => {
      expect(() => rankCombination([1, 2, 3, 4, 5])).toThrow();
      expect(() => rankCombination([1, 2, 3, 4, 5, 6, 7])).toThrow();
    });

    it("범위(1~45) 밖의 번호가 있으면 에러를 던진다", () => {
      expect(() => rankCombination([0, 2, 3, 4, 5, 6])).toThrow();
      expect(() => rankCombination([1, 2, 3, 4, 5, 46])).toThrow();
    });

    it("중복된 번호가 있으면 에러를 던진다", () => {
      expect(() => rankCombination([1, 2, 3, 4, 5, 5])).toThrow();
    });

    it("정수가 아닌 순위나 범위 밖 순위를 unrank하면 에러를 던진다", () => {
      expect(() => unrankCombination(-1)).toThrow();
      expect(() => unrankCombination(TOTAL_LOTTO_COMBINATIONS)).toThrow();
      expect(() => unrankCombination(1.5)).toThrow();
    });
  });
});
