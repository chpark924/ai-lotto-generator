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
  const updated = tickets.map((t) =>
    t.id === id ? { ...t, drawNumber, updatedAt: new Date().toISOString() } : t
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
