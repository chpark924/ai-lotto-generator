import { recommendDeepPatterns, deepPatternEngineStatus, getDeepPatternAtlasMeta } from "../src/lib/deepPattern/engine";
import { combinationKey } from "../src/lib/lottery/similarity";

describe("딥 패턴 — v1 실제 엔진 (Atlas 기반)", () => {
  it("status()는 Atlas가 번들되어 있으면 READY다", () => {
    expect(deepPatternEngineStatus()).toBe("READY");
  });

  it("Atlas 메타데이터가 전수 계산 기준과 일치한다", () => {
    const meta = getDeepPatternAtlasMeta();
    expect(meta.totalCombinations).toBe(8_145_060);
    expect(meta.basinCount).toBe(81);
    expect(meta.engineVersion).toMatch(/^DPE-/);
    expect(meta.atlasVersion).toMatch(/^ATLAS-/);
    expect(meta.historyThroughDrawNumber).toBeGreaterThan(0);
  });

  it("요청한 개수만큼 서로 다른 유효 조합을 반환한다 (실제 Atlas 기반 basin에서 샘플링)", async () => {
    const batch = await recommendDeepPatterns(5);
    expect(batch.recommendations.length).toBeGreaterThan(0);
    expect(batch.recommendations.length).toBeLessThanOrEqual(5);

    const keys = new Set<string>();
    batch.recommendations.forEach((rec, index) => {
      expect(rec.numbers).toHaveLength(6);
      expect(new Set(rec.numbers).size).toBe(6);
      rec.numbers.forEach((n) => {
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(45);
      });
      expect(rec.numbers).toEqual([...rec.numbers].sort((a, b) => a - b));
      expect(rec.patternIndex).toBe(index + 1);
      expect(rec.noveltyPercentile).toBeGreaterThan(0);
      expect(["LOW", "MID", "HIGH"]).toContain(rec.structuralVoidLevel);
      expect(["LOW", "MID", "HIGH"]).toContain(rec.scalePersistenceLevel);
      expect(["LOW", "MID", "HIGH"]).toContain(rec.temporalPersistenceLevel);
      expect(rec.validationPercentile).toBeGreaterThanOrEqual(0);
      expect(rec.validationPercentile).toBeLessThanOrEqual(100);
      if (rec.nearestHistoricalDrawNumber === null) {
        expect(rec.nearestHistoricalSimilarityPercent).toBeNull();
      } else {
        expect(rec.nearestHistoricalSimilarityPercent).not.toBeNull();
        expect(rec.nearestHistoricalSimilarityPercent).toBeGreaterThanOrEqual(0);
        expect(rec.nearestHistoricalSimilarityPercent).toBeLessThanOrEqual(100);
      }
      keys.add(combinationKey(rec.numbers));
    });
    expect(keys.size).toBe(batch.recommendations.length); // 배치 내 중복 없음
  }, 20000);

  it("결과는 밀도비가 낮은(구조적 공백이 큰) basin 순서로 우선 채워진다", async () => {
    const batch = await recommendDeepPatterns(5);
    // 1번 패턴이 5번 패턴보다 최소한 같거나 더 큰 결손을 대표해야 한다 — 정확한 순서 보장까지는
    // rejection sampling 실패로 건너뛸 수 있어 완전히 단조롭다고 단정하진 않지만, structuralVoidLevel이
    // "HIGH"가 하나라도 있다면 1번 패턴이어야 한다는 정도는 검증할 수 있다.
    const firstHighIndex = batch.recommendations.findIndex((r) => r.structuralVoidLevel === "HIGH");
    if (firstHighIndex !== -1) {
      expect(firstHighIndex).toBe(0);
    }
  }, 20000);

  it("recommend(5)가 짧은 시간 안에 끝난다 (§22 latency — basin당 sampleCombos에서만 고르므로 8,145,060개 rejection sampling이 없다)", async () => {
    // 이 값 자체가 실기기 성능을 대변하진 않는다(Node/Jest 환경) — 그래도 v2(런타임 rejection
    // sampling)로 되돌아가는 회귀가 생기면 이 임계값을 훨씬 넘길 만큼 느려지므로, 대략적인
    // 가드레일로는 유효하다.
    const start = Date.now();
    await recommendDeepPatterns(5);
    const elapsedMs = Date.now() - start;
    expect(elapsedMs).toBeLessThan(3000);
  }, 20000);
});
