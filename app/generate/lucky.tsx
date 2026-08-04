import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { DisclaimerCard, NumberGrid, BottomActionBar } from "../../src/components";
import { generateLuckyProfileGame } from "../../src/lib/lottery/luckyNumber";
import { buildGameMetadata } from "../../src/lib/lottery/pattern";
import { calculateFirstPrizeProbability, PROBABILITY_DISCLAIMER } from "../../src/lib/lottery/probability";
import { getPreferences, updatePreferences } from "../../src/lib/storage/preferences";
import { useGenerationStore } from "../../src/state/generationStore";
import type { GeneratedGame, GenerationRequest } from "../../src/lib/lottery/types";
import { useAppTheme, type AppColors } from "../../src/theme";

const RATIO_OPTIONS = [
  { label: "운명 30%", value: 0.3 },
  { label: "운명 50%", value: 0.5 },
  { label: "운명 70%", value: 0.7 },
  { label: "운명 99%", value: 0.99 },
];

export default function LuckyProfileScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const setResult = useGenerationStore((s) => s.setResult);

  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [saveProfile, setSaveProfile] = useState(false);
  const [preferred, setPreferred] = useState<number[]>([]);
  const [ratio, setRatio] = useState(0.5);

  useEffect(() => {
    getPreferences().then((prefs) => {
      setPreferred(prefs.preferredNumbers);
      setSaveProfile(prefs.saveBirthProfile);
      if (prefs.saveBirthProfile && prefs.birthProfile) {
        setYear(String(prefs.birthProfile.year));
        setMonth(String(prefs.birthProfile.month));
        setDay(String(prefs.birthProfile.day));
      }
    });
  }, []);

  function togglePreferred(n: number) {
    setPreferred((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }

  async function handleGenerate() {
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) {
      Alert.alert("생년월일을 확인해주세요.", "예: 1990 / 3 / 14");
      return;
    }

    const birthProfile = { year: y, month: m, day: d };

    try {
      await updatePreferences({
        preferredNumbers: preferred,
        saveBirthProfile: saveProfile,
        birthProfile: saveProfile ? birthProfile : undefined,
      });
    } catch {
      // 선호번호/생년월일 저장은 번호 생성 자체를 막을 이유는 아니지만, 조용히 사라지면
      // 다음에 다시 입력해야 하는 걸 사용자가 모를 수 있어 알려준다.
      Alert.alert("설정 저장 실패", "선호번호·생년월일 저장에 실패했어요. 번호는 계속 생성됩니다.");
    }

    const luckyResult = generateLuckyProfileGame({
      birthProfile,
      preferredNumbers: preferred,
      excludedNumbers: [],
      destinyRatio: ratio,
    });

    const game: GeneratedGame = {
      id: `lucky_${Date.now()}`,
      numbers: luckyResult.numbers,
      mode: "LUCKY_PROFILE",
      metadata: buildGameMetadata(luckyResult.numbers),
      numberReasons: luckyResult.numberReasons,
    };

    const request: GenerationRequest = {
      mode: "LUCKY_PROFILE",
      gameCount: 1,
      excludedNumbers: [],
      requiredNumbers: [],
      preferredNumbers: preferred,
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
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
      <Text style={styles.sectionTitle}>생년월일</Text>
      <View style={styles.dateRow}>
        <TextInput
          style={styles.dateInput}
          placeholder="년(YYYY)"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          maxLength={4}
          value={year}
          onChangeText={setYear}
          accessibilityLabel="출생 연도"
        />
        <TextInput
          style={styles.dateInput}
          placeholder="월"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          maxLength={2}
          value={month}
          onChangeText={setMonth}
          accessibilityLabel="출생 월"
        />
        <TextInput
          style={styles.dateInput}
          placeholder="일"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          maxLength={2}
          value={day}
          onChangeText={setDay}
          accessibilityLabel="출생 일"
        />
      </View>

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.switchLabel}>생년월일 이 기기에 저장</Text>
          <Text style={styles.smallNotice}>
            끄면 매번 새로 입력해야 하지만 기기에도 저장되지 않습니다.
          </Text>
        </View>
        <Switch
          value={saveProfile}
          onValueChange={setSaveProfile}
          accessibilityRole="switch"
          accessibilityLabel="생년월일 이 기기에 저장"
        />
      </View>

      <Text style={styles.sectionTitle}>선호번호 ({preferred.length}개)</Text>
      <NumberGrid selected={preferred} onToggle={togglePreferred} />

      <Text style={styles.sectionTitle}>운명 비중</Text>
      <View style={styles.row}>
        {RATIO_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            style={[styles.optionButton, ratio === opt.value && styles.optionButtonActive]}
            onPress={() => setRatio(opt.value)}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: ratio === opt.value }}
          >
            <Text style={[styles.optionButtonText, ratio === opt.value && styles.optionButtonTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <DisclaimerCard text="생년월일 파생번호는 참고용 재미 요소이며, 당첨 확률과는 무관합니다." />
      </ScrollView>

      <BottomActionBar label="행운번호 생성" onPress={handleGenerate} />
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary, marginTop: 16, marginBottom: 8 },
    dateRow: { flexDirection: "row", gap: 8 },
    dateInput: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      textAlign: "center",
      color: colors.textPrimary,
    },
    switchRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      gap: 12,
    },
    switchLabel: { fontSize: 14, color: colors.textPrimary, fontWeight: "600" },
    smallNotice: { fontSize: 11, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
    row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
    optionButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionButtonActive: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
    optionButtonText: { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },
    optionButtonTextActive: { color: "#fff" },
  });
}
