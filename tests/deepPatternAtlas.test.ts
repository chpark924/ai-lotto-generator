/**
 * Master Spec §34 Exhaustive/Golden/Property Test 원칙을 data/deep-pattern-atlas.json
 * (scripts/build-deep-pattern-atlas.mjs의 산출물)에 대해 적용한다. 빌드 스크립트를 다시
 * 돌리지 않고도, 커밋된 Atlas 자체가 무결한지 항상 검증할 수 있게 한다.
 */
import atlasData from "../data/deep-pattern-atlas.json";

interface AtlasBasin {
  key: number;
  rowZone: number;
  colZone: number;
  dispZone: number;
  oddZone: number;
  population: number;
  observedCount: number;
  expectedCount: number;
  densityRatio: number | null;
  structuralVoidLevel: "LOW" | "MID" | "HIGH";
  coarseDensityRatio: number | null;
  scalePersistenceLevel: "LOW" | "MID" | "HIGH";
  recentDensityRatio: number | null;
  temporalPersistenceLevel: "LOW" | "MID" | "HIGH";
  noveltyPercentile: number;
  validationPercentile: number;
  midDensityRatio: number | null;
  sampleCombos: number[][];
}

interface Atlas {
  engineVersion: string;
  atlasVersion: string;
  nullModelVersion: string;
  numNullSimulations: number;
  basinSampleSize: number;
  totalCombinations: number;
  totalHistoricalDraws: number;
  historyThroughDrawNumber: number;
  thresholds: { row: number[]; col: number[]; dispersion: number[] };
  basins: AtlasBasin[];
  history: { drawNumber: number; numbers: number[] }[];
}

const atlas = atlasData as unknown as Atlas;

describe("딥 패턴 Atlas — 전수/무결성 검증 (Master Spec §34)", () => {
  it("정확히 8,145,060개 조합 기준으로 빌드되었다", () => {
    expect(atlas.totalCombinations).toBe(8_145_060);
  });

  it("81개(3^4) fine basin을 가진다", () => {
    expect(atlas.basins).toHaveLength(81);
  });

  it("basin population 합계가 전체 조합 수와 정확히 일치한다", () => {
    const sum = atlas.basins.reduce((s, b) => s + b.population, 0);
    expect(sum).toBe(atlas.totalCombinations);
  });

  it("basin key가 rowZone/colZone/dispZone/oddZone 조합과 정확히 대응한다", () => {
    for (const b of atlas.basins) {
      const expectedKey = ((b.rowZone * 3 + b.colZone) * 3 + b.dispZone) * 3 + b.oddZone;
      expect(b.key).toBe(expectedKey);
      expect(b.rowZone).toBeGreaterThanOrEqual(0);
      expect(b.rowZone).toBeLessThanOrEqual(2);
      expect(b.colZone).toBeGreaterThanOrEqual(0);
      expect(b.colZone).toBeLessThanOrEqual(2);
      expect(b.dispZone).toBeGreaterThanOrEqual(0);
      expect(b.dispZone).toBeLessThanOrEqual(2);
      expect(b.oddZone).toBeGreaterThanOrEqual(0);
      expect(b.oddZone).toBeLessThanOrEqual(2);
    }
  });

  it("population > 0인 basin은 densityRatio/expectedCount가 항상 채워져 있다", () => {
    for (const b of atlas.basins) {
      if (b.population > 0) {
        expect(b.expectedCount).toBeGreaterThan(0);
        expect(b.densityRatio).not.toBeNull();
      }
    }
  });

  it("noveltyPercentile은 population 비율과 일치한다", () => {
    for (const b of atlas.basins) {
      const expected = (b.population / atlas.totalCombinations) * 100;
      expect(b.noveltyPercentile).toBeCloseTo(expected, 2);
    }
  });

  it("역사 배열은 totalHistoricalDraws 길이만큼, 회차 오름차순, 번호는 6개 유일값 1~45다", () => {
    expect(atlas.history).toHaveLength(atlas.totalHistoricalDraws);
    for (let i = 1; i < atlas.history.length; i += 1) {
      expect(atlas.history[i].drawNumber).toBeGreaterThan(atlas.history[i - 1].drawNumber);
    }
    for (const entry of atlas.history) {
      expect(entry.numbers).toHaveLength(6);
      expect(new Set(entry.numbers).size).toBe(6);
      entry.numbers.forEach((n) => {
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(45);
      });
    }
    expect(atlas.history[atlas.history.length - 1].drawNumber).toBe(atlas.historyThroughDrawNumber);
  });

  it("엔진/Atlas 버전 문자열이 명세 §33 규칙(엔진=DPE-*, atlas=ATLAS-*)을 따른다", () => {
    expect(atlas.engineVersion).toMatch(/^DPE-/);
    expect(atlas.atlasVersion).toMatch(/^ATLAS-/);
  });

  it("모든 basin이 0~100 범위의 validationPercentile(§14 Null Simulation + 다중검정 보정)을 가진다", () => {
    for (const b of atlas.basins) {
      expect(b.validationPercentile).toBeGreaterThanOrEqual(0);
      expect(b.validationPercentile).toBeLessThanOrEqual(100);
    }
  });

  it("population이 0인(=원천적으로 관측 불가능한) basin은 validationPercentile이 0이다", () => {
    for (const b of atlas.basins) {
      if (b.densityRatio === null) {
        expect(b.validationPercentile).toBe(0);
      }
    }
  });

  it("Null 모델 메타데이터(nullModelVersion/numNullSimulations)가 채워져 있다", () => {
    expect(atlas.nullModelVersion).toMatch(/^NULL-/);
    expect(atlas.numNullSimulations).toBeGreaterThan(0);
  });

  it("scalePersistenceLevel(§7 3단계 Multi-scale)이 fine/mid/coarse 결손 조합과 정확히 일치한다", () => {
    for (const b of atlas.basins) {
      const fineDeficit = b.densityRatio !== null && b.densityRatio < 1.0;
      const midDeficit = b.midDensityRatio !== null && b.midDensityRatio < 1.0;
      const coarseDeficit = b.coarseDensityRatio !== null && b.coarseDensityRatio < 1.0;
      const expected =
        fineDeficit && midDeficit && coarseDeficit ? "HIGH" : fineDeficit && (midDeficit || coarseDeficit) ? "MID" : "LOW";
      expect(b.scalePersistenceLevel).toBe(expected);
    }
  });

  it("basin.sampleCombos(§22 latency 대응 사전 샘플링) — population>0인 basin은 1개 이상, basinSampleSize 이하의 유효한 조합을 가진다", () => {
    for (const b of atlas.basins) {
      if (b.population > 0) {
        expect(b.sampleCombos.length).toBeGreaterThan(0);
        expect(b.sampleCombos.length).toBeLessThanOrEqual(atlas.basinSampleSize);
      } else {
        expect(b.sampleCombos.length).toBe(0);
      }
      for (const combo of b.sampleCombos) {
        expect(combo).toHaveLength(6);
        expect(new Set(combo).size).toBe(6);
        expect(combo).toEqual([...combo].sort((x, y) => x - y));
        combo.forEach((n) => {
          expect(n).toBeGreaterThanOrEqual(1);
          expect(n).toBeLessThanOrEqual(45);
        });
      }
    }
  });

  it("basin.sampleCombos의 각 조합이 실제로 그 basin(rowZone/colZone/dispZone/oddZone)에 속한다", () => {
    // 빌드 스크립트는 avgRow/avgCol/dispersion을 Float32Array에 저장해 zone 판정을 한다
    // (scripts/build-deep-pattern-atlas.mjs [1/5]~[3/5]) — 여기서도 Math.fround로 동일한
    // float32 정밀도를 재현해야 경계값 근처에서 오탐(false mismatch)이 나지 않는다.
    const PAPER_COLUMNS = 7;
    const paperRow = (n: number) => Math.floor((n - 1) / PAPER_COLUMNS) + 1;
    const paperCol = (n: number) => ((n - 1) % PAPER_COLUMNS) + 1;
    const zone3 = (v: number, q1: number, q2: number) => (v <= q1 ? 0 : v <= q2 ? 1 : 2);
    const oddZoneOf = (c: number) => (c <= 2 ? 0 : c === 3 ? 1 : 2);
    const fineBasinKey = (r: number, c: number, d: number, o: number) => ((r * 3 + c) * 3 + d) * 3 + o;
    const { row, col, dispersion } = atlas.thresholds;

    // 81개 basin × 최대 150개 = 최대 12,150개 조합을 전부 검증하면 이 테스트만 느려지므로,
    // basin마다 대표로 몇 개씩만 뽑아 확인한다(그래도 basin 전체를 커버하므로 회귀 탐지에는 충분).
    const SAMPLE_CHECK_PER_BASIN = 10;
    for (const b of atlas.basins) {
      const toCheck = b.sampleCombos.slice(0, SAMPLE_CHECK_PER_BASIN);
      for (const combo of toCheck) {
        let sumRow = 0;
        let sumCol = 0;
        let oddCount = 0;
        const rows: number[] = [];
        const cols: number[] = [];
        for (const n of combo) {
          const r = paperRow(n);
          const c = paperCol(n);
          rows.push(r);
          cols.push(c);
          sumRow += r;
          sumCol += c;
          if (n % 2 === 1) oddCount += 1;
        }
        const avgRow = Math.fround(sumRow / 6);
        const avgCol = Math.fround(sumCol / 6);
        let disp = 0;
        for (let i = 0; i < 6; i += 1) {
          const dr = rows[i] - avgRow;
          const dc = cols[i] - avgCol;
          disp += dr * dr + dc * dc;
        }
        disp = Math.fround(disp / 6);
        const rowZone = zone3(avgRow, row[0], row[1]);
        const colZone = zone3(avgCol, col[0], col[1]);
        const dispZone = zone3(disp, dispersion[0], dispersion[1]);
        const oddZone = oddZoneOf(oddCount);
        expect(fineBasinKey(rowZone, colZone, dispZone, oddZone)).toBe(b.key);
      }
    }
  });
});
