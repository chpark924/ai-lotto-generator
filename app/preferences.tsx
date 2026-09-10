import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LottoBall, NumberGrid } from "../src/components";
import { getPreferences, updatePreferences } from "../src/lib/storage/preferences";
import {
  getExclusionSets,
  deleteExclusionSet,
  type ExclusionSet,
} from "../src/lib/storage/exclusionSets";
import { useAppTheme, type AppColors, type AppTints, type BrandTokens } from "../src/theme";

export default function PreferencesScreen() {
  const insets = useSafeAreaInsets();
  const { colors, tints, brand } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors, tints, brand), [colors, tints, brand]);
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
    try {
      await updatePreferences({ preferredNumbers });
      setDirty(false);
      Alert.alert("선호번호를 저장했습니다.");
    } catch {
      Alert.alert("저장 실패", "선호번호를 저장하지 못했어요. 다시 시도해주세요.");
    }
  }

  // QA 피드백 — 제외번호 세트는 확인 없이 바로 삭제됐다(다른 화면의 삭제 동작, 예: 내 번호
  // 탭의 티켓 삭제는 전부 확인 Alert를 거친다). 실수로 눌러도 되돌릴 수 없다는 안내와 함께
  // 확인 절차를 거치도록 다른 삭제 동작들과 통일한다.
  function handleDeleteSet(set: ExclusionSet) {
    Alert.alert("제외번호 세트 삭제", `"${set.name}" 세트를 삭제합니다. 삭제 후에는 되돌릴 수 없습니다.`, [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteExclusionSet(set.id);
            setExclusionSets((prev) => prev.filter((s) => s.id !== set.id));
          } catch {
            Alert.alert("삭제 실패", "세트를 삭제하지 못했어요. 다시 시도해주세요.");
          }
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
    >
      <Text style={styles.sectionTitle}>선호번호 ({preferredNumbers.length}개)</Text>
      <Text style={styles.sectionSub}>
        나의 행운번호, AI 조합 탐색, 운명의 신 생성에서 이 번호들을 우대해서 반영합니다.
      </Text>
      <NumberGrid selected={preferredNumbers} onToggle={togglePreferred} />
      <Pressable
        style={[styles.saveButton, !dirty && styles.saveButtonDisabled]}
        onPress={handleSavePreferred}
        disabled={!dirty}
        accessibilityRole="button"
        accessibilityLabel="선호번호 저장"
        accessibilityState={{ disabled: !dirty }}
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
              <View style={styles.setNameRow}>
                <Text style={styles.setName} numberOfLines={1}>
                  {set.name}
                </Text>
                <View style={styles.setCountBadge}>
                  <Text style={styles.setCountText}>{set.numbers.length}개</Text>
                </View>
              </View>
              <Pressable
                style={styles.deleteButton}
                onPress={() => handleDeleteSet(set)}
                accessibilityRole="button"
                accessibilityLabel={`${set.name} 세트 삭제`}
                hitSlop={6}
              >
                <Ionicons name="trash-outline" size={13} color={tints.red.fg} />
                <Text style={styles.deleteText}>삭제</Text>
              </Pressable>
            </View>
            <View style={styles.setNumbersRow}>
              {set.numbers.map((n) => (
                <LottoBall key={n} number={n} size={26} />
              ))}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function createStyles(colors: AppColors, tints: AppTints, brand: BrandTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.textPrimary, marginTop: 20, marginBottom: 6 },
    sectionSub: { fontSize: 12, color: colors.textMuted, marginBottom: 10 },
    // [Phase 5c 브랜드 토큰 확장, 2026-09-10] #2563EB 하드코딩 → brand.primary.
    saveButton: {
      backgroundColor: brand.primary,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
      marginTop: 12,
    },
    saveButtonDisabled: { backgroundColor: "#BFDBFE" },
    saveButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
    emptyText: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
    setCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    setCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    setNameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1, marginRight: 8 },
    setName: { fontSize: 13, fontWeight: "700", color: colors.textPrimary, flexShrink: 1 },
    setCountBadge: { backgroundColor: colors.surfaceAlt, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
    setCountText: { fontSize: 10, fontWeight: "600", color: colors.textMuted },
    // 다른 삭제 버튼과 톤을 맞춰(빨간 배경 칩 + 아이콘) "누를 수 있는 버튼"임을 명확히 하고,
    // 텍스트만 있던 기존 방식보다 터치 영역도 넉넉하게 잡는다.
    deleteButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: tints.red.bg,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    deleteText: { fontSize: 12, fontWeight: "700", color: tints.red.fg },
    // 콤마로 나열된 숫자 텍스트 대신, 앱 전체에서 일관되게 쓰는 로또 공 컴포넌트로 보여줘서
    // 한눈에 더 잘 들어오게 한다.
    setNumbersRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  });
}
