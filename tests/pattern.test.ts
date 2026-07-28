import {
  getOddCount,
  getLowNumberCount,
  getNumberSum,
  getMaxConsecutiveLength,
  getSameEndingMaxCount,
  getSectionCounts,
} from "../src/lib/lottery/pattern";

describe("패턴 검증 함수", () => {
  it("getOddCount", () => {
    expect(getOddCount([1, 2, 3, 4, 5, 6])).toBe(3);
    expect(getOddCount([2, 4, 6, 8, 10, 12])).toBe(0);
  });

  it("getLowNumberCount (1~22 기준)", () => {
    expect(getLowNumberCount([1, 10, 22, 23, 30, 45])).toBe(3);
  });

  it("getNumberSum", () => {
    expect(getNumberSum([1, 2, 3, 4, 5, 6])).toBe(21);
  });

  it("getMaxConsecutiveLength", () => {
    expect(getMaxConsecutiveLength([1, 2, 3, 10, 20, 30])).toBe(3);
    expect(getMaxConsecutiveLength([1, 5, 10, 20, 30, 40])).toBe(1);
    expect(getMaxConsecutiveLength([5, 6, 20, 21, 22, 40])).toBe(3);
  });

  it("getSameEndingMaxCount", () => {
    expect(getSameEndingMaxCount([1, 11, 21, 31, 41, 5])).toBe(5);
    expect(getSameEndingMaxCount([1, 2, 3, 4, 5, 6])).toBe(1);
  });

  it("getSectionCounts", () => {
    expect(getSectionCounts([5, 15, 25, 35, 45, 1])).toEqual([2, 1, 1, 1, 1]);
  });
});
