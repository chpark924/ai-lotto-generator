/**
 * GeneratedGameCard의 스크린리더용 요약 문구를 만드는 순수 함수.
 *
 * 로또공 6개(각각 개별 접근성 라벨 보유) + 점수 + 메타 칩 3개 + 배지 최대 4개 + 설명
 * 문단이 전부 따로 초점을 잡으면 스크린리더로 카드 하나를 이해하는 데 스와이프를 15번
 * 넘게 해야 한다. 이 "읽기 전용 정보" 구간을 하나의 접근성 그룹으로 묶어 한 번에
 * 읽어주기 위해 카드가 이 함수의 결과를 accessibilityLabel로 사용한다(실제 액션인
 * 저장/구매예정/공유 버튼은 개별 접근성을 그대로 유지한다).
 *
 * react-native에 의존하지 않는 순수 문자열 조합 로직이라 별도 파일로 분리했다 —
 * 컴포넌트 파일(.tsx) 안에 두면 react-native 의존성 때문에 순수 함수 단위 테스트
 * (`unit` jest 프로젝트, node 환경)로 검증하기 어렵다.
 */
import type { GeneratedGame } from "./types";
import type { ResultBadge } from "./resultBadges";

export function buildGameAccessibilitySummary(
  game: Pick<GeneratedGame, "numbers" | "score" | "metadata">,
  badges: ResultBadge[] | undefined,
  explanation: string | undefined
): string {
  const evenCount = 6 - game.metadata.oddCount;
  const parts: string[] = [`번호 ${game.numbers.join(", ")}`];

  if (game.score) {
    parts.push(`추천 적합도 ${Math.round(game.score.totalScore)}점`);
  }

  // 시각적으로 보여지는 칩 표기("홀짝 3:3")는 그대로 두고, 음성으로 들었을 때 자연스럽도록
  // 별도로 풀어서 구성한다(":" 같은 기호는 TTS로 어색하게 읽히기 쉽다).
  parts.push(
    `홀수 ${game.metadata.oddCount}개, 짝수 ${evenCount}개, 합계 ${game.metadata.sum}, ` +
      (game.metadata.maxConsecutiveLength >= 2 ? "연속번호 있음" : "연속번호 없음")
  );

  if (badges && badges.length > 0) {
    parts.push(badges.map((b) => b.label).join(", "));
  }

  if (explanation) {
    parts.push(explanation);
  }

  return parts.join(". ");
}
