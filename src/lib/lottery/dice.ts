/** 기획서 10장 45면체 운명의 주사위. 실제 값은 기기 내 CSPRNG가 결정한다. */
import { randomInt } from "./random";

export function rollDice45(excludedNumbers: number[], alreadySelected: number[]): number {
  const unavailable = new Set([...excludedNumbers, ...alreadySelected]);
  const available = Array.from({ length: 45 }, (_, index) => index + 1).filter(
    (n) => !unavailable.has(n)
  );

  if (available.length === 0) {
    throw new Error("굴릴 수 있는 번호가 없습니다.");
  }

  return available[randomInt(0, available.length)];
}
