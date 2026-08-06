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
  savedCombinations: number[][],
  /** 최근 4주(회차) 실제 당첨번호(중복 제거)의 합집합. 못 불러왔으면 null. */
  recentWinningNumbers: number[] | null = null
): GameFeatures {
  const oddCount = getOddCount(game.numbers);
  const evenCount = 6 - oddCount;
  const birthdayRangeCount = game.numbers.filter((n) => n <= 31).length;
  const popularNumberCount = game.numbers.filter(
    (n) => (popularityByNumber[n - 1] ?? 0) >= 0.6
  ).length;
  const maxOverlap =
    savedCombinations.length > 0 ? maxOverlapAgainstList(game.numbers, savedCombinations) : 0;
  const recentWinningMatchCount = recentWinningNumbers
    ? game.numbers.filter((n) => recentWinningNumbers.includes(n)).length
    : null;

  return {
    mode: game.mode,
    numbers: game.numbers,
    oddEven: `${oddCount}:${evenCount}`,
    sum: game.metadata.sum,
    hasConsecutive: getMaxConsecutiveLength(game.numbers) >= 2,
    popularNumberCount,
    birthdayRangeCount,
    similarityToSavedNumbers: Math.round((maxOverlap / 6) * 100) / 100,
    recentWinningMatchCount,
  };
}

/**
 * 비용 0원 — 서버/AI 호출 없이 규칙 기반으로 결과를 설명한다. 기본 동작.
 *
 * 가독성 리뷰(QA_LOG 48번): 예전에는 "이 설명은 조합의 특징을 나타낼 뿐 당첨 가능성을
 * 의미하지 않습니다."를 매 카드 끝에 반복했다. 결과 화면 맨 아래 DisclaimerCard가 같은
 * 취지의 안내(모든 조합이 동일 확률이라는 점)를 화면당 한 번 이미 보여주고 있어서, 카드마다
 * (최대 10번) 똑같은 문장을 반복하면 정보라기보다 "숙제 검사받는 느낌"에 가까워지고 정작
 * 읽어야 할 특징 설명의 가독성만 떨어뜨린다고 판단해 뺐다 — 40번 항목에서 점수 설명 문구에
 * 이미 적용했던 것과 같은 원칙("카드마다 반복 노출되면 기대감을 과도하게 꺾을 수 있다")을
 * 여기에도 동일하게 적용한 것이다.
 */
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

  if (features.recentWinningMatchCount !== null && features.recentWinningMatchCount > 0) {
    parts.push(`최근 4주간 당첨된 번호가 ${features.recentWinningMatchCount}개 포함되어 있습니다.`);
  } else if (features.popularNumberCount === 0) {
    parts.push("일반적으로 많이 선택되는 번호는 포함되어 있지 않습니다.");
  } else {
    parts.push(`일반적으로 많이 선택되는 번호가 ${features.popularNumberCount}개 포함되어 있습니다.`);
  }

  if (features.similarityToSavedNumbers > 0) {
    parts.push(
      `내 기존 저장번호와의 최대 유사도는 ${Math.round(features.similarityToSavedNumbers * 100)}%입니다.`
    );
  }

  return parts.join(" ");
}
