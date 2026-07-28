import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Dice45, DisclaimerCard, LottoBall, NumberGrid } from "../../src/components";
import { rollDice45 } from "../../src/lib/lottery/dice";
import { buildGameMetadata } from "../../src/lib/lottery/pattern";
import { calculateFirstPrizeProbability, PROBABILITY_DISCLAIMER } from "../../src/lib/lottery/probability";
import { useGenerationStore } from "../../src/state/generationStore";
import type { GeneratedGame, GenerationRequest } from "../../src/lib/lottery/types";

export default function DiceScreen() {
  const router = useRouter();
  const setResult = useGenerationStore((s) => s.setResult);
  const [excluded, setExcluded] = useState<number[]>([]);
  const [rolled, setRolled] = useState<number[]>([]);
  const [showExclusionPicker, setShowExclusionPicker] = useState(false);
  const [diceNumber, setDiceNumber] = useState<number | null>(null);
  const [diceSpinTrigger, setDiceSpinTrigger] = useState(0);

  function toggleExcluded(n: number) {
    setExcluded((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }

  function rollOnce() {
    if (rolled.length >= 6) return;
    const next = rollDice45(excluded, rolled);
    setRolled((prev) => [...prev, next].sort((a, b) => a - b));
    setDiceNumber(next);
    setDiceSpinTrigger((t) => t + 1);
  }

  function rollAllSix() {
    let current = [...rolled];
    let last: number | null = null;
    while (current.length < 6) {
      last = rollDice45(excluded, current);
      current = [...current, last];
    }
    setRolled(current.sort((a, b) => a - b));
    if (last !== null) {
      setDiceNumber(last);
      setDiceSpinTrigger((t) => t + 1);
    }
  }

  function reset() {
    setRolled([]);
    setDiceNumber(null);
  }

  function rerollOne(target: number) {
    const withoutTarget = rolled.filter((n) => n !== target);
    const next = rollDice45(excluded, withoutTarget);
    setRolled([...withoutTarget, next].sort((a, b) => a - b));
    setDiceNumber(next);
    setDiceSpinTrigger((t) => t + 1);
  }

  function handleShowResult() {
    const game: GeneratedGame = {
      id: `dice_${Date.now()}`,
      numbers: rolled,
      mode: "DICE",
      metadata: buildGameMetadata(rolled),
    };
    const request: GenerationRequest = {
      mode: "DICE",
      gameCount: 1,
      excludedNumbers: excluded,
      requiredNumbers: [],
      preferredNumbers: [],
      consecutiveRule: "ANY",
    };
    setResult(request, {
      requestId: game.id,
      games: [game],
      probability: calculateFirstPrizeProbability(1),
      disclaimer: PROBABILITY_DISCLAIMER,
    });
    router.push("/generate/result");
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Dice45 number={diceNumber} spinTrigger={diceSpinTrigger} />

      <Text style={styles.title}>가상의 45면체 주사위를 굴려보세요</Text>

      <View style={styles.diceResultArea}>
        {Array.from({ length: 6 }, (_, i) => rolled[i]).map((n, i) =>
          n ? (
            <Pressable key={i} onPress={() => rerollOne(n)}>
              <LottoBall number={n} size={48} />
            </Pressable>
          ) : (
            <View key={i} style={styles.emptySlot}>
              <Text style={styles.emptySlotText}>?</Text>
            </View>
          )
        )}
      </View>
      <Text style={styles.hint}>번호를 탭하면 그 번호만 다시 굴립니다.</Text>

      <View style={styles.buttonRow}>
        <Pressable style={styles.button} onPress={rollOnce} disabled={rolled.length >= 6}>
          <Text style={styles.buttonText}>한 번 굴리기</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={rollAllSix}>
          <Text style={styles.buttonText}>자동 6회 굴리기</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.buttonSecondary]} onPress={reset}>
          <Text style={styles.buttonSecondaryText}>초기화</Text>
        </Pressable>
      </View>

      <Pressable onPress={() => setShowExclusionPicker((v) => !v)}>
        <Text style={styles.toggleLink}>
          {showExclusionPicker ? "제외번호 설정 닫기" : `제외번호 설정 (${excluded.length}개)`}
        </Text>
      </Pressable>
      {showExclusionPicker ? <NumberGrid selected={excluded} onToggle={toggleExcluded} /> : null}

      <DisclaimerCard text="실제 결과는 기기 내 안전한 난수 엔진이 결정하며, 주사위는 시각적 표현일 뿐입니다." />

      <Pressable
        style={[styles.generateButton, rolled.length < 6 && styles.generateButtonDisabled]}
        disabled={rolled.length < 6}
        onPress={handleShowResult}
      >
        <Text style={styles.generateButtonText}>결과 확인</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  title: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginBottom: 16, textAlign: "center" },
  diceResultArea: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 8,
  },
  emptySlot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  emptySlotText: { color: "#CBD5E1", fontSize: 18, fontWeight: "700" },
  hint: { textAlign: "center", fontSize: 11, color: "#94A3B8", marginBottom: 16 },
  buttonRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  button: {
    flex: 1,
    backgroundColor: "#0F172A",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  buttonSecondary: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" },
  buttonSecondaryText: { color: "#334155", fontSize: 12, fontWeight: "700" },
  toggleLink: { color: "#2563EB", fontSize: 13, fontWeight: "600", marginBottom: 8 },
  generateButton: {
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 16,
    marginBottom: 24,
  },
  generateButtonDisabled: { backgroundColor: "#93C5FD" },
  generateButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
