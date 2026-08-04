import { computeRank } from "../draws/rank";
import type { WinningDraw } from "../draws/types";
import type { ParsedLottoQrGame } from "./parseLottoQr";

export interface CheckedLottoQrGame {
  numbers: number[];
  gameType: ParsedLottoQrGame["gameType"];
  rank: 0 | 1 | 2 | 3 | 4 | 5;
}

/**
 * 파싱된 QR 게임들을 실제 당첨번호(draw)와 대조해 게임별 등수를 계산한다.
 * QR 안에 있을지 모르는 자체 "당첨" 표시는 쓰지 않고, 항상 이 함수(=computeRank)로
 * 로컬 재계산한 값만 신뢰한다. 화면(qr-check.tsx)과 테스트가 동일한 로직을 공유한다.
 */
export function buildCheckedLottoQrGames(games: ParsedLottoQrGame[], draw: WinningDraw): CheckedLottoQrGame[] {
  return games.map((g) => ({
    numbers: g.numbers,
    gameType: g.gameType,
    rank: computeRank(g.numbers, draw),
  }));
}
