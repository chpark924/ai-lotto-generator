import { validateGenerationRequest, ValidationError } from "../src/lib/lottery/validators";
import type { GenerationRequest } from "../src/lib/lottery/types";

function baseRequest(overrides: Partial<GenerationRequest> = {}): GenerationRequest {
  return {
    mode: "PURE_RANDOM",
    gameCount: 1,
    excludedNumbers: [],
    requiredNumbers: [],
    preferredNumbers: [],
    consecutiveRule: "ANY",
    ...overrides,
  };
}

describe("validateGenerationRequest", () => {
  it("정상 요청은 통과한다", () => {
    expect(() => validateGenerationRequest(baseRequest())).not.toThrow();
  });

  it("필수번호와 제외번호가 겹치면 에러", () => {
    expect(() =>
      validateGenerationRequest(baseRequest({ excludedNumbers: [7], requiredNumbers: [7] }))
    ).toThrow(ValidationError);
  });

  it("필수번호가 6개 초과면 에러", () => {
    expect(() =>
      validateGenerationRequest(baseRequest({ requiredNumbers: [1, 2, 3, 4, 5, 6, 7] }))
    ).toThrow(ValidationError);
  });

  it("제외 후 남은 번호가 6개 미만이면 에러", () => {
    const excluded = Array.from({ length: 40 }, (_, i) => i + 1);
    expect(() => validateGenerationRequest(baseRequest({ excludedNumbers: excluded }))).toThrow(
      ValidationError
    );
  });

  it("게임 수가 범위를 벗어나면 에러", () => {
    expect(() => validateGenerationRequest(baseRequest({ gameCount: 0 }))).toThrow(ValidationError);
    expect(() => validateGenerationRequest(baseRequest({ gameCount: 100 }))).toThrow(ValidationError);
  });

  it("1~45 범위를 벗어난 번호는 에러", () => {
    expect(() => validateGenerationRequest(baseRequest({ requiredNumbers: [46] }))).toThrow(
      ValidationError
    );
  });
});
