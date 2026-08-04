import { readJson, writeJson } from "./storage";
import { BIRTH_PROFILE_SECURE_KEY, readSecureJson, removeSecureKey, writeSecureJson } from "./secureStorage";
import type { BirthProfile } from "../lottery/luckyNumber";

export interface UserPreferences {
  preferredNumbers: number[];
  defaultExcludedNumbers: number[];
  birthProfile?: BirthProfile;
  /** false면 생년월일을 아예 저장하지 않고 매번 입력받는다 (기획서 9.1 개인정보 원칙). */
  saveBirthProfile: boolean;
  nickname?: string;
  /** 매주 구매 마감 하루 전(금)·구매 마감일(토 18시)·추첨 임박(토 저녁) 로컬 알림 사용 여부 (서버 푸시 아님, 기기 예약 알림). */
  notifyDrawDay: boolean;
}

/**
 * AsyncStorage(평문)에는 birthProfile을 두지 않는다 — 생년월일은 SecureStore(Keychain/
 * Keystore)에만 보관하고, 나머지(선호번호·알림 설정 등)는 그대로 AsyncStorage에 둔다.
 */
type StoredPreferences = Omit<UserPreferences, "birthProfile">;

const KEY = "preferences";

const DEFAULT_PREFERENCES: UserPreferences = {
  preferredNumbers: [],
  defaultExcludedNumbers: [],
  saveBirthProfile: false,
  notifyDrawDay: false,
};

export async function getPreferences(): Promise<UserPreferences> {
  // readJson의 제네릭을 StoredPreferences로 선언해도, 이전 버전 앱이 저장해둔 데이터에는
  // birthProfile이 평문으로 섞여 있을 수 있다(마이그레이션 이전 데이터) — 그래서 실제
  // 읽은 값은 birthProfile을 포함할 수도 있는 타입으로 한 번 더 열어본다.
  const storedRaw = await readJson<StoredPreferences & { birthProfile?: BirthProfile }>(
    KEY,
    DEFAULT_PREFERENCES
  );
  const stored = { ...DEFAULT_PREFERENCES, ...storedRaw };

  if (stored.birthProfile) {
    // 마이그레이션: 예전 버전에서 평문 AsyncStorage에 남아있던 생년월일을 발견하면,
    // 이번 조회 시점에 SecureStore로 옮기고 평문 원본은 즉시 지운다(1회성).
    const legacyProfile = stored.birthProfile;
    const { birthProfile: _legacy, ...rest } = stored;
    try {
      await writeSecureJson(BIRTH_PROFILE_SECURE_KEY, legacyProfile);
      await writeJson(KEY, rest);
    } catch {
      // 마이그레이션 자체가 실패해도 이번 조회 결과는 정상적으로 돌려준다 — 다음 조회 때 재시도.
    }
    return { ...rest, birthProfile: legacyProfile };
  }

  if (!stored.saveBirthProfile) {
    return stored;
  }

  const birthProfile = await readSecureJson<BirthProfile | null>(BIRTH_PROFILE_SECURE_KEY, null);
  return { ...stored, birthProfile: birthProfile ?? undefined };
}

export async function updatePreferences(
  patch: Partial<UserPreferences>
): Promise<UserPreferences> {
  const current = await getPreferences();
  const next = { ...current, ...patch };

  if ("birthProfile" in patch) {
    if (next.saveBirthProfile && next.birthProfile) {
      await writeSecureJson(BIRTH_PROFILE_SECURE_KEY, next.birthProfile);
    } else {
      await removeSecureKey(BIRTH_PROFILE_SECURE_KEY);
    }
  }

  const { birthProfile: _birthProfile, ...toStore } = next;
  await writeJson(KEY, toStore);
  return next;
}
