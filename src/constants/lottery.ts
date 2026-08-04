/** 로또 6/45 공식 번호 색상 구간 (1~10 노랑, 11~20 파랑, 21~30 빨강, 31~40 회색, 41~45 초록) */
export function getBallColor(number: number): string {
  if (number <= 10) return "#FBC400";
  if (number <= 20) return "#69C8F2";
  if (number <= 30) return "#FF7272";
  if (number <= 40) return "#AAAAAA";
  return "#B0D840";
}

export const TOTAL_COMBINATIONS = 8_145_060;

export const CONSECUTIVE_RULE_LABELS: Record<string, string> = {
  ANY: "상관없음",
  NONE: "연속번호 없음",
  ALLOW_TWO: "2연속 허용",
  ALLOW_THREE: "3연속 허용",
  REQUIRE_TWO: "2연속 반드시 포함",
  REQUIRE_THREE: "3연속 반드시 포함",
};

export const EXCLUSION_PRESETS = [6, 10, 15, 20, 25, 30];

export const SEARCH_STRENGTH_OPTIONS: { label: string; value: 1 | 30000 | 100000 | 1000000 }[] = [
  { label: "바로 생성", value: 1 },
  { label: "3만 회 탐색", value: 30000 },
  { label: "10만 회 탐색", value: 100000 },
  { label: "100만 회 부스터 탐색", value: 1000000 },
];

export const DESTINY_TARGET_OPTIONS: { label: string; value: "ONE" | "FIVE" | "TEN" | "TWENTY" | "CHAOS" | "GODS_WILL" }[] = [
  { label: "당첨자 1명", value: "ONE" },
  { label: "당첨자 5명", value: "FIVE" },
  { label: "당첨자 10명", value: "TEN" },
  { label: "당첨자 20명", value: "TWENTY" },
  { label: "30명 이상 대혼돈", value: "CHAOS" },
  { label: "신의 뜻에 맡기기", value: "GODS_WILL" },
];
