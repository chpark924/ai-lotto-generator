import type { ConsecutiveRule, GenerationRequest } from "./types";

export class ValidationError extends Error {}

/** 기획서 5.2 공통 검증 규칙 */
export function validateGenerationRequest(request: GenerationRequest): void {
  const { excludedNumbers, requiredNumbers, gameCount } = request;

  for (const n of [...excludedNumbers, ...requiredNumbers]) {
    if (!Number.isInteger(n) || n < 1 || n > 45) {
      throw new ValidationError("번호는 1~45 범위여야 합니다.");
    }
  }

  const excludedSet = new Set(excludedNumbers);
  const overlap = requiredNumbers.filter((n) => excludedSet.has(n));
  if (overlap.length > 0) {
    throw new ValidationError(
      `필수번호와 제외번호가 겹칩니다. 겹치는 번호를 확인해주세요. (${overlap.join(", ")})`
    );
  }

  if (requiredNumbers.length > 6) {
    throw new ValidationError("필수번호는 최대 6개까지 설정할 수 있습니다.");
  }

  const remainingPoolSize = 45 - new Set(excludedNumbers).size;
  if (remainingPoolSize < 6) {
    throw new ValidationError("제외 후 남은 번호가 6개 미만입니다. 제외번호를 줄여주세요.");
  }

  if (request.oddCount !== undefined && (request.oddCount < 0 || request.oddCount > 6)) {
    throw new ValidationError("홀수 개수는 0~6 범위여야 합니다.");
  }

  if (
    request.minSum !== undefined &&
    request.maxSum !== undefined &&
    request.minSum > request.maxSum
  ) {
    throw new ValidationError("최소 합계가 최대 합계보다 클 수 없습니다.");
  }

  if (!Number.isInteger(gameCount) || gameCount < 1 || gameCount > 30) {
    throw new ValidationError("게임 수는 1~30 사이여야 합니다.");
  }

  if (request.mustIncludeOneOfSets) {
    for (const set of request.mustIncludeOneOfSets) {
      for (const n of set) {
        if (!Number.isInteger(n) || n < 1 || n > 45) {
          throw new ValidationError("번호는 1~45 범위여야 합니다.");
        }
      }
    }
  }
}

export function isConsecutiveRuleSatisfied(
  maxConsecutiveLength: number,
  rule: ConsecutiveRule
): boolean {
  switch (rule) {
    case "ANY":
      return true;
    case "NONE":
      return maxConsecutiveLength <= 1;
    case "ALLOW_TWO":
      return maxConsecutiveLength <= 2;
    case "ALLOW_THREE":
      return maxConsecutiveLength <= 3;
    case "REQUIRE_TWO":
      return maxConsecutiveLength >= 2;
    case "REQUIRE_THREE":
      return maxConsecutiveLength >= 3;
    default:
      return true;
  }
}
