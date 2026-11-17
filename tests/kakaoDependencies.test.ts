/**
 * 2026-11-17 회귀 방지 — @react-native-kakao/social은 코드에서 직접 쓰지 않지만 지우면 안 된다.
 *
 * 2026-11-15에 "JS 사용처 0건, 빈 AndroidManifest"만 보고 미사용 의존성으로 판단해 제거했더니
 * v9 EAS 빌드가 실패했다: share 패키지의 android/build.gradle이
 * `project.ext.getWorkspaceProject("social")` → `api socialProject`로 social을 Gradle 단에서
 * 직접 의존한다("Could not find the react-native-kakao/social package, have you installed it?").
 * npm 의존성 트리(npm ls)에도 안 잡히는 Gradle 전용 의존이라 이 테스트로 고정해 둔다.
 */
import pkg from "../package.json";

describe("카카오 SDK 의존성", () => {
  it("share를 쓰는 동안 social도 같은 버전대로 dependencies에 있어야 한다", () => {
    const deps = (pkg as { dependencies: Record<string, string> }).dependencies;
    expect(deps["@react-native-kakao/share"]).toBeDefined();
    expect(deps["@react-native-kakao/social"]).toBe(deps["@react-native-kakao/share"]);
    expect(deps["@react-native-kakao/core"]).toBe(deps["@react-native-kakao/share"]);
  });
});
