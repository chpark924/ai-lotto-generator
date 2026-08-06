/**
 * 결과 화면(GeneratedGameCard)에 붙는 짧은 "전문 분석 배지".
 *
 * 원칙(기획서 23장과 동일): 장식용 문구가 아니라, 실제로 그 조합이 만들어진 방식/조건과
 * 항상 일치해야 한다. 아래 4개 배지는 전부 이미 존재하는 실제 로직(탐색 반복 횟수, 인기번호
 * 회피 여부, 여러 게임 간 중복 회피, 과거 당첨 통계)을 그대로 서술할 뿐 새로운 주장을 하지
 * 않는다. "커버링 설계"처럼 이 앱이 실제로 보장하지 않는 수학적 성질(예: 특정 t개 번호 조합을
 * 반드시 포함하는 조합론적 보장)은 의도적으로 배지화하지 않았다 — 실제 로직은 게임 간 4개
 * 이상 중복을 배제하는 소프트한 다양성 휴리스틱일 뿐이라, "휠링(wheeling)"이라는 이름도
 * 엄밀한 보장을 주장하지 않는 수준으로만 표현한다.
 */
import type { GeneratedGame, GenerationRequest } from "./types";

export interface ResultBadge {
  key: "MONTE_CARLO" | "EV_OPTIMIZED" | "WHEELING" | "SAKAI_PATTERN";
  label: string;
}

function formatIterationCount(n: number): string {
  if (n >= 10000) {
    const man = n / 10000;
    return `${Number.isInteger(man) ? man : man.toFixed(1)}만 회`;
  }
  return `${n.toLocaleString()}회`;
}

/**
 * AI 조합 탐색은 무작위 후보를 대량 생성해 점수로 평가한 뒤 상위권을 채택하는 방식이라
 * (generator.ts의 generateAiSearchGames), 반복 횟수가 1보다 클 때는 몬테카를로 방식의
 * 무작위 표본 탐색이라고 서술해도 정확하다. "바로 생성"(반복 1회)은 반복 표본 자체가
 * 없어서 제외한다.
 */
export function getMonteCarloBadge(
  request: Pick<GenerationRequest, "mode" | "searchCount">
): ResultBadge | null {
  if (request.mode !== "AI_SEARCH") return null;
  const iterations = request.searchCount ?? 0;
  if (iterations <= 1) return null;
  return { key: "MONTE_CARLO", label: `몬테카를로 탐색 · ${formatIterationCount(iterations)}` };
}

/**
 * "인기번호 회피"가 켜져 있으면 실제로 흔히 선택되는 번호를 피하도록 점수에 반영된다
 * (scoring.ts의 userUniquenessScore). 당첨 확률 자체는 바뀌지 않지만, 당첨 시 같은 번호를
 * 고른 다른 당첨자와 상금을 나눠 받을 가능성이 낮아져 "기대값(EV)"이 높아지는 방향의
 * 최적화라는 점에서 정확한 서술이다.
 */
export function getEvOptimizationBadge(
  request: Pick<GenerationRequest, "mode" | "avoidPopularNumbers">
): ResultBadge | null {
  if (request.mode !== "AI_SEARCH" || !request.avoidPopularNumbers) return null;
  return { key: "EV_OPTIMIZED", label: "EV 최적화" };
}

/**
 * AI 조합 탐색에서 여러 게임을 함께 생성할 때만, 서로 4개 이상 겹치는 조합을 배제하며
 * 채택한다(generator.ts). 여러 게임에 걸쳐 번호 풀을 넓게 분산시킨다는 점에서 "휠링" 원리와
 * 같은 방향이지만, 특정 조합을 반드시 포함하도록 수학적으로 보장하는 정식 휠링 시스템은
 * 아니므로 문구도 "분산"까지만 표현한다. 게임이 1개면 겹칠 다른 게임이 없어 의미가 없어
 * 제외한다.
 */
export function getWheelingBadge(
  request: Pick<GenerationRequest, "mode" | "gameCount">
): ResultBadge | null {
  if (request.mode !== "AI_SEARCH" || request.gameCount < 2) return null;
  return { key: "WHEELING", label: "휠링 방식 분산" };
}

export interface SakaiAnalysisInputs {
  /** 최근 26주 표본 기준 출현 3~4회(평균권) 번호 (drawStats.ts의 getSakaiAverageFrequencyNumbers). */
  averageFrequencyNumbers: number[];
  /** 직전 회차(가장 최근 당첨) 번호 6개 ("이월수" 후보). */
  previousDrawNumbers: number[];
}

/**
 * "사카이 분석법": 최근 26주 평균권 번호를 최소 1개, 직전 회차 번호("이월수")를 최소 1개
 * 함께 포함하는 조합에 그 패턴이 우연히든 의도적이든 실제로 들어있다는 사실만 서술한다.
 * 어떤 방식으로 생성됐든(모드 무관) 결과 번호 자체의 통계적 속성이라 조건에 mode 제한을
 * 두지 않는다. 두 데이터 중 하나라도 못 불러왔으면(표본 없음) 조용히 배지를 생략한다.
 */
export function getSakaiPatternBadge(
  numbers: number[],
  inputs: SakaiAnalysisInputs | null
): ResultBadge | null {
  if (!inputs) return null;
  const { averageFrequencyNumbers, previousDrawNumbers } = inputs;
  if (averageFrequencyNumbers.length === 0 || previousDrawNumbers.length === 0) return null;

  const hasAverageFrequencyNumber = numbers.some((n) => averageFrequencyNumbers.includes(n));
  const hasCarryoverNumber = numbers.some((n) => previousDrawNumbers.includes(n));
  if (!hasAverageFrequencyNumber || !hasCarryoverNumber) return null;

  return { key: "SAKAI_PATTERN", label: "사카이 분석 패턴" };
}

/** 위 4개 배지 판정을 한 번에 모아 반환한다(적용되지 않는 배지는 결과에서 빠진다). */
export function computeResultBadges(
  game: Pick<GeneratedGame, "numbers">,
  request: GenerationRequest,
  sakaiInputs: SakaiAnalysisInputs | null
): ResultBadge[] {
  return [
    getMonteCarloBadge(request),
    getEvOptimizationBadge(request),
    getWheelingBadge(request),
    getSakaiPatternBadge(game.numbers, sakaiInputs),
  ].filter((badge): badge is ResultBadge => badge !== null);
}
