/**
 * 2026-11-15 — 한국 데이터로 추정한 번호별 인기도(popularityModel.ts) 기본 검증.
 * 값 자체는 scripts/fit-popularity-model.mjs가 data/lotto-draws.json에서 다시 만든다.
 */
import { buildPopularityHeuristic } from "../src/lib/draws/drawStats";
import { KOREAN_NUMBER_POPULARITY, KOREAN_POPULARITY_MODEL_INFO } from "../src/lib/draws/popularityModel";

describe("KOREAN_NUMBER_POPULARITY", () => {
  it("1~45번 45개 값이 모두 0.2~0.8 범위", () => {
    expect(KOREAN_NUMBER_POPULARITY).toHaveLength(45);
    for (const v of KOREAN_NUMBER_POPULARITY) {
      expect(v).toBeGreaterThanOrEqual(0.2);
      expect(v).toBeLessThanOrEqual(0.8);
    }
  });

  it("연구와 같은 방향: 7은 가장 많이 고르는 쪽, 41~45 평균은 1~31 평균보다 낮다", () => {
    const p = KOREAN_NUMBER_POPULARITY;
    expect(p[6]).toBe(Math.max(...p));
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    expect(avg(p.slice(40, 45))).toBeLessThan(avg(p.slice(0, 31)));
  });

  it("88회 이후 충분한 회차로 적합됐다", () => {
    expect(KOREAN_POPULARITY_MODEL_INFO.firstDraw).toBe(88);
    expect(KOREAN_POPULARITY_MODEL_INFO.drawCount).toBeGreaterThan(1000);
  });

  it("buildPopularityHeuristic은 이 값의 복사본을 돌려준다(호출부가 바꿔도 원본 불변)", () => {
    const a = buildPopularityHeuristic();
    a[0] = 999;
    expect(buildPopularityHeuristic()[0]).toBe(KOREAN_NUMBER_POPULARITY[0]);
  });
});
