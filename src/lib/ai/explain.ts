/**
 * 결과 설명 생성 (기획서 2.3, 19장).
 *
 * 비용 최소화 원칙:
 *  - "로컬 템플릿 설명"만 제공한다. LLM 호출은 전혀 발생하지 않는다 (비용 0원).
 *  - 번호 생성 자체는 이 모듈과 무관하다 — 항상 로컬 난수 엔진이 전담한다.
 *
 * 참고: 이전에는 사용자가 본인의 Anthropic API 키를 입력하면(BYOK) LLM으로 설명을
 * 생성하는 옵션이 있었으나, 일반 사용자가 API 키를 준비해 직접 연동할 일이 거의 없어
 * 사용성 관점에서 제거했다. 필요해지면 서버가 대신 호출하는 방식으로 다시 검토한다.
 */
import type { GeneratedGame } from "../lottery/types";
import { getOddCount, getMaxConsecutiveLength } from "../lottery/pattern";
import { maxOverlapAgainstList } from "../lottery/similarity";
import type { GameFeatures } from "./types";

export function buildGameFeatures(
  game: GeneratedGame,
  popularityByNumber: number[],
  savedCombinations: number[][]
): GameFeatures {
  const oddCount = getOddCount(game.numbers);
  const evenCount = 6 - oddCount;
  const birthdayRangeCount = game.numbers.filter((n) => n <= 31).length;
  const popularNumberCount = game.numbers.filter(
    (n) => (popularityByNumber[n - 1] ?? 0) >= 0.6
  ).length;
  const maxOverlap =
    savedCombinations.length > 0 ? maxOverlapAgainstList(game.numbers, savedCombinations) : 0;

  return {
    mode: game.mode,
    numbers: game.numbers,
    oddEven: `${oddCount}:${evenCount}`,
    sum: game.metadata.sum,
    hasConsecutive: getMaxConsecutiveLength(game.numbers) >= 2,
    popularNumberCount,
    birthdayRangeCount,
    similarityToSavedNumbers: Math.round((maxOverlap / 6) * 100) / 100,
  };
}

/** 비용 0원 — 서버/AI 호출 없이 규칙 기반으로 결과를 설명한다. 기본 동작. */
export function explainGameLocally(features: GameFeatures): string {
  const parts: string[] = [];

  parts.push(`홀짝 비율 ${features.oddEven}, 번호 합계 ${features.sum}입니다.`);

  if (features.hasConsecutive) {
    parts.push("연속된 번호가 포함되어 있습니다.");
  } else {
    parts.push("연속된 번호는 없습니다.");
  }

  if (features.birthdayRangeCount >= 5) {
    parts.push("생일번호로 흔히 쓰이는 1~31 범위에 번호가 몰려 있습니다.");
  } else if (features.birthdayRangeCount <= 1) {
    parts.push("1~31 범위 밖의 번호 비중이 높습니다.");
  }

  if (features.popularNumberCount === 0) {
    parts.push("일반적으로 많이 선택되는 번호는 포함되어 있지 않습니다.");
  } else {
    parts.push(`일반적으로 많이 선택되는 번호가 ${features.popularNumberCount}개 포함되어 있습니다.`);
  }

  if (features.similarityToSavedNumbers > 0) {
    parts.push(
      `내 기존 저장번호와의 최대 유사도는 ${Math.round(features.similarityToSavedNumbers * 100)}%입니다.`
    );
  }

  parts.push("이 설명은 조합의 특징을 나타낼 뿐 당첨 가능성을 의미하지 않습니다.");
  return parts.join(" ");
}
