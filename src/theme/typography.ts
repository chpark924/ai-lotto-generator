/**
 * [DESIGN_GUIDE.md 5절 / Phase 5b, 2026-09-10] Pretendard 폰트 패밀리 이름.
 *
 * React Native는 웹과 달리 하나의 fontFamily에 여러 굵기(fontWeight)를 자동으로
 * 매핑해주지 않는다 — 특히 이 앱처럼 React 19 + RN 0.81(새 아키텍처) 조합에서는
 * `Text.defaultProps`로 전역 기본 폰트를 주입하는 예전 트릭도 신뢰할 수 없다(함수
 * 컴포넌트의 defaultProps는 React 19에서 지원이 빠졌다). 그래서 굵기별로 별도 폰트
 * 파일(assets/fonts/Pretendard-*.otf)을 따로 등록하고(app/_layout.tsx의 useFonts),
 * 화면의 각 텍스트 스타일이 이 상수를 통해 명시적으로 fontFamily를 지정하는 방식을
 * 쓴다. 이번 1차 반영 범위는 가이드 5절의 상위 타이포 계층(Hero/페이지 제목/섹션
 * 제목/카드 제목/버튼)까지다 — 12px 이하 캡션·안내문 등 하위 계층은 시스템 폰트를
 * 그대로 두고, 실기기 확인 후 다음 라운드에서 필요하면 넓힌다(QA_LOG 참고).
 */
export const fontFamily = {
  regular: "Pretendard-Regular",
  medium: "Pretendard-Medium",
  semiBold: "Pretendard-SemiBold",
  bold: "Pretendard-Bold",
} as const;
