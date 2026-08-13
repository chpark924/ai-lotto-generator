/**
 * 화면 렌더링 테스트: app/generate/deep-pattern.tsx (딥 패턴 탐색 소개+생성 화면).
 *
 * 이 테스트가 잡으려는 회귀: 소개 문구/경고 문구가 실제로 화면에 나타나는지, "패턴 분석
 * 시작하기"를 눌렀을 때 엔진 호출 → 스토어 저장 → 결과 화면으로 navigate까지 실제로
 * 이어지는지. 순수 함수 테스트(deepPatternEngine.test.ts 등)만으로는 "화면이 버튼 핸들러를
 * 아예 안 부른다"거나 "스토어에 안 담는다" 같은 배선(wiring) 버그를 못 잡는다 —
 * QA_LOG 2026-08-04(lab.tsx dead-code 버그) 때와 같은 이유로 이 프로젝트를 둔다.
 *
 * recommendDeepPatterns()는 실제 Atlas(814만 조합 기반)를 쓰는 무거운 경로라, 여기서는
 * 엔진 자체의 정확성이 아니라 "화면이 그 결과를 제대로 받아서 처리하는지"만 확인하면
 * 되므로 mock으로 대체한다(엔진 자체 검증은 tests/deepPatternEngine.test.ts가 담당).
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import DeepPatternIntroScreen from "../../app/generate/deep-pattern";
import { useDeepPatternStore } from "../../src/state/deepPatternStore";
import * as engine from "../../src/lib/deepPattern/engine";
import type { DeepPatternBatch } from "../../src/lib/deepPattern/types";

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  Stack: { Screen: () => null },
}));

jest.mock("../../src/lib/deepPattern/engine", () => ({
  recommendDeepPatterns: jest.fn(),
  // deep-pattern.tsx가 마운트될 때(useEffect)와 "패턴 분석 시작하기"를 누를 때 각각
  // refreshAtlasIfStale()/snapFrequentPatternRatio()도 실제로 호출한다(QA_LOG 77~79번,
  // 72번) — 이 화면 전체를 모킹하는 이상 엔진 모듈에서 실제로 export되는 함수는 전부 같이
  // 모킹해줘야 "is not a function" TypeError 없이 렌더링/버튼 클릭이 끝까지 진행된다.
  refreshAtlasIfStale: jest.fn(() => Promise.resolve()),
  snapFrequentPatternRatio: jest.fn((value: number) => value),
}));

function makeFixtureBatch(): DeepPatternBatch {
  return {
    requestId: "req_test",
    generatedAt: new Date().toISOString(),
    recommendations: [
      {
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
      },
    ],
  };
}

describe("DeepPatternIntroScreen (딥 패턴 탐색 소개)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useDeepPatternStore.setState({ batch: null, selectedIndex: 0 });
  });

  it("소개 문구가 화면에 나타난다", () => {
    render(<DeepPatternIntroScreen />);
    expect(screen.getByText(/814만 개 조합/)).toBeTruthy();
    // 예전에는 이 화면에도 별도 확률 무관 경고 박스가 있었지만, QA_LOG.md 71번 항목에서
    // deep-pattern-detail.tsx(상세 화면)에 동일 취지의 안내가 이미 있어 중복이라는 피드백에
    // 따라 의도적으로 제거됐다 — 여기서 그 문구를 다시 기대하면 안 된다.
  });

  it("'패턴 분석 시작하기'를 누르면 엔진 결과가 스토어에 저장되고 결과 화면으로 이동한다", async () => {
    const fixture = makeFixtureBatch();
    (engine.recommendDeepPatterns as jest.Mock).mockResolvedValue(fixture);

    render(<DeepPatternIntroScreen />);
    fireEvent.press(screen.getByText("패턴 분석 시작하기"));

    await waitFor(
      () => {
        expect(mockPush).toHaveBeenCalledWith("/generate/deep-pattern-result");
      },
      { timeout: 5000 }
    );

    expect(useDeepPatternStore.getState().batch).toEqual(fixture);
  });
});
