import { stretchScoresForDisplay } from "../src/lib/lottery/scoring";

describe("stretchScoresForDisplay (추천 적합도 표시용 재조정)", () => {
  it("빈 배열은 빈 배열을 반환한다", () => {
    expect(stretchScoresForDisplay([])).toEqual([]);
  });

  it("원점수가 몰려 있어도(예: 87~89) 우열 순서를 유지하며 폭을 넓게 펼친다", () => {
    const result = stretchScoresForDisplay([88.4, 87.9, 88.1, 87.2, 88.8]);
    // 원래 순서: 5번째(88.8)가 최고, 4번째(87.2)가 최저.
    expect(result[4]).toBeGreaterThan(result[3]);
    expect(Math.max(...result)).toBe(98);
    expect(Math.min(...result)).toBe(65);
    // 편차가 최소 몇 점 이상으로 벌어져 사용자가 체감할 수 있어야 한다.
    expect(Math.max(...result) - Math.min(...result)).toBeGreaterThanOrEqual(30);
  });

  it("완전히 동점이면 순위 순서대로 살짝 차등을 준다", () => {
    const result = stretchScoresForDisplay([90, 90, 90]);
    expect(result[0]).toBeGreaterThan(result[1]);
    expect(result[1]).toBeGreaterThan(result[2]);
  });

  it("항목이 1개면 최고점으로 표시한다", () => {
    expect(stretchScoresForDisplay([55])).toEqual([98]);
  });

  it("상대적 우열 순서는 항상 원점수 순서와 같다", () => {
    const raw = [72, 95, 60, 88];
    const result = stretchScoresForDisplay(raw);
    const rawOrder = [...raw].map((v, i) => i).sort((a, b) => raw[b] - raw[a]);
    const resultOrder = [...result].map((v, i) => i).sort((a, b) => result[b] - result[a]);
    expect(resultOrder).toEqual(rawOrder);
  });
});
