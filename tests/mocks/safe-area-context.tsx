/**
 * react-native-safe-area-context 전역 jest mock 등록 (jest.config.js "components" 프로젝트의
 * setupFiles에서 로드된다 — moduleNameMapper가 아니다, 아래 이유 참고).
 *
 * BottomActionBar.tsx 등에서 `import { useSafeAreaInsets } from "react-native-safe-area-context"`
 * 를 쓰는데, <SafeAreaProvider> 없이 렌더링하면 "No safe area value available..." 예외가
 * 난다. 패키지가 공식 제공하는 mock(react-native-safe-area-context/jest/mock)을 쓰면
 * Provider 없이도 기본값(0 inset)으로 안전하게 동작한다.
 *
 * 처음엔 moduleNameMapper로 패키지 이름 자체를 이 mock으로 치환했는데, 그 공식 mock
 * 내부가 `jest.requireActual('react-native-safe-area-context')`로 "진짜 원본" Context
 * 객체(SafeAreaInsetsContext 등)를 가져오는 구조다. moduleNameMapper는 requireActual까지
 * 포함해 그 패키지 이름의 모든 참조를 리다이렉트해버려서, 공식 mock이 자기 자신을 다시
 * 가져오는 순환이 되어 SafeAreaInsetsContext가 undefined로 깨졌다(실제로 겪은 문제).
 * jest.mock()의 mock registry는 requireActual이 정확히 우회하도록 설계돼 있어 이 문제가
 * 없다 — 그래서 moduleNameMapper 대신 이 setupFile 방식을 쓴다.
 */
jest.mock("react-native-safe-area-context", () =>
  jest.requireActual("react-native-safe-area-context/jest/mock").default
);
