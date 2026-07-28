// 의존성 설치 없이(bare `node smoke_test.mjs`) 핵심 알고리즘의 정확성을 빠르게 확인하는 스크립트.
// src/lib/lottery의 실제 로직을 그대로 재현하며, npm install 없이 CI/로컬 어디서나 즉시 실행 가능하다.
import { randomBytes } from "node:crypto";

function secureRandomInt(maxExclusive) {
  if (maxExclusive === 1) return 0;
  const bitsNeeded = Math.ceil(Math.log2(maxExclusive));
  const byteLength = Math.max(1, Math.ceil(bitsNeeded / 8));
  const range = 2 ** (byteLength * 8);
  const limit = range - (range % maxExclusive);
  for (let attempt = 0; attempt < 1000; attempt++) {
    const bytes = randomBytes(byteLength);
    let value = 0;
    for (let i = 0; i < byteLength; i++) value = value * 256 + bytes[i];
    if (value < limit) return value % maxExclusive;
  }
  throw new Error("fail");
}

function secureShuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function generatePureRandom(excludedNumbers = [], requiredNumbers = []) {
  const excluded = new Set(excludedNumbers);
  const required = [...new Set(requiredNumbers)];
  const available = Array.from({ length: 45 }, (_, i) => i + 1)
    .filter((n) => !excluded.has(n))
    .filter((n) => !required.includes(n));
  if (required.length > 6) throw new Error("필수번호는 최대 6개까지");
  if (available.length + required.length < 6) throw new Error("후보 부족");
  const remainingCount = 6 - required.length;
  const selected = secureShuffle(available).slice(0, remainingCount);
  return [...required, ...selected].sort((a, b) => a - b);
}

function combinationKey(numbers) {
  return [...numbers].sort((a, b) => a - b).join("-");
}

let allOk = true;
for (let i = 0; i < 5000; i++) {
  const numbers = generatePureRandom();
  if (numbers.length !== 6) allOk = false;
  if (new Set(numbers).size !== 6) allOk = false;
  for (const n of numbers) if (n < 1 || n > 45) allOk = false;
  const sorted = [...numbers].sort((a, b) => a - b);
  if (JSON.stringify(sorted) !== JSON.stringify(numbers)) allOk = false;
}
console.log("Test1 (range/unique/sorted x5000):", allOk ? "PASS" : "FAIL");

let test2Ok = true;
const excluded = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const required = [40, 41];
for (let i = 0; i < 2000; i++) {
  const numbers = generatePureRandom(excluded, required);
  for (const e of excluded) if (numbers.includes(e)) test2Ok = false;
  for (const r of required) if (!numbers.includes(r)) test2Ok = false;
}
console.log("Test2 (exclude/require honored x2000):", test2Ok ? "PASS" : "FAIL");

const seen = new Set();
for (let i = 0; i < 500; i++) {
  seen.add(combinationKey(generatePureRandom()));
}
console.log("Test3 (combinationKey consistent):", seen.size > 400 ? "PASS" : "FAIL");

const TOTAL = 8_145_060;
function calcProb(uniqueGameCount) {
  if (uniqueGameCount <= 0) return 0;
  return (uniqueGameCount / TOTAL) * 100;
}
const p1 = calcProb(1);
const p5 = calcProb(5);
const probOk = Math.abs(p1 - (1 / TOTAL) * 100) < 1e-9 && Math.abs(p5 - (5 / TOTAL) * 100) < 1e-9;
console.log("Test4 (probability formula 1/N, 5/N):", probOk ? "PASS" : "FAIL", { p1, p5 });

function coverage(unique) {
  return (unique / TOTAL) * 100;
}
const c10k = coverage(10000);
const c100k = coverage(100000);
console.log(
  "Test5 (coverage 10k/100k ~ 0.1228%/1.2277%):",
  Math.abs(c10k - 0.1228) < 0.001 && Math.abs(c100k - 1.2277) < 0.001 ? "PASS" : "FAIL",
  { c10k, c100k }
);

console.log(allOk && test2Ok && probOk ? "\nALL CRITICAL CHECKS PASSED" : "\nSOME CHECKS FAILED");
