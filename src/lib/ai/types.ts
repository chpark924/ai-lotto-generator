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
}
