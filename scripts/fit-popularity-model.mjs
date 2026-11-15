#!/usr/bin/env node
/**
 * 한국형 번호 인기도 모델 적합 (2026-11-15).
 *
 * 목적: "당첨되면 나눠 가질 사람이 적은 조합"을 고르기 위한 번호별 인기도(사람들이 그 번호를
 * 얼마나 많이 고르나)를, 정적 추측 대신 한국 로또 실제 당첨자 수로 추정한다. 당첨 확률과는
 * 무관하다 — 모든 조합의 당첨 확률은 같고, 이 값은 "같은 번호를 산 사람이 몇 명일까"만 반영한다.
 *
 * 방법: 회차마다 5등(3개 일치) 실제 당첨 게임 수 ÷ 이론 기대값(총판매 게임 수 × 5등 확률)을
 * 구하면, 그 회차 당첨번호들을 사람들이 평균보다 얼마나 많이 골랐는지가 나온다(회차당 표본
 * 수백만 게임이라 잡음이 작다). log(비율)을 "그 회차 당첨번호 6개 포함 여부(45개 지시변수)"로
 * 최소제곱 회귀해 번호별 효과를 얻는다. 1,000원 가격 이후(88회~)만 사용.
 * 검증(2026-11-15, 1~1250회): 홀짝 회차 분할 상관 0.96, 전·후반 0.93, 4등으로 따로 적합한
 * 결과와 상관 0.996 — 안정적. 번호 외 패턴(연번·같은 끝수·용지 줄)은 잔차 효과가 ±1% 이내라 미반영.
 *
 * 사용법: node scripts/fit-popularity-model.mjs  → src/lib/draws/popularityModel.ts 재생성.
 * 데이터(data/lotto-draws.json)가 dataVersion 2(rankWinnerCounts·실제 totalSalesAmount)여야 한다.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "..", "data", "lotto-draws.json");
const OUT_PATH = path.join(__dirname, "..", "src", "lib", "draws", "popularityModel.ts");

function comb(n, k) {
  let r = 1;
  for (let i = 1; i <= k; i += 1) r = (r * (n - k + i)) / i;
  return r;
}
const TOTAL = comb(45, 6);
const P5 = (comb(6, 3) * comb(39, 3)) / TOTAL;
const MIN_DRAW = 88; // 2004-08 이후 1게임 1,000원
const OUT_MIN = 0.2;
const OUT_MAX = 0.8;

/** 정규방정식 (XᵀX)β = Xᵀy 를 가우스 소거로 푼다. */
function solveLeastSquares(rows, y, k) {
  const A = Array.from({ length: k }, () => new Array(k + 1).fill(0));
  rows.forEach((cols, r) => {
    for (const i of cols) {
      for (const j of cols) A[i][j] += 1;
      A[i][k] += y[r];
    }
  });
  for (let c = 0; c < k; c += 1) {
    let p = c;
    for (let r = c + 1; r < k; r += 1) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < k; r += 1) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let j = c; j <= k; j += 1) A[r][j] -= f * A[c][j];
    }
  }
  return A.map((row, i) => row[k] / row[i]);
}

async function main() {
  const draws = JSON.parse(await readFile(DATA_PATH, "utf-8"));
  const usable = draws.filter(
    (d) =>
      d.drawNumber >= MIN_DRAW &&
      d.dataVersion >= 2 &&
      Number.isInteger(d.totalSalesAmount) &&
      Array.isArray(d.rankWinnerCounts) &&
      d.rankWinnerCounts[4] > 0
  );
  if (usable.length < 500) throw new Error(`사용 가능한 회차가 너무 적습니다(${usable.length}).`);

  const rows = usable.map((d) => d.numbers.map((n) => n - 1));
  const y = usable.map((d) => Math.log(d.rankWinnerCounts[4] / ((d.totalSalesAmount / 1000) * P5)));
  const beta = solveLeastSquares(rows, y, 45);
  const mean = beta.reduce((a, b) => a + b, 0) / beta.length;
  const centered = beta.map((b) => b - mean);
  const lo = Math.min(...centered);
  const hi = Math.max(...centered);
  const scores = centered.map((b) => Math.round((OUT_MIN + ((b - lo) / (hi - lo)) * (OUT_MAX - OUT_MIN)) * 100) / 100);
  const lastDraw = usable[usable.length - 1].drawNumber;

  const lines = [];
  for (let i = 0; i < 45; i += 9) lines.push(`  ${scores.slice(i, i + 9).map((s) => s.toFixed(2)).join(", ")},`);
  const relative = centered.map((b) => Math.exp(b));
  const order = relative.map((v, i) => [i + 1, v]).sort((a, b) => b[1] - a[1]);
  const fmt = (list) => list.map(([n, v]) => `${n}(${((v - 1) * 100).toFixed(1)}%)`).join(", ");

  const content = `/**
 * ⚠️ 자동 생성 파일 — 직접 고치지 말고 \`node scripts/fit-popularity-model.mjs\`로 다시 만들 것.
 *
 * 한국 로또 6/45 번호별 "선택 인기도"(0.2=가장 덜 고름 ~ 0.8=가장 많이 고름).
 * ${MIN_DRAW}~${lastDraw}회(${usable.length}회차) 5등 실제 당첨 게임 수 ÷ 이론 기대값을 번호별로 회귀한 값이다.
 * 당첨 확률과는 무관하다 — "당첨되면 같은 번호를 가진 사람이 몇 명일까"만 반영한다.
 *
 * 5등 당첨 비율 기준 상대 효과(자동 구매가 섞여 있어 실제 수동 선택 차이는 이보다 크다):
 *  - 가장 많이 고르는 번호: ${fmt(order.slice(0, 8))}
 *  - 가장 덜 고르는 번호: ${fmt(order.slice(-8))}
 */
export const KOREAN_NUMBER_POPULARITY: readonly number[] = [
${lines.join("\n")}
];

export const KOREAN_POPULARITY_MODEL_INFO = {
  firstDraw: ${MIN_DRAW},
  lastDraw: ${lastDraw},
  drawCount: ${usable.length},
} as const;
`;
  await writeFile(OUT_PATH, content, "utf-8");
  console.log(`[fit-popularity-model] ${usable.length}회차로 적합 → ${path.relative(process.cwd(), OUT_PATH)}`);
  console.log(`  많이 고름: ${fmt(order.slice(0, 5))}`);
  console.log(`  덜 고름:  ${fmt(order.slice(-5))}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
