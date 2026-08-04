/** @type {import('jest').Config} */
module.exports = {
  // 두 종류의 테스트를 분리해서 돌린다.
  //  - "unit": src/lib의 순수 함수 로직 (기존과 동일, ts-jest + node 환경, 빠름).
  //  - "components": 실제 화면 컴포넌트를 렌더링해서 확인하는 테스트
  //    (jest-expo + @testing-library/react-native). "함수는 있는데 호출 흐름이
  //    끊겨서 화면에 아무것도 안 뜨는" 것 같은 버그는 순수 함수 테스트만으로는
  //    못 잡는다 — app/(tabs)/lab.tsx의 loadLabData()에 있던 조기 return 버그가
  //    정확히 그런 경우였다(2026-08-04 리뷰 참고). 이 프로젝트를 별도로 둔 이유.
  projects: [
    {
      displayName: "unit",
      preset: "ts-jest",
      testEnvironment: "node",
      rootDir: "<rootDir>",
      roots: ["<rootDir>/tests"],
      testPathIgnorePatterns: ["<rootDir>/tests/components/"],
      moduleNameMapper: {
        "^expo-crypto$": "<rootDir>/tests/mocks/expo-crypto.ts",
      },
      transform: {
        "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.jest.json" }],
      },
    },
    {
      displayName: "components",
      preset: "jest-expo",
      rootDir: "<rootDir>",
      roots: ["<rootDir>/tests/components"],
      // AsyncStorage는 네이티브 모듈이라 jest-expo가 기본으로 목(mock) 처리해주지 않는다.
      // 이게 없으면 storage.ts를 거치는 화면(lab.tsx가 불러오는 SettingsSheet 등)을
      // 렌더링할 때 "NativeModule: AsyncStorage is null" 에러로 테스트가 실행되지 않는다.
      //
      // 처음엔 이 목 파일을 setupFiles로만 넣었는데 그것만으로는 실제로 효과가 없었다
      // (직접 열어보니 이 파일은 `jest.mock(...)`을 스스로 호출하는 게 아니라 그냥
      // `module.exports = asMock`으로 목 구현체 객체 하나만 내보낼 뿐이다 — 즉
      // setupFiles로 그냥 require만 하면 아무 등록도 안 되고 조용히 버려진다).
      // 그래서 실제 패키지 경로 자체를 이 목 파일로 치환하는 moduleNameMapper를 쓴다 —
      // storage.ts든 SettingsSheet.tsx든, 어디서 얼마나 깊이 import하든 전부 이걸로 대체된다.
      moduleNameMapper: {
        "^@react-native-async-storage/async-storage$":
          "<rootDir>/node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock",
      },
      setupFilesAfterEnv: ["@testing-library/react-native/extend-expect"],
    },
  ],
};
