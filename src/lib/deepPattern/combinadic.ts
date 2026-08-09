/**
 * Combinadic(조합 순위) rank/unrank 유틸 — Deep Pattern Engine Master Spec §19 사전 작업.
 *
 * `scripts/build-deep-pattern-atlas.mjs`는 로또 6/45의 8,145,060개 조합을 표준 사전순
 * (lexicographic order — a<b<c<d<e<f 오름차순, a가 가장 느리게 바뀌는 최상위 자릿수)으로
 * 6중 for문을 돌며 idx 0..8,145,059를 매긴다. 이 모듈은 그 순서를 그대로 따르는
 * "조합 → 순위"(rank)와 "순위 → 조합"(unrank) 양방향 변환을, 8,145,060개를 실제로 나열하거나
 * 탐색하지 않고 조합론 공식(이항계수의 합)만으로 O(45) 시간에 계산한다.
 *
 * 왜 필요한가(§19): 지금(v3, DPE-1.1)은 basin마다 빌드타임에 reservoir sampling으로 뽑아둔
 * 최대 150개 대표 후보(`sampleCombos`)만 쓰고 있고, 런타임은 그중에서 부분셔플만 한다. basin
 * 대표 후보를 더 정교하게 다루려면(예: basin 전체 인구에서 결정론적으로 균등 간격의 표본을
 * 뽑거나, 특정 순위 구간만 골라내거나, §7의 "Exact"(개별 조합) 해상도 계층을 별도로 만들 때)
 * "이 조합이 전체 8,145,060개 중 몇 번째인가" / "몇 번째 조합이 무엇인가"를 즉시 계산할 수
 * 있어야 한다 — 이 유틸이 그 기반이다.
 *
 * **정직한 현재 상태**: 이 모듈은 아직 엔진(`engine.ts`)이나 Atlas 빌더 어디에서도 호출되지
 * 않는다. 지금의 reservoir sampling 방식(#55)이 이미 latency 문제를 해결했기 때문에 당장
 * 급하게 필요한 것은 아니고, 다음에 basin 표본을 더 정교하게 다루는 작업을 할 때 쓸 수 있도록
 * 미리 준비해두는 사전 작업이다.
 */

const LOTTO_N = 45;
const LOTTO_K = 6;

/** 로또 6/45 전체 조합 개수. `scripts/build-deep-pattern-atlas.mjs`의 TOTAL_COMBINATIONS와 동일. */
export const TOTAL_LOTTO_COMBINATIONS = 8_145_060;

/**
 * 이항계수 C(n, k)를 곱셈/나눗셈을 번갈아가며 계산한다(각 단계 결과가 항상 정수임이 수학적으로
 * 보장되는 표준 기법 — 예를 들어 C(45,3)을 구할 때 45/1, *44/2, *43/3처럼 매 단계 나눠떨어짐).
 * n<k, n<0, k<0이면 0(그런 조합은 존재하지 않는다는 뜻)을 그대로 반환한다.
 */
function binomial(n: number, k: number): number {
  if (k < 0 || n < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  const kk = Math.min(k, n - k);
  let result = 1;
  for (let i = 0; i < kk; i += 1) {
    result = (result * (n - i)) / (i + 1);
  }
  return Math.round(result);
}

function assertValidCombo(numbers: number[]): number[] {
  if (numbers.length !== LOTTO_K) {
    throw new Error(`조합은 정확히 ${LOTTO_K}개 번호여야 합니다 (받은 개수: ${numbers.length})`);
  }
  const sorted = [...numbers].sort((a, b) => a - b);
  for (let i = 0; i < LOTTO_K; i += 1) {
    const n = sorted[i];
    if (!Number.isInteger(n) || n < 1 || n > LOTTO_N) {
      throw new Error(`번호는 1~${LOTTO_N} 범위의 정수여야 합니다 (받은 값: ${n})`);
    }
    if (i > 0 && sorted[i] === sorted[i - 1]) {
      throw new Error(`중복된 번호가 있습니다: ${n}`);
    }
  }
  return sorted;
}

/**
 * 조합(1~45, 순서 무관 6개) → Atlas 빌더의 전수 순회 순서에서의 순위(0 ~ 8,145,059).
 *
 * 각 자리(왼쪽부터)마다 "그 자리에 실제보다 더 작은 값이 왔다면 나머지 자리를 채우는 방법의
 * 수"를 전부 더한다 — 사전순으로 이 조합보다 앞서는 조합의 개수와 정확히 같다.
 */
export function rankCombination(numbers: number[]): number {
  const sorted = assertValidCombo(numbers);
  const c = sorted.map((n) => n - 1); // 0-indexed(0~44)로 바꿔서 계산한다.
  let rank = 0;
  let prev = -1;
  for (let i = 0; i < LOTTO_K; i += 1) {
    for (let v = prev + 1; v < c[i]; v += 1) {
      rank += binomial(LOTTO_N - 1 - v, LOTTO_K - i - 1);
    }
    prev = c[i];
  }
  return rank;
}

/**
 * 순위(0 ~ 8,145,059) → 조합(1~45 오름차순 6개). `rankCombination`의 역함수.
 *
 * 각 자리마다 후보값을 0부터 하나씩 올려보며, 그 값을 이 자리에 놓았을 때 나머지 자리를
 * 채우는 방법의 수(cnt)를 남은 순위(remaining)에서 뺄 수 있으면(=아직 이 자리 값이 아니면)
 * 계속 진행하고, 뺄 수 없으면(remaining < cnt) 그 값으로 이 자리가 확정된다.
 */
export function unrankCombination(rank: number): number[] {
  if (!Number.isInteger(rank) || rank < 0 || rank >= TOTAL_LOTTO_COMBINATIONS) {
    throw new Error(`순위는 0~${TOTAL_LOTTO_COMBINATIONS - 1} 범위의 정수여야 합니다 (받은 값: ${rank})`);
  }
  let remaining = rank;
  const result: number[] = [];
  let prev = -1;
  for (let i = 0; i < LOTTO_K; i += 1) {
    let v = prev + 1;
    for (;;) {
      const cnt = binomial(LOTTO_N - 1 - v, LOTTO_K - i - 1);
      if (remaining < cnt) break;
      remaining -= cnt;
      v += 1;
    }
    result.push(v);
    prev = v;
  }
  return result.map((v) => v + 1);
}
