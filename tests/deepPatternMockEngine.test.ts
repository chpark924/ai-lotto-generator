import { recommendDeepPatterns, deepPatternEngineStatus } from "../src/lib/deepPattern/mockEngine";
import { combinationKey } from "../src/lib/lottery/similarity";

describe("딥 패턴 — mock 엔진 (Phase 2 Research/Atlas 이전 자리표시자)", () => {
  it("status()는 항상 MOCK을 반환한다", () => {
    expect(deepPatternEngineStatus()).toBe("MOCK");
  });

  it("요청한 개수만큼, 서로 다른 유효한 조합을 반환한다", async () => {
    const batch = await recommendDeepPatterns(5);
    expect(batch.recommendations).toHaveLength(5);

    const keys = new Set<string>();
    batch.recommendations.forEach((rec, index) => {
      expect(rec.numbers).toHaveLength(6);
      expect(new Set(rec.numbers).size).toBe(6); // 중복 없음
      rec.numbers.forEach((n) => {
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(45);
      });
      expect(rec.numbers).toEqual([...rec.numbers].sort((a, b) => a - b)); // 오름차순 정렬

      expect(rec.patternIndex).toBe(index + 1); // 1번 패턴 ~ 5번 패턴 순번
      expect(rec.noveltyPercentile).toBeGreaterThan(0);
      expect(["LOW", "MID", "HIGH"]).toContain(rec.structuralVoidLevel);
      expect(["LOW", "MID", "HIGH"]).toContain(rec.scalePersistenceLevel);
      expect(["LOW", "MID", "HIGH"]).toContain(rec.temporalPersistenceLevel);
      expect(rec.validationPercentile).toBeGreaterThanOrEqual(0);
      expect(rec.validationPercentile).toBeLessThanOrEqual(100);
      expect(rec.engineVersion).toMatch(/^DPE-/);
      expect(rec.atlasVersion).toMatch(/^ATLAS-/);
      expect(rec.historyThroughDrawNumber).toBeGreaterThan(0);

      // nearestHistoricalDrawNumber와 similarityPercent는 항상 함께 있거나 함께 null이어야 한다.
      if (rec.nearestHistoricalDrawNumber === null) {
        expect(rec.nearestHistoricalSimilarityPercent).toBeNull();
      } else {
        expect(rec.nearestHistoricalSimilarityPercent).not.toBeNull();
      }

      keys.add(combinationKey(rec.numbers));
    });

    expect(keys.size).toBe(5); // 배치 내 5게임은 서로 다른 조합이어야 한다
  });

  it("count 파라미터를 존중한다", async () => {
    const batch = await recommendDeepPatterns(3);
    expect(batch.recommendations).toHaveLength(3);
  });

  it("requestId/generatedAt이 배치마다 채워진다", async () => {
    const batch = await recommendDeepPatterns(1);
    expect(batch.requestId).toContain("deep_pattern_");
    expect(() => new Date(batch.generatedAt).toISOString()).not.toThrow();
  });
});
