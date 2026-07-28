/**
 * 테스트(Node/Jest) 환경용 expo-crypto 목(mock).
 * 실제 앱에서는 expo-crypto 네이티브 모듈이 사용되지만, 여기서는 동일한 인터페이스를
 * node:crypto로 재현하여 순수 로직(src/lib/lottery)을 실제 네이티브 빌드 없이 검증한다.
 */
import { randomBytes, createHash } from "node:crypto";

export function getRandomBytes(byteLength: number): Uint8Array {
  return new Uint8Array(randomBytes(byteLength));
}

export enum CryptoDigestAlgorithm {
  SHA256 = "SHA-256",
}

export async function digestStringAsync(
  _algorithm: CryptoDigestAlgorithm,
  data: string
): Promise<string> {
  return createHash("sha256").update(data).digest("hex");
}
