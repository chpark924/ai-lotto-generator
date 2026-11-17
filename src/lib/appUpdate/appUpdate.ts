/**
 * 앱 업데이트 안내 (2026-11-17, v11부터).
 *
 * GitHub에 둔 작은 설정 파일(data/app-config.json)을 읽어, 설치된 앱의 versionCode가
 *  - minSupportedVersionCode보다 낮으면 "필수" 업데이트(닫을 수 없는 안내),
 *  - latestVersionCode보다 낮으면 "권장" 업데이트("나중에"로 닫을 수 있고, 같은 최신 버전에
 *    대해서는 한 번만 안내)
 * 를 띄운다. 당첨번호 데이터와 같은 배포 방식이라 비용 없음, 숫자만 바꾸면 빌드 없이 적용된다.
 *
 * 운영 규칙(중요):
 *  - latestVersionCode는 Play 스토어에 그 버전이 "실제로 게시된 뒤"에 올린다. 심사 중에 먼저
 *    올리면 사용자가 스토어에 가도 업데이트가 안 보인다.
 *  - minSupportedVersionCode는 꼭 필요할 때만 올린다(예: 옛 버전에 심각한 버그). 0이면 필수 없음.
 *
 * 안전장치: 설정을 못 읽거나(오프라인·형식 오류) 설치 버전을 모르면 아무것도 띄우지 않는다
 * (fail-open). 설정 실수로 모든 사용자가 앱을 못 여는 사고를 막기 위해서다.
 */
import { Linking } from "react-native";
import * as Application from "expo-application";
import { readJson, writeJson } from "../storage/storage";

export interface AppUpdateConfig {
  latestVersionCode: number;
  minSupportedVersionCode: number;
  /** 권장 업데이트 안내 문구(선택). 없으면 기본 문구. */
  message?: string;
  /** 필수 업데이트 안내 문구(선택). 없으면 기본 문구. */
  requiredMessage?: string;
}

export type UpdateDecision =
  | { kind: "none" }
  | { kind: "recommended"; latestVersionCode: number; message: string }
  | { kind: "required"; message: string };

export const DEFAULT_RECOMMENDED_MESSAGE = "새 기능과 개선 사항이 담긴 새 버전이 나왔어요. 지금 업데이트할까요?";
export const DEFAULT_REQUIRED_MESSAGE = "원활한 이용을 위해 최신 버전으로 업데이트해 주세요.";

const CONFIG_URL = "https://raw.githubusercontent.com/chpark924/ai-lotto-generator/main/data/app-config.json";
const FETCH_TIMEOUT_MS = 6000;
const DISMISSED_KEY = "appUpdateDismissedFor";
const PACKAGE_NAME = "com.geumsonlotto.app";
const MAX_MESSAGE_LENGTH = 200;

function isVersionCode(v: unknown): v is number {
  return Number.isInteger(v) && (v as number) >= 0 && (v as number) < 1_000_000;
}

function cleanMessage(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 && v.length <= MAX_MESSAGE_LENGTH ? v.trim() : undefined;
}

/** 설정 JSON 전체에서 android 항목을 검증해 꺼낸다. 형식이 이상하면 null. */
export function parseAppUpdateConfig(raw: unknown): AppUpdateConfig | null {
  const android = (raw as { android?: Record<string, unknown> } | null)?.android;
  if (!android || typeof android !== "object") return null;
  const { latestVersionCode, minSupportedVersionCode } = android;
  if (!isVersionCode(latestVersionCode) || !isVersionCode(minSupportedVersionCode)) return null;
  return {
    latestVersionCode,
    minSupportedVersionCode,
    message: cleanMessage(android.message),
    requiredMessage: cleanMessage(android.requiredMessage),
  };
}

/** 순수 함수 — 설치 버전·설정·"나중에"로 닫은 버전으로 무엇을 띄울지 정한다. */
export function decideUpdate(
  installedVersionCode: number | null,
  config: AppUpdateConfig | null,
  dismissedForVersionCode: number | null
): UpdateDecision {
  if (installedVersionCode === null || config === null) return { kind: "none" };
  if (installedVersionCode < config.minSupportedVersionCode) {
    return { kind: "required", message: config.requiredMessage ?? DEFAULT_REQUIRED_MESSAGE };
  }
  if (installedVersionCode < config.latestVersionCode && dismissedForVersionCode !== config.latestVersionCode) {
    return {
      kind: "recommended",
      latestVersionCode: config.latestVersionCode,
      message: config.message ?? DEFAULT_RECOMMENDED_MESSAGE,
    };
  }
  return { kind: "none" };
}

/** 설치된 앱의 versionCode(Android). 개발 환경 등에서 알 수 없으면 null. */
export function getInstalledVersionCode(): number | null {
  const n = Number(Application.nativeBuildVersion);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** GitHub의 설정 파일을 읽는다. 무엇이 잘못되든 throw하지 않고 null. */
export async function fetchAppUpdateConfig(): Promise<AppUpdateConfig | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${CONFIG_URL}?t=${Date.now()}`, { signal: controller.signal });
    if (!response.ok) return null;
    return parseAppUpdateConfig(await response.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getDismissedVersionCode(): Promise<number | null> {
  try {
    const v = await readJson<number | null>(DISMISSED_KEY, null);
    return isVersionCode(v) ? v : null;
  } catch {
    return null;
  }
}

export async function rememberDismissed(latestVersionCode: number): Promise<void> {
  try {
    await writeJson(DISMISSED_KEY, latestVersionCode);
  } catch {
    // 기억 못 해도 다음 실행 때 한 번 더 안내될 뿐이다.
  }
}

/** Play 스토어 앱의 금손로또 페이지를 연다. 스토어 앱이 없으면 웹 페이지로. */
export async function openStorePage(): Promise<void> {
  try {
    await Linking.openURL(`market://details?id=${PACKAGE_NAME}`);
  } catch {
    await Linking.openURL(`https://play.google.com/store/apps/details?id=${PACKAGE_NAME}`).catch(() => {});
  }
}
