/**
 * 딥 패턴 탐색 공용 타입.
 *
 * Deep Pattern Engine Master Spec §43 "권장 Boundary API"의 DeepPatternRecommendation을
 * 그대로 옮긴 TS 버전이다. 명세는 Android/Kotlin을 전제로 작성됐지만 이 앱은 RN/Expo/TS
 * 프로젝트라(Phase 0 audit 결과), Kotlin data class 대신 이 인터페이스가 그 경계 역할을 한다.
 *
 * 중요: Basin/DeepVoid 같은 엔진 내부 개념은 이 타입 밖으로 나가지 않는다. 화면에는
 * patternIndex("N번 패턴")처럼 사용자 언어로 이미 번역된 필드만 노출한다.
 */

export type DeepPatternLevel = "LOW" | "MID" | "HIGH";

export interface DeepPatternRecommendation {
  /** 6개, 오름차순, 1~45, 중복 없음 — 기존 GeneratedGame.numbers와 동일한 계약. */
  numbers: number[];
  /** 이 배치(batch) 안에서의 표시 순번(1~5). 내부 Basin ID를 사용자에게 그대로 보여주지 않는다. */
  patternIndex: number;
  /** "패턴 독창성: 상위 X%"에 쓰는 값 (낮을수록 희소). */
  noveltyPercentile: number;
  structuralVoidLevel: DeepPatternLevel;
  scalePersistenceLevel: DeepPatternLevel;
  temporalPersistenceLevel: DeepPatternLevel;
  /**
   * 명세 §14 Null Simulation/Skeptic Engine + 다중검정 보정(family-wise, basin 전체 중 최선
   * 대비) 결과를 0~100 percentile로 표현한 값. 높을수록 "무작위로 생성한 가짜 역사들과 비교해도
   * 이 정도 결손은 드물다"는 뜻이고, 낮으면(특히 50 미만) 무작위 변동과 통계적으로 구분하기
   * 어렵다는 뜻이다 — 이 경우도 실패가 아니라 정직한 결과로 그대로 보여준다(§17).
   */
  validationPercentile: number;
  /** 가장 가까운 과거 당첨 회차. 이력이 아직 없거나 계산 불가하면 null. */
  nearestHistoricalDrawNumber: number | null;
  /** 위 회차와의 패턴 유사도(0~100). nearestHistoricalDrawNumber가 null이면 함께 null. */
  nearestHistoricalSimilarityPercent: number | null;
  engineVersion: string;
  atlasVersion: string;
  /** 이 배치가 반영한 마지막 회차 번호. */
  historyThroughDrawNumber: number;
}

export interface DeepPatternBatch {
  requestId: string;
  recommendations: DeepPatternRecommendation[];
  generatedAt: string;
}

/**
 * status()의 반환 타입 (명세 §43). v1은 항상 "MOCK"만 반환한다 — Research/Atlas Builder
 * (Phase 2~4)가 끝나기 전까지는 실제 엔진이 존재하지 않는다는 뜻을 화면단에서도 숨기지 않는다.
 */
export type DeepPatternEngineStatus = "MOCK" | "READY" | "UNAVAILABLE";
