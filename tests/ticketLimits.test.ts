/**
 * 2026-11-15 — 내 번호 저장 한도(회차당 100개, 전체 1,000개)와 낙첨 번호 3개월 후 자동 정리 검증.
 */
import type { GeneratedGame } from "../src/lib/lottery/types";
import type { SavedTicket } from "../src/lib/storage/tickets";

function game(i: number): GeneratedGame {
  return {
    id: `g${i}`,
    numbers: [1, 2, 3, 4, 5, 6],
    mode: "PURE_RANDOM",
    metadata: { oddCount: 3, lowNumberCount: 6, sum: 21, maxConsecutiveLength: 6, sameEndingMaxCount: 1, sectionCounts: [2, 2, 2, 0, 0] },
  };
}

function ticket(i: number, over: Partial<SavedTicket> = {}): SavedTicket {
  return {
    id: `t${i}`,
    game: game(i),
    status: "SAVED",
    drawNumber: 1251,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

async function withStore<T>(initial: SavedTicket[], run: (mod: typeof import("../src/lib/storage/tickets"), read: () => SavedTicket[]) => Promise<T>) {
  jest.resetModules();
  const store = new Map<string, string>([["tickets", JSON.stringify(initial)]]);
  jest.doMock("../src/lib/storage/storage", () => ({
    readJson: jest.fn(async (key: string, fallback: unknown) => {
      const raw = store.get(key);
      return raw ? JSON.parse(raw) : fallback;
    }),
    writeJson: jest.fn(async (key: string, value: unknown) => {
      store.set(key, JSON.stringify(value));
    }),
  }));
  const mod = await import("../src/lib/storage/tickets");
  const result = await run(mod, () => JSON.parse(store.get("tickets") ?? "[]"));
  jest.dontMock("../src/lib/storage/storage");
  return result;
}

describe("저장 한도", () => {
  it("같은 회차 100개까지는 저장되고 101번째는 TicketLimitError(PER_DRAW)", async () => {
    const existing = Array.from({ length: 99 }, (_, i) => ticket(i));
    await withStore(existing, async (mod, read) => {
      await mod.saveTicket(game(999), "SAVED", 1251);
      expect(read()).toHaveLength(100);
      await expect(mod.saveTicket(game(1000), "SAVED", 1251)).rejects.toMatchObject({ kind: "PER_DRAW" });
      expect(read()).toHaveLength(100);
      // 다른 회차는 여전히 저장된다.
      await mod.saveTicket(game(1001), "SAVED", 1252);
      expect(read()).toHaveLength(101);
    });
  });

  it("전체 1,000개를 넘으면 TicketLimitError(TOTAL)", async () => {
    const existing = Array.from({ length: 1000 }, (_, i) => ticket(i, { drawNumber: 1000 + Math.floor(i / 50) }));
    await withStore(existing, async (mod) => {
      await expect(mod.saveTicket(game(1), "SAVED", 2000)).rejects.toMatchObject({ kind: "TOTAL" });
    });
  });

  it("묶음 저장은 한도를 넘으면 하나도 저장하지 않는다", async () => {
    const existing = Array.from({ length: 95 }, (_, i) => ticket(i));
    await withStore(existing, async (mod, read) => {
      const games = Array.from({ length: 10 }, (_, i) => game(500 + i));
      await expect(mod.saveTicketsBatch(games, "SAVED", 1251)).rejects.toBeInstanceOf(mod.TicketLimitError);
      expect(read()).toHaveLength(95);
    });
  });

  it("다른 회차로 옮길 때도 그 회차 한도를 지킨다", async () => {
    const existing = [...Array.from({ length: 100 }, (_, i) => ticket(i)), ticket(500, { drawNumber: 1252 })];
    await withStore(existing, async (mod) => {
      await expect(mod.updateTicketDrawNumber("t500", 1251)).rejects.toMatchObject({ kind: "PER_DRAW" });
    });
  });
});

describe("낙첨 번호 3개월 후 자동 정리", () => {
  it("낙첨 확인 3개월이 지난 번호만 지우고, 당첨·미확인·3개월 전 번호는 남긴다", async () => {
    const existing = [
      ticket(1, { matchedRank: 0, checkedAt: "2026-07-01T00:00:00.000Z" }), // 지움
      ticket(2, { matchedRank: 0, checkedAt: "2026-09-01T00:00:00.000Z" }), // 아직(11/15 기준 2.5개월)
      ticket(3, { matchedRank: 5, checkedAt: "2025-01-01T00:00:00.000Z" }), // 당첨 — 절대 안 지움
      ticket(4, { matchedRank: undefined, updatedAt: "2025-01-01T00:00:00.000Z" }), // 미확인 — 안 지움
      ticket(5, { matchedRank: 0, updatedAt: "2026-06-01T00:00:00.000Z" }), // checkedAt 없는 옛 티켓 → updatedAt 기준, 지움
    ];
    await withStore(existing, async (mod, read) => {
      const removed = await mod.pruneExpiredLostTickets(new Date("2026-11-15T00:00:00.000Z"));
      expect(removed).toBe(2);
      expect(read().map((t) => t.id)).toEqual(["t2", "t3", "t4"]);
    });
  });

  it("당첨 확인 시 checkedAt이 기록되고, 회차를 바꾸면 지워진다", async () => {
    await withStore([ticket(1)], async (mod, read) => {
      await mod.updateTicketMatchedRank("t1", 0);
      expect(read()[0].checkedAt).toBeDefined();
      await mod.updateTicketDrawNumber("t1", 1260);
      expect(read()[0].checkedAt).toBeUndefined();
    });
  });
});
