import {
  PAPER_COLUMNS,
  PAPER_ROWS,
  PAPER_TOTAL_NUMBERS,
  getPaperPosition,
  getAllPaperCells,
  buildCanonicalPath,
  toPixel,
  getBoardSize,
} from "../src/lib/deepPattern/coordinates";

describe("딥 패턴 — 로또 용지 좌표 매핑", () => {
  it("실제 마킹 용지 배열(7열×7행) 상수", () => {
    expect(PAPER_COLUMNS).toBe(7);
    expect(PAPER_ROWS).toBe(7);
    expect(PAPER_TOTAL_NUMBERS).toBe(45);
  });

  it("알려진 번호의 좌표가 7열 기준 계산과 일치한다", () => {
    expect(getPaperPosition(1)).toEqual({ row: 1, col: 1 });
    expect(getPaperPosition(7)).toEqual({ row: 1, col: 7 });
    expect(getPaperPosition(8)).toEqual({ row: 2, col: 1 });
    expect(getPaperPosition(45)).toEqual({ row: 7, col: 3 });
  });

  it("범위를 벗어난 번호는 에러를 던진다", () => {
    expect(() => getPaperPosition(0)).toThrow();
    expect(() => getPaperPosition(46)).toThrow();
    expect(() => getPaperPosition(1.5)).toThrow();
  });

  it("getAllPaperCells는 1~45 번호를 중복/누락 없이 정확히 45개 반환한다", () => {
    const cells = getAllPaperCells();
    expect(cells).toHaveLength(45);
    const numbers = cells.map((c) => c.number).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 45 }, (_, i) => i + 1));
    for (const cell of cells) {
      expect(cell.row).toBeGreaterThanOrEqual(1);
      expect(cell.row).toBeLessThanOrEqual(7);
      expect(cell.col).toBeGreaterThanOrEqual(1);
      expect(cell.col).toBeLessThanOrEqual(7);
    }
  });

  it("마지막 행(7행)은 43~45 3칸만 사용한다", () => {
    const lastRow = getAllPaperCells().filter((c) => c.row === 7);
    expect(lastRow.map((c) => c.number).sort((a, b) => a - b)).toEqual([43, 44, 45]);
  });

  it("buildCanonicalPath는 입력 순서와 무관하게 번호 오름차순으로 연결한다", () => {
    const ascending = buildCanonicalPath([8, 19, 22, 27, 30, 31]);
    const shuffled = buildCanonicalPath([30, 8, 31, 22, 19, 27]);
    expect(ascending).toEqual(shuffled);
    expect(ascending).toEqual([
      getPaperPosition(8),
      getPaperPosition(19),
      getPaperPosition(22),
      getPaperPosition(27),
      getPaperPosition(30),
      getPaperPosition(31),
    ]);
  });

  it("toPixel/getBoardSize는 셀 중심 좌표를 보드 크기 안에 배치한다", () => {
    const boardSize = getBoardSize(30, 14);
    expect(boardSize).toBe(14 * 2 + 7 * 30);
    const center = toPixel({ row: 1, col: 1 }, 30, 14);
    expect(center.x).toBeGreaterThan(0);
    expect(center.x).toBeLessThan(boardSize);
    expect(center.y).toBeGreaterThan(0);
    expect(center.y).toBeLessThan(boardSize);
  });
});
