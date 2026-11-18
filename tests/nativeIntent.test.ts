/**
 * 2026-11-18 — 카카오톡 "앱에서 확인하기"로 앱이 열릴 때 "Unmatched Route" 대신 홈으로 가는지.
 */
import { redirectSystemPath } from "../app/+native-intent";

describe("redirectSystemPath", () => {
  it("카카오 링크(kakao{키}://kakaolink, geumsonlotto://kakaolink)는 홈으로", () => {
    expect(redirectSystemPath({ path: "kakao457dfeb6e32b6c6f9221a8bbdacfaea1://kakaolink", initial: true })).toBe("/");
    expect(redirectSystemPath({ path: "geumsonlotto://kakaolink", initial: true })).toBe("/");
    expect(redirectSystemPath({ path: "geumsonlotto://kakaolink?foo=bar", initial: false })).toBe("/");
  });

  it("그 밖의 링크는 그대로 둔다", () => {
    expect(redirectSystemPath({ path: "geumsonlotto://privacy", initial: true })).toBe("geumsonlotto://privacy");
    expect(redirectSystemPath({ path: "/", initial: true })).toBe("/");
  });
});
