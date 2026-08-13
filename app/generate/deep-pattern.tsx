import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { BottomActionBar } from "../../src/components";
import { DeepPatternLoadingBoard, PatternMixSlider } from "../../src/components/deepPattern";
import { recommendDeepPatterns, refreshAtlasIfStale, snapFrequentPatternRatio } from "../../src/lib/deepPattern/engine";
import { useDeepPatternStore } from "../../src/state/deepPatternStore";
import { useAppTheme, type AppColors } from "../../src/theme";

const RECOMMENDATION_COUNT = 5;
// v3 엔진(engine.ts)은 basin마다 빌드타임에 미리 검증해둔 대표 후보 목록(sampleCombos)에서
// 가볍게 고르기만 해서 실제 계산은 매우 짧게 끝난다(§22 실기기 latency 실측은 아직 없지만,
// 런타임에서 8,145,060개 공간을 다시 뒤지는 rejection sampling을 제거했으므로 v2 대비 크게
// 빨라졌을 것으로 기대한다). 승인된 목업의 "생성 중" 연출(라인 드로잉 애니메이션)이 최소한의
// 시간 동안은 보이도록 인위적인 최소 지연을 둔다 — 너무 빨리 사라지면 오히려 "제대로 분석한
// 게 맞나" 하는 불신을 줄 수 있어서다.
//
// DeepPatternLoadingBoard의 애니메이션 주기(CYCLE_MS=1800ms) 기준, 선이 다 이어지는 시점은
// progress 0.65(=1170ms)지만 마지막 점(5번째)이 완전히 나타나는 시점은 0.8(=1440ms)로 더
// 늦다 — 즉 애니메이션이 "다 그려졌다"고 보이려면 최소 1440ms는 지나야 한다. 예전 900ms는
// 이 값보다 짧아서 점을 다 잇기도 전에 로딩이 끝나버리는 문제가 있었다(QA 피드백). 여유를 두고
// 1440ms보다 넉넉히 긴 값으로 잡는다.
const MOCK_LOADING_MS = 1600;

export default function DeepPatternIntroScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const setBatch = useDeepPatternStore((s) => s.setBatch);
  const [isGenerating, setIsGenerating] = useState(false);
  // 슬라이더는 화면상으로는 부드럽게 움직이도록 연속값(0~100)을 그대로 들고 있다가, 실제
  // 분석을 시작하는 순간에만 engine.ts의 7개 스텝 중 가장 가까운 값으로 스냅해서 넘긴다 —
  // 사용자에게는 몇 %인지 보여주지 않는다(QA 요청).
  const [frequentMixRatio, setFrequentMixRatio] = useState(0);

  // 이 화면에 들어올 때마다(동기화 주기 안이면 조용히 아무 것도 안 함, engine.ts 참고)
  // GitHub에 커밋된 최신 Atlas로 백그라운드에서 갱신을 시도한다 — 매주 자동 갱신되는 당첨
  // 이력을 앱 재빌드 없이도 딥 패턴 탐색이 따라가게 하기 위함(QA_LOG.md 77/78번). 버튼을
  // 누르기 전에 조용히 끝나든 안 끝나든 "패턴 분석 시작하기" 자체는 이 요청을 기다리지 않는다.
  useEffect(() => {
    void refreshAtlasIfStale();
  }, []);

  async function handleStart() {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const snappedRatio = snapFrequentPatternRatio(frequentMixRatio);
      const [batch] = await Promise.all([
        recommendDeepPatterns(RECOMMENDATION_COUNT, snappedRatio),
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
        {/* 처음 들어오면 긴 설명부터 읽어야 해서 안 읽고 넘어간다는 QA 피드백 — 글로
            설명하던 "좌표/선 잇기" 개념을 로딩 화면에도 쓰는 것과 동일한 점-선 애니메이션으로
            먼저 보여주고, 아래 문구는 이 화면이 뭘 해주는지만 한 줄로 짧게 남긴다. */}
        <DeepPatternLoadingBoard />
        <Text style={styles.paragraph}>
          814만 개 조합과 역대 당첨 기록을 비교해, 상대적으로 덜 관측된 패턴 영역을 찾아드려요.
        </Text>
        <PatternMixSlider value={frequentMixRatio} onChange={setFrequentMixRatio} />
      </ScrollView>

      <BottomActionBar label="패턴 분석 시작하기" onPress={handleStart} color="#6C5CE7" disabledColor="#C9C2FF" />
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    paragraph: {
      fontSize: 13.5,
      color: colors.textSecondary,
      lineHeight: 21,
      textAlign: "center",
      marginTop: 4,
    },
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
