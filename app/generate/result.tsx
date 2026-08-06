import React, { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { DisclaimerCard, GeneratedGameCard, LottoBallLoader, ProbabilityCard } from "../../src/components";
import { useGenerationStore } from "../../src/state/generationStore";
import { buildGameFeatures, explainGameLocally } from "../../src/lib/ai";
import { getGenerationHistory, saveTicket } from "../../src/lib/storage";
import { buildPopularityHeuristic, getSakaiAverageFrequencyNumbers } from "../../src/lib/draws/drawStats";
import { buildOfficialPurchasePageUrl, estimateLatestDrawNumber } from "../../src/lib/draws/drawApi";
import { getRecentDrawsSafe } from "../../src/lib/draws/drawCache";
import { generateAiSearchGames, buildBasicGenerationResult } from "../../src/lib/lottery/generator";
import {
  computeBatchLevelBadges,
  computeGameLevelBadges,
  type ResultBadge,
  type SakaiAnalysisInputs,
} from "../../src/lib/lottery/resultBadges";
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
      const nextExplanations: Record<string, string> = {};
      const nextBadges: Record<string, ResultBadge[]> = {};
      for (const game of lastResult.games) {
        const features = buildGameFeatures(game, popularity, history, recentWinningNumbers);
        nextExplanations[game.id] = explainGameLocally(features);
        // 사카이 분석 패턴만 게임마다 계산한다 — 몬테카를로/EV/휠링/끝수 스프레드는 탐색
        // 조건(request)만으로 결정되는 배치 단위 사실이라 카드마다 반복하지 않고 화면
        // 상단에 한 번만 보여준다(아래 batchBadges 참고).
        nextBadges[game.id] = computeGameLevelBadges(game, sakaiInputs);
      }
      setExplanations(nextExplanations);
      setBadgesByGameId(nextBadges);
    })();
  }, [lastResult]);

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

  // 몬테카를로 탐색/EV 최적화/휠링 방식 분산/끝수 스프레드 최적화는 탐색 조건(request)만으로
  // 정해지는 배치 단위 사실이라, 카드마다 반복하지 않고 화면 상단에 한 번만 계산해서
  // 보여준다(resultBadges.ts 참고). lastRequest만으로 즉시 계산되는 순수 함수라 별도
  // useEffect/state 없이 렌더링 시점에 바로 구한다.
  const batchBadges = computeBatchLevelBadges(lastRequest);

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

  function handleOpenPurchasePage() {
    Linking.openURL(buildOfficialPurchasePageUrl()).catch(() => {
      Alert.alert("페이지를 열 수 없습니다.");
    });
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

      {batchBadges.length > 0 ? (
        <View
          style={styles.batchBadgeRow}
          accessible
          accessibilityLabel={`이번 탐색에 적용된 방식: ${batchBadges.map((b) => b.label).join(", ")}`}
        >
          {batchBadges.map((badge) => (
            <View key={badge.key} style={styles.batchBadgeChip}>
              <Text maxFontSizeMultiplier={1.3} style={styles.batchBadgeChipText}>
                {badge.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

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

      <View style={styles.purchaseSection}>
        <Pressable
          style={styles.purchaseButton}
          onPress={handleOpenPurchasePage}
          accessibilityRole="button"
          accessibilityLabel="동행복권 공식 사이트에서 구매하기, 앱을 벗어나 외부 웹사이트로 이동합니다"
        >
          <Text style={styles.purchaseButtonText}>공식 사이트에서 구매하기</Text>
          <Ionicons name="open-outline" size={16} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.purchaseCaption}>
          동행복권 홈페이지로 이동해요. 번호는 자동으로 입력되지 않아 직접 선택해야 해요.
        </Text>
      </View>

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
    // GeneratedGameCard의 배지 칩과 같은 톤(초록)을 써서 "같은 종류의 정보"임을 시각적으로
    // 연결한다 — 다만 여기는 카드 안이 아니라 화면 상단에 한 번만 뜬다(배치 단위 정보라
    // 카드마다 반복하지 않기로 한 결정, QA_LOG 48번 참고).
    batchBadgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
    batchBadgeChip: {
      backgroundColor: tints.green.bg,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    batchBadgeChipText: { fontSize: 11, color: tints.green.fg, fontWeight: "600" },
    cardFooter: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
    // 저장/구매예정/공유(카드별 인디고 버튼)나 다시 생성(브랜드 다크 버튼)과는 일부러 다른
    // 톤(테두리만 있는 아웃라인)을 써서 "이 버튼만 앱을 벗어나 외부 사이트로 이동한다"는 걸
    // 시각적으로도 구분한다. 카드마다 반복하지 않고 화면당 한 번만 노출(QA_LOG 49번 참고).
    purchaseSection: { marginTop: 4, marginBottom: 8 },
    purchaseButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingVertical: 14,
      backgroundColor: colors.surface,
    },
    purchaseButtonText: { color: colors.textPrimary, fontWeight: "700", fontSize: 15 },
    purchaseCaption: {
      color: colors.textMuted,
      fontSize: 11,
      textAlign: "center",
      marginTop: 6,
      lineHeight: 16,
    },
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
