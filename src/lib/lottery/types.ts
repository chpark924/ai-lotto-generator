/**
 * 공통 타입 정의
 * 기획서 5.1 공통 입력 모델을 그대로 따른다.
 * 모든 생성은 클라이언트(기기) 내부에서 수행되며 서버/AI 호출이 없다.
 */

export type GenerationMode =
  | "PURE_RANDOM"
  | "EXCLUSION"
  | "AI_SEARCH"
  | "LUCKY_PROFILE"
  | "DICE"
  | "DESTINY_GOD";

export type ConsecutiveRule =
  | "ANY"
  | "NONE"
  | "ALLOW_TWO"
  | "ALLOW_THREE"
  | "REQUIRE_TWO"
  | "REQUIRE_THREE";

export interface GenerationRequest {
  mode: GenerationMode;
  gameCount: number;

  excludedNumbers: number[];
  requiredNumbers: number[];
  preferredNumbers: number[];

  consecutiveRule: ConsecutiveRule;

  oddCount?: number;
  lowNumberCount?: number;
  minSum?: number;
  maxSum?: number;

  /** 1(즉시 생성) | 10000(AI 탐색) | 100000(AI 정밀 탐색) */
  searchCount?: 1 | 10000 | 100000;

  avoidPopularNumbers?: boolean;
  avoidMySavedNumbers?: boolean;
  popularityAvoidanceStrength?: number;
}

export interface CandidateScore {
  totalScore: number;
  conditionMatchScore: number;
  diversityScore: number;
  userUniquenessScore: number;
  personalNoveltyScore: number;
  balanceScore: number;
}

export type NumberSource =
  | "RANDOM"
  | "BIRTH_MONTH"
  | "BIRTH_DAY"
  | "BIRTH_SUM"
  | "PREFERRED"
  | "REQUIRED";

export interface NumberReason {
  number: number;
  source: NumberSource;
  description: string;
}

export interface GameMetadata {
  oddCount: number;
  lowNumberCount: number;
  sum: number;
  maxConsecutiveLength: number;
  sameEndingMaxCount: number;
  sectionCounts: number[];
}

export interface GeneratedGame {
  id: string;
  numbers: number[];
  mode: GenerationMode;
  score?: CandidateScore;
  metadata: GameMetadata;
  numberReasons?: NumberReason[];
}

export interface SimulationSummary {
  requestedIterations: number;
  completedIterations: number;
  uniqueCandidateCount: number;
  validCandidateCount: number;
  coveragePercent: number;
}

export interface ProbabilitySummary {
  uniqueGameCount: number;
  firstPrizeFraction: string;
  firstPrizePercent: number;
}

export interface GenerationResult {
  requestId: string;
  games: GeneratedGame[];
  simulation?: SimulationSummary;
  probability: ProbabilitySummary;
  disclaimer: string;
  /** 운명의 신 등 시나리오 기반 생성의 요약 안내 (예: "목표 시나리오: 단독 당첨자 1명"). */
  resultNotice?: string;
}
