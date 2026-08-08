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

/**
 * 두 조합(각 6개 번호) 사이의 기하학적 거리. 명세 §3 canonical 규칙대로 두 조합을 각각
 * 오름차순 정렬한 뒤, 같은 순번끼리(1번째-1번째, 2번째-2번째, ...) 용지 좌표 제곱거리 합을
 * 구한다. 값이 클수록 두 조합의 용지 위 형태·위치가 서로 멀다.
 */
export function patternDistance(a: number[], b: number[]): number {
  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);
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
 * 명세 §8의 V_k(C): 후보 C와 이력 집합의 거리들 중 가장 가까운 k개를 골라 그 중앙값을
 * 반환한다. 값이 클수록 "역대 이력에서 기하학적으로 더 멀리 떨어진(=구조적으로 덜 겪어본)"
 * 후보라는 뜻이다. history가 k개보다 적으면 있는 만큼만 쓴다.
 */
export function kNearestVoidScore(candidate: number[], history: { numbers: number[] }[], k = 10): number {
  if (history.length === 0) return 0;
  const distances = history.map((h) => patternDistance(candidate, h.numbers)).sort((x, y) => x - y);
  const nearest = distances.slice(0, Math.min(k, distances.length));
  const mid = Math.floor(nearest.length / 2);
  if (nearest.length % 2 === 1) return nearest[mid];
  return (nearest[mid - 1] + nearest[mid]) / 2;
}
