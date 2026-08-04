/**
 * "내 번호" 탭의 회차 지정 / 당첨 확인 기능이 의존하는 저장소 계층 검증.
 * AsyncStorage를 인메모리 맵으로 흉내내어, 실제 값 변경이 제대로 저장/반영되는지 확인한다.
 */
import type { GeneratedGame } from "../src/lib/lottery/types";

function fakeGame(id: string): GeneratedGame {
  return {
    id,
    numbers: [1, 2, 3, 4, 5, 6],
    mode: "PURE_RANDOM",
    metadata: {
      oddCount: 3,
      lowNumberCount: 6,
      sum: 21,
      maxConsecutiveLength: 6,
      sameEndingMaxCount: 1,
      sectionCounts: [2, 2, 2, 0, 0],
    },
  };
}

async function withInMemoryStorage<T>(run: () => Promise<T>): Promise<T> {
  jest.resetModules();
  const store = new Map<string, string>();
  jest.doMock("../src/lib/storage/storage", () => ({
    readJson: jest.fn(async (key: string, fallback: unknown) => {
      const raw = store.get(key);
      return raw ? JSON.parse(raw) : fallback;
    }),
    writeJson: jest.fn(async (key: string, value: unknown) => {
      store.set(key, JSON.stringify(value));
    }),
  }));
  const result = await run();
  jest.dontMock("../src/lib/storage/storage");
  return result;
}

describe("tickets storage — 회차 지정 / 당첨 확인이 의존하는 저장 로직", () => {
  it("updateTicketDrawNumber로 지정한 회차가 그대로 저장되고 조회된다", async () => {
    await withInMemoryStorage(async () => {
      const { saveTicket, updateTicketDrawNumber, getTickets } = await import("../src/lib/storage/tickets");
      const ticket = await saveTicket(fakeGame("g1"), "PLANNED");
      expect(ticket.drawNumber).toBeUndefined();

      await updateTicketDrawNumber(ticket.id, 1236);
      const [updated] = await getTickets();
      expect(updated.drawNumber).toBe(1236);

      // 다시 다른 값으로 지정해도 정상적으로 덮어써진다 (버튼을 눌러 값을 바꾸는 경로).
      await updateTicketDrawNumber(ticket.id, 1240);
      const [updatedAgain] = await getTickets();
      expect(updatedAgain.drawNumber).toBe(1240);
    });
  });

  it("updateTicketMatchedRank는 등수를 저장하고 상태를 CHECKED로 바꾼다", async () => {
    await withInMemoryStorage(async () => {
      const { saveTicket, updateTicketDrawNumber, updateTicketMatchedRank, getTickets } = await import(
        "../src/lib/storage/tickets"
      );
      const ticket = await saveTicket(fakeGame("g2"), "SAVED");
      await updateTicketDrawNumber(ticket.id, 1236);

      await updateTicketMatchedRank(ticket.id, 4);
      const [updated] = await getTickets();
      expect(updated.matchedRank).toBe(4);
      expect(updated.status).toBe("CHECKED");
    });
  });

  it("deleteTicket은 해당 항목만 제거하고 나머지는 남긴다", async () => {
    await withInMemoryStorage(async () => {
      const { saveTicket, deleteTicket, getTickets } = await import("../src/lib/storage/tickets");
      const a = await saveTicket(fakeGame("gA"), "SAVED");
      const b = await saveTicket(fakeGame("gB"), "SAVED");

      await deleteTicket(a.id);
      const remaining = await getTickets();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(b.id);
    });
  });
});
