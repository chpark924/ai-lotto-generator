/**
 * 외부에서 들어온 링크를 Expo Router가 처리하기 전에 고쳐 쓰는 훅 (2026-11-18).
 *
 * 왜: v10부터 카카오톡 공유 카드의 "앱에서 확인하기"가 앱을 바로 연다(app.json의 카카오
 * forwardKakaoLinkIntentFilterToMainActivity). 이때 카카오가 보내는 주소는
 * `kakao{네이티브앱키}://kakaolink?...` 형태인데, Expo Router가 이를 `geumsonlotto://kakaolink`로
 * 받아 "kakaolink"라는 화면을 찾다가 없어서 "Unmatched Route" 오류 화면을 띄웠다(v10 실기기 확인).
 * 카카오 링크는 지금은 "앱을 연다"만 의도하므로 홈으로 보낸다.
 *
 * Expo Router 공식 문서: 이 함수에서 오류가 나면 앱이 죽을 수 있으므로 try/catch로 감싼다.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    if (/kakaolink/i.test(path)) return "/";
    return path;
  } catch {
    return "/";
  }
}
