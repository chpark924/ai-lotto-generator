/**
 * 기획서 14장 로또 연구소 - 기본 당첨 통계 / 조합 패턴 통계.
 * 기기에 캐시된 과거 당첨번호만으로 전부 클라이언트에서 계산한다 (서버 집계 없음).
 */
import { getOddCount, getLowNumberCount, getMaxConsecutiveLength, getNumberSum } from "../lottery/pattern";
import { TOTAL_COMBINATIONS } from "../lottery/probability";
import type { WinningDraw } from "./types";

export interface NumberFrequency {
  number: number;
  totalCount: number;
  bonusCount: number;
  lastDrawNumber: number | null;
}

export function computeNumberFrequencies(draws: WinningDraw[]): NumberFrequency[] {
  const totals = new Map<number, number>();
  const bonuses = new Map<number, number>();
  const lastSeen = new Map<number, number>();

  const markSeen = (n: number, drawNumber: number) => {
    if (!lastSeen.has(n) || drawNumber > (lastSeen.get(n) ?? 0)) {
      lastSeen.set(n, drawNumber);
    }
  };

  for (const draw of draws) {
    for (const n of draw.numbers) {
      totals.set(n, (totals.get(n) ?? 0) + 1);
      markSeen(n, draw.drawNumber);
    }
    bonuses.set(draw.bonusNumber, (bonuses.get(draw.bonusNumber) ?? 0) + 1);
    // lastSeen(=lastDrawNumber)은 getLongestAbsentNumbers()의 "장기 미출현" 판정에 쓰인다.
    // 유저 입장에서는 본번호든 보너스 번호든 화면에 뜬 번호는 "이번에 나온 번호"로 인식하므로
    // (QA_LOG 81번 후속 피드백), 보너스로 나온 회차도 마지막 출현 회차로 반영한다. 다만
    // totalCount(출현 빈도 Top6·사카이 분석 등에서 쓰는 "당첨번호 출현 빈도"의 의미)는 계속
    // 본번호만 센다 — 보너스는 별도로 bonusCount에서 이미 집계하고 있고, "빈도" 자체의 정의를
    // 바꾸는 건 이번 요청 범위가 아니다.
    markSeen(draw.bonusNumber, draw.drawNumber);
  }

  return Array.from({ length: 45 }, (_, i) => i + 1).map((number) => ({
    number,
    totalCount: totals.get(number) ?? 0,
    bonusCount: bonuses.get(number) ?? 0,
    lastDrawNumber: lastSeen.get(number) ?? null,
  }));
}

/** 장기간 나오지 않은 번호 (미출현 회차 수 기준 내림차순). */
export function getLongestAbsentNumbers(
  frequencies: NumberFrequency[],
  latestDrawNumber: number,
  topN = 10
): { number: number; drawsSinceLastSeen: number }[] {
  return frequencies
    .map((f) => ({
      number: f.number,
      drawsSinceLastSeen: f.lastDrawNumber ? latestDrawNumber - f.lastDrawNumber : latestDrawNumber,
    }))
    .sort((a, b) => b.drawsSinceLastSeen - a.drawsSinceLastSeen)
    .slice(0, topN);
}

export interface CombinationPatternStats {
  averageOddCount: number;
  averageLowCount: number;
  averageSum: number;
  consecutiveRatio: number; // 연속번호를 포함한 회차 비율 (0~1)
}

export function computeCombinationPatternStats(draws: WinningDraw[]): CombinationPatternStats {
  if (draws.length === 0) {
    return { averageOddCount: 0, averageLowCount: 0, averageSum: 0, consecutiveRatio: 0 };
  }

  let oddSum = 0;
  let lowSum = 0;
  let numberSum = 0;
  let consecutiveDraws = 0;

  for (const draw of draws) {
    oddSum += getOddCount(draw.numbers);
    lowSum += getLowNumberCount(draw.numbers);
    numberSum += draw.numbers.reduce((s, n) => s + n, 0);
    if (getMaxConsecutiveLength(draw.numbers) >= 2) consecutiveDraws += 1;
  }

  return {
    averageOddCount: oddSum / draws.length,
    averageLowCount: lowSum / draws.length,
    averageSum: numberSum / draws.length,
    consecutiveRatio: consecutiveDraws / draws.length,
  };
}

/**
 * 점수 엔진의 userUniquenessScore(기획서 7.5, 13.4)에서 쓰는 "흔한 선택" 근사치.
 *
 * 주의: 이 값은 실제 타 사용자 선택 데이터의 서버 집계가 아니다(서버가 없으므로 수집 자체를
 * 하지 않는다). 대신 기획서 11.3/13.4에 설명된 일반적인 번호 선택 편향(생일번호 1~31 쏠림,
 * 보기 좋은 패턴 선호)을 정적 규칙으로 근사한 값이며, 실제 당첨 여부와는 무관하다.
 * UI에는 반드시 "일반적인 선택 편향 근사치"라고 표기해야 한다.
 */
export function buildPopularityHeuristic(): number[] {
  const byNumber = new Array(45).fill(0.3); // 기본값

  for (let n = 1; n <= 45; n += 1) {
    let score = 0.3;
    if (n <= 31) score += 0.35; // 생일번호(1~31) 쏠림
    if (n % 10 === 0) score += 0.1; // 10,20,30,40 같은 정갈한 숫자 선호
    if (n === 7) score += 0.15; // 전통적 행운번호
    if (n === 3 || n === 8) score += 0.05;
    if (n >= 41) score -= 0.1; // 41~45는 상대적으로 덜 선택되는 경향
    byNumber[n - 1] = Math.max(0, Math.min(1, score));
  }
  return byNumber;
}

/**
 * 로또 6/45 번호 합계의 이론적 중간값. 최소합(1+2+3+4+5+6=21)과 최대합(40+41+42+43+44+45=255)의
 * 정중앙이다: (21 + 255) / 2 = 138.
 */
export const SUM_MIDPOINT = 138;

export interface SumTrendPoint {
  drawNumber: number;
  drawDate: string;
  sum: number;
  /** sum이 SUM_MIDPOINT 이상이면 true(고합), 미만이면 false(저합). */
  isHigh: boolean;
}

/**
 * 회차별 당첨번호 합계를 중간값(138) 기준 고/저로 분류해 시간순(과거→최신)으로 반환한다.
 * `draws`는 보통 최신순으로 들어오므로(drawCache.ts의 getRecentDraws 참고) 여기서 뒤집는다 —
 * 그래프는 왼쪽이 과거, 오른쪽이 최신이 되는 게 자연스럽기 때문이다.
 *
 * 주의: 이 함수는 어디까지나 "지금까지 실제로 그랬다"는 서술적 통계를 계산할 뿐이다. 로또 추첨은
 * 매회 독립 사건이라 과거 합계의 고/저 패턴이 다음 회차의 확률에 전혀 영향을 주지 않는다
 * (ALL_COMBINATIONS_EQUAL_NOTICE 참고) — 이 값을 소비하는 화면은 반드시 그 취지의 안내문을
 * 함께 표시해야 한다.
 */
export function computeSumTrend(draws: WinningDraw[]): SumTrendPoint[] {
  return [...draws]
    .sort((a, b) => a.drawNumber - b.drawNumber)
    .map((draw) => {
      const sum = getNumberSum(draw.numbers);
      return {
        drawNumber: draw.drawNumber,
        drawDate: draw.drawDate,
        sum,
        isHigh: sum >= SUM_MIDPOINT,
      };
    });
}

/**
 * 표본(`draws`) 내 출현 빈도 상위 N개 번호. AI 조합 탐색의 "고빈도 당첨번호 상위권 포함"
 * 토글이 실제 생성 로직에 반영할 번호 집합을 여기서 산출한다(호출부가 최근 1년치 표본을
 * 넘겨준다는 전제). 동률은 번호 오름차순으로 안정 정렬해 매번 결과가 흔들리지 않게 한다.
 * 표본이 비어 있으면 빈 배열을 반환한다(호출부가 "데이터 없음"으로 처리).
 */
export function getTopFrequentNumbers(draws: WinningDraw[], topN = 10): number[] {
  if (draws.length === 0) return [];
  return [...computeNumberFrequencies(draws)]
    .sort((a, b) => b.totalCount - a.totalCount || a.number - b.number)
    .slice(0, topN)
    .map((f) => f.number);
}

/**
 * 표본(`draws`) 안에서 단 한 번도 나오지 않은 "장기 미출현" 번호 목록(1~45 중). AI 조합
 * 탐색의 "장기 미출현번호 포함" 토글용 — 호출부가 기준 주(週) 수만큼의 최근 회차를 넘기면
 * (기본 12주, 100만 회 부스터 탐색 시 8주), 그 기간 동안 등장하지 않은 번호를 반환한다.
 * 표본이 비어 있으면 빈 배열을 반환한다(호출부가 "데이터 없음"으로 처리).
 */
export function getNumbersAbsentInLastDraws(draws: WinningDraw[]): number[] {
  if (draws.length === 0) return [];
  const appeared = new Set<number>();
  for (const draw of draws) {
    for (const n of draw.numbers) appeared.add(n);
  }
  return Array.from({ length: 45 }, (_, i) => i + 1).filter((n) => !appeared.has(n));
}

/**
 * "사카이 분석법"(일본 로또 명인 후나츠 사카이가 소개한 방법으로 널리 알려진 기법)에서 쓰는
 * "평균 빈도" 번호 집합. 최근 26주(약 6개월) 표본에서 출현 횟수가 지정한 구간(기본 3~4회)에
 * 드는 번호를 고른다 — 너무 자주 나온 번호도, 전혀 안 나온 번호도 아닌 "통계적 평균에 가까운"
 * 번호를 뜻한다. 6/45 기준 26주 표본의 이론적 평균 출현 횟수는 6*26/45 ≈ 3.47회로, 3~4회
 * 구간이 이 평균을 자연스럽게 감싼다. 결과 화면의 "사카이 분석 패턴" 배지가 이 함수를 그대로
 * 사용한다(장식용이 아니라 실제 계산 결과를 기준으로 배지 노출 여부를 판단한다).
 */
export function getSakaiAverageFrequencyNumbers(
  draws: WinningDraw[],
  band: readonly [number, number] = [3, 4]
): number[] {
  if (draws.length === 0) return [];
  const [min, max] = band;
  return computeNumberFrequencies(draws)
    .filter((f) => f.totalCount >= min && f.totalCount <= max)
    .map((f) => f.number);
}

/** 참고용: 과거 당첨 데이터 내 실제 출현 빈도(무작위 추첨 결과이므로 편향의 증거가 아니다). */
export function buildHistoricalFrequencyRatio(draws: WinningDraw[]): number[] {
  const frequencies = computeNumberFrequencies(draws);
  const max = Math.max(1, ...frequencies.map((f) => f.totalCount));
  const byNumber = new Array(45).fill(0);
  for (const f of frequencies) {
    byNumber[f.number - 1] = f.totalCount / max;
  }
  return byNumber;
}

export interface TransitionFrequencyRow {
  /** 기준(트리거) 번호 — 보통 최신 당첨번호 6개 중 하나. */
  triggerNumber: number;
  /** 트리거 번호가 나온 과거 회차 중, 그 다음 회차 데이터까지 확보된 표본 수. 값이 작을수록
   * top 목록의 순위 차이가 통계적으로 무의미할 가능성이 크므로 화면에 항상 함께 노출해야 한다. */
  sampleSize: number;
  top: { number: number; count: number }[];
}

/**
 * "다음 회차 통계 탐색" — 로또 연구소 신규 섹션.
 *
 * ⚠️ 반드시 읽을 것: 로또 6/45 추첨은 회차마다 완전히 독립된 사건이다. 특정 번호가 나온 뒤
 * 다음 회차에 어떤 번호가 더 자주 나왔는지를 집계하면 항상 "1위, 2위, 3위..."라는 순위가
 * 생기지만, 이건 순수하게 표본 크기가 유한해서 생기는 무작위 변동(노이즈)이지 실제 인과관계나
 * 확률적 편향이 아니다. 예: 트리거 번호 1개가 과거 N회 등장했다면, 특정 목표 번호가 "다음
 * 회차"에 나올 기대 횟수는 N×6/45, 표준편차는 √(기대값×(1-6/45))이며, 실제 관측치는 거의
 * 항상 이 범위 안에서만 움직인다. 즉 이 함수의 출력은 "그럼에도 불구하고 과거엔 이랬다"를
 * 보여주는 서술적 통계일 뿐 다음 회차 예측이 아니며, 반드시 TRANSITION_FREQUENCY_NOTICE와
 * 함께 노출해야 한다(§23 사용 금지/권장 표현 원칙과 동일한 원칙 적용).
 *
 * 여러 트리거 번호의 결과를 하나의 "합산 점수"로 더하지 않고 트리거 번호별로 따로 반환한다 —
 * 합산하면 사실상 각 번호의 전체 출현 빈도(핫넘버 여부)를 몇 배로 부풀려 재현할 뿐이라
 * "직전 회차와의 관계"라는 조건 자체가 주는 정보가 없어지고, 오히려 더 그럴듯한 예측처럼
 * 보이는 착시만 커진다.
 *
 * @param draws 표본으로 쓸 과거 당첨 회차. 표본이 작을수록 노이즈가 커지므로 호출부는
 *   가능한 한 많은(이상적으로는 전체) 히스토리를 넘겨야 한다 — lab.tsx는 이 목적으로
 *   RECENT_DRAW_SAMPLE_SIZE(52주)가 아닌 별도의 대용량 표본을 사용한다.
 * @param triggerNumbers 기준이 되는 번호 집합(보통 최신 당첨번호 6개).
 * @param topN 트리거 번호별로 보여줄 다음 회차 후보 개수.
 */
export function computeTransitionFrequencies(
  draws: WinningDraw[],
  triggerNumbers: readonly number[],
  topN = 3
): TransitionFrequencyRow[] {
  if (draws.length === 0 || triggerNumbers.length === 0) return [];

  // drawNumber → WinningDraw 맵으로 "바로 다음 회차"를 찾는다. 배열상 인접 원소가 아니라
  // 실제 drawNumber+1 존재 여부를 기준으로 삼아야, 캐시에 빠진 회차가 있어도 엉뚱한 회차끼리
  // 잘못 이어붙이지 않는다.
  const byDrawNumber = new Map(draws.map((d) => [d.drawNumber, d]));

  return triggerNumbers.map((triggerNumber) => {
    const counts = new Map<number, number>();
    let sampleSize = 0;
    for (const draw of draws) {
      if (!draw.numbers.includes(triggerNumber)) continue;
      const next = byDrawNumber.get(draw.drawNumber + 1);
      if (!next) continue;
      sampleSize += 1;
      for (const n of next.numbers) counts.set(n, (counts.get(n) ?? 0) + 1);
    }

    const top = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, topN)
      .map(([number, count]) => ({ number, count }));

    return { triggerNumber, sampleSize, top };
  });
}

/** 로또 1게임 가격(원). 총판매액에서 게임 수를 역산할 때만 쓰는 상수다. */
const LOTTO_TICKET_PRICE = 1000;

export interface FirstPrizeExpectation {
  drawNumber: number;
  totalSalesAmount: number;
  /** 총판매액 ÷ 1,000원으로 역산한 추정 구매 게임 수(자동/수동 구분 없이 전체). */
  estimatedGameCount: number;
  /** 추정 게임 수가 전부 서로 다른 조합이라 가정했을 때의 이론적(포아송 근사) 1등 기대 인원. */
  expectedWinnerCount: number;
  actualWinnerCount: number;
  /** 실제/기대 비율. 기대 인원이 0에 가까우면(표본 부족) null. */
  ratio: number | null;
  /** (실제 − 기대) ÷ √기대. 포아송 분포 기준 표준화 편차 — 절대값이 클수록 이례적. */
  zScore: number | null;
}

/**
 * 회차별 "기대 대비 실제 1등 당첨자 수" — 로또 연구소 신규 카드.
 *
 * ⚠️ 반드시 읽을 것: 이 함수는 예측이 아니라 순수한 사후 서술 통계다. 총판매액에서 역산한
 * 추정 게임 수를 8,145,060(TOTAL_COMBINATIONS)으로 나누면 "모든 게임이 서로 다른 조합을
 * 골랐다고 가정했을 때"의 이론적 1등 기대 인원이 나온다(포아송 근사). 실제로는 자동/수동
 * 선택 편향으로 특정 조합에 구매가 몰리므로 이 기대값은 근사치일 뿐이며, 이 값과 실제
 * 당첨자 수의 차이(zScore)가 크다고 해서 다음 회차의 확률이 달라지는 것도 아니다 — 반드시
 * FIRST_PRIZE_EXPECTATION_NOTICE와 함께 노출해야 한다(§23 사용 금지/권장 표현 원칙 적용).
 *
 * 데이터가 없거나(과거 극초기 회차 등) 비정상 값이면 null을 반환한다 — 호출부는 카드 자체를
 * 숨겨야 한다.
 */
export function computeFirstPrizeExpectation(draw: WinningDraw): FirstPrizeExpectation | null {
  if (
    draw.totalSalesAmount == null ||
    draw.totalSalesAmount <= 0 ||
    draw.firstPrizeWinnerCount == null ||
    draw.firstPrizeWinnerCount < 0
  ) {
    return null;
  }

  const estimatedGameCount = draw.totalSalesAmount / LOTTO_TICKET_PRICE;
  const expectedWinnerCount = estimatedGameCount / TOTAL_COMBINATIONS;
  const actualWinnerCount = draw.firstPrizeWinnerCount;

  const ratio = expectedWinnerCount > 0 ? actualWinnerCount / expectedWinnerCount : null;
  const zScore =
    expectedWinnerCount > 0 ? (actualWinnerCount - expectedWinnerCount) / Math.sqrt(expectedWinnerCount) : null;

  return {
    drawNumber: draw.drawNumber,
    totalSalesAmount: draw.totalSalesAmount,
    estimatedGameCount,
    expectedWinnerCount,
    actualWinnerCount,
    ratio,
    zScore,
  };
}

/**
 * computeFirstPrizeExpectation() 결과를 유저가 한눈에 이해할 수 있는 한 문장으로 요약한다.
 * 카드에 그대로 노출하기 위한 것이며, 이 문장 자체도 "지금까지 그랬다"는 서술일 뿐 다음
 * 회차 예측이 아니다 — 반드시 FIRST_PRIZE_EXPECTATION_NOTICE와 함께 노출해야 한다.
 */
export function describeFirstPrizeExpectation(exp: FirstPrizeExpectation): string {
  const expected = exp.expectedWinnerCount.toFixed(1);

  if (exp.actualWinnerCount === 0) {
    return `제 ${exp.drawNumber}회는 1등 당첨자가 한 명도 없어 상금이 다음 회차로 이월됐습니다. (판매량 기준 이론적 기대치는 약 ${expected}명)`;
  }
  if (exp.zScore === null) {
    return `제 ${exp.drawNumber}회 1등 당첨자는 ${exp.actualWinnerCount}명입니다.`;
  }

  const absZ = Math.abs(exp.zScore);
  const direction = exp.zScore >= 0 ? "많이" : "적게";

  if (absZ < 1) {
    return `제 ${exp.drawNumber}회 1등 당첨자는 ${exp.actualWinnerCount}명으로, 판매량 기준 이론적 기대치(약 ${expected}명)와 비슷한 수준입니다.`;
  }
  if (absZ < 2) {
    return `제 ${exp.drawNumber}회 1등 당첨자는 ${exp.actualWinnerCount}명으로, 판매량 기준 이론적 기대치(약 ${expected}명)보다 다소 ${direction} 나왔습니다.`;
  }
  return `제 ${exp.drawNumber}회 1등 당첨자는 ${exp.actualWinnerCount}명으로, 판매량 기준 이론적 기대치(약 ${expected}명)보다 꽤 이례적으로 ${direction} 나왔습니다.`;
}
