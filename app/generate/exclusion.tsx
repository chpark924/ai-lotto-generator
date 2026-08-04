import React, { useEffect, useRef, useState } from "react";
import { Alert, Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { NumberGrid, DisclaimerCard, BottomActionBar } from "../../src/components";
import { buildBasicGenerationResult } from "../../src/lib/lottery/generator";
import type { GenerationRequest } from "../../src/lib/lottery/types";
import { ValidationError } from "../../src/lib/lottery/validators";
import { getRecentDraws, RecentDrawsFetchError } from "../../src/lib/draws";
import { getExclusionSets, saveExclusionSet, type ExclusionSet } from "../../src/lib/storage";
import { useGenerationStore } from "../../src/state/generationStore";
import { ALL_COMBINATIONS_EQUAL_NOTICE } from "../../src/constants/messages";
import { useAppTheme, type AppColors, type AppTints } from "../../src/theme";

const RECENT_WEEK_OPTIONS = [1, 3, 5, 10];
const MAX_SET_NAME_LENGTH = 20;

/** "exclude=5,11,22" 형태의 라우트 파라미터를 1~45 범위의 정수 배열로 변환한다. */
function parseExcludeParam(raw?: string | string[]): number[] {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(",")
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 45)
    ),
  ];
}

export default function ExclusionScreen() {
  const router = useRouter();
  const { colors, tints } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors, tints), [colors, tints]);
  const params = useLocalSearchParams<{ exclude?: string }>();
  const setResult = useGenerationStore((s) => s.setResult);
  const [selected, setSelected] = useState<number[]>(() => parseExcludeParam(params.exclude));
  // 홈 화면 "내가 자주 선택한 번호 > 바로가기"로 들어왔는지(마운트 시점 값으로 고정, 이후 선택 변경과 무관).
  const [cameFromShortcut] = useState(() => parseExcludeParam(params.exclude).length > 0);
  const [gameCount, setGameCount] = useState(5);
  const [savedSets, setSavedSets] = useState<ExclusionSet[]>([]);
  const [newSetName, setNewSetName] = useState("");
  const [loadingWeeks, setLoadingWeeks] = useState<number | null>(null);
  const [savingSet, setSavingSet] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [highlightedSetId, setHighlightedSetId] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    getExclusionSets().then(setSavedSets);
  }, []);

  function showSaveToast(message: string) {
    setToastMessage(message);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1700),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToastMessage(null));
  }

  function toggleNumber(n: number) {
    setSelected((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }

  async function applyRecentWeeks(weeks: number) {
    if (loadingWeeks !== null) return; // 중복 탭 방지 (연타 시 중복 네트워크 요청 방지)
    setLoadingWeeks(weeks);
    try {
      const draws = await getRecentDraws(weeks);
      const numbers = [...new Set(draws.flatMap((d) => d.numbers))].sort((a, b) => a - b);
      setSelected(numbers);
    } catch (e) {
      if (e instanceof RecentDrawsFetchError) {
        // 일부 회차는 못 받아왔더라도, 받아온 만큼은 반영하고 사용자에게 알린다.
        const numbers = [...new Set(e.partialResults.flatMap((d) => d.numbers))].sort((a, b) => a - b);
        setSelected(numbers);
        Alert.alert(
          "일부 회차 조회 실패",
          `네트워크 상태가 좋지 않아 최근 ${weeks}주 중 일부 회차만 반영됐어요.`,
          [
            { text: "취소", style: "cancel" },
            { text: "다시 시도", onPress: () => applyRecentWeeks(weeks) },
          ]
        );
      } else {
        Alert.alert("조회 실패", "최근 당첨번호를 불러오지 못했어요. 네트워크 상태를 확인 후 다시 시도해주세요.", [
          { text: "취소", style: "cancel" },
          { text: "다시 시도", onPress: () => applyRecentWeeks(weeks) },
        ]);
      }
    } finally {
      setLoadingWeeks(null);
    }
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
    if (savingSet) return; // 연타로 중복 저장되는 것 방지
    setSavingSet(true);
    try {
      const set = await saveExclusionSet(newSetName.trim(), selected);
      setSavedSets((prev) => [set, ...prev]);
      setNewSetName("");
      // 방금 저장된 세트를 목록 맨 앞에서 잠깐 강조해 "저장되어 여기 추가됐다"를 시각적으로 알려준다.
      setHighlightedSetId(set.id);
      setTimeout(() => setHighlightedSetId((cur) => (cur === set.id ? null : cur)), 2200);
      showSaveToast(`"${set.name}" 세트가 저장됐어요`);
    } catch {
      Alert.alert("저장 실패", "세트를 저장하지 못했어요. 다시 시도해주세요.");
    } finally {
      setSavingSet(false);
    }
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
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
      {cameFromShortcut ? (
        <View style={styles.shortcutBanner}>
          <Text style={styles.shortcutBannerText}>
            홈 화면에서 자주 선택한 번호가 자동으로 제외 처리됐어요. 아래에서 직접 조정할 수 있어요.
          </Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>최근 당첨번호 자동 제외</Text>
      <View style={styles.row}>
        {RECENT_WEEK_OPTIONS.map((w) => (
          <Pressable
            key={w}
            style={[styles.smallButton, loadingWeeks === w && styles.smallButtonActive]}
            disabled={loadingWeeks !== null}
            onPress={() => applyRecentWeeks(w)}
            accessibilityRole="button"
            accessibilityLabel={`최근 ${w}주 당첨번호 자동 제외`}
            accessibilityState={{ disabled: loadingWeeks !== null, busy: loadingWeeks === w }}
          >
            <Text style={[styles.smallButtonText, loadingWeeks === w && styles.smallButtonTextActive]}>
              {loadingWeeks === w ? "불러오는 중..." : `최근 ${w}주`}
            </Text>
          </Pressable>
        ))}
      </View>

      {savedSets.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>저장된 제외번호 세트</Text>
          <View style={styles.row}>
            {savedSets.map((set) => (
              <Pressable
                key={set.id}
                style={[styles.smallButton, highlightedSetId === set.id && styles.smallButtonHighlight]}
                onPress={() => loadSet(set)}
                accessibilityRole="button"
                accessibilityLabel={`${set.name} 세트 불러오기`}
              >
                {highlightedSetId === set.id ? <Text style={styles.newBadge}>NEW</Text> : null}
                <Text
                  style={[
                    styles.smallButtonText,
                    highlightedSetId === set.id && styles.smallButtonTextHighlight,
                  ]}
                >
                  {set.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <Text style={styles.sectionTitle}>직접 선택 ({selected.length}개 제외 중)</Text>
      <NumberGrid selected={selected} onToggle={toggleNumber} />

      <View style={styles.saveRow}>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder="세트 이름 (예: 40번대 제외)"
            placeholderTextColor={colors.textMuted}
            value={newSetName}
            onChangeText={setNewSetName}
            maxLength={MAX_SET_NAME_LENGTH}
            accessibilityLabel="제외번호 세트 이름 입력"
          />
          <Text
            style={[
              styles.charCount,
              newSetName.length >= MAX_SET_NAME_LENGTH && styles.charCountLimit,
            ]}
          >
            {newSetName.length}/{MAX_SET_NAME_LENGTH}
          </Text>
        </View>
        <Pressable
          style={[styles.saveButton, savingSet && styles.saveButtonDisabled]}
          onPress={saveCurrentAsSet}
          disabled={savingSet}
          accessibilityRole="button"
          accessibilityLabel="제외번호 세트 저장"
          accessibilityState={{ disabled: savingSet, busy: savingSet }}
        >
          <Text style={styles.saveButtonText}>{savingSet ? "저장 중..." : "세트 저장"}</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>생성할 게임 수: {gameCount}</Text>
      <View style={styles.row}>
        {[1, 5, 10].map((c) => (
          <Pressable
            key={c}
            style={[styles.smallButton, gameCount === c && styles.smallButtonActive]}
            onPress={() => setGameCount(c)}
            accessibilityRole="button"
            accessibilityLabel={`${c}게임 생성`}
            accessibilityState={{ selected: gameCount === c }}
          >
            <Text style={[styles.smallButtonText, gameCount === c && styles.smallButtonTextActive]}>
              {c}게임
            </Text>
          </Pressable>
        ))}
      </View>

      <DisclaimerCard text={ALL_COMBINATIONS_EQUAL_NOTICE} />
      </ScrollView>

      {toastMessage ? (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]} pointerEvents="none">
          <Text style={styles.toastCheck}>✓</Text>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      ) : null}

      <BottomActionBar label="번호 생성" onPress={handleGenerate} />
    </View>
  );
}

function createStyles(colors: AppColors, tints: AppTints) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    shortcutBanner: {
      backgroundColor: tints.indigo.bg,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
    shortcutBannerText: { color: tints.indigo.fg, fontSize: 12, fontWeight: "600", lineHeight: 18 },
    sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary, marginTop: 16, marginBottom: 8 },
    row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
    smallButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    smallButtonActive: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
    smallButtonText: { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },
    smallButtonTextActive: { color: "#fff" },
    // 방금 저장된 세트를 목록에서 잠깐 강조 표시 (저장 완료를 목록 위치에서도 확인시켜줌).
    // 반투명 블루 오버레이라 라이트/다크 배경 위에서 모두 자연스럽게 보인다.
    smallButtonHighlight: { backgroundColor: "rgba(37,99,235,0.15)", borderColor: "#2563EB", borderWidth: 1.5 },
    smallButtonTextHighlight: { color: "#1D4ED8" },
    newBadge: {
      position: "absolute",
      top: -8,
      right: -8,
      backgroundColor: "#2563EB",
      color: "#fff",
      fontSize: 9,
      fontWeight: "800",
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 8,
      overflow: "hidden",
    },
    saveRow: { flexDirection: "row", gap: 8, marginTop: 12, alignItems: "flex-start" },
    inputWrap: { flex: 1 },
    input: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 13,
      color: colors.textPrimary,
    },
    charCount: {
      alignSelf: "flex-end",
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 4,
    },
    charCountLimit: { color: "#EF4444", fontWeight: "700" },
    // 저장 버튼/토스트는 항상 어두운 브랜드 톤을 유지한다.
    saveButton: { backgroundColor: "#0F172A", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
    saveButtonDisabled: { backgroundColor: "#94A3B8" },
    saveButtonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
    // 저장 완료 토스트: 저장 직후 화면 하단(생성 버튼 위)에 잠깐 나타났다 사라짐
    toast: {
      position: "absolute",
      bottom: 92,
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "#0F172A",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    toastCheck: { color: "#4ADE80", fontSize: 13, fontWeight: "800" },
    toastText: { color: "#fff", fontSize: 12.5, fontWeight: "600" },
  });
}
