/**
 * 동행복권 로또 6/45 용지 QR코드 파서.
 *
 * 동행복권은 공식 파일 포맷 문서를 공개하지 않는다. 아래 로직은 실제로 발급된 QR코드가
 * 가리키는 URL(`https://m.dhlottery.co.kr/qr.do?method=winQr&v=...`) 여러 건을 비교해
 * 역으로 추정한 구조다:
 *
 *   v = [회차 4자리] + ([게임유형 1글자][번호 6개 × 2자리 = 12자리]) × 1~5게임
 *   예) v=1195m060713162425m050912202126m051820364243m051427303943m152733343637
 *       → 1195회, 5게임(각 수동 "m"), 첫 게임 = 06 07 13 16 24 25
 *
 * 게임 유형 글자는 관찰된 범위에서 수동(m) 위주였고 자동/반자동 글자는 확실히 검증하지
 * 못했다 — 그래서 이 값은 참고용으로만 노출하고(UNKNOWN 허용), 당첨 등수 판정에는
 * 전혀 사용하지 않는다.
 *
 * 그 뒤에 붙는 추가 문자열(체크섬 등으로 추정)은 여러 회차의 샘플에서 서로 다른 번호인데도
 * 동일한 값이 관찰돼 신뢰할 수 없다고 판단해 아예 파싱하지 않는다. 이 파서는 "회차 번호 +
 * 번호 6개"만 뽑아내고, 실제 당첨 여부는 항상 동행복권에서 그 회차의 공식 당첨번호를 다시
 * 조회해(`getDrawByNumberWithStatus`) 로컬에서 재계산한다(`computeRank`) — QR 안에 있을지
 * 모르는 자체 "당첨" 플래그는 애초에 신뢰하지 않는 구조라, 이 부분이 부정확해도 최종 결과의
 * 정확성에는 영향이 없다.
 */

export type LottoQrGameType = "AUTO" | "MANUAL" | "SEMI_AUTO" | "UNKNOWN";

export interface ParsedLottoQrGame {
  gameType: LottoQrGameType;
  numbers: number[];
}

export interface ParsedLottoQr {
  drawNumber: number;
  games: ParsedLottoQrGame[];
}

export type LottoQrParseResult =
  | { status: "success"; data: ParsedLottoQr }
  /** 동행복권 당첨 확인 QR로 전혀 인식되지 않는 코드 (도메인/형식 불일치). */
  | { status: "not_lotto_qr" }
  /** 동행복권 QR로 보이지만 안에 담긴 회차/번호 데이터가 규칙에 맞지 않음. */
  | { status: "unrecognized_data" };

const GAME_TYPE_MAP: Record<string, LottoQrGameType> = {
  m: "MANUAL",
  a: "AUTO",
  b: "SEMI_AUTO",
};

const MAX_GAMES = 5;
const GAME_BLOCK_LENGTH = 13; // 게임유형 1글자 + 번호 12자리
const NUMBERS_PER_GAME = 6;

// 2026-08 조사 결과 동행복권이 dhlottery.co.kr에서 donghanglottery.com으로 사이트를
// 개편한 것으로 보인다(QA_LOG.md 참고). 이 QR 파서는 원래 dhlottery.co.kr 용지로만 검증한
// 것이라, 개편 이후 발급된 실물 용지의 QR이 새 도메인(예: donghanglottery.com)을 가리킬
// 가능성이 있다 — 다만 실제 신규 발급 용지로 확인은 못 했다(개발 환경에 실인터넷이 없음).
// 그래서 도메인 검사를 두 도메인 다 허용하도록 넉넉하게 잡는다. 이렇게 넓혀도 안전한 이유:
// 이 파서는 회차/번호만 뽑아낼 뿐이고, 실제 당첨 여부는 항상 서버(동행복권)에서 그 회차의
// 공식 당첨번호를 다시 조회해 로컬 재계산하므로(getDrawByNumberWithStatus/computeRank), QR
// 안의 도메인이나 번호가 조작됐다 해도 "존재하지 않는 조합"으로 처리될 뿐 오탐 위험이 없다.
// TODO: 실기기에서 개편 이후 실제 발급된 용지로 QR을 스캔해 이 정규식이 맞는지 확인 필요.
const KNOWN_WIN_QR_URL_PATTERN = /(dhlottery\.co\.kr|donghanglottery\.com)\/qr\.do\?/;

/** URL 전체(예: 카메라로 스캔한 QR 원문)에서 v= 파라미터 값을 뽑아낸다. */
function extractVParam(raw: string): string | null {
  const trimmed = raw.trim();

  // 동행복권 당첨 확인 URL 형태 (모바일/PC 도메인, 신구 도메인 모두 허용).
  const isDhlotteryWinQrUrl = KNOWN_WIN_QR_URL_PATTERN.test(trimmed) && /method=winQr/.test(trimmed);
  if (isDhlotteryWinQrUrl) {
    const match = trimmed.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
  }

  // URL이 아니라 v 값 자체만 담긴 QR(일부 서드파티 발급 용지)도 방어적으로 지원한다.
  // 최소 "회차 4자리 + 게임 1블록(13자리)" 형태를 그대로 만족해야만 허용한다.
  if (/^\d{4}[a-zA-Z]\d{12}/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

function parseGameBlock(block: string): ParsedLottoQrGame | null {
  const typeChar = block[0].toLowerCase();
  const digits = block.slice(1);
  if (!/^\d{12}$/.test(digits)) return null;

  const numbers: number[] = [];
  for (let i = 0; i < NUMBERS_PER_GAME; i += 1) {
    const pair = digits.slice(i * 2, i * 2 + 2);
    const n = Number(pair);
    if (!Number.isInteger(n) || n < 1 || n > 45) return null;
    numbers.push(n);
  }
  if (new Set(numbers).size !== NUMBERS_PER_GAME) return null;

  return {
    gameType: GAME_TYPE_MAP[typeChar] ?? "UNKNOWN",
    numbers: numbers.sort((a, b) => a - b),
  };
}

/** 카메라로 스캔한 QR 원문 텍스트를 파싱한다. */
export function parseLottoQrText(raw: string): LottoQrParseResult {
  const vValue = extractVParam(raw);
  if (!vValue) return { status: "not_lotto_qr" };

  const roundMatch = vValue.match(/^(\d{4})/);
  if (!roundMatch) return { status: "unrecognized_data" };

  const drawNumber = Number(roundMatch[1]);
  if (!Number.isInteger(drawNumber) || drawNumber < 1) {
    return { status: "unrecognized_data" };
  }

  let cursor = vValue.slice(4);
  const games: ParsedLottoQrGame[] = [];

  while (games.length < MAX_GAMES && cursor.length >= GAME_BLOCK_LENGTH) {
    const block = cursor.slice(0, GAME_BLOCK_LENGTH);
    const game = parseGameBlock(block);
    if (!game) break; // 이후는 체크섬 등 알 수 없는 꼬리 데이터로 간주하고 중단한다.
    games.push(game);
    cursor = cursor.slice(GAME_BLOCK_LENGTH);
  }

  if (games.length === 0) return { status: "unrecognized_data" };

  return { status: "success", data: { drawNumber, games } };
}
