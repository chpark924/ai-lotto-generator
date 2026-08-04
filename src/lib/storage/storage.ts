/**
 * 모든 사용자 데이터는 서버 없이 기기 내 AsyncStorage에만 저장한다 (비용 최소화 원칙).
 * 클라우드 동기화가 필요하면 이후 단계에서 선택적으로 추가할 수 있도록
 * 이 계층 뒤에서만 저장 방식을 바꾸면 되게 설계했다.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BIRTH_PROFILE_SECURE_KEY, removeSecureKey } from "./secureStorage";

const NAMESPACE = "@ai-lotto";

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(`${NAMESPACE}/${key}`);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * AsyncStorage 쓰기 실패(용량 초과, 직렬화 오류 등)를 조용히 삼키지 않는다.
 * 호출부가 사용자에게 실패를 안내할 수 있도록 항상 명확한 한국어 메시지를 담아 다시 던진다.
 */
export async function writeJson<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(`${NAMESPACE}/${key}`, JSON.stringify(value));
  } catch (error) {
    console.error(`[storage] "${key}" 저장 실패:`, error);
    throw new Error("기기에 저장하지 못했습니다. 저장 공간을 확인하고 다시 시도해주세요.");
  }
}

export async function removeKey(key: string): Promise<void> {
  await AsyncStorage.removeItem(`${NAMESPACE}/${key}`);
}

export async function clearAllLocalData(): Promise<void> {
  const keys: readonly string[] = await AsyncStorage.getAllKeys();
  const ours = keys.filter((k: string) => k.startsWith(`${NAMESPACE}/`));
  await AsyncStorage.multiRemove(ours as string[]);
  // 생년월일은 AsyncStorage가 아니라 SecureStore(Keychain/Keystore)에 별도 보관되므로,
  // "모든 로컬 데이터 삭제"가 이것까지 함께 지우지 않으면 암호화된 생년월일만 남는
  // 불완전한 삭제가 된다 — 반드시 같이 지운다.
  await removeSecureKey(BIRTH_PROFILE_SECURE_KEY);
}
