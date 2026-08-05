/**
 * drawCache.ts의 GitHub 정적 JSON 동기화 로직 검증 (34번 항목 이후 추가 — QA_LOG.md 참고).
 *
 * 핵심 확인 사항:
 *  1. GitHub 데이터 소스가 설정 안 돼 있으면 기존 방식(기기에서 직접 조회) 그대로 동작한다
 *     (회귀 없음).
 *  2. GitHub에서 받아온 데이터로 캐시가 채워지면, 그 회차는 dhlottery.co.kr에 직접 묻지 않는다
 *     (원래 문제였던 "직접 스크래핑 의존"이 실제로 줄어드는지 확인).
 *  3. GitHub 동기화가 실패해도(오프라인 등) 기존 방식으로 조용히 폴백한다 — 절대 이 계층
 *     때문에 기능 자체가 죽지 않는다.
 *  4. 동기화 주기(6시간) 안에는 매 호출마다 다시 시도하지 않는다.
 *
 * storage.ts와 drawApi.ts/githubDataSource.ts를 전부 인메모리/스텁으로 목 처리해서
 * AsyncStorage 네이티브 모듈이나 실제 네트워크를 전혀 건드리지 않는다(tickets.test.ts와
 * 동일한 기법 — 이 프로젝트의 "unit" jest 프로젝트는 AsyncStorage를 목 처리하지 않으므로
 * storage.ts 자체를 대체해야 한다).
 */
import type { WinningDraw } from "../src/lib/draws/types";

function sampleDraw(drawNumber: number): WinningDraw {
  return {
    drawNumber,
    drawDate: "2026-01-01",
    numbers: [1, 2, 3, 4, 5, 6],
    bonusNumber: 7,
    firstPrizeWinnerCount: 10,
    firstPrizeAmount: 2000000000,
    totalSalesAmount: 90000000000,
  };
}

async function withMocks<T>(
  opts: {
    githubConfigured: boolean;
    githubDraws: WinningDraw[] | null;
  },
  run: (mocks: {
    fetchWinningDrawWithStatus: jest.Mock;
    fetchAllDrawsFromGithub: jest.Mock;
  }) => Promise<T>
): Promise<T> {
  jest.resetModules();
  const store = new Map<string, string>();

  jest.doMock("../src/lib/storage/storage", () => ({
    readJson: jest.fn(async (key: string, fallback: unknown) => {
      const raw = store.get(key);
      return raw !== undefined ? JSON.parse(raw) : fallback;
    }),
    writeJson: jest.fn(async (key: string, value: unknown) => {
      store.set(key, JSON.stringify(value));
    }),
  }));

  const fetchWinningDrawWithStatus = jest.fn(async () => ({ status: "network_error" as const }));
  jest.doMock("../src/lib/draws/drawApi", () => ({
    fetchWinningDrawWithStatus,
    fetchWinningDraw: jest.fn(async () => null),
    estimateLatestDrawNumber: jest.fn(() => 1235),
  }));

  const fetchAllDrawsFromGithub = jest.fn(async () => opts.githubDraws);
  jest.doMock("../src/lib/draws/githubDataSource", () => ({
    isGithubDataSourceConfigured: jest.fn(() => opts.githubConfigured),
    fetchAllDrawsFromGithub,
  }));

  const result = await run({ fetchWinningDrawWithStatus, fetchAllDrawsFromGithub });

  jest.dontMock("../src/lib/storage/storage");
  jest.dontMock("../src/lib/draws/drawApi");
  jest.dontMock("../src/lib/draws/githubDataSource");
  return result;
}

describe("drawCache — GitHub 정적 JSON 동기화", () => {
  it("GitHub 소스가 설정 안 돼 있으면 기존 방식(직접 조회)이 그대로 호출된다", async () => {
    await withMocks(
      { githubConfigured: false, githubDraws: null },
      async ({ fetchWinningDrawWithStatus, fetchAllDrawsFromGithub }) => {
        fetchWinningDrawWithStatus.mockResolvedValueOnce({ status: "success", draw: sampleDraw(1000) });
        const { getDrawByNumberWithStatus } = await import("../src/lib/draws/drawCache");

        const result = await getDrawByNumberWithStatus(1000);

        expect(result.status).toBe("success");
        expect(fetchAllDrawsFromGithub).not.toHaveBeenCalled();
        expect(fetchWinningDrawWithStatus).toHaveBeenCalledWith(1000);
      }
    );
  });

  it("GitHub에 있는 회차는 캐시에서 바로 서빙되고 직접 조회를 하지 않는다", async () => {
    await withMocks(
      { githubConfigured: true, githubDraws: [sampleDraw(1000), sampleDraw(1001)] },
      async ({ fetchWinningDrawWithStatus }) => {
        const { getDrawByNumberWithStatus } = await import("../src/lib/draws/drawCache");

        const result = await getDrawByNumberWithStatus(1000);

        expect(result).toEqual({ status: "success", draw: sampleDraw(1000) });
        expect(fetchWinningDrawWithStatus).not.toHaveBeenCalled();
      }
    );
  });

  it("GitHub 동기화가 실패해도(null) 기존 방식으로 조용히 폴백한다", async () => {
    await withMocks(
      { githubConfigured: true, githubDraws: null },
      async ({ fetchWinningDrawWithStatus }) => {
        fetchWinningDrawWithStatus.mockResolvedValueOnce({ status: "success", draw: sampleDraw(2000) });
        const { getDrawByNumberWithStatus } = await import("../src/lib/draws/drawCache");

        const result = await getDrawByNumberWithStatus(2000);

        expect(result.status).toBe("success");
        expect(fetchWinningDrawWithStatus).toHaveBeenCalledWith(2000);
      }
    );
  });

  it("동기화 주기(6시간) 안에는 같은 세션에서 GitHub을 다시 조회하지 않는다", async () => {
    await withMocks(
      { githubConfigured: true, githubDraws: [sampleDraw(3000)] },
      async ({ fetchAllDrawsFromGithub }) => {
        const { getDrawByNumberWithStatus } = await import("../src/lib/draws/drawCache");

        await getDrawByNumberWithStatus(3000);
        await getDrawByNumberWithStatus(3000);
        await getDrawByNumberWithStatus(9999); // 캐시에 없는 회차라도 동기화 자체는 주기 내엔 스킵

        expect(fetchAllDrawsFromGithub).toHaveBeenCalledTimes(1);
      }
    );
  });
});
