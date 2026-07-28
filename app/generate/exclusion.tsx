import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { NumberGrid, DisclaimerCard } from "../../src/components";
import { buildBasicGenerationResult } from "../../src/lib/lottery/generator";
import type { GenerationRequest } from "../../src/lib/lottery/types";
import { ValidationError } from "../../src/lib/lottery/validators";
import { getRecentDraws } from "../../src/lib/draws";
import { getExclusionSets, saveExclusionSet, type ExclusionSet } from "../../src/lib/storage";
import { useGenerationStore } from "../../src/state/generationStore";
import { ALL_COMBINATIONS_EQUAL_NOTICE } from "../../src/constants/messages";

const RECENT_WEEK_OPTIONS = [1, 3, 5, 10];

export default function ExclusionScreen() {
  const router = useRouter();
  const setResult = useGenerationStore((s) => s.setResult);
  const [selected, setSelected] = useState<number[]>([]);
  const [gameCount, setGameCount] = useState(5);
  const [savedSets, setSavedSets] = useState<ExclusionSet[]>([]);
  const [newSetName, setNewSetName] = useState("");

  useEffect(() => {
    getExclusionSets().then(setSavedSets);
  }, []);

  function toggleNumber(n: number) {
    setSelected((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }

  async function applyRecentWeeks(weeks: number) {
    const draws = await getRecentDraws(weeks);
    const numbers = [...new Set(draws.flatMap((d) => d.numbers))].sort((a, b) => a - b);
    setSelected(numbers);
  }

  function loadSet(set: ExclusionSet) {
    setSelected(set.numbers);
  }

  async function saveCurrentAsSet() {
    if (!newSetName.trim()) {
      Alert.alert("세트 이름을 입력해주세요.");
      return;
    }
    if (selected.length === 0) {
      Alert.alert("제외할 번호를 먼저 선택해주세요.");
      return;
    }
    const set = await saveExclusionSet(newSetName.trim(), selected);
    setSavedSets((prev) => [set, ...prev]);
    setNewSetName("");
  }

  function handleGenerate() {
    const request: GenerationRequest = {
      mode: "EXCLUSION",
      gameCount,
      excludedNumbers: selected,
      requiredNumbers: [],
      preferredNumbers: [],
      consecutiveRule: "ANY",
    };
    try {
      const result = buildBasicGenerationResult(request);
      setResult(request, result);
      router.push("/generate/result");
    } catch (e) {
      const message = e instanceof ValidationError ? e.message : "번호를 생성하지 못했습니다.";
      Alert.alert("생성 실패", message);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.sectionTitle}>최근 당첨번호 자동 제외</Text>
      <View style={styles.row}>
        {RECENT_WEEK_OPTIONS.map((w) => (
          <Pressable key={w} style={styles.smallButton} onPress={() => applyRecentWeeks(w)}>
            <Text style={styles.smallButtonText}>최근 {w}주</Text>
          </Pressable>
        ))}
      </View>

      {savedSets.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>저장된 제외번호 세트</Text>
          <View style={styles.row}>
            {savedSets.map((set) => (
              <Pressable key={set.id} style={styles.smallButton} onPress={() => loadSet(set)}>
                <Text style={styles.smallButtonText}>{set.name}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <Text style={styles.sectionTitle}>직접 선택 ({selected.length}개 제외 중)</Text>
      <NumberGrid selected={selected} onToggle={toggleNumber} />

      <View style={styles.saveRow}>
        <TextInput
          style={styles.input}
          placeholder="세트 이름 (예: 40번대 제외)"
          value={newSetName}
          onChangeText={setNewSetName}
        />
        <Pressable style={styles.saveButton} onPress={saveCurrentAsSet}>
          <Text style={styles.saveButtonText}>세트 저장</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>생성할 게임 수: {gameCount}</Text>
      <View style={styles.row}>
        {[1, 5, 10].map((c) => (
          <Pressable
            key={c}
            style={[styles.smallButton, gameCount === c && styles.smallButtonActive]}
            onPress={() => setGameCount(c)}
          >
            <Text style={[styles.smallButtonText, gameCount === c && styles.smallButtonTextActive]}>
              {c}게임
            </Text>
          </Pressable>
        ))}
      </View>

      <DisclaimerCard text={ALL_COMBINATIONS_EQUAL_NOTICE} />

      <Pressable style={styles.generateButton} onPress={handleGenerate}>
        <Text style={styles.generateButtonText}>번호 생성</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A", marginTop: 16, marginBottom: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  smallButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  smallButtonActive: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  smallButtonText: { fontSize: 12, color: "#334155", fontWeight: "600" },
  smallButtonTextActive: { color: "#fff" },
  saveRow: { flexDirection: "row", gap: 8, marginTop: 12, alignItems: "center" },
  input: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  saveButton: { backgroundColor: "#0F172A", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  saveButtonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  generateButton: {
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  generateButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
