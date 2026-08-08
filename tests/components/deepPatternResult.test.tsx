/**
 * 화면 렌더링 테스트: app/generate/deep-pattern-result.tsx (딥 패턴 탐색 결과 리스트).
 *
 * 확인하는 것: 배치(batch)가 있을 때 카드마다 "N번 패턴"/패턴 독창성이 실제로 표시되는지,
 * 카드를 누르면 selectIndex + 상세 화면 이동이 이어지는지, "다시 생성"이 엔진을 다시
 * 호출해 화면을 갱신하는지, "모두 저장"이 저장 함수를 호출하는지, 배치가 없을 때(empty
 * state)도 화면이 죽지 않고 안내 문구로 대체되는지.
 */
import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import DeepPatternResultScreen from "../../app/generate/deep-pattern-result";
import { useDeepPatternStore } from "../../src/state/deepPatternStore";
import * as engine from "../../src/lib/deepPattern/engine";
import * as storage from "../../src/lib/storage";
import type { DeepPatternBatch, DeepPatternRecommendation } from "../../src/lib/deepPattern/types";

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  Stack: { Screen: () => null },
}));

jest.mock("../../src/lib/deepPattern/engine", () => ({
  recommendDeepPatterns: jest.fn(),
}));

jest.mock("../../src/lib/storage", () => ({
  saveTicket: jest.fn(),
}));

function makeRec(overrides: Partial<DeepPatternRecommendation> = {}): DeepPatternRecommendation {
  return {
    numbers: [1, 2, 3, 4, 5, 6],
    patternIndex: 1,
    noveltyPercentile: 1.23,
    structuralVoidLevel: "HIGH",
    scalePersistenceLevel: "HIGH",
    temporalPersistenceLevel: "MID",
    validationPercentile: 92,
    nearestHistoricalDrawNumber: 1234,
    nearestHistoricalSimilarityPercent: 50,
    engineVersion: "DPE-TEST",
    atlasVersion: "ATLAS-TEST",
    historyThroughDrawNumber: 1235,
    ...overrides,
  };
}

function makeBatch(recs: DeepPatternRecommendation[]): DeepPatternBatch {
  return { requestId: "req_test", generatedAt: new Date().toISOString(), recommendations: recs };
}

describe("DeepPatternResultScreen (딥 패턴 탐색 결과)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useDeepPatternStore.setState({ batch: null, selectedIndex: 0 });
  });

  it("배치가 없으면 안내 문구가 나오고, 버튼을 누르면 소개 화면으로 이동한다", () => {
    render(<DeepPatternResultScreen />);
    expect(screen.getByText("표시할 딥 패턴 결과가 없습니다.")).toBeTruthy();
    fireEvent.press(screen.getByText("딥 패턴 탐색으로 이동"));
    expect(mockReplace).toHaveBeenCalledWith("/generate/deep-pattern");
  });

  it("배치가 있으면 각 카드에 패턴 번호와 패턴 독창성이 나타나고, 카드를 누르면 상세로 이동한다", () => {
    const batch = makeBatch([
      makeRec({ patternIndex: 1, noveltyPercentile: 1.23 }),
      makeRec({ patternIndex: 2, noveltyPercentile: 4.56, numbers: [10, 20, 30, 40, 41, 42] }),
    ]);
    useDeepPatternStore.setState({ batch, selectedIndex: 0 });

    render(<DeepPatternResultScreen />);

    expect(screen.getByText("1번 패턴")).toBeTruthy();
    expect(screen.getByText("2번 패턴")).toBeTruthy();
    expect(screen.getByText("패턴 독창성 상위 1.23%")).toBeTruthy();

    fireEvent.press(screen.getByLabelText(/2번 패턴, 번호/));
    expect(useDeepPatternStore.getState().selectedIndex).toBe(1);
    expect(mockPush).toHaveBeenCalledWith("/generate/deep-pattern-detail");
  });

  it("'다시 생성'을 누르면 엔진을 다시 호출해 스토어(및 화면)를 갱신한다", async () => {
    const initialBatch = makeBatch([makeRec({ patternIndex: 1 })]);
    const nextBatch = makeBatch([makeRec({ patternIndex: 1, numbers: [7, 8, 9, 10, 11, 12] })]);
    useDeepPatternStore.setState({ batch: initialBatch, selectedIndex: 0 });
    (engine.recommendDeepPatterns as jest.Mock).mockResolvedValue(nextBatch);

    render(<DeepPatternResultScreen />);
    fireEvent.press(screen.getByLabelText("다시 생성"));

    await waitFor(() => {
      expect(engine.recommendDeepPatterns).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(useDeepPatternStore.getState().batch).toEqual(nextBatch);
    });
  });

  it("'N게임 모두 저장'을 누르면 배치의 게임 수만큼 saveTicket을 호출하고 완료 알림을 띄운다", async () => {
    const batch = makeBatch([makeRec({ patternIndex: 1 }), makeRec({ patternIndex: 2, numbers: [10, 20, 30, 40, 41, 42] })]);
    useDeepPatternStore.setState({ batch, selectedIndex: 0 });
    (storage.saveTicket as jest.Mock).mockResolvedValue(undefined);
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

    render(<DeepPatternResultScreen />);
    fireEvent.press(screen.getByLabelText("2게임 모두 저장"));

    await waitFor(() => {
      expect(storage.saveTicket).toHaveBeenCalledTimes(2);
    });
    expect(alertSpy).toHaveBeenCalledWith("저장했습니다.", expect.stringContaining("2게임"));
  });
});
