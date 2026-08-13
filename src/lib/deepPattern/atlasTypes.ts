/**
 * scripts/build-deep-pattern-atlas.mjs가 만드는 data/deep-pattern-atlas.json의 타입.
 *
 * engine.ts(앱에 번들된 기본 atlas를 읽는 쪽)와 atlasGithubSource.ts/atlasCache.ts(GitHub에
 * 커밋된 최신 atlas를 런타임에 받아와 검증하는 쪽) 둘 다 이 타입을 공유해야 해서 별도
 * 파일로 뺐다 — engine.ts 안에서만 쓰던 걸 atlasGithubSource.ts가 import하면 순환 참조가
 * 생기기 쉬워서, 타입만 있는 이 파일을 공통 기반으로 둔다.
 */
import type { DeepPatternLevel } from "./types";

export interface AtlasBasin {
  key: number;
  rowZone: number;
  colZone: number;
  dispZone: number;
  oddZone: number;
  population: number;
  observedCount: number;
  expectedCount: number;
  densityRatio: number | null;
  structuralVoidLevel: DeepPatternLevel;
  /** mid(27개, 행×열×산포도) 해상도에서의 밀도비 — §7 Multi-scale 세분화. */
  midDensityRatio: number | null;
  coarseDensityRatio: number | null;
  scalePersistenceLevel: DeepPatternLevel;
  recentDensityRatio: number | null;
  temporalPersistenceLevel: DeepPatternLevel;
  noveltyPercentile: number;
  /** Null 시뮬레이션(§14) + 다중검정 보정(family-wise, 81개 basin 중 best 대비) 결과. 0~100. */
  validationPercentile: number;
  /**
   * 빌드타임에 reservoir sampling으로 미리 뽑아둔, 실제로 이 basin에 속하는 대표 조합
   * 목록(최대 150개, basin.population이 이보다 작으면 그만큼만). 런타임은 이 목록에서만
   * 고른다 — 8,145,060개 전체 공간에서 다시 rejection sampling하지 않는다.
   */
  sampleCombos: number[][];
}

export interface AtlasHistoryEntry {
  drawNumber: number;
  numbers: number[];
}

export interface Atlas {
  engineVersion: string;
  atlasVersion: string;
  methodology: string;
  historyThroughDrawNumber: number;
  totalCombinations: number;
  thresholds: { row: number[]; col: number[]; dispersion: number[] };
  basins: AtlasBasin[];
  history: AtlasHistoryEntry[];
}

/**
 * GitHub에서 받아온(또는 로컬 캐시에서 읽은) 데이터가 정말 Atlas 형태인지 구조적으로만
 * 검증한다 — drawApi.ts의 isPlausibleWinningDraw와 같은 원칙: 응답이 왔다고 그대로 믿지
 * 않는다. "더 최신인지"(historyThroughDrawNumber 비교)는 이 함수의 책임이 아니다 —
 * atlasCache.ts가 별도로 판단한다.
 */
export function isPlausibleAtlas(data: unknown): data is Atlas {
  if (!data || typeof data !== "object") return false;
  const a = data as Record<string, unknown>;
  if (a.totalCombinations !== 8_145_060) return false;
  if (!Array.isArray(a.basins) || a.basins.length !== 81) return false;
  if (!Array.isArray(a.history)) return false;
  if (!Number.isInteger(a.historyThroughDrawNumber) || (a.historyThroughDrawNumber as number) <= 0) return false;
  if (typeof a.engineVersion !== "string" || typeof a.atlasVersion !== "string") return false;
  return true;
}
