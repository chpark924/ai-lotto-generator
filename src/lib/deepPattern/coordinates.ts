/**
 * 딥 패턴 탐색 — 로또 용지 좌표 모델 (Deep Pattern Engine Master Spec §3).
 *
 * 실제 로또(6/45) 마킹 용지의 번호 배열은 7열×7행이다(마지막 줄은 43~45 3칸만 사용, 나머지
 * 4칸은 비어 있음). 이 파일은 1~45 번호를 그 고정 좌표계에 deterministic하게 매핑하고,
 * canonical path(번호 오름차순으로 연결)를 만든다. 이 모듈은 React Native에 의존하지 않는
 * 순수 함수만 담아 시각화 컴포넌트(PatternBoard 등)와 유닛 테스트 양쪽에서 그대로 재사용한다.
 */

export const PAPER_COLUMNS = 7;
export const PAPER_ROWS = 7;
export const PAPER_TOTAL_NUMBERS = 45;

export interface PaperPosition {
  /** 1-indexed 행 (위→아래) */
  row: number;
  /** 1-indexed 열 (왼→오른) */
  col: number;
}

export interface PaperCell extends PaperPosition {
  number: number;
}

/** 번호 n(1~45)의 용지 좌표를 계산한다. 왼쪽 위부터 가로로 채워나가는 배치. */
export function getPaperPosition(n: number): PaperPosition {
  if (!Number.isInteger(n) || n < 1 || n > PAPER_TOTAL_NUMBERS) {
    throw new Error(`번호는 1~${PAPER_TOTAL_NUMBERS} 사이의 정수여야 합니다: ${n}`);
  }
  const zeroBased = n - 1;
  return {
    col: (zeroBased % PAPER_COLUMNS) + 1,
    row: Math.floor(zeroBased / PAPER_COLUMNS) + 1,
  };
}

/** 1~45 전체 번호의 좌표 목록 (시각화에서 빈 칸 없이 그리드를 그릴 때 사용). */
export function getAllPaperCells(): PaperCell[] {
  return Array.from({ length: PAPER_TOTAL_NUMBERS }, (_, i) => {
    const number = i + 1;
    return { number, ...getPaperPosition(number) };
  });
}

/**
 * Canonical path(명세 §3): 순서에 의존하는 Path Feature는 항상 "번호 오름차순 연결"로
 * 버전 고정한다. 입력 순서와 무관하게 항상 같은 결과를 반환한다.
 */
export function buildCanonicalPath(numbers: number[]): PaperPosition[] {
  return [...numbers].sort((a, b) => a - b).map(getPaperPosition);
}

export interface PixelPoint {
  x: number;
  y: number;
}

/** 좌표를 셀 중심 픽셀 좌표로 변환한다. */
export function toPixel(position: PaperPosition, cellSize: number, margin: number): PixelPoint {
  return {
    x: margin + (position.col - 0.5) * cellSize,
    y: margin + (position.row - 0.5) * cellSize,
  };
}

/** 정사각형 보드의 한 변 길이(px)를 계산한다. */
export function getBoardSize(cellSize: number, margin: number): number {
  return margin * 2 + Math.max(PAPER_COLUMNS, PAPER_ROWS) * cellSize;
}
