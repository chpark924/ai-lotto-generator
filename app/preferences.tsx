import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NumberGrid } from "../src/components";
import { getPreferences, updatePreferences } from "../src/lib/storage/preferences";
import {
  getExclusionSets,
  deleteExclusionSet,
  type ExclusionSet,
} from "../src/lib/storage/exclusionSets";

export default function PreferencesScreen() {
  const [preferredNumbers, setPreferredNumbers] = useState<number[]>([]);
  const [exclusionSets, setExclusionSets] = useState<ExclusionSet[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    getPreferences().then((prefs) => setPreferredNumbers(prefs.preferredNumbers));
    getExclusionSets().then(setExclusionSets);
  }, []);

  function togglePreferred(n: number) {
    setPreferredNumbers((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
    setDirty(true);
  }

  async function handleSavePreferred() {
    await updatePreferences({ preferredNumbers });
    setDirty(false);
    Alert.alert("선호번호를 저장했습니다.");
  }

  async function handleDeleteSet(id: string) {
    await deleteExclusionSet(id);
    setExclusionSets((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.sectionTitle}>선호번호 ({preferredNumbers.length}개)</Text>
      <Text style={styles.sectionSub}>
        나의 행운번호, AI 조합 탐색, 운명의 신 생성에서 이 번호들을 우대해서 반영합니다.
      </Text>
      <NumberGrid selected={preferredNumbers} onToggle={togglePreferred} />
      <Pressable
        style={[styles.saveButton, !dirty && styles.saveButtonDisabled]}
        onPress={handleSavePreferred}
        disabled={!dirty}
      >
        <Text style={styles.saveButtonText}>선호번호 저장</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>저장된 제외번호 세트</Text>
      {exclusionSets.length === 0 ? (
        <Text style={styles.emptyText}>
          아직 저장한 제외번호 세트가 없습니다. "제외하고 생성" 화면에서 세트를 만들어보세요.
        </Text>
      ) : (
        exclusionSets.map((set) => (
          <View key={set.id} style={styles.setCard}>
            <View style={styles.setCardHeader}>
              <Text style={styles.setName}>{set.name}</Text>
              <Pressable onPress={() => handleDeleteSet(set.id)}>
                <Text style={styles.deleteText}>삭제</Text>
              </Pressable>
            </View>
            <Text style={styles.setNumbers}>{set.numbers.join(", ")}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#0F172A", marginTop: 20, marginBottom: 6 },
  sectionSub: { fontSize: 12, color: "#64748B", marginBottom: 10 },
  saveButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },
  saveButtonDisabled: { backgroundColor: "#BFDBFE" },
  saveButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  emptyText: { fontSize: 12, color: "#94A3B8", lineHeight: 18 },
  setCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  setCardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  setName: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  deleteText: { fontSize: 11, color: "#94A3B8" },
  setNumbers: { fontSize: 12, color: "#475569" },
});
