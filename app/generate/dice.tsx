import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Dice45, DisclaimerCard, LottoBall, NumberGrid, BottomActionBar } from "../../src/components";
import { rollDice45 } from "../../src/lib/lottery/dice";
import { buildGameMetadata } from "../../src/lib/lottery/pattern";
import { calculateFirstPrizeProbability, PROBABILITY_DISCLAIMER } from "../../src/lib/lottery/probability";
import { useGenerationStore } from "../../src/state/generationStore";
import type { GeneratedGame, GenerationRequest } from "../../src/lib/lottery/types";
import { useAppTheme, type AppColors } from "../../src/theme";

export default function DiceScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const setResult = useGenerationStore((s) => s.setResult);
  const [excluded, setExcluded] = useState<number[]>([]);
  const [rolled, setRolled] = useState<number[]>([]);
  const [showExclusionPicker, setShowExclusionPicker] = useState(false);
  const [diceNumber, setDiceNumber] = useState<number | null>(null);
  const [diceSpinTrigger, setDiceSpinTrigger] = useState(0);
  // QA_LOG 96번 — "자동 6회 굴리기"를 연타하면 Dice45 안의 굴리기 애니메이션(스케일/글로우
  // 이펙트까지 포함해 최대 ~1.2초)이 채 끝나기도 전에 다음 굴리기가 새로 시작돼 애니메이션이
  // 서로 겹치며 화면이 버벅이거나 멈춘 것처럼 보이는 문제가 있었다. Dice45가 애니메이션
  // 진행 상태를 이 값으로 올려주면, 굴리는 동안은 굴리기 버튼들을 잠깐 비활성화해 애초에
  // 겹쳐 시작될 수 없게 막는다.
  const [isDiceSpinning, setIsDiceSpinning] = useState(false);

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
    // QA_LOG 97번 — 이미 6개가 다 찬 상태에서 "자동 6회 굴리기"를 다시 눌러도, 매번
    // "초기화"부터 따로 눌러야만 새로 굴릴 수 있는 게 불편하다는 피드백. 그래서 기존에
    // 몇 개가 차 있든 상관없이(이어받지 않고) 항상 빈 상태에서부터 새 6개를 굴리도록 바꿨다
    // — 버튼을 연타하면 그때마다 완전히 새로운 6개 조합이 나온다.
    let current: number[] = [];
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
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
      <Dice45 number={diceNumber} spinTrigger={diceSpinTrigger} onSpinningChange={setIsDiceSpinning} />

      <Text style={styles.title}>가상의 45면체 주사위를 굴려보세요</Text>

      <View style={styles.diceResultArea}>
        {Array.from({ length: 6 }, (_, i) => rolled[i]).map((n, i) =>
          n ? (
            <Pressable
              key={i}
              onPress={() => rerollOne(n)}
              accessibilityRole="button"
              accessibilityLabel={`${n}번, 탭하면 이 번호만 다시 굴리기`}
            >
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
        {/* 세 버튼 다 눌러도 스타일이 그대로라 "이미 선택된 상태"처럼 정적으로 보인다는
            QA 피드백(70번) — 이 앱 다른 화면(홈 화면 CTA, 번호 만들기 카드 등)이 이미 쓰고 있는
            일반적인 버튼 프레스 피드백 패턴(눌리는 순간 살짝 어두워지고 축소 + 안드로이드
            리플)을 여기에도 동일하게 적용해, 누르는 행위 자체가 체감되도록 한다.
            후속(95번): 프레스 피드백을 넣은 뒤에도 "한 번 굴리기"(파란 테두리)와
            "자동 6회 굴리기"(파란 채움)가 나란히 브랜드 블루를 공유하고 있어서, 마치 세그먼트
            토글에서 두 개가 이미 "선택"돼 있고 "초기화"만 선택 안 된 것처럼 읽혔다 — 그래서
            브랜드 블루는 실제 핵심 액션(자동 6회 굴리기) 하나에만 남기고, "한 번 굴리기"는
            중립 회색 채움(버튼처럼 눌러야 하는 하나의 독립 액션)으로 바꿔 세 버튼이 토글
            그룹이 아니라 위계가 다른 개별 버튼 3개로 읽히게 한다. */}
        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.buttonOutline,
            pressed && styles.buttonOutlinePressed,
            (rolled.length >= 6 || isDiceSpinning) && styles.buttonDisabled,
          ]}
          android_ripple={{ color: colors.surfaceAlt }}
          onPress={rollOnce}
          disabled={rolled.length >= 6 || isDiceSpinning}
          accessibilityRole="button"
          accessibilityLabel="한 번 굴리기"
          accessibilityState={{ disabled: rolled.length >= 6 || isDiceSpinning }}
        >
          <Text style={styles.buttonOutlineText}>한 번 굴리기</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.buttonPrimary,
            pressed && styles.buttonPrimaryPressed,
            isDiceSpinning && styles.buttonDisabled,
          ]}
          android_ripple={{ color: "#1E3A8A" }}
          onPress={rollAllSix}
          disabled={isDiceSpinning}
          accessibilityRole="button"
          accessibilityLabel="자동 6회 굴리기, 다시 누르면 6개를 새로 굴립니다"
          accessibilityState={{ disabled: isDiceSpinning }}
        >
          <Text style={styles.buttonPrimaryText}>자동 6회 굴리기</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.buttonSecondary,
            pressed && styles.buttonSecondaryPressed,
            isDiceSpinning && styles.buttonDisabled,
          ]}
          android_ripple={{ color: colors.surfaceAlt }}
          onPress={reset}
          disabled={isDiceSpinning}
          accessibilityRole="button"
          accessibilityLabel="굴린 번호 초기화"
          accessibilityState={{ disabled: isDiceSpinning }}
        >
          <Text style={styles.buttonSecondaryText}>초기화</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => setShowExclusionPicker((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={showExclusionPicker ? "제외번호 설정 닫기" : `제외번호 설정, ${excluded.length}개 선택됨`}
      >
        <Text style={styles.toggleLink}>
          {showExclusionPicker ? "제외번호 설정 닫기" : `제외번호 설정 (${excluded.length}개)`}
        </Text>
      </Pressable>
      {showExclusionPicker ? <NumberGrid selected={excluded} onToggle={toggleExcluded} /> : null}

      <DisclaimerCard text="실제 표시되는 결과는 기기 내 안전한 난수 엔진이 결정합니다." />
      </ScrollView>

      <BottomActionBar
        label="결과 확인"
        onPress={handleShowResult}
        disabled={rolled.length < 6}
        disabledColor="#93C5FD"
      />
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    title: { fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginBottom: 16, textAlign: "center" },
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
      borderColor: colors.border,
      borderStyle: "dashed",
      alignItems: "center",
      justifyContent: "center",
    },
    emptySlotText: { color: colors.textMuted, fontSize: 18, fontWeight: "700" },
    hint: { textAlign: "center", fontSize: 11, color: colors.textMuted, marginBottom: 16 },
    buttonRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
    button: {
      flex: 1,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
    },
    // Primary: 결과 확인까지 가장 빠르게 도달하는 핵심 액션
    buttonPrimary: {
      backgroundColor: "#2563EB",
      shadowColor: "#2563EB",
      shadowOpacity: 0.25,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    // 누르는 순간 살짝 어두워지고(iOS 리플 대체) 축소돼서 "지금 눌렀다"는 게 체감되도록.
    buttonPrimaryPressed: {
      backgroundColor: "#1D4ED8",
      transform: [{ scale: 0.97 }],
      shadowOpacity: 0.15,
    },
    buttonPrimaryText: { color: "#fff", fontSize: 12, fontWeight: "700" },
    // Secondary: 보조 액션 (한 번 굴리기) - QA_LOG 95번: 예전엔 브랜드 블루 아웃라인이라
    // Primary(자동 6회 굴리기, 파란 채움)와 색이 겹쳐 마치 이미 "선택"된 세그먼트 토글처럼
    // 보였다. 브랜드 블루는 진짜 핵심 액션 하나에만 남기고, 이 버튼은 중립 회색 채움으로
    // 바꿔 "눌러야 하는 독립된 버튼"으로 읽히게 한다.
    buttonOutline: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
    buttonOutlinePressed: { backgroundColor: colors.border, transform: [{ scale: 0.97 }] },
    buttonOutlineText: { color: colors.textPrimary, fontSize: 12, fontWeight: "700" },
    // Tertiary: 초기화 - 가장 낮은 위계, 중립 회색(테두리만)
    buttonSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    buttonSecondaryPressed: { backgroundColor: colors.surfaceAlt, transform: [{ scale: 0.97 }] },
    buttonSecondaryText: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
    // QA_LOG 96번: 굴리는 애니메이션 도중엔 버튼들이 비활성화되는데, Pressable의 disabled
    // prop 자체는 시각적으로 아무것도 바꾸지 않는다 — 눌러도 반응 없는 버튼이 멀쩡해 보이면
    // 유저가 "왜 안 눌리지" 하고 여러 번 다시 누르게 된다. 살짝 흐리게 표시해 지금은 누를 수
    // 없는 상태임을 바로 알 수 있게 한다.
    buttonDisabled: { opacity: 0.45 },
    toggleLink: { color: "#2563EB", fontSize: 13, fontWeight: "600", marginBottom: 8 },
  });
}
