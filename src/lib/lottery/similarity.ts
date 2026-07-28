/** 기획서 8장 조합 유사도 계산 */

export function overlapCount(a: number[], b: number[]): number {
  const setB = new Set(b);
  return a.filter((n) => setB.has(n)).length;
}

/** 0~1 사이의 유사도. 6개 중 몇 개가 겹치는지의 비율. */
export function combinationSimilarity(a: number[], b: number[]): number {
  return overlapCount(a, b) / 6;
}

export function combinationKey(numbers: number[]): string {
  return [...numbers].sort((x, y) => x - y).join("-");
}

/** 후보 하나가 기존 조합 목록과 얼마나 겹치는지의 최댓값(0~6)을 반환한다. */
export function maxOverlapAgainstList(candidate: number[], others: number[][]): number {
  let max = 0;
  for (const other of others) {
    const overlap = overlapCount(candidate, other);
    if (overlap > max) max = overlap;
  }
  return max;
}
