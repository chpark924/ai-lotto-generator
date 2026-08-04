/**
 * 생년월일처럼 민감할 수 있는 값 전용의 암호화 저장소.
 *
 * 위협 모델: 이 앱은 서버가 없어 "개발자가 데이터를 수집"할 위험은 애초에 없다.
 * 남는 위협은 "기기 자체에 대한 접근"이다 — 잠금 해제된 기기를 잠깐 만질 수 있는
 * 사람, 루팅/탈옥된 기기에서 다른 앱이 파일시스템을 직접 읽는 경우, 기기 백업 파일을
 * 분석하는 경우 등. AsyncStorage(readJson/writeJson)는 평문 파일이라 이런 경우
 * 생년월일이 그대로 노출될 수 있다. 그래서 저장 여부를 사용자가 직접 선택하는
 * 생년월일만, iOS Keychain / Android Keystore 기반의 expo-secure-store로 별도 보관한다.
 *
 * 저장번호·제외번호·티켓 등 나머지 데이터는 그대로 AsyncStorage를 쓴다 — 민감도가
 * 낮고(로또 번호 자체는 개인정보가 아님) 양이 많아 SecureStore의 항목당 용량 제한
 * (플랫폼에 따라 수 KB 수준)에 맞지 않기 때문이다. 즉, 앱 전체를 암호화하는 대신
 * "정말 민감한 값 하나만" 정확히 골라 암호화하는 편이 실효성과 비용 모두에서 낫다.
 */
import * as SecureStore from "expo-secure-store";

const SECURE_NAMESPACE = "ai-lotto-secure";

/** preferences.ts에서 생년월일 저장/삭제 시 함께 쓰는 SecureStore 키. */
export const BIRTH_PROFILE_SECURE_KEY = "birthProfile";

function namespacedKey(key: string): string {
  // SecureStore 키는 영문/숫자/".", "-", "_"만 허용한다("/" 불가) — AsyncStorage와
  // 네임스페이스 구분자를 다르게 쓴다.
  return `${SECURE_NAMESPACE}-${key}`;
}

export async function readSecureJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await SecureStore.getItemAsync(namespacedKey(key));
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // 기기가 Keychain/Keystore를 지원하지 않는 드문 경우 등에도 앱이 죽지 않도록 fallback.
    return fallback;
  }
}

export async function writeSecureJson<T>(key: string, value: T): Promise<void> {
  try {
    await SecureStore.setItemAsync(namespacedKey(key), JSON.stringify(value));
  } catch (error) {
    console.error(`[secureStorage] "${key}" 저장 실패:`, error);
    throw new Error("기기에 안전하게 저장하지 못했습니다. 다시 시도해주세요.");
  }
}

export async function removeSecureKey(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(namespacedKey(key));
  } catch {
    // no-op: 애초에 없던 키를 지우거나, 삭제 자체가 실패해도 다음 저장 때 덮어써지므로
    // 사용자 흐름을 막을 정도의 오류는 아니다.
  }
}
