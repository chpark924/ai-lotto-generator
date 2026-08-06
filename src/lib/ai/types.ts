import type { GenerationMode } from "../lottery/types";

/** 기획서 19.1: AI에는 구조화된 특징만 전달하고 개인정보 원문은 절대 보내지 않는다. */
export interface GameFeatures {
  mode: GenerationMode;
  numbers: number[];
  oddEven: string; // 예: "3:3"
  sum: number;
  hasConsecutive: boolean;
  popularNumberCount: number;
  birthdayRangeCount: number; // 1~31 범위 번호 개수
  similarityToSavedNumbers: number; // 0~1
  /**
   * 최근 4주(회차) 실제 당첨번호와 겹치는 개수. 당첨번호를 불러오지 못했으면 null
   * (이 경우 설명 문구는 popularNumberCount 기반 문장으로 대체된다).
   */
  recentWinningMatchCount: number | null;
  /**
   * "끝수 스프레드 최적화"가 적용된 조합인지(AI 조합 탐색의 3만 회/10만 회 탐색에서만
   * 내부적으로 활성화됨 — scoring.ts의 isLastDigitSpreadOptimizationActive 참고).
   */
  lastDigitSpreadOptimized: boolean;
}
