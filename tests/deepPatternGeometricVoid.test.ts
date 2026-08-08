import { patternDistance, kNearestVoidScore } from "../src/lib/deepPattern/geometricVoid";

describe("딥 패턴 — Geometric Void (Master Spec §8, kNN 보정)", () => {
  it("동일한 조합끼리는 거리 0이다", () => {
    expect(patternDistance([1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6])).toBe(0);
  });

  it("입력 순서(정렬 안 된 배열)와 무관하게 canonical(오름차순) 기준으로 계산한다", () => {
    const a = patternDistance([6, 5, 4, 3, 2, 1], [1, 2, 3, 4, 5, 6]);
    const b = patternDistance([1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6]);
    expect(a).toBe(b);
  });

  it("서로 다른 조합은 0보다 큰 거리를 가진다", () => {
    expect(patternDistance([1, 2, 3, 4, 5, 6], [40, 41, 42, 43, 44, 45])).toBeGreaterThan(0);
  });

  it("kNearestVoidScore — 이력에 정확히 같은 조합이 있으면 0에 가깝지 않고, k개 중앙값을 반영한다", () => {
    const history = [
      { numbers: [1, 2, 3, 4, 5, 6] }, // 후보와 동일 (거리 0)
      { numbers: [1, 2, 3, 4, 5, 7] }, // 매우 가까움
      { numbers: [40, 41, 42, 43, 44, 45] }, // 매우 멂
    ];
    const score = kNearestVoidScore([1, 2, 3, 4, 5, 6], history, 3);
    // 3개 중 중앙값이므로 0(자기 자신)도 아니고 가장 먼 값도 아닌 중간 거리여야 한다.
    expect(score).toBeGreaterThan(0);
  });

  it("이력이 비어 있으면 0을 반환한다", () => {
    expect(kNearestVoidScore([1, 2, 3, 4, 5, 6], [], 10)).toBe(0);
  });

  it("이력 전체와 아주 멀리 떨어진 후보는 이력과 가까운 후보보다 void score가 더 크다", () => {
    const history = Array.from({ length: 20 }, (_, i) => ({ numbers: [1, 2, 3, 4, 5, 6 + (i % 3)] }));
    const closeCandidate = [1, 2, 3, 4, 5, 6];
    const farCandidate = [40, 41, 42, 43, 44, 45];
    const closeScore = kNearestVoidScore(closeCandidate, history, 10);
    const farScore = kNearestVoidScore(farCandidate, history, 10);
    expect(farScore).toBeGreaterThan(closeScore);
  });
});
