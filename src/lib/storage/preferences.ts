import { readJson, writeJson } from "./storage";
import type { BirthProfile } from "../lottery/luckyNumber";

export interface UserPreferences {
  preferredNumbers: number[];
  defaultExcludedNumbers: number[];
  birthProfile?: BirthProfile;
  /** false면 생년월일을 아예 저장하지 않고 매번 입력받는다 (기획서 9.1 개인정보 원칙). */
  saveBirthProfile: boolean;
  nickname?: string;
  /** 매주 토요일 추첨일 로컬 알림 사용 여부 (서버 푸시 아님, 기기 예약 알림). */
  notifyDrawDay: boolean;
}

const KEY = "preferences";

const DEFAULT_PREFERENCES: UserPreferences = {
  preferredNumbers: [],
  defaultExcludedNumbers: [],
  saveBirthProfile: false,
  notifyDrawDay: false,
};

export async function getPreferences(): Promise<UserPreferences> {
  const stored = await readJson<UserPreferences>(KEY, DEFAULT_PREFERENCES);
  // 이전 버전 데이터와의 호환을 위해 누락된 필드는 기본값으로 채운다.
  return { ...DEFAULT_PREFERENCES, ...stored };
}

export async function updatePreferences(
  patch: Partial<UserPreferences>
): Promise<UserPreferences> {
  const current = await getPreferences();
  const next = { ...current, ...patch };
  await writeJson(KEY, next);
  return next;
}
