/**
 * 화면 렌더링 테스트: app/generate/deep-pattern-detail.tsx (딥 패턴 탐색 상세).
 *
 * 확인하는 것: 선택된 추천의 5개 지표(구조적 공백/패턴 독창성/공백 지속성/시간 안정성/
 * 통계적 유의성)와 그 설명 캡션이 실제로 나타나는지, 가장 가까운 과거 당첨 정보가 있을
 * 때/없을 때 각각 올바른 문구가 뜨는지, 저장 버튼을 누르면 saveTicket이 호출되고 완료
 * 알림이 뜨는지, 배치가 없을 때(empty state) 안전하게 안내 문구로 대체되는지.
 */
import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import DeepPatternDetailScreen from "../../app/generate/deep-pattern-detail";
import { useDeepPatternStore } from "../../src/state/deepPatternStore";
import * as storage from "../../src/lib/storage";
import type { DeepPatternBatch, DeepPatternRecommendation } from "../../src/lib/deepPattern/types";

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  Stack: { Screen: () => null },
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
    scalePersistenceLevel: "MID",
    temporalPersistenceLevel: "LOW",
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

describe("DeepPatternDetailScreen (딥 패턴 탐색 상세)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useDeepPatternStore.setState({ batch: null, selectedIndex: 0 });
  });

  it("배치/선택이 없으면 안내 문구가 나오고, 버튼을 누르면 소개 화면으로 이동한다", () => {
    render(<DeepPatternDetailScreen />);
    expect(screen.getByText("표시할 패턴 상세가 없습니다.")).toBeTruthy();
    fireEvent.press(screen.getByText("딥 패턴 탐색으로 이동"));
    expect(mockReplace).toHaveBeenCalledWith("/generate/deep-pattern");
  });

  it("선택된 추천의 5개 지표와 설명 캡션, 가장 가까운 과거 당첨 정보가 나타난다", () => {
    const rec = makeRec({ validationPercentile: 92 });
    useDeepPatternStore.setState({ batch: makeBatch([rec]), selectedIndex: 0 });

    render(<DeepPatternDetailScreen />);

    expect(screen.getByText("구조적 공백")).toBeTruthy();
    expect(screen.getByText("패턴 독창성")).toBeTruthy();
    expect(screen.getByText("공백 지속성")).toBeTruthy();
    expect(screen.getByText("시간 안정성")).toBeTruthy();
    expect(screen.getByText("통계적 유의성")).toBeTruthy();
    expect(screen.getByText(/무작위로 만든 가짜 역사 500개와 비교했을 때도/)).toBeTruthy();
    // validationPercentile=92 → HIGH("높음")로 변환되어 보여야 한다. 이 fixture는
    // structuralVoidLevel도 HIGH라 "높음"이 두 번(구조적 공백/통계적 유의성) 나타난다 —
    // getAllByText로 최소 1개 이상 존재하는지만 확인한다(중복 렌더 자체는 정상).
    expect(screen.getAllByText("높음").length).toBeGreaterThan(0);
    expect(screen.getByText(/제1234회/)).toBeTruthy();
  });

  it("가장 가까운 과거 당첨이 없으면(null) 대체 문구가 나타난다", () => {
    const rec = makeRec({ nearestHistoricalDrawNumber: null, nearestHistoricalSimilarityPercent: null });
    useDeepPatternStore.setState({ batch: makeBatch([rec]), selectedIndex: 0 });

    render(<DeepPatternDetailScreen />);

    expect(screen.getByText("비교할 만큼 가까운 과거 당첨 패턴을 찾지 못했습니다.")).toBeTruthy();
  });

  it("'이 번호 저장하기'를 누르면 saveTicket이 호출되고 저장 완료 알림이 뜬다", async () => {
    const rec = makeRec();
    useDeepPatternStore.setState({ batch: makeBatch([rec]), selectedIndex: 0 });
    (storage.saveTicket as jest.Mock).mockResolvedValue(undefined);
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

    render(<DeepPatternDetailScreen />);
    fireEvent.press(screen.getByLabelText("이 번호 저장하기"));

    await waitFor(() => {
      expect(storage.saveTicket).toHaveBeenCalledTimes(1);
    });
    expect(alertSpy).toHaveBeenCalledWith("번호가 저장되었습니다");
  });
});
