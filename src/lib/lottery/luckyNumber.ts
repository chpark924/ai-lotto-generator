/**
 * 기획서 9장 나의 행운번호.
 *
 * 개인정보 보호 원칙: 생년월일 원본은 기본적으로 기기에만 저장하고(스토리지 계층 참고),
 * 이 모듈은 순수 함수로 생년월일로부터 "파생 정수"만 계산한다. 서버 전송이 없다.
 */
import * as Crypto from "expo-crypto";
import { secureShuffle } from "./random";
import type { NumberReason } from "./types";

export interface BirthProfile {
  year: number;
  month: number; // 1~12
  day: number; // 1~31
}

function digitSum(value: number): number {
  return Math.abs(value)
    .toString()
    .split("")
    .reduce((sum, d) => sum + Number(d), 0);
}

/** 45를 초과하는 값을 1~45 범위로 순환시킨다 (기획서 9.2). */
export function normalizeToLottoNumber(value: number): number {
  return ((Math.abs(value) - 1) % 45) + 1;
}

export interface DerivedNumber {
  value: number;
  reason: NumberReason;
}

export function deriveBirthNumbers(profile: BirthProfile): DerivedNumber[] {
  const { year, month, day } = profile;
  const yearDigitSum = digitSum(year);
  const totalDigitSum = digitSum(year) + digitSum(month) + digitSum(day);
  const monthPlusDay = month + day;

  const candidates: DerivedNumber[] = [
    {
      value: normalizeToLottoNumber(month),
      reason: { number: 0, source: "BIRTH_MONTH", description: "태어난 달" },
    },
    {
      value: normalizeToLottoNumber(day),
      reason: { number: 0, source: "BIRTH_DAY", description: "태어난 날짜" },
    },
    {
      value: normalizeToLottoNumber(yearDigitSum),
      reason: { number: 0, source: "BIRTH_SUM", description: "태어난 연도 숫자 합" },
    },
    {
      value: normalizeToLottoNumber(totalDigitSum),
      reason: { number: 0, source: "BIRTH_SUM", description: "생년월일 전체 숫자 합" },
    },
    {
      value: normalizeToLottoNumber(monthPlusDay),
      reason: { number: 0, source: "BIRTH_SUM", description: "태어난 달 + 날짜" },
    },
  ];

  // reason.number를 실제 값으로 채운다.
  return candidates.map((c) => ({ ...c, reason: { ...c.reason, number: c.value } }));
}

export interface LuckyProfileOptions {
  birthProfile?: BirthProfile;
  preferredNumbers: number[];
  excludedNumbers: number[];
  /** 0~1. 운명(생년월일+선호번호) 비중. 나머지는 안전한 무작위. */
  destinyRatio: number;
}

export interface LuckyGameResult {
  numbers: number[];
  numberReasons: NumberReason[];
}

export function generateLuckyProfileGame(options: LuckyProfileOptions): LuckyGameResult {
  const excluded = new Set(options.excludedNumbers);
  const reasonsByNumber = new Map<number, NumberReason>();

  const destinyPool: number[] = [];
  if (options.birthProfile) {
    for (const derived of deriveBirthNumbers(options.birthProfile)) {
      if (!excluded.has(derived.value) && !destinyPool.includes(derived.value)) {
        destinyPool.push(derived.value);
        reasonsByNumber.set(derived.value, derived.reason);
      }
    }
  }
  for (const preferred of options.preferredNumbers) {
    if (!excluded.has(preferred) && !destinyPool.includes(preferred)) {
      destinyPool.push(preferred);
      reasonsByNumber.set(preferred, {
        number: preferred,
        source: "PREFERRED",
        description: "저장한 선호번호",
      });
    }
  }

  const destinyCount = Math.round(6 * Math.min(1, Math.max(0, options.destinyRatio)));
  const shuffledDestiny = secureShuffle(destinyPool).slice(0, destinyCount);

  const numbers = new Set<number>(shuffledDestiny);

  const remainingPool = Array.from({ length: 45 }, (_, i) => i + 1).filter(
    (n) => !excluded.has(n) && !numbers.has(n)
  );
  const shuffledRemaining = secureShuffle(remainingPool);
  let idx = 0;
  while (numbers.size < 6 && idx < shuffledRemaining.length) {
    const n = shuffledRemaining[idx];
    idx += 1;
    numbers.add(n);
    if (!reasonsByNumber.has(n)) {
      reasonsByNumber.set(n, { number: n, source: "RANDOM", description: "무작위 보완" });
    }
  }

  const sorted = [...numbers].sort((a, b) => a - b);
  return {
    numbers: sorted,
    numberReasons: sorted.map((n) => reasonsByNumber.get(n) ?? {
      number: n,
      source: "RANDOM",
      description: "무작위 보완",
    }),
  };
}

/**
 * 기획서 9.5 해시 기반 번호 생성 (이름/닉네임 등 문자열 기반 추가 번호).
 * SHA-256을 사용해 동일 입력 + 동일 회차에 대해 재현 가능한 결과를 만든다.
 * expo-crypto의 비동기 digestStringAsync를 사용하므로 이 함수만 async다.
 */
export async function deriveHashNumbers(
  input: string,
  drawNumber: number,
  count = 6
): Promise<number[]> {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${input}+${drawNumber}`
  );
  const bytes: number[] = [];
  for (let i = 0; i < hash.length; i += 2) {
    bytes.push(parseInt(hash.slice(i, i + 2), 16));
  }
  const numbers = new Set<number>();
  for (const byte of bytes) {
    if (numbers.size >= count) break;
    numbers.add(normalizeToLottoNumber(byte + 1));
  }
  return [...numbers].sort((a, b) => a - b);
}
