import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { BottomActionBar } from "../../src/components";
import { DeepPatternLoadingBoard } from "../../src/components/deepPattern";
import { recommendDeepPatterns } from "../../src/lib/deepPattern/engine";
import { useDeepPatternStore } from "../../src/state/deepPatternStore";
import { useAppTheme, type AppColors, type AppTints } from "../../src/theme";

const RECOMMENDATION_COUNT = 5;
// v3 엔진(engine.ts)은 basin마다 빌드타임에 미리 검증해둔 대표 후보 목록(sampleCombos)에서
// 가볍게 고르기만 해서 실제 계산은 매우 짧게 끝난다(§22 실기기 latency 실측은 아직 없지만,
// 런타임에서 8,145,060개 공간을 다시 뒤지는 rejection sampling을 제거했으므로 v2 대비 크게
// 빨라졌을 것으로 기대한다). 승인된 목업의 "생성 중" 연출(라인 드로잉 애니메이션)이 최소한의
// 시간 동안은 보이도록 인위적인 최소 지연을 둔다 — 너무 빨리 사라지면 오히려 "제대로 분석한
// 게 맞나" 하는 불신을 줄 수 있어서다.
const MOCK_LOADING_MS = 900;

export default function DeepPatternIntroScreen() {
  const router = useRouter();
  const { colors, tints } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors, tints), [colors, tints]);
  const setBatch = useDeepPatternStore((s) => s.setBatch);
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleStart() {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const [batch] = await Promise.all([
        recommendDeepPatterns(RECOMMENDATION_COUNT),
        new Promise((resolve) => setTimeout(resolve, MOCK_LOADING_MS)),
      ]);
      setBatch(batch);
      router.push("/generate/deep-pattern-result");
    } finally {
      setIsGenerating(false);
    }
  }

  if (isGenerating) {
    return (
      <View style={styles.loadingWrap}>
        <DeepPatternLoadingBoard />
        <Text style={styles.loadingTitle}>패턴을 분석하고 있어요</Text>
        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <Text style={styles.paragraph}>
          로또 용지의 1~45 번호를 좌표로 보고, 당첨번호 6개를 선으로 이으면 하나의 패턴이 됩니다.
          전체 814만 개 조합과 역대 당첨 기록을 비교해 상대적으로 덜 관측된 패턴 영역을
          찾아드립니다.
        </Text>

        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            ⚠️ 이 분석은 각 번호 조합의 실제 당첨확률을 높이지 않습니다. 모든 조합은 추첨에서
            동일한 확률을 가지며, 이 기능은 전체 조합 공간 중 역사적으로 덜 탐색된 패턴 영역을
            참고용으로 보여줄 뿐입니다.
          </Text>
        </View>
      </ScrollView>

      <BottomActionBar label="패턴 분석 시작하기" onPress={handleStart} color="#6C5CE7" disabledColor="#C9C2FF" />
    </View>
  );
}

function createStyles(colors: AppColors, tints: AppTints) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    paragraph: { fontSize: 13.5, color: colors.textSecondary, lineHeight: 21, marginTop: 8, marginBottom: 16 },
    notice: {
      backgroundColor: tints.orange.bg,
      borderRadius: 12,
      padding: 13,
    },
    noticeText: { color: tints.orange.fg, fontSize: 11.5, lineHeight: 18 },
    loadingWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
      paddingHorizontal: 30,
    },
    loadingTitle: { fontSize: 15, fontWeight: "800", color: colors.textPrimary, marginBottom: 18 },
    progressTrack: {
      width: "100%",
      height: 5,
      borderRadius: 99,
      backgroundColor: colors.border,
      overflow: "hidden",
    },
    progressFill: { width: "64%", height: "100%", borderRadius: 99, backgroundColor: "#6C5CE7" },
  });
}
