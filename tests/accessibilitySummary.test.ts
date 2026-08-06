import { buildGameAccessibilitySummary } from "../src/lib/lottery/accessibilitySummary";
import type { GeneratedGame } from "../src/lib/lottery/types";

function game(overrides: Partial<GeneratedGame> = {}): GeneratedGame {
  return {
    id: "game_1",
    numbers: [1, 5, 12, 23, 34, 42],
    mode: "AI_SEARCH",
    metadata: {
      oddCount: 3,
      lowNumberCount: 3,
      sum: 117,
      maxConsecutiveLength: 1,
      sameEndingMaxCount: 1,
      sectionCounts: [2, 1, 1, 1, 1],
    },
    ...overrides,
  };
}

describe("buildGameAccessibilitySummary (스크린리더 요약)", () => {
  it("번호·홀짝·합계·연속번호를 자연스러운 문장으로 조합한다", () => {
    const summary = buildGameAccessibilitySummary(game(), undefined, undefined);
    expect(summary).toContain("번호 1, 5, 12, 23, 34, 42");
    expect(summary).toContain("홀수 3개, 짝수 3개, 합계 117");
    expect(summary).toContain("연속번호 없음");
    expect(summary).not.toContain(":"); // 시각용 "3:3" 표기 대신 TTS 친화적 표현만 쓴다.
  });

  it("연속번호가 있으면 '연속번호 있음'을 포함한다", () => {
    const summary = buildGameAccessibilitySummary(
      game({ metadata: { ...game().metadata, maxConsecutiveLength: 2 } }),
      undefined,
      undefined
    );
    expect(summary).toContain("연속번호 있음");
  });

  it("점수가 있으면 추천 적합도 문구를 포함하고, 없으면 생략한다", () => {
    const withScore = buildGameAccessibilitySummary(
      game({
        score: {
          totalScore: 88.4,
          conditionMatchScore: 90,
          diversityScore: 80,
          userUniquenessScore: 85,
          personalNoveltyScore: 100,
          balanceScore: 90,
        },
      }),
      undefined,
      undefined
    );
    expect(withScore).toContain("추천 적합도 88점");

    const withoutScore = buildGameAccessibilitySummary(game(), undefined, undefined);
    expect(withoutScore).not.toContain("추천 적합도");
  });

  it("배지가 있으면 라벨을 이어붙여 포함한다", () => {
    const summary = buildGameAccessibilitySummary(
      game(),
      [
        { key: "MONTE_CARLO", label: "몬테카를로 탐색 · 10만 회" },
        { key: "EV_OPTIMIZED", label: "EV 최적화" },
      ],
      undefined
    );
    expect(summary).toContain("몬테카를로 탐색 · 10만 회, EV 최적화");
  });

  it("배지가 없거나 빈 배열이면 배지 관련 문구를 포함하지 않는다", () => {
    expect(buildGameAccessibilitySummary(game(), undefined, undefined)).not.toContain("EV 최적화");
    expect(buildGameAccessibilitySummary(game(), [], undefined)).not.toContain("EV 최적화");
  });

  it("설명 문단이 있으면 맨 끝에 포함한다", () => {
    const summary = buildGameAccessibilitySummary(game(), undefined, "이 조합은 예시 설명입니다.");
    expect(summary.endsWith("이 조합은 예시 설명입니다.")).toBe(true);
  });
});
