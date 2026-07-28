import {
  normalizeToLottoNumber,
  deriveBirthNumbers,
  generateLuckyProfileGame,
  deriveHashNumbers,
} from "../src/lib/lottery/luckyNumber";

describe("normalizeToLottoNumber", () => {
  it("1~45는 그대로 유지된다", () => {
    expect(normalizeToLottoNumber(1)).toBe(1);
    expect(normalizeToLottoNumber(45)).toBe(45);
  });

  it("45 초과 값은 1~45로 순환한다", () => {
    expect(normalizeToLottoNumber(46)).toBe(1);
    expect(normalizeToLottoNumber(107)).toBe(17);
  });
});

describe("deriveBirthNumbers", () => {
  it("1988년 12월 25일 예시가 기획서와 동일한 파생값을 만든다", () => {
    const derived = deriveBirthNumbers({ year: 1988, month: 12, day: 25 });
    const values = derived.map((d) => d.value);
    // 월(12), 일(25), 연도숫자합(26->26), 전체숫자합(36), 월+일(37)
    expect(values).toContain(normalizeToLottoNumber(12));
    expect(values).toContain(normalizeToLottoNumber(25));
    expect(values).toContain(normalizeToLottoNumber(26));
    expect(values).toContain(normalizeToLottoNumber(36));
    expect(values).toContain(normalizeToLottoNumber(37));
  });
});

describe("generateLuckyProfileGame", () => {
  it("중복 없이 6개의 1~45 번호를 반환한다", () => {
    const result = generateLuckyProfileGame({
      birthProfile: { year: 1990, month: 3, day: 14 },
      preferredNumbers: [7],
      excludedNumbers: [],
      destinyRatio: 0.5,
    });
    expect(result.numbers).toHaveLength(6);
    expect(new Set(result.numbers).size).toBe(6);
    expect(result.numberReasons).toHaveLength(6);
  });

  it("제외번호는 포함하지 않는다", () => {
    const result = generateLuckyProfileGame({
      birthProfile: { year: 1990, month: 3, day: 14 },
      preferredNumbers: [7],
      excludedNumbers: [3, 14, 7],
      destinyRatio: 0.7,
    });
    expect(result.numbers).not.toContain(3);
    expect(result.numbers).not.toContain(14);
    expect(result.numbers).not.toContain(7);
  });
});

describe("deriveHashNumbers", () => {
  it("동일 입력 + 동일 회차는 항상 같은 결과를 재현한다", async () => {
    const a = await deriveHashNumbers("홍길동", 1100);
    const b = await deriveHashNumbers("홍길동", 1100);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it("회차가 다르면 다른 결과가 나올 수 있다", async () => {
    const a = await deriveHashNumbers("홍길동", 1100);
    const b = await deriveHashNumbers("홍길동", 1101);
    expect(a).not.toEqual(b);
  });
});
