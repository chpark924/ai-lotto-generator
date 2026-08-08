/**
 * 딥 패턴 탐색 — Geometric Void (Master Spec §8).
 *
 * 후보 C와 역대 당첨 H 사이의 Pattern distance D(C,H)를 정의하고, 최근접 이웃 1개만 쓰는
 * 취약성을 보완하기 위해 kNN(§8 "V_k(C)=median 또는 mean of k nearest distances") 버전을
 * 함께 제공한다. 이 값은 basin 단위 Structural Void(engine.ts, atlas 기반)와는 다른 축이다 —
 * 같은 basin 안에서도 어떤 구체적 조합을 대표로 뽑을지 고를 때 쓴다("같은 basin이라도 역대
 * 이력과 기하학적으로 더 먼 조합을 우선한다").
 *
 * 순수 함수만 담아 RN 의존성이 없고, engine.ts와 유닛 테스트 양쪽에서 재사용한다.
 */
import { getPaperPosition } from "./coordinates";

/** 이미 오름차순 정렬된 두 배열 사이의 용지 좌표 제곱거리 합을 구한다(내부 전용, 정렬은 호출부 책임). */
function sumSquaredPaperDistance(sortedA: number[], sortedB: number[]): number {
  let sum = 0;
  const length = Math.min(sortedA.length, sortedB.length);
  for (let i = 0; i < length; i += 1) {
    const posA = getPaperPosition(sortedA[i]);
    const posB = getPaperPosition(sortedB[i]);
    const dr = posA.row - posB.row;
    const dc = posA.col - posB.col;
    sum += dr * dr + dc * dc;
  }
  return sum;
}

/**
 * 두 조합(각 6개 번호) 사이의 기하학적 거리. 명세 §3 canonical 규칙대로 두 조합을 각각
 * 오름차순 정렬한 뒤, 같은 순번끼리(1번째-1번째, 2번째-2번째, ...) 용지 좌표 제곱거리 합을
 * 구한다. 값이 클수록 두 조합의 용지 위 형태·위치가 서로 멀다. 입력 배열은 정렬하지 않고
 * 읽기만 한다(원본 순서를 바꾸지 않음).
 */
export function patternDistance(a: number[], b: number[]): number {
  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);
  return sumSquaredPaperDistance(sortedA, sortedB);
}

/**
 * 명세 §8의 V_k(C): 후보 C와 이력 집합의 거리들 중 가장 가까운 k개를 골라 그 중앙값을
 * 반환한다. 값이 클수록 "역대 이력에서 기하학적으로 더 멀리 떨어진(=구조적으로 덜 겪어본)"
 * 후보라는 뜻이다. history가 k개보다 적으면 있는 만큼만 쓴다.
 *
 * 성능 참고: candidate는 history 전체(engine.ts 기준 최대 1,235개)와 비교하는 동안 값이
 * 바뀌지 않으므로, `patternDistance(candidate, ...)`를 반복 호출해 매번 candidate를 다시
 * 정렬하는 대신 여기서 한 번만 정렬해 재사용한다 — 결과는 patternDistance를 매번 호출하는
 * 것과 수학적으로 동일하고(정렬은 순서만 바꿀 뿐 집합 자체는 그대로), 추천 5개 기준으로
 * 최대 100번 호출되는 이 함수에서 불필요한 정렬 횟수를 최대 12만 회 이상 줄인다.
 */
export function kNearestVoidScore(candidate: number[], history: { numbers: number[] }[], k = 10): number {
  if (history.length === 0) return 0;
  const sortedCandidate = [...candidate].sort((x, y) => x - y);
  const distances = history
    .map((h) => sumSquaredPaperDistance(sortedCandidate, [...h.numbers].sort((x, y) => x - y)))
    .sort((x, y) => x - y);
  const nearest = distances.slice(0, Math.min(k, distances.length));
  const mid = Math.floor(nearest.length / 2);
  if (nearest.length % 2 === 1) return nearest[mid];
  return (nearest[mid - 1] + nearest[mid]) / 2;
}
