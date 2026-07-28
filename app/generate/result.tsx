import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { DisclaimerCard, GeneratedGameCard, ProbabilityCard } from "../../src/components";
import { useGenerationStore } from "../../src/state/generationStore";
import { buildGameFeatures, explainGameLocally } from "../../src/lib/ai";
import { getGenerationHistory, saveTicket } from "../../src/lib/storage";
import { buildPopularityHeuristic } from "../../src/lib/draws/drawStats";
import { estimateLatestDrawNumber } from "../../src/lib/draws/drawApi";
import { generateAiSearchGames, buildBasicGenerationResult } from "../../src/lib/lottery/generator";
import type { GeneratedGame } from "../../src/lib/lottery/types";

export default function ResultScreen() {
  const router = useRouter();
  const { lastResult, lastRequest, setResult } = useGenerationStore();
  const [explanations, setExplanations] = useState<Record<string, string>>({});

  const canRegenerate =
    lastRequest?.mode === "AI_SEARCH" || lastRequest?.mode === "EXCLUSION" || lastRequest?.mode === "PURE_RANDOM";

  useEffect(() => {
    if (!lastResult) return;
    (async () => {
      const [history, popularity] = await Promise.all([
        getGenerationHistory(),
        Promise.resolve(buildPopularityHeuristic()),
      ]);
      const next: Record<string, string> = {};
      for (const game of lastResult.games) {
        const features = buildGameFeatures(game, popularity, history);
        next[game.id] = explainGameLocally(features);
      }
      setExplanations(next);
    })();
  }, [lastResult]);

  if (!lastResult || !lastRequest) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>표시할 생성 결과가 없습니다.</Text>
        <Pressable style={styles.emptyButton} onPress={() => router.replace("/(tabs)/generate")}>
          <Text style={styles.emptyButtonText}>번호 만들기로 이동</Text>
        </Pressable>
      </View>
    );
  }

  async function handleSave(game: GeneratedGame, status: "SAVED" | "PLANNED") {
    const nextDrawNumber = estimateLatestDrawNumber() + 1;
    await saveTicket(game, status, nextDrawNumber);
    Alert.alert(
      status === "SAVED" ? "저장했습니다." : "구매 예정으로 등록했습니다.",
      `제 ${nextDrawNumber}회 기준으로 등록했어요. 내 번호 탭에서 회차를 바꿀 수 있어요.`
    );
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
    if (!lastRequest) return;
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
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
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
          footer={
            <View style={styles.cardFooter}>
              <Pressable style={styles.footerButton} onPress={() => handleSave(game, "SAVED")}>
                <Text style={styles.footerButtonText}>번호 저장</Text>
              </Pressable>
              <Pressable style={styles.footerButton} onPress={() => handleSave(game, "PLANNED")}>
                <Text style={styles.footerButtonText}>구매 예정 등록</Text>
              </Pressable>
              <Pressable style={styles.footerButton} onPress={() => handleShare(game)}>
                <Text style={styles.footerButtonText}>공유</Text>
              </Pressable>
            </View>
          }
        />
      ))}

      <DisclaimerCard text={lastResult.disclaimer} />

      {canRegenerate ? (
        <Pressable style={styles.regenerateButton} onPress={handleRegenerate}>
          <Text style={styles.regenerateButtonText}>같은 조건으로 다시 생성</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  noticeCard: {
    backgroundColor: "#EDE9FE",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  noticeText: { color: "#5B21B6", fontSize: 12, fontWeight: "600", lineHeight: 20 },
  cardFooter: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  footerButton: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  footerButtonText: { color: "#4338CA", fontSize: 12, fontWeight: "700" },
  regenerateButton: {
    backgroundColor: "#0F172A",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  regenerateButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyText: { color: "#64748B", fontSize: 14, marginBottom: 16 },
  emptyButton: { backgroundColor: "#2563EB", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  emptyButtonText: { color: "#fff", fontWeight: "700" },
});
