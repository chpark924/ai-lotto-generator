import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { DisclaimerCard, GeneratedGameCard, LottoBallLoader, ProbabilityCard } from "../../src/components";
import { useGenerationStore } from "../../src/state/generationStore";
import { buildGameFeatures, explainGameLocally } from "../../src/lib/ai";
import { getGenerationHistory, saveTicket } from "../../src/lib/storage";
import { buildPopularityHeuristic, getSakaiAverageFrequencyNumbers } from "../../src/lib/draws/drawStats";
import { estimateLatestDrawNumber } from "../../src/lib/draws/drawApi";
import { getRecentDrawsSafe } from "../../src/lib/draws/drawCache";
import { generateAiSearchGames, buildBasicGenerationResult } from "../../src/lib/lottery/generator";
import { isLastDigitSpreadOptimizationActive } from "../../src/lib/lottery/scoring";
import { computeResultBadges, type ResultBadge, type SakaiAnalysisInputs } from "../../src/lib/lottery/resultBadges";
import type { GeneratedGame } from "../../src/lib/lottery/types";
import { useAppTheme, type AppColors, type AppTints } from "../../src/theme";

/** 결과 설명에 쓸 "최근 4주(회차) 실제 당첨번호" 합집합. 못 불러오면 null. */
const RECENT_WEEKS_FOR_EXPLANATION = 4;
async function loadRecentWinningNumbers(): Promise<number[] | null> {
  const draws = await getRecentDrawsSafe(RECENT_WEEKS_FOR_EXPLANATION);
  if (draws.length === 0) return null;
  return [...new Set(draws.flatMap((d) => d.numbers))];
}

/** "사카이 분석 패턴" 배지에 쓰는 표본 크기 (최근 26주 ≈ 6개월). drawStats.ts 참고. */
const SAKAI_ANALYSIS_WINDOW_WEEKS = 26;
async function loadSakaiAnalysisInputs(): Promise<SakaiAnalysisInputs | null> {
  const draws = await getRecentDrawsSafe(SAKAI_ANALYSIS_WINDOW_WEEKS);
  if (draws.length === 0) return null;
  return {
    averageFrequencyNumbers: getSakaiAverageFrequencyNumbers(draws),
    // draws는 최신순으로 반환되므로(drawCache.ts) draws[0]이 직전 회차("이월수" 후보)다.
    previousDrawNumbers: draws[0].numbers,
  };
}

export default function ResultScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, tints } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors, tints), [colors, tints]);
  const { lastResult, lastRequest, setResult } = useGenerationStore();
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [badgesByGameId, setBadgesByGameId] = useState<Record<string, ResultBadge[]>>({});
  const [isRegenerating, setIsRegenerating] = useState(false);

  const canRegenerate =
    lastRequest?.mode === "AI_SEARCH" || lastRequest?.mode === "EXCLUSION" || lastRequest?.mode === "PURE_RANDOM";

  useEffect(() => {
    if (!lastResult) return;
    (async () => {
      const [history, popularity, recentWinningNumbers, sakaiInputs] = await Promise.all([
        getGenerationHistory(),
        Promise.resolve(buildPopularityHeuristic()),
        loadRecentWinningNumbers(),
        loadSakaiAnalysisInputs(),
      ]);
      // "끝수 최적화" 노출 여부는 scoring.ts가 실제로 그 최적화를 적용했는지를 판단하는
      // 기준과 동일한 함수(isLastDigitSpreadOptimizationActive)로 결정한다 — 설명 문구와
      // 실제 생성 로직이 어긋날 일이 없다.
      const lastDigitSpreadOptimized = lastRequest
        ? isLastDigitSpreadOptimizationActive(lastRequest)
        : false;
      const nextExplanations: Record<string, string> = {};
      const nextBadges: Record<string, ResultBadge[]> = {};
      for (const game of lastResult.games) {
        const features = buildGameFeatures(
          game,
          popularity,
          history,
          recentWinningNumbers,
          lastDigitSpreadOptimized
        );
        nextExplanations[game.id] = explainGameLocally(features);
        nextBadges[game.id] = lastRequest ? computeResultBadges(game, lastRequest, sakaiInputs) : [];
      }
      setExplanations(nextExplanations);
      setBadgesByGameId(nextBadges);
    })();
    // lastRequest는 항상 lastResult와 함께 setResult()로 동시에 갱신되므로(generationStore.ts),
    // 두 값을 별도 의존성으로 둬도 추가 재실행이 생기지 않는다.
  }, [lastResult, lastRequest]);

  if (!lastResult || !lastRequest) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>표시할 생성 결과가 없습니다.</Text>
        <Pressable
          style={styles.emptyButton}
          onPress={() => router.replace("/(tabs)/generate")}
          accessibilityRole="button"
          accessibilityLabel="번호 만들기로 이동"
        >
          <Text style={styles.emptyButtonText}>번호 만들기로 이동</Text>
        </Pressable>
      </View>
    );
  }

  async function handleSave(game: GeneratedGame, status: "SAVED" | "PLANNED") {
    const nextDrawNumber = estimateLatestDrawNumber() + 1;
    try {
      await saveTicket(game, status, nextDrawNumber);
      Alert.alert(
        status === "SAVED" ? "저장했습니다." : "구매 예정으로 등록했습니다.",
        `제 ${nextDrawNumber}회 기준으로 등록했어요. 내 번호 탭에서 회차를 바꿀 수 있어요.`
      );
    } catch {
      Alert.alert("저장 실패", "번호를 저장하지 못했어요. 다시 시도해주세요.");
    }
  }

  async function handleShare(game: GeneratedGame) {
    const numbersText = game.numbers.join(" · ");
    try {
      await Share.share({
        message: `내 로또 번호: ${numbersText}\n\n로또 6/45의 모든 조합은 1/8,145,060의 동일한 확률을 가집니다. 엔터테인먼트용 번호 생성 앱으로 만들었어요.`,
      });
    } catch {
      // 사용자가 공유를 취소한 경우 등은 조용히 무시한다.
    }
  }

  async function handleRegenerate() {
    if (!lastRequest || isRegenerating) return;
    setIsRegenerating(true);
    try {
      if (lastRequest.mode === "AI_SEARCH") {
        const [history, popularity] = await Promise.all([
          lastRequest.avoidMySavedNumbers ? getGenerationHistory() : Promise.resolve([]),
          Promise.resolve(buildPopularityHeuristic()),
        ]);
        const result = await generateAiSearchGames(lastRequest, {
          popularityByNumber: lastRequest.avoidPopularNumbers ? popularity : new Array(45).fill(0),
          savedCombinations: history,
        });
        setResult(lastRequest, result);
      } else {
        const result = buildBasicGenerationResult(lastRequest);
        setResult(lastRequest, result);
      }
    } finally {
      setIsRegenerating(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
    >
      {lastResult.resultNotice ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeText}>{lastResult.resultNotice}</Text>
        </View>
      ) : null}

      <ProbabilityCard probability={lastResult.probability} simulation={lastResult.simulation} />

      {lastResult.games.map((game) => (
        <GeneratedGameCard
          key={game.id}
          game={game}
          explanation={explanations[game.id]}
          badges={badgesByGameId[game.id]}
          footer={
            <View style={styles.cardFooter}>
              <Pressable
                style={styles.footerButton}
                onPress={() => handleSave(game, "SAVED")}
                accessibilityRole="button"
                accessibilityLabel="번호 저장"
              >
                <Text style={styles.footerButtonText}>번호 저장</Text>
              </Pressable>
              <Pressable
                style={styles.footerButton}
                onPress={() => handleSave(game, "PLANNED")}
                accessibilityRole="button"
                accessibilityLabel="구매 예정 등록"
              >
                <Text style={styles.footerButtonText}>구매 예정 등록</Text>
              </Pressable>
              <Pressable
                style={styles.footerButton}
                onPress={() => handleShare(game)}
                accessibilityRole="button"
                accessibilityLabel="번호 공유"
              >
                <Text style={styles.footerButtonText}>공유</Text>
              </Pressable>
            </View>
          }
        />
      ))}

      <DisclaimerCard text={lastResult.disclaimer} />

      {canRegenerate ? (
        isRegenerating ? (
          <View style={styles.regenerateLoadingContainer}>
            <LottoBallLoader />
            <Text style={styles.regenerateLoadingText}>다시 생성하는 중...</Text>
          </View>
        ) : (
          <Pressable
            style={styles.regenerateButton}
            onPress={handleRegenerate}
            disabled={isRegenerating}
            accessibilityRole="button"
            accessibilityLabel="같은 조건으로 다시 생성"
            accessibilityState={{ disabled: isRegenerating }}
          >
            <Text style={styles.regenerateButtonText}>같은 조건으로 다시 생성</Text>
          </Pressable>
        )
      ) : null}
    </ScrollView>
  );
}

function createStyles(colors: AppColors, tints: AppTints) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    noticeCard: {
      backgroundColor: tints.purple.bg,
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
    },
    noticeText: { color: tints.purple.fg, fontSize: 12, fontWeight: "600", lineHeight: 20 },
    cardFooter: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
    footerButton: {
      backgroundColor: tints.indigo.bg,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
    },
    footerButtonText: { color: tints.indigo.fg, fontSize: 12, fontWeight: "700" },
    // 재생성 버튼/로딩 카드는 항상 어두운 브랜드 톤을 유지한다.
    regenerateButton: {
      backgroundColor: "#0F172A",
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 8,
    },
    regenerateButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    regenerateLoadingContainer: {
      backgroundColor: "#0F172A",
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 8,
    },
    regenerateLoadingText: { color: "#fff", fontWeight: "700", fontSize: 13, marginTop: 8 },
    emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.background },
    emptyText: { color: colors.textMuted, fontSize: 14, marginBottom: 16 },
    emptyButton: { backgroundColor: "#2563EB", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
    emptyButtonText: { color: "#fff", fontWeight: "700" },
  });
}
