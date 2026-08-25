import { readJson, writeJson } from "./storage";
import type { GeneratedGame } from "../lottery/types";

export type TicketStatus = "SAVED" | "PLANNED" | "PURCHASED" | "CHECKED";

export interface SavedTicket {
  id: string;
  game: GeneratedGame;
  drawNumber?: number;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  /** 당첨 결과 확인 후 채워짐. 실제 당첨 등수(0은 낙첨). */
  matchedRank?: 0 | 1 | 2 | 3 | 4 | 5;
}

const KEY = "tickets";
const HISTORY_KEY = "generationHistory";
const HISTORY_LIMIT = 50;

export async function getTickets(): Promise<SavedTicket[]> {
  return readJson<SavedTicket[]>(KEY, []);
}

export async function saveTicket(
  game: GeneratedGame,
  status: TicketStatus = "SAVED",
  drawNumber?: number
): Promise<SavedTicket> {
  const tickets = await getTickets();
  const now = new Date().toISOString();
  const ticket: SavedTicket = {
    id: `ticket_${Date.now()}_${Math.round(Math.random() * 1e6)}`,
    game,
    status,
    drawNumber,
    createdAt: now,
    updatedAt: now,
  };
  await writeJson(KEY, [ticket, ...tickets]);
  await pushToGenerationHistory(game.numbers);
  return ticket;
}

export async function updateTicketStatus(id: string, status: TicketStatus): Promise<void> {
  const tickets = await getTickets();
  const updated = tickets.map((t) =>
    t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t
  );
  await writeJson(KEY, updated);
}

export async function updateTicketDrawNumber(id: string, drawNumber: number): Promise<void> {
  const tickets = await getTickets();
  const updated = tickets.map((t) => {
    if (t.id !== id) return t;
    if (t.drawNumber === drawNumber) {
      // 같은 회차로 "재지정"된 경우(사실상 변경 없음)라 기존 확인 결과를 지울 이유가 없다.
      return { ...t, drawNumber, updatedAt: new Date().toISOString() };
    }
    // QA_LOG 109번 — "회차 변경"으로 회차를 실제로 바꾸면, 예전 회차의 당첨번호와 비교해서
    // 나온 matchedRank(당첨 확인 결과)는 새 회차엔 더 이상 맞지 않는 값이다. 특히 "다음 주"처럼
    // 아직 추첨도 하지 않은 미래 회차로 바꿨는데 "확인 완료"·"낙첨" 배지가 그대로 남아있으면
    // "아직 추첨도 안 했는데 왜 낙첨이지?"처럼 논리적으로 말이 안 되는 화면이 된다(과거의
    // 다른 회차로 바꾼 경우도 마찬가지로 그 결과가 새 회차엔 안 맞기는 매한가지). 회차가 실제로
    // 바뀔 때는 matchedRank를 지우고, 그 값 때문에만 "CHECKED"로 켜져 있던 status도 함께
    // 되돌려 "다시 확인이 필요한 상태"로 만든다. 자동 확인(autoCheckPendingTickets)이
    // matchedRank가 비어있는 티켓을 대상으로 하므로, 미래 회차는 발표 전까지 조용히
    // 건너뛰다가 발표되면 자동으로 다시 채워진다.
    return {
      ...t,
      drawNumber,
      matchedRank: undefined,
      status: t.status === "CHECKED" ? "SAVED" : t.status,
      updatedAt: new Date().toISOString(),
    };
  });
  await writeJson(KEY, updated);
}

/**
 * QA_LOG 114번 — updateTicketDrawNumber(109번)의 가드는 "그 시점 이후에 일어나는 회차
 * 변경"만 막아준다. 109번 수정이 배포되기 전에 이미 저장돼 있던 티켓(예: 이미 확인이 끝난
 * 회차의 matchedRank를 그대로 지닌 채 회차 번호만 미래로 바뀐 낡은 데이터)에는 소급 적용되지
 * 않으므로, 기기에 남아있던 그런 티켓은 109번 수정 이후에도 여전히 "아직 추첨도 안 한
 * 회차인데 확인완료·낙첨" 화면으로 보였다. tickets.tsx가 화면 진입 시 이 함수로 "지정된
 * 회차가 아직 추첨 전인데 matchedRank가 남아있는" 티켓을 찾아 스스로 정리한다(1회 정리되면
 * 그 뒤로는 다시 나타나지 않는다) — updateTicketDrawNumber의 회차-변경 가드와 달리, 회차
 * 자체는 그대로 두고 "무효가 된 확인 결과"만 지운다는 점이 다르다.
 */
export async function clearTicketCheckResult(id: string): Promise<void> {
  const tickets = await getTickets();
  const updated = tickets.map((t) =>
    t.id === id
      ? {
          ...t,
          matchedRank: undefined,
          status: t.status === "CHECKED" ? "SAVED" : t.status,
          updatedAt: new Date().toISOString(),
        }
      : t
  );
  await writeJson(KEY, updated);
}

export async function updateTicketMatchedRank(
  id: string,
  matchedRank: SavedTicket["matchedRank"]
): Promise<void> {
  const tickets = await getTickets();
  const updated = tickets.map((t) =>
    t.id === id
      ? { ...t, matchedRank, status: "CHECKED" as TicketStatus, updatedAt: new Date().toISOString() }
      : t
  );
  await writeJson(KEY, updated);
}

export async function deleteTicket(id: string): Promise<void> {
  const tickets = await getTickets();
  await writeJson(
    KEY,
    tickets.filter((t) => t.id !== id)
  );
}

/** 나의 최근 저장 조합 (기획서 7.5 "내 기존 번호와의 차별성" 계산에 사용). */
export async function getGenerationHistory(): Promise<number[][]> {
  return readJson<number[][]>(HISTORY_KEY, []);
}

async function pushToGenerationHistory(numbers: number[]): Promise<void> {
  const history = await getGenerationHistory();
  const next = [numbers, ...history].slice(0, HISTORY_LIMIT);
  await writeJson(HISTORY_KEY, next);
}
