/**
 * 2026-11-17 — 업데이트 안내(권장/필수) 판단 로직과 설정 검증.
 */
jest.mock("react-native", () => ({ Linking: { openURL: jest.fn(async () => undefined) } }));
jest.mock("expo-application", () => ({ nativeBuildVersion: "11" }));
jest.mock("../src/lib/storage/storage", () => ({
  readJson: jest.fn(async (_k: string, fallback: unknown) => fallback),
  writeJson: jest.fn(async () => undefined),
}));

import {
  decideUpdate,
  parseAppUpdateConfig,
  fetchAppUpdateConfig,
  getInstalledVersionCode,
  DEFAULT_RECOMMENDED_MESSAGE,
} from "../src/lib/appUpdate/appUpdate";

const cfg = (latest: number, min: number) => ({ latestVersionCode: latest, minSupportedVersionCode: min });

describe("decideUpdate", () => {
  it("최신이면 아무것도 안 띄운다", () => {
    expect(decideUpdate(12, cfg(12, 0), null)).toEqual({ kind: "none" });
  });

  it("최신보다 낮으면 권장 안내(기본 문구)", () => {
    expect(decideUpdate(11, cfg(12, 0), null)).toEqual({
      kind: "recommended",
      latestVersionCode: 12,
      message: DEFAULT_RECOMMENDED_MESSAGE,
    });
  });

  it("같은 최신 버전에 대해 '나중에'를 눌렀으면 다시 권장하지 않고, 더 새 버전이 나오면 다시 권장", () => {
    expect(decideUpdate(11, cfg(12, 0), 12)).toEqual({ kind: "none" });
    expect(decideUpdate(11, cfg(13, 0), 12).kind).toBe("recommended");
  });

  it("최소 지원 버전보다 낮으면 '나중에' 기록과 무관하게 필수", () => {
    expect(decideUpdate(10, cfg(12, 11), 12).kind).toBe("required");
  });

  it("설치 버전을 모르거나 설정이 없으면 아무것도 안 띄운다(fail-open)", () => {
    expect(decideUpdate(null, cfg(99, 99), null)).toEqual({ kind: "none" });
    expect(decideUpdate(5, null, null)).toEqual({ kind: "none" });
  });
});

describe("parseAppUpdateConfig", () => {
  it("정상 설정과 선택 문구를 읽는다", () => {
    expect(parseAppUpdateConfig({ android: { latestVersionCode: 12, minSupportedVersionCode: 0, message: " 새 버전! " } })).toEqual({
      latestVersionCode: 12,
      minSupportedVersionCode: 0,
      message: "새 버전!",
      requiredMessage: undefined,
    });
  });

  it("형식이 이상하면 null", () => {
    for (const raw of [null, {}, { android: {} }, { android: { latestVersionCode: "12", minSupportedVersionCode: 0 } }, { android: { latestVersionCode: 12, minSupportedVersionCode: -1 } }]) {
      expect(parseAppUpdateConfig(raw)).toBeNull();
    }
  });

  it("저장소의 실제 data/app-config.json이 올바른 형식이다", () => {
    const real = require("../data/app-config.json");
    const parsed = parseAppUpdateConfig(real);
    expect(parsed).not.toBeNull();
    expect(parsed!.minSupportedVersionCode).toBeLessThanOrEqual(parsed!.latestVersionCode);
  });
});

describe("fetchAppUpdateConfig / getInstalledVersionCode", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("네트워크 오류면 null(안내 안 띄움)", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;
    await expect(fetchAppUpdateConfig()).resolves.toBeNull();
  });

  it("GitHub의 data/app-config.json을 읽는다", async () => {
    const spy = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ android: cfg(12, 0) }) });
    global.fetch = spy as unknown as typeof fetch;
    await expect(fetchAppUpdateConfig()).resolves.toMatchObject(cfg(12, 0));
    expect(String(spy.mock.calls[0][0])).toContain("raw.githubusercontent.com/chpark924/ai-lotto-generator/main/data/app-config.json");
  });

  it("설치 versionCode를 숫자로 읽는다", () => {
    expect(getInstalledVersionCode()).toBe(11);
  });
});
