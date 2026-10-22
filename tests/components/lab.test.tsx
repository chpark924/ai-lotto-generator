/**
 * 화면 렌더링 테스트: app/(tabs)/lab.tsx.
 *
 * 이 테스트를 추가한 이유: 2026-08-04 재점검에서 `loadLabData()` 안에 있던 조기
 * `return`으로 인해 "내 번호 분석"·"이번 주 리포트" 계산 코드 전체가 도달 불가능한
 * 죽은 코드였던 버그를 발견했다. `src/lib`의 순수 함수 테스트는 전부 통과하고 있었는데도
 * 이 버그를 잡지 못한 이유는, 문제가 "함수 자체의 계산 로직"이 아니라 "그 계산이 애초에
 * 호출되는지 여부"였기 때문이다 — 화면을 실제로 렌더링해서 최종 결과물(화면에 뭐가
 * 보이는지)까지 확인해야만 이런 종류의 회귀를 잡을 수 있다.
 *
 * 그래서 이 테스트는 저장된 조합 이력(getGenerationHistory)과 최근 저장한 티켓(getTickets)을
 * 미리 채워두고, 로또 연구소 화면이 로딩을 마친 뒤 "내 번호 분석"·"이번 주 리포트" 카드가
 * 실제로 화면에 나타나는지를 확인한다. 이 테스트는 수정 전 코드에서는 실패했을 것이다.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import LabScreen from "../../app/(tabs)/lab";
import * as draws from "../../src/lib/draws";
import * as storage from "../../src/lib/storage";
import type { WinningDraw } from "../../src/lib/draws";
import type { SavedTicket } from "../../src/lib/storage";

// jest.mock()은 babel-jest에 의해 파일 최상단으로 호이스팅되므로, 아래 import 선언보다
// 나중에 적어도 실제 실행 순서에는 영향이 없다(require() 대신 ESM import를 쓰기 위한 정리).
//
// 주의: "../../src/lib/draws" 바렐(index.ts)을 통째로 jest.requireActual하면 안 된다 —
// 그 바렐은 drawCache.ts도 함께 export하는데, drawCache.ts는 storage.ts를 거쳐 실제
// AsyncStorage 네이티브 모듈을 불러온다. requireActual은 "완전히 실제 모듈"을 강제로
// 불러오는 API라 jest 목(mock) 처리를 전부 우회해버리므로, setupFiles에 등록해 둔
// AsyncStorage jest mock까지 같이 건너뛰어 "NativeModule: AsyncStorage is null" 에러가
// 난다(실제로 겪은 문제). computeNumberFrequencies 등 순수 계산 함수만 필요하므로,
// AsyncStorage와 무관한 drawStats.ts 서브모듈만 콕 집어 requireActual한다.
jest.mock("../../src/lib/draws", () => {
  const drawStats = jest.requireActual("../../src/lib/draws/drawStats");
  // 2026-10-22: "번호 커버리지" 카드가 rank.ts의 RANK_LABELS/computeRank도 바렐에서 가져온다.
  // drawStats.ts만 requireActual하면 이 테스트 환경에서 RANK_LABELS가 undefined가 되어,
  // 당첨 등수가 있는 조합을 렌더링할 때(이 테스트엔 없지만 추후 테스트엔 있을 수 있음)
  // 터질 수 있다 — drawStats와 같은 이유로 rank도 함께 requireActual한다.
  const rank = jest.requireActual("../../src/lib/draws/rank");
  return {
    ...drawStats,
    ...rank,
    getRecentDrawsSafe: jest.fn(),
  };
});

// storage 쪽은 이 화면이 쓰는 getGenerationHistory/getTickets 두 함수만 필요하고,
// 나머지(readJson/writeJson 등 실제 AsyncStorage를 만지는 함수)는 이 테스트에서 전혀
// 안 쓰이므로 requireActual 없이 완전히 목으로만 채운다.
jest.mock("../../src/lib/storage", () => ({
  getGenerationHistory: jest.fn(),
  getTickets: jest.fn(),
}));

function makeDraw(drawNumber: number, numbers: WinningDraw["numbers"]): WinningDraw {
  return {
    drawNumber,
    drawDate: "2026-08-01",
    numbers,
    bonusNumber: 7,
  };
}

describe("LabScreen (로또 연구소)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 2026-10-22: 로또 연구소에 신규 카드 3종(번호 커버리지·보너스볼 통계·1등 당첨자 수 통계)이
  // 추가되면서 LottoBall(Animated Svg) 렌더 개수가 늘어, 기본 5000ms 제한에 걸려 이 테스트가
  // 간헐적으로 타임아웃됐다(로직 오류 아님 — 같은 입력으로 재실행하면 통과하기도 함). 순수
  // 렌더 비용 문제이므로 테스트 타임아웃만 15000ms로 늘린다.
  it(
    "저장 이력과 최근 티켓이 있으면 '내 번호 분석'·'이번 주 리포트' 카드가 실제로 나타난다",
    async () => {
    (draws.getRecentDrawsSafe as jest.Mock).mockResolvedValue([
      makeDraw(1234, [1, 2, 3, 4, 5, 6]),
      makeDraw(1233, [7, 8, 9, 10, 11, 12]),
    ]);
    (storage.getGenerationHistory as jest.Mock).mockResolvedValue([
      [1, 2, 3, 4, 5, 6],
      [1, 2, 3, 20, 21, 22],
    ]);
    const now = new Date().toISOString();
    const mockTicket = {
      id: "t1",
      game: { id: "g1", numbers: [1, 2, 3, 4, 5, 6], mode: "PURE_RANDOM", metadata: {} },
      status: "SAVED",
      createdAt: now,
      updatedAt: now,
    } as unknown as SavedTicket;
    (storage.getTickets as jest.Mock).mockResolvedValue([mockTicket]);

    render(<LabScreen />);

    // 로딩 스켈레톤이 끝나고 실제 데이터가 반영될 때까지 기다린다.
    await waitFor(() => {
      expect(screen.getByText(/내 번호 분석/)).toBeTruthy();
    });

    expect(screen.getByText(/이번 주 리포트/)).toBeTruthy();
    },
    15000
  );
});
