// 최소 린트 설정. 목적은 스타일 강제가 아니라 "함수 흐름이 끊긴 죽은 코드"·
// "안 쓰는 변수" 같은, 리뷰에서 실제로 놓쳤던 버그를 자동으로 잡는 것이다
// (app/(tabs)/lab.tsx의 loadLabData()에 조기 return이 있어 그 아래 코드 전체가
// 도달 불가능했던 버그가 이 설정만 있었어도 즉시 잡혔을 것 — 2026-08-04 리뷰 참고).
//
// 그래서 규칙을 늘리기보다 js/ts 권장 프리셋 그대로만 켠다. 프로젝트 스타일(세미콜론,
// 따옴표 등)은 강제하지 않는다 — 필요해지면 이후에 추가하면 된다.
//
// 2026-08-04 사용자 로컬 환경에서 처음 실행해보고 아래 세 가지를 추가로 다듬었다
// (제 세션 환경에서는 eslint 자체를 설치할 수 없어 실행 확인을 못 했던 부분들):
//  1. babel.config.js/jest.config.js 등 Node 스크립트에서 `module`/`require`/`console`을
//     "정의되지 않음"으로 오탐하던 문제 → 해당 파일들에 Node 전역을 명시.
//  2. Dice45.tsx/SettingsSheet.tsx에 이미 있던 `eslint-disable-next-line
//     react-hooks/exhaustive-deps` 주석이 정작 그 규칙을 제공하는 플러그인이 없어서
//     "존재하지 않는 규칙" 에러로 뒤집혔던 문제 → eslint-plugin-react-hooks 추가.
//  3. RN/Expo에서 이미지 등 정적 에셋을 불러올 때 쓰는 `require("./assets/x.png")`
//     패턴을 `no-require-imports`가 막던 문제 → 이 프로젝트에선 끈다(Metro 번들러가
//     정적 에셋을 다루는 표준 방식이라 import로 대체할 수 없음).
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      ".expo/**",
      "android/**",
      "ios/**",
      "dist/**",
      "web-build/**",
      "assets/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      // RN/Expo 코드베이스 전반에서 관용적으로 쓰는 패턴을 오탐으로 막지 않기 위한 완화.
      // 언더스코어 접두사 인자(예: 사용하지 않는 콜백 파라미터)는 허용한다.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // any는 점진적으로 줄여나갈 대상이라 error가 아닌 warn으로 시작한다.
      "@typescript-eslint/no-explicit-any": "warn",
      // Metro가 정적 에셋(이미지 등)을 요구하는 표준 방식이 require()라 끈다.
      "@typescript-eslint/no-require-imports": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    // Node에서 직접 실행되는 설정/스크립트 파일: module/require/process/console 등
    // Node 전역이 실제로 쓰이므로 no-undef가 오탐하지 않도록 전역을 등록한다.
    files: ["**/*.config.js", "**/*.config.mjs", "smoke_test.mjs"],
    languageOptions: {
      globals: {
        module: "writable",
        exports: "writable",
        require: "readonly",
        process: "readonly",
        console: "readonly",
        __dirname: "readonly",
      },
    },
  }
);
