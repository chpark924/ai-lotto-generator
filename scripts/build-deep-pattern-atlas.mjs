#!/usr/bin/env node
/**
 * 딥 패턴 탐색 Atlas Builder (v3 근사치).
 *
 * Deep Pattern Engine Master Spec §2/§6/§7/§9/§13/§14/§18/§22를 참고해 로또 6/45 전체
 * 8,145,060개 조합을 전수 순회하며 Geometry 기반 Feature를 계산하고, 이를 거친 Basin
 * (3×3×3×3=81개: 중심행/중심열/산포도/홀짝 각 3단계)으로 묶어 실제 당첨 이력
 * (data/lotto-draws.json) 대비 밀도비(구조적 공백)를 계산한다. 런타임(src/lib/deepPattern/
 * engine.ts)은 이 스크립트가 미리 계산한 결과만 읽는다 — "Precompute globally, evaluate
 * locally"(§18)를 그대로 따른다.
 *
 * v3에서 실제로 계산하는 것:
 *   1) Multi-scale(§11, §7 해상도 세분화): 이제 3단계 해상도를 본다 — fine 81개(행×열×산포도
 *      ×홀짝), mid 27개(행×열×산포도, §7의 "Mid" 계층), coarse 9개(행×열만, §7의 "Macro"
 *      계층). 세 해상도 모두에서 결손이 유지될 때만 scalePersistenceLevel을 HIGH로 매긴다
 *      (이전엔 fine/coarse 2단계뿐이라 "우연히 fine 한 곳만 결손"인 경우와 구분이 약했다).
 *   2) Temporal(§13): 전체 역사 vs 최근 300회 두 window에서 밀도비를 각각 계산한다.
 *   3) Null Simulation + 다중검정 보정(§14 Skeptic Engine): 실제 역사와 같은 길이(1235회)의
 *      "공정한 가짜 역사" 500개를 결정론적 PRNG로 생성해 같은 분석을 반복하고, 81개 basin을
 *      동시에 살펴본 것까지 반영한 family-wise 유의성(validationPercentile)을 계산한다.
 *   4) **basin별 대표 후보 사전 샘플링(신규, §22 latency 대응)**: fine basin마다 결정론적
 *      reservoir sampling(Algorithm R, §33 재현성 유지)으로 그 basin에 실제로 속하는 조합
 *      최대 150개를 미리 뽑아 `sampleCombos`로 저장해둔다. 기존엔 런타임(engine.ts)이 "무작위
 *      조합을 뽑고 → basin이 맞는지 확인 → 아니면 버림"을 반복하는 rejection sampling
 *      방식이었는데, basin 1개당 적중 확률이 약 1/81이라 pool 20개를 채우려면 평균 수백~수천
 *      번의 CSPRNG 호출이 필요했다(추천 5개면 실기기에서 체감될 만큼 느려짐). 이제는 그 무거운
 *      탐색을 빌드타임에 한 번만 하고, 런타임은 이미 검증된 150개 중에서 가볍게 부분셔플만
 *      하면 된다 — 결과 분포(basin 내부 uniform sampling이라는 성질)는 그대로 유지하면서
 *      런타임 CSPRNG 호출 횟수를 basin당 수백~수천 회에서 20회 안팎으로 줄인다.
 *
 * 아직 없는 것: kNN 기반 Geometric Void는 basin *내부*에서 대표 후보를 고를 때만 런타임
 * (engine.ts)에서 쓰고, 이 Atlas 자체에는 반영돼 있지 않다. §7의 "Exact"(개별 조합 단위)
 * 해상도는 이 kNN 보정이 근사적으로 대신하고 있어 별도 basin 계층으로는 만들지 않았다.
 *
 * 출력: data/deep-pattern-atlas.json — basin 통계 + basin별 대표 후보 샘플 + 전체 당첨 이력
 * 번호까지 포함한 self-contained 아티팩트다(§30 "오프라인에서도 핵심 추천은 계속 동작"). 앱은
 * 이 파일을 정적 import로 번들하고, 런타임에 네트워크나 data/lotto-draws.json에 다시 접근하지
 * 않는다.
 *
 * 실행: node scripts/build-deep-pattern-atlas.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const TOTAL_COMBINATIONS = 8_145_060;
// src/lib/deepPattern/coordinates.ts의 PAPER_COLUMNS/getPaperPosition과 동기화 유지 —
// 이 스크립트는 순수 Node(.mjs)라 TS 모듈을 직접 import하지 않고 동일한 공식을 그대로 둔다.
const PAPER_COLUMNS = 7;
const RECENT_WINDOW_SIZE = 300;
const FINE_BASIN_COUNT = 81; // 3(row) × 3(col) × 3(dispersion) × 3(odd) — §7의 "Fine"
const MID_BASIN_COUNT = 27; // 3(row) × 3(col) × 3(dispersion), 홀짝 제외 — §7의 "Mid"
const COARSE_BASIN_COUNT = 9; // 3(row) × 3(col) — §7의 "Macro"
// fine basin마다 미리 뽑아두는 대표 후보(실제로 그 basin에 속하는 조합) 개수. 런타임
// 후보 풀(CANDIDATE_POOL_SIZE=20, engine.ts)보다 넉넉히 커야 매번 부분셔플했을 때 어느 정도
// 다양성이 나온다 — 너무 크면 Atlas 파일 크기만 커지고 체감 다양성은 크게 안 늘어난다.
const RESERVOIR_SIZE = 150;

function paperRow(n) {
  return Math.floor((n - 1) / PAPER_COLUMNS) + 1;
}
function paperCol(n) {
  return ((n - 1) % PAPER_COLUMNS) + 1;
}

function zone3(value, q1, q2) {
  if (value <= q1) return 0;
  if (value <= q2) return 1;
  return 2;
}

function oddZoneOf(oddCount) {
  if (oddCount <= 2) return 0;
  if (oddCount === 3) return 1;
  return 2;
}

function fineBasinKey(rowZone, colZone, dispZone, oddZone) {
  return ((rowZone * 3 + colZone) * 3 + dispZone) * 3 + oddZone;
}
function midBasinKey(rowZone, colZone, dispZone) {
  return (rowZone * 3 + colZone) * 3 + dispZone;
}
function coarseBasinKey(rowZone, colZone) {
  return rowZone * 3 + colZone;
}

// 결정론적 PRNG(mulberry32) — 명세 §33 "동일 input+동일 version 조합의 분석 결과는
// deterministic해야 한다"를 만족하려고 Math.random() 대신 고정 seed를 쓴다. reservoir
// sampling과 Null 시뮬레이션 두 곳에서 쓰는데, 서로 다른 seed로 독립된 스트림을 만든다
// (하나가 다른 하나의 결과에 영향을 주지 않도록). 둘 다 통계적 검증/사전 샘플링용이라
// CSPRNG(expo-crypto)가 필요 없다 — random.ts의 보안 난수와는 목적이 다르다.
function mulberry32(seed) {
  let state = seed | 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const RESERVOIR_SEED = 20260809; // NULL_SIM_SEED(20260808)와 다른 값 — 독립 스트림 유지.

/** 6개 번호(순서 무관)의 원시 Feature(중심 행/열, 산포도, 홀수 개수)를 계산한다. */
function computeRawFeatures(numbers) {
  let sumRow = 0;
  let sumCol = 0;
  let oddCount = 0;
  const rows = new Array(6);
  const cols = new Array(6);
  for (let i = 0; i < 6; i += 1) {
    const n = numbers[i];
    const r = paperRow(n);
    const c = paperCol(n);
    rows[i] = r;
    cols[i] = c;
    sumRow += r;
    sumCol += c;
    if (n % 2 === 1) oddCount += 1;
  }
  const avgRow = sumRow / 6;
  const avgCol = sumCol / 6;
  let dispersion = 0;
  for (let i = 0; i < 6; i += 1) {
    const dr = rows[i] - avgRow;
    const dc = cols[i] - avgCol;
    dispersion += dr * dr + dc * dc;
  }
  dispersion /= 6;
  return { avgRow, avgCol, dispersion, oddCount };
}

console.log("[1/5] 8,145,060개 조합 전수 순회 (Feature 계산)...");
const t0 = Date.now();

const avgRowArr = new Float32Array(TOTAL_COMBINATIONS);
const avgColArr = new Float32Array(TOTAL_COMBINATIONS);
const dispersionArr = new Float32Array(TOTAL_COMBINATIONS);
const oddZoneArr = new Uint8Array(TOTAL_COMBINATIONS);
// 조합 6개 번호 자체(1~45, Uint8Array로 충분)도 함께 저장해둔다 — 3단계에서 basin별
// reservoir sampling(대표 후보 뽑기)을 할 때 조합 값이 그대로 필요하기 때문이다. 8,145,060 ×
// 6바이트 ≈ 47MB로, 이미 할당하는 Float32Array 3개(각 ~31MB)에 비해 크지 않다.
const numbersArr = new Uint8Array(TOTAL_COMBINATIONS * 6);

let idx = 0;
const tmp = [0, 0, 0, 0, 0, 0];
for (let a = 1; a <= 40; a += 1) {
  for (let b = a + 1; b <= 41; b += 1) {
    for (let c = b + 1; c <= 42; c += 1) {
      for (let d = c + 1; d <= 43; d += 1) {
        for (let e = d + 1; e <= 44; e += 1) {
          for (let f = e + 1; f <= 45; f += 1) {
            tmp[0] = a;
            tmp[1] = b;
            tmp[2] = c;
            tmp[3] = d;
            tmp[4] = e;
            tmp[5] = f;
            const feat = computeRawFeatures(tmp);
            avgRowArr[idx] = feat.avgRow;
            avgColArr[idx] = feat.avgCol;
            dispersionArr[idx] = feat.dispersion;
            oddZoneArr[idx] = oddZoneOf(feat.oddCount);
            const base = idx * 6;
            numbersArr[base] = a;
            numbersArr[base + 1] = b;
            numbersArr[base + 2] = c;
            numbersArr[base + 3] = d;
            numbersArr[base + 4] = e;
            numbersArr[base + 5] = f;
            idx += 1;
          }
        }
      }
    }
  }
}

if (idx !== TOTAL_COMBINATIONS) {
  throw new Error(`전수 검증 실패: ${idx}개 처리됨 (기대값 ${TOTAL_COMBINATIONS}) — Master Spec §34 exhaustive test 위반`);
}
console.log(`  완료: ${idx.toLocaleString()}개, ${((Date.now() - t0) / 1000).toFixed(1)}s`);

console.log("[2/5] 경험적 분포 기준 tercile 임계값 계산 중 (§6)...");
const t1 = Date.now();
const q1i = Math.floor(TOTAL_COMBINATIONS * (1 / 3));
const q2i = Math.floor(TOTAL_COMBINATIONS * (2 / 3));

// TypedArray.prototype.sort()는 (일반 Array와 달리) 기본이 숫자 오름차순 정렬이다.
const sortedRow = Float32Array.from(avgRowArr).sort();
const sortedCol = Float32Array.from(avgColArr).sort();
const sortedDisp = Float32Array.from(dispersionArr).sort();
const rowThresholds = [sortedRow[q1i], sortedRow[q2i]];
const colThresholds = [sortedCol[q1i], sortedCol[q2i]];
const dispThresholds = [sortedDisp[q1i], sortedDisp[q2i]];
console.log(`  row=[${rowThresholds}] col=[${colThresholds}] dispersion=[${dispThresholds.map((v) => v.toFixed(3))}]`);
console.log(`  완료: ${((Date.now() - t1) / 1000).toFixed(1)}s`);

console.log("[3/5] Basin population 집계 + basin별 대표 후보 reservoir sampling 중...");
const finePopulation = new Float64Array(FINE_BASIN_COUNT);
const midPopulation = new Float64Array(MID_BASIN_COUNT);
const coarsePopulation = new Float64Array(COARSE_BASIN_COUNT);

// fine basin마다 최대 RESERVOIR_SIZE개의 대표 후보를 Algorithm R(reservoir sampling)로 뽑는다.
// 81개 basin 각각을 독립된 스트림으로 보고, 그 basin에 속하는 조합을 만날 때마다 다음 규칙을
// 적용한다: 아직 자리가 남아 있으면 그냥 채우고, 자리가 다 찼으면 "지금까지 이 basin에서 본
// 개수"를 상한으로 하는 균등 난수로 기존 슬롯 하나를 교체할지 결정한다. 이 과정을 표준대로
// 따르면 최종 결과는 그 basin에 속한 전체 조합(수만~수십만 개) 중에서의 균등 무작위 표본이
// 된다 — 기존 런타임 rejection sampling과 통계적으로 같은 성질을 유지하면서 계산을 빌드타임
// 한 번으로 옮긴 것이다.
const reservoirSeenCount = new Uint32Array(FINE_BASIN_COUNT);
const reservoirNumbers = new Uint8Array(FINE_BASIN_COUNT * RESERVOIR_SIZE * 6);
const reservoirRng = mulberry32(RESERVOIR_SEED);

for (let i = 0; i < TOTAL_COMBINATIONS; i += 1) {
  const rowZone = zone3(avgRowArr[i], rowThresholds[0], rowThresholds[1]);
  const colZone = zone3(avgColArr[i], colThresholds[0], colThresholds[1]);
  const dispZone = zone3(dispersionArr[i], dispThresholds[0], dispThresholds[1]);
  const oddZone = oddZoneArr[i];
  const fineKey = fineBasinKey(rowZone, colZone, dispZone, oddZone);
  finePopulation[fineKey] += 1;
  midPopulation[midBasinKey(rowZone, colZone, dispZone)] += 1;
  coarsePopulation[coarseBasinKey(rowZone, colZone)] += 1;

  const seenInBasin = reservoirSeenCount[fineKey];
  let targetSlot = -1;
  if (seenInBasin < RESERVOIR_SIZE) {
    targetSlot = seenInBasin;
  } else {
    const j = Math.floor(reservoirRng() * (seenInBasin + 1));
    if (j < RESERVOIR_SIZE) targetSlot = j;
  }
  if (targetSlot !== -1) {
    const srcBase = i * 6;
    const dstBase = (fineKey * RESERVOIR_SIZE + targetSlot) * 6;
    reservoirNumbers[dstBase] = numbersArr[srcBase];
    reservoirNumbers[dstBase + 1] = numbersArr[srcBase + 1];
    reservoirNumbers[dstBase + 2] = numbersArr[srcBase + 2];
    reservoirNumbers[dstBase + 3] = numbersArr[srcBase + 3];
    reservoirNumbers[dstBase + 4] = numbersArr[srcBase + 4];
    reservoirNumbers[dstBase + 5] = numbersArr[srcBase + 5];
  }
  reservoirSeenCount[fineKey] += 1;
}

function getReservoirSample(fineKey) {
  const count = Math.min(reservoirSeenCount[fineKey], RESERVOIR_SIZE);
  const combos = [];
  for (let s = 0; s < count; s += 1) {
    const base = (fineKey * RESERVOIR_SIZE + s) * 6;
    combos.push(
      [
        reservoirNumbers[base],
        reservoirNumbers[base + 1],
        reservoirNumbers[base + 2],
        reservoirNumbers[base + 3],
        reservoirNumbers[base + 4],
        reservoirNumbers[base + 5],
      ].sort((x, y) => x - y)
    );
  }
  return combos;
}

const populationSum = finePopulation.reduce((s, v) => s + v, 0);
if (populationSum !== TOTAL_COMBINATIONS) {
  throw new Error(`Basin population 합계 불일치: ${populationSum} (기대값 ${TOTAL_COMBINATIONS}) — Master Spec §34 위반`);
}
console.log(`  81개 fine basin population 합계 검증 통과 (${populationSum.toLocaleString()})`);
const reservoirSampleTotal = Array.from({ length: FINE_BASIN_COUNT }, (_, k) =>
  Math.min(reservoirSeenCount[k], RESERVOIR_SIZE)
).reduce((s, v) => s + v, 0);
console.log(`  basin별 대표 후보 reservoir sampling 완료 (총 ${reservoirSampleTotal.toLocaleString()}개, basin당 최대 ${RESERVOIR_SIZE}개)`);

console.log("[4/5] 실제 당첨 이력(data/lotto-draws.json) 대비 밀도비 계산 중...");
const rawDraws = JSON.parse(readFileSync(join(ROOT, "data/lotto-draws.json"), "utf-8"));
const draws = [...rawDraws].sort((x, y) => x.drawNumber - y.drawNumber);
const recentDraws = draws.slice(-RECENT_WINDOW_SIZE);

function basinKeysFor(numbers) {
  const feat = computeRawFeatures(numbers);
  const rowZone = zone3(feat.avgRow, rowThresholds[0], rowThresholds[1]);
  const colZone = zone3(feat.avgCol, colThresholds[0], colThresholds[1]);
  const dispZone = zone3(feat.dispersion, dispThresholds[0], dispThresholds[1]);
  const oddZone = oddZoneOf(feat.oddCount);
  return {
    fine: fineBasinKey(rowZone, colZone, dispZone, oddZone),
    mid: midBasinKey(rowZone, colZone, dispZone),
    coarse: coarseBasinKey(rowZone, colZone),
  };
}

const fineObservedFull = new Float64Array(FINE_BASIN_COUNT);
const midObservedFull = new Float64Array(MID_BASIN_COUNT);
const coarseObservedFull = new Float64Array(COARSE_BASIN_COUNT);
const fineObservedRecent = new Float64Array(FINE_BASIN_COUNT);

for (const draw of draws) {
  const { fine, mid, coarse } = basinKeysFor(draw.numbers);
  fineObservedFull[fine] += 1;
  midObservedFull[mid] += 1;
  coarseObservedFull[coarse] += 1;
}
for (const draw of recentDraws) {
  const { fine } = basinKeysFor(draw.numbers);
  fineObservedRecent[fine] += 1;
}

const totalHistoricalDraws = draws.length;
const recentCount = recentDraws.length;

console.log("[5/5] Null Simulation + 다중검정 보정 계산 중 (§14 Skeptic Engine)...");
const t2 = Date.now();

// mulberry32는 파일 상단(reservoir sampling에서도 재사용)에 이미 정의돼 있다.
const NULL_SIM_SEED = 20260808; // 이 스크립트를 처음 작성한 날짜 — 고정값이면 무엇이든 상관없다.
const NUM_NULL_SIMULATIONS = 500;
const rng = mulberry32(NULL_SIM_SEED);

const basePool = Array.from({ length: 45 }, (_, i) => i + 1);
function randomComboViaRng() {
  const pool = basePool.slice();
  for (let i = 0; i < 6; i += 1) {
    const j = i + Math.floor(rng() * (45 - i));
    const tmpVal = pool[i];
    pool[i] = pool[j];
    pool[j] = tmpVal;
  }
  return pool.slice(0, 6);
}

// 실제 history와 같은 방식으로 기대값을 계산해두고, Null 시뮬레이션에서도 그대로 재사용한다.
const expectedFullByKey = new Float64Array(FINE_BASIN_COUNT);
for (let key = 0; key < FINE_BASIN_COUNT; key += 1) {
  expectedFullByKey[key] = (finePopulation[key] / TOTAL_COMBINATIONS) * totalHistoricalDraws;
}

// basin별 null 분포(500개씩)와, "81개 basin 중 그 시뮬레이션에서 가장 낮았던 밀도비"의 분포
// (다중검정 보정용 family-wise null)를 함께 쌓는다.
const nullRatiosByBasin = Array.from({ length: FINE_BASIN_COUNT }, () => new Float64Array(NUM_NULL_SIMULATIONS));
const nullBestRatioPerSim = new Float64Array(NUM_NULL_SIMULATIONS);

const simObserved = new Float64Array(FINE_BASIN_COUNT);
for (let sim = 0; sim < NUM_NULL_SIMULATIONS; sim += 1) {
  simObserved.fill(0);
  for (let draw = 0; draw < totalHistoricalDraws; draw += 1) {
    const numbers = randomComboViaRng();
    const { fine } = basinKeysFor(numbers);
    simObserved[fine] += 1;
  }
  let bestRatioThisSim = Infinity;
  for (let key = 0; key < FINE_BASIN_COUNT; key += 1) {
    if (finePopulation[key] === 0) continue;
    const ratio = simObserved[key] / expectedFullByKey[key];
    nullRatiosByBasin[key][sim] = ratio;
    if (ratio < bestRatioThisSim) bestRatioThisSim = ratio;
  }
  nullBestRatioPerSim[sim] = bestRatioThisSim;
}

/**
 * family-wise(다중검정 보정) p-value: 순수 무작위 역사 500개 각각에서 "81개 basin 중
 * 가장 결손이 컸던 basin의 밀도비"를 모아두고, 그중 실제 관측 밀도비만큼(또는 더) 극단적인
 * 것이 몇 번 나왔는지를 비율로 낸다. "81개나 동시에 봤으니 우연히 하나쯤 극단적으로 보일 수
 * 있다"는 문제(§14 multiple-testing)를 이렇게 직접 시뮬레이션으로 보정한다 — Bonferroni처럼
 * 독립성을 가정하지 않고, 실제 basin 간 상관관계까지 반영된 값이라 더 정확하다.
 */
function familyWiseValidationPercentile(realRatio) {
  if (realRatio === null) return 0;
  let countAtLeastAsExtreme = 0;
  for (let sim = 0; sim < NUM_NULL_SIMULATIONS; sim += 1) {
    if (nullBestRatioPerSim[sim] <= realRatio) countAtLeastAsExtreme += 1;
  }
  const pValue = countAtLeastAsExtreme / NUM_NULL_SIMULATIONS;
  return Math.round((1 - pValue) * 100);
}

console.log(`  ${NUM_NULL_SIMULATIONS}회 시뮬레이션 완료, ${((Date.now() - t2) / 1000).toFixed(1)}s`);

function densityLevel(ratio) {
  if (ratio === null) return "LOW";
  if (ratio < 0.6) return "HIGH";
  if (ratio < 1.0) return "MID";
  return "LOW";
}

const basins = [];
for (let key = 0; key < FINE_BASIN_COUNT; key += 1) {
  const oddZone = key % 3;
  const dispZone = Math.floor(key / 3) % 3;
  const colZone = Math.floor(key / 9) % 3;
  const rowZone = Math.floor(key / 27) % 3;
  const coarseKey = coarseBasinKey(rowZone, colZone);

  const population = finePopulation[key];
  const observedFull = fineObservedFull[key];
  const expectedFull = (population / TOTAL_COMBINATIONS) * totalHistoricalDraws;
  const densityRatioFull = expectedFull > 0 ? observedFull / expectedFull : null;

  const observedRecent = fineObservedRecent[key];
  const expectedRecent = (population / TOTAL_COMBINATIONS) * recentCount;
  const densityRatioRecent = expectedRecent > 0 ? observedRecent / expectedRecent : null;

  const coarsePopulationVal = coarsePopulation[coarseKey];
  const coarseObservedVal = coarseObservedFull[coarseKey];
  const coarseExpectedVal = (coarsePopulationVal / TOTAL_COMBINATIONS) * totalHistoricalDraws;
  const coarseDensityRatio = coarseExpectedVal > 0 ? coarseObservedVal / coarseExpectedVal : null;

  const midKeyVal = midBasinKey(rowZone, colZone, dispZone);
  const midPopulationVal = midPopulation[midKeyVal];
  const midObservedVal = midObservedFull[midKeyVal];
  const midExpectedVal = (midPopulationVal / TOTAL_COMBINATIONS) * totalHistoricalDraws;
  const midDensityRatio = midExpectedVal > 0 ? midObservedVal / midExpectedVal : null;

  const structuralVoidLevel = densityLevel(densityRatioFull);
  const fineDeficit = densityRatioFull !== null && densityRatioFull < 1.0;
  const midDeficit = midDensityRatio !== null && midDensityRatio < 1.0;
  const coarseDeficit = coarseDensityRatio !== null && coarseDensityRatio < 1.0;
  // §7 해상도 세분화: 이제 3단계(fine/mid/coarse) 전부에서 결손이 유지될 때만 HIGH다.
  // fine에서만 결손이고 mid·coarse에서는 아니라면(더 넓게 보면 결손이 아니라면) 우연일 확률이
  // 높다고 보수적으로 MID까지만 준다. 어느 단계에서도 결손이 아니면 LOW.
  const scalePersistenceLevel =
    fineDeficit && midDeficit && coarseDeficit ? "HIGH" : fineDeficit && (midDeficit || coarseDeficit) ? "MID" : "LOW";
  const recentDeficit = densityRatioRecent !== null && densityRatioRecent < 1.0;
  const temporalPersistenceLevel = fineDeficit && recentDeficit ? "HIGH" : fineDeficit || recentDeficit ? "MID" : "LOW";

  basins.push({
    key,
    rowZone,
    colZone,
    dispZone,
    oddZone,
    population,
    observedCount: observedFull,
    expectedCount: Number(expectedFull.toFixed(3)),
    densityRatio: densityRatioFull !== null ? Number(densityRatioFull.toFixed(4)) : null,
    structuralVoidLevel,
    midDensityRatio: midDensityRatio !== null ? Number(midDensityRatio.toFixed(4)) : null,
    coarseDensityRatio: coarseDensityRatio !== null ? Number(coarseDensityRatio.toFixed(4)) : null,
    scalePersistenceLevel,
    recentDensityRatio: densityRatioRecent !== null ? Number(densityRatioRecent.toFixed(4)) : null,
    temporalPersistenceLevel,
    noveltyPercentile: Number(((population / TOTAL_COMBINATIONS) * 100).toFixed(3)),
    validationPercentile: familyWiseValidationPercentile(densityRatioFull),
    sampleCombos: getReservoirSample(key),
  });
}

const historyForAtlas = draws.map((d) => ({
  drawNumber: d.drawNumber,
  numbers: [...d.numbers].sort((x, y) => x - y),
}));

const atlas = {
  engineVersion: "DPE-1.1-v3approx",
  atlasVersion: "ATLAS-1.1-v3approx",
  featureSchema: "FS-1-geometry-odd",
  nullModelVersion: "NULL-1.0-familywise",
  methodology:
    "v3 근사치: 로또 용지 좌표 기반 Geometry(중심 행/열, 산포도)+홀짝 비율로 81개 fine Basin을 정의. " +
    "Multi-scale을 3단계(fine 81/mid 27/coarse 9, §7 Exact→Fine→Mid→Macro 중 Mid·Macro 계층 반영)로 " +
    "세분화했고, Temporal(전체 역사 vs 최근 300회), kNN(k=10) 기반 Geometric Void(basin 내 후보 선택), " +
    "Null Simulation(공정한 가짜 역사 500개) + family-wise 다중검정 보정은 실제로 계산했다. basin마다 " +
    "대표 후보 최대 150개를 결정론적 reservoir sampling으로 미리 뽑아둬(sampleCombos), 런타임이 8,145,060개 " +
    "공간에서 매번 rejection sampling하지 않고 이 사전 표본에서만 가볍게 골라 latency를 줄였다(§22). " +
    "아직 없는 것: §7의 \"Exact\"(개별 조합) 계층은 kNN 보정이 근사적으로만 대신하고, 실기기 latency 실측치는 없다.",
  numNullSimulations: NUM_NULL_SIMULATIONS,
  basinSampleSize: RESERVOIR_SIZE,
  builtAt: new Date().toISOString(),
  totalCombinations: TOTAL_COMBINATIONS,
  totalHistoricalDraws,
  recentWindowSize: recentCount,
  historyThroughDrawNumber: draws[draws.length - 1].drawNumber,
  thresholds: { row: rowThresholds, col: colThresholds, dispersion: dispThresholds },
  basins,
  history: historyForAtlas,
};

const outPath = join(ROOT, "data/deep-pattern-atlas.json");
const serialized = JSON.stringify(atlas);
writeFileSync(outPath, serialized);

const sizeKb = (serialized.length / 1024).toFixed(1);
console.log(`\nAtlas 저장 완료: data/deep-pattern-atlas.json (약 ${sizeKb} KB)`);
console.log(`  basin ${basins.length}개, 역대 ${totalHistoricalDraws}회(최근 ${recentCount}회 window), 최신 제${atlas.historyThroughDrawNumber}회 기준`);
console.log(`  구조적 공백 HIGH basin 수: ${basins.filter((b) => b.structuralVoidLevel === "HIGH").length}`);
console.log(`  scalePersistenceLevel HIGH(fine·mid·coarse 3단계 전부 결손) basin 수: ${basins.filter((b) => b.scalePersistenceLevel === "HIGH").length}`);
console.log(`  validationPercentile >= 90(다중검정 보정 후에도 유의미) basin 수: ${basins.filter((b) => b.validationPercentile >= 90).length}`);
console.log(`  validationPercentile >= 50 basin 수: ${basins.filter((b) => b.validationPercentile >= 50).length} / 81`);
console.log(`  대표 후보 sampleCombos 총합: ${basins.reduce((s, b) => s + b.sampleCombos.length, 0).toLocaleString()}개`);
console.log(`총 소요 시간: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
