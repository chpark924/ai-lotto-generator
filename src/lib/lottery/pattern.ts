import type { GameMetadata } from "./types";

/** 기획서 12장 번호 패턴 검증 함수 */

export function getOddCount(numbers: number[]): number {
  return numbers.filter((n) => n % 2 === 1).length;
}

/** 1~22를 낮은 번호로 본다. */
export function getLowNumberCount(numbers: number[]): number {
  return numbers.filter((n) => n <= 22).length;
}

export function getNumberSum(numbers: number[]): number {
  return numbers.reduce((sum, n) => sum + n, 0);
}

export function getSameEndingMaxCount(numbers: number[]): number {
  const endings = new Map<number, number>();
  for (const n of numbers) {
    const ending = n % 10;
    endings.set(ending, (endings.get(ending) ?? 0) + 1);
  }
  return Math.max(...endings.values());
}

export function getSectionCounts(numbers: number[]): number[] {
  const sections = [0, 0, 0, 0, 0];
  for (const n of numbers) {
    if (n <= 10) sections[0] += 1;
    else if (n <= 20) sections[1] += 1;
    else if (n <= 30) sections[2] += 1;
    else if (n <= 40) sections[3] += 1;
    else sections[4] += 1;
  }
  return sections;
}

export function getMaxConsecutiveLength(numbers: number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b);
  let maxLength = 1;
  let currentLength = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] === sorted[i - 1] + 1) {
      currentLength += 1;
      maxLength = Math.max(maxLength, currentLength);
    } else {
      currentLength = 1;
    }
  }
  return maxLength;
}

export function buildGameMetadata(numbers: number[]): GameMetadata {
  return {
    oddCount: getOddCount(numbers),
    lowNumberCount: getLowNumberCount(numbers),
    sum: getNumberSum(numbers),
    maxConsecutiveLength: getMaxConsecutiveLength(numbers),
    sameEndingMaxCount: getSameEndingMaxCount(numbers),
    sectionCounts: getSectionCounts(numbers),
  };
}
