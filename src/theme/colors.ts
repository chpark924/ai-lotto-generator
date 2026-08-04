/**
 * 라이트/다크 공통 색상 토큰.
 *
 * 브랜드 블루(#2563EB)나 로또공 색상, "항상 어두운" 히어로/CTA 카드(#0F172A 배경 + 흰 텍스트)처럼
 * 시스템 테마와 무관하게 고정되어야 하는 색은 각 화면에 그대로 남겨둔다. 여기 정의하는 토큰은
 * 화면 배경, 카드/서피스, 텍스트, 테두리처럼 라이트/다크에 따라 실제로 뒤집혀야 하는 값만 다룬다.
 */
export interface AppColors {
  /** 화면 최상위 배경 (ScrollView/View container) */
  background: string;
  /** 카드, 입력창 등 배경 위에 얹히는 서피스 */
  surface: string;
  /** 살짝 더 튀어나오거나 눌린 상태를 표현하는 보조 서피스 (예: 칩, 눌림 상태 배경) */
  surfaceAlt: string;
  /** 제목 등 가장 진한 본문 텍스트 */
  textPrimary: string;
  /** 본문보다 한 단계 옅은 보조 텍스트 (설명문 등) */
  textSecondary: string;
  /** 캡션·안내문처럼 가장 옅은 텍스트. 배경 대비 AA(4.5:1) 기준을 만족한다. */
  textMuted: string;
  /** 카드/입력창 테두리, 구분선 */
  border: string;
  /** 스켈레톤 로딩 블록 */
  skeleton: string;
  /** 모달/바텀시트 배경 오버레이 */
  overlay: string;
}

export const lightColors: AppColors = {
  background: "#F8FAFC",
  surface: "#FFFFFF",
  surfaceAlt: "#F1F5F9",
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#64748B",
  border: "#E2E8F0",
  skeleton: "#E2E8F0",
  overlay: "rgba(0,0,0,0.4)",
};

export const darkColors: AppColors = {
  background: "#0B1220",
  surface: "#161F32",
  surfaceAlt: "#1E293B",
  textPrimary: "#F1F5F9",
  textSecondary: "#CBD5E1",
  textMuted: "#94A3B8",
  border: "#26314A",
  skeleton: "#1E293B",
  overlay: "rgba(0,0,0,0.6)",
};

/**
 * 화면 곳곳에서 쓰이는 상태 배지(태그) 색. 라이트 모드는 옅은 배경 + 진한 글자,
 * 다크 모드는 같은 색상 계열을 어둡게 눌러서 배경으로 쓰고 글자는 밝게 올린다.
 */
export interface TintColors {
  bg: string;
  fg: string;
}

export interface AppTints {
  indigo: TintColors;
  green: TintColors;
  orange: TintColors;
  red: TintColors;
  purple: TintColors;
  slate: TintColors;
}

export const lightTints: AppTints = {
  indigo: { bg: "#EEF2FF", fg: "#4338CA" },
  green: { bg: "#ECFDF5", fg: "#047857" },
  orange: { bg: "#FFF7ED", fg: "#C2410C" },
  red: { bg: "#FEE2E2", fg: "#DC2626" },
  purple: { bg: "#EDE9FE", fg: "#5B21B6" },
  slate: { bg: "#F1F5F9", fg: "#475569" },
};

export const darkTints: AppTints = {
  indigo: { bg: "#312E81", fg: "#C7D2FE" },
  green: { bg: "#064E3B", fg: "#6EE7B7" },
  orange: { bg: "#7C2D12", fg: "#FDBA74" },
  red: { bg: "#7F1D1D", fg: "#FCA5A5" },
  purple: { bg: "#4C1D95", fg: "#DDD6FE" },
  slate: { bg: "#1E293B", fg: "#CBD5E1" },
};
