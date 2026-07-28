/**
 * 모든 사용자 데이터는 서버 없이 기기 내 AsyncStorage에만 저장한다 (비용 최소화 원칙).
 * 클라우드 동기화가 필요하면 이후 단계에서 선택적으로 추가할 수 있도록
 * 이 계층 뒤에서만 저장 방식을 바꾸면 되게 설계했다.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

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

export async function writeJson<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(`${NAMESPACE}/${key}`, JSON.stringify(value));
}

export async function removeKey(key: string): Promise<void> {
  await AsyncStorage.removeItem(`${NAMESPACE}/${key}`);
}

export async function clearAllLocalData(): Promise<void> {
  const keys: readonly string[] = await AsyncStorage.getAllKeys();
  const ours = keys.filter((k: string) => k.startsWith(`${NAMESPACE}/`));
  await AsyncStorage.multiRemove(ours as string[]);
}
