import React, { useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { useRouter } from "expo-router";
import { LottoBall, DisclaimerCard } from "../../src/components";
import { parseLottoQrText, type ParsedLottoQrGame } from "../../src/lib/qr/parseLottoQr";
import { buildCheckedLottoQrGames } from "../../src/lib/qr/checkLottoQrGames";
import {
  getDrawByNumberWithStatus,
  buildOfficialResultPageUrl,
  RANK_LABELS,
  type WinningDraw,
} from "../../src/lib/draws";
import { useAppTheme, type AppColors, type BrandTokens } from "../../src/theme";
import { shareLottoNumbers } from "../../src/lib/share/kakaoShare";

const GAME_TYPE_LABELS: Record<ParsedLottoQrGame["gameType"], string> = {
  MANUAL: "수동",
  AUTO: "자동",
  SEMI_AUTO: "반자동",
  UNKNOWN: "구매",
};

interface CheckedGame {
  numbers: number[];
  gameTypeLabel: string;
  rank: 0 | 1 | 2 | 3 | 4 | 5;
}

interface ResultState {
  draw: WinningDraw;
  games: CheckedGame[];
}

function openOfficialResultPage(drawNumber: number) {
  Linking.openURL(buildOfficialResultPageUrl(drawNumber)).catch(() => {
    Alert.alert("페이지를 열 수 없습니다.");
  });
}

export default function QrCheckScreen() {
  const router = useRouter();
  const { colors, brand } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors, brand), [colors, brand]);
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanLocked, setScanLocked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<ResultState | null>(null);

  function resetScan() {
    setResult(null);
    setScanLocked(false);
  }

  async function handleBarcodeScanned(scan: BarcodeScanningResult) {
    if (scanLocked || checking) return;
    setScanLocked(true); // 같은 QR을 프레임마다 중복 스캔하지 않도록 즉시 잠근다.

    const parsed = parseLottoQrText(scan.data);

    if (parsed.status === "not_lotto_qr") {
      Alert.alert("로또 당첨 확인 QR이 아니에요", "동행복권 로또 6/45 용지의 QR코드를 스캔해주세요.", [
        { text: "다시 스캔", onPress: resetScan },
      ]);
      return;
    }
    if (parsed.status === "unrecognized_data") {
      Alert.alert(
        "QR을 읽었지만 번호를 알아볼 수 없어요",
        "용지가 손상됐거나 예상과 다른 형식이에요. 다시 스캔하거나 동행복권 홈페이지에서 직접 확인해주세요.",
        [{ text: "다시 스캔", onPress: resetScan }]
      );
      return;
    }

    setChecking(true);
    const { drawNumber, games } = parsed.data;
    const drawResult = await getDrawByNumberWithStatus(drawNumber);
    setChecking(false);

    if (drawResult.status === "network_error") {
      Alert.alert(
        "지금은 확인할 수 없어요",
        "네트워크 연결을 확인하고 다시 시도해주세요. 동행복권 홈페이지에서 직접 확인할 수도 있어요.",
        [
          { text: "다시 스캔", style: "cancel", onPress: resetScan },
          { text: "동행복권에서 확인", onPress: () => { openOfficialResultPage(drawNumber); resetScan(); } },
        ]
      );
      return;
    }
    if (drawResult.status === "not_announced") {
      Alert.alert(
        "아직 발표되지 않은 회차예요",
        `제 ${drawNumber}회는 아직 추첨 전이거나 결과가 반영되지 않았어요.`,
        [{ text: "다시 스캔", onPress: resetScan }]
      );
      return;
    }

    const checkedGames: CheckedGame[] = buildCheckedLottoQrGames(games, drawResult.draw).map((g) => ({
      numbers: g.numbers,
      gameTypeLabel: GAME_TYPE_LABELS[g.gameType],
      rank: g.rank,
    }));
    setResult({ draw: drawResult.draw, games: checkedGames });
  }

  async function handleShareResult() {
    if (!result) return;
    const winners = result.games.filter((g) => g.rank > 0);
    const lines = result.games.map(
      (g, i) => `${i + 1}게임(${g.gameTypeLabel}): ${g.numbers.join(" ")} → ${RANK_LABELS[g.rank]}`
    );
    const summary =
      winners.length > 0
        ? `제 ${result.draw.drawNumber}회 당첨 결과\n${lines.join("\n")}`
        : `제 ${result.draw.drawNumber}회 당첨 결과\n${lines.join("\n")}\n\n아쉽게도 당첨은 없었어요.`;
    // [10차 업데이트] 카카오톡에서는 카드로, 그 외에는 기존과 동일한 순수 텍스트로 공유된다.
    const description =
      winners.length > 0
        ? `${winners.length}게임 당첨! ${RANK_LABELS[winners[0].rank]}`
        : "아쉽게도 당첨은 없었어요.";
    await shareLottoNumbers(`제 ${result.draw.drawNumber}회 당첨 결과`, description, summary);
  }

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>카메라 권한이 필요해요</Text>
        <Text style={styles.permissionBody}>
          구매한 로또 용지의 QR코드를 스캔해 당첨 여부를 바로 확인할 수 있어요. 촬영된 이미지는 기기 밖으로 전송되지
          않고, QR 안의 번호를 읽는 데만 사용돼요.
        </Text>
        {permission.canAskAgain ? (
          <Pressable
            style={styles.permissionButton}
            onPress={requestPermission}
            accessibilityRole="button"
            accessibilityLabel="카메라 권한 허용"
          >
            <Text style={styles.permissionButtonText}>카메라 권한 허용</Text>
          </Pressable>
        ) : (
          // OS가 더 이상 권한 요청 팝업 자체를 띄워주지 않는 상태(한 번 거부됐거나 "다시
          // 묻지 않음"을 선택한 경우)라 requestPermission()을 다시 불러도 아무 반응이 없다.
          // 예전에는 "설정 > 앱 > 금손로또 > 권한" 경로를 텍스트로만 안내했는데, 주요 앱들처럼
          // 그 설정 화면으로 바로 연결하는 버튼을 눌러야 실제로 실행에 옮기기 쉽다는 피드백 —
          // `Linking.openSettings()`(RN 코어 API, iOS/Android 모두 앱의 설정 화면을 바로 연다)
          // 로 원탭 이동시킨다.
          //
          // [10차 업데이트] "권한이 켜지는 화면으로 바로 가게 해달라"는 추가 요청을 받았다.
          // 실제로 확인해보니 Android/iOS 모두 서드파티 앱이 "앱 권한 목록" 화면이나 특정
          // 권한(카메라)의 토글 화면을 직접 여는 공식적으로 문서화된 방법이 없다 — 가장 널리
          // 쓰이는 react-native-permissions 라이브러리도 openSettings()가 "application"(앱
          // 정보 화면, 지금 우리가 여는 것과 동일) 등 몇 가지 카테고리만 지원하고 개별 권한
          // 화면은 지원하지 않는다고 명시한다(비공식/미문서화된 Intent를 억지로 쓰면 기기·OS
          // 버전마다 조용히 실패할 위험이 있어 장년층 사용자에게 오히려 혼란을 줄 수 있다고
          // 판단해 적용하지 않았다). 대신 `Linking.openSettings()`로 도착하는 "앱 정보" 화면
          // 에서 남은 두 번의 탭("권한" → "카메라" 켜기)을 놓치지 않도록, 기존의 작은 안내
          // 문장 한 줄 대신 번호가 매겨진 큼직한 단계별 안내 박스로 바꿨다 — 글자 크기를 키우고
          // 눌러야 할 단어("권한"/"카메라")를 굵게 강조해 장년층도 다음에 뭘 눌러야 할지
          // 한눈에 알 수 있게 했다.
          <>
            <Pressable
              style={styles.permissionButton}
              onPress={() => {
                Linking.openSettings().catch(() => {
                  Alert.alert("설정 화면을 열 수 없어요", "기기 설정 앱에서 직접 권한을 변경해주세요.");
                });
              }}
              accessibilityRole="button"
              accessibilityLabel="설정에서 카메라 권한 허용하기"
            >
              <Text style={styles.permissionButtonText}>설정에서 권한 허용하기</Text>
            </Pressable>
            <View style={styles.permissionStepsBox}>
              <Text style={styles.permissionStepsTitle}>설정 화면이 열리면, 이렇게 2번만 눌러주세요</Text>
              <View style={styles.permissionStepRow}>
                <View style={styles.permissionStepNumber}>
                  <Text style={styles.permissionStepNumberText}>1</Text>
                </View>
                <Text style={styles.permissionStepText}>
                  <Text style={styles.permissionStepHighlight}>권한</Text> 누르기
                </Text>
              </View>
              <View style={styles.permissionStepRow}>
                <View style={styles.permissionStepNumber}>
                  <Text style={styles.permissionStepNumberText}>2</Text>
                </View>
                <Text style={styles.permissionStepText}>
                  <Text style={styles.permissionStepHighlight}>카메라</Text> 눌러서 켜기
                </Text>
              </View>
            </View>
          </>
        )}
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="닫기">
          <Text style={styles.backLink}>닫기</Text>
        </Pressable>
      </View>
    );
  }

  if (result) {
    const winners = result.games.filter((g) => g.rank > 0);
    return (
      // [Phase 5c 안전영역 재점검, 2026-09-10] "결과 공유"/"다시 스캔" 버튼이 하단 고정 바
      // 없이 스크롤 콘텐츠 맨 아래에 있다 — 고정 32px만으로는 엣지투엣지로 그려지는 기기의
      // 하단 제스처 바(insets.bottom)를 못 벗어날 수 있어 더해준다.
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        <View style={styles.resultHeader}>
          <Text style={styles.resultRound}>제 {result.draw.drawNumber}회</Text>
          <Text style={styles.resultSummary}>
            {winners.length > 0 ? `${winners.length}게임 당첨!` : "아쉽게도 당첨은 없었어요"}
          </Text>
        </View>

        {result.games.map((g, i) => (
          <View key={i} style={styles.gameCard}>
            <View style={styles.gameCardHeader}>
              <Text style={styles.gameCardLabel}>{i + 1}게임 · {g.gameTypeLabel}</Text>
              <Text style={[styles.rankText, g.rank > 0 && styles.rankTextWin]}>{RANK_LABELS[g.rank]}</Text>
            </View>
            <View style={styles.ballRow}>
              {g.numbers.map((n) => (
                <LottoBall key={n} number={n} size={32} />
              ))}
            </View>
          </View>
        ))}

        <DisclaimerCard text="당첨 결과는 동행복권이 발표한 공식 당첨번호를 기기에서 다시 조회해 계산한 값입니다. QR 자체에 담긴 당첨 표시는 신뢰하지 않고 항상 재계산합니다." />

        <View style={styles.resultActionRow}>
          <Pressable style={styles.secondaryButton} onPress={handleShareResult} accessibilityRole="button" accessibilityLabel="결과 공유">
            <Text style={styles.secondaryButtonText}>결과 공유</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={resetScan} accessibilityRole="button" accessibilityLabel="다시 스캔">
            <Text style={styles.primaryButtonText}>다시 스캔</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanLocked ? undefined : handleBarcodeScanned}
      />
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.scanFrame} />
        <Text style={styles.overlayHint}>
          {checking ? "당첨번호 확인 중..." : "로또 용지의 QR코드를 사각형 안에 맞춰주세요"}
        </Text>
      </View>
      <Pressable style={styles.closeButton} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="닫기">
        <Text style={styles.closeButtonText}>닫기</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: AppColors, brand: BrandTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    camera: { flex: 1 },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
    },
    scanFrame: {
      width: 240,
      height: 240,
      borderRadius: 20,
      borderWidth: 3,
      borderColor: "#fff",
    },
    overlayHint: {
      marginTop: 20,
      color: "#fff",
      fontSize: 13,
      fontWeight: "600",
      textAlign: "center",
      paddingHorizontal: 32,
      textShadowColor: "rgba(0,0,0,0.6)",
      textShadowRadius: 4,
    },
    closeButton: {
      position: "absolute",
      top: 56,
      right: 20,
      backgroundColor: "rgba(15,23,42,0.6)",
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    closeButtonText: { color: "#fff", fontSize: 13, fontWeight: "700" },
    permissionContainer: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      gap: 12,
    },
    permissionTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.textPrimary,
      textAlign: "center",
    },
    permissionBody: { fontSize: 13, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
    permissionButton: {
      backgroundColor: brand.primary,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 24,
      marginTop: 8,
    },
    permissionButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
    // [10차 업데이트] 설정 화면 도착 후 남은 탭("권한"→"카메라")을 장년층도 헷갈리지 않게
    // 안내하는 단계별 박스 — 기존의 작은 한 줄 안내 문장보다 글자를 키우고 번호를 매겨
    // 한눈에 순서가 들어오도록 했다.
    permissionStepsBox: {
      width: "100%",
      backgroundColor: colors.surfaceAlt,
      borderRadius: 14,
      padding: 16,
      gap: 10,
    },
    permissionStepsTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textPrimary,
      textAlign: "center",
      marginBottom: 2,
    },
    permissionStepRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    permissionStepNumber: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: brand.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    permissionStepNumberText: { color: "#fff", fontSize: 13, fontWeight: "800" },
    permissionStepText: { fontSize: 16, color: colors.textPrimary, fontWeight: "600" },
    permissionStepHighlight: { color: brand.primary, fontWeight: "800" },
    backLink: { color: colors.textMuted, fontSize: 12, fontWeight: "600", marginTop: 8, textDecorationLine: "underline" },
    resultHeader: { alignItems: "center", marginBottom: 16 },
    resultRound: { fontSize: 14, color: colors.textMuted, fontWeight: "600", marginBottom: 4 },
    resultSummary: { fontSize: 20, color: colors.textPrimary, fontWeight: "800" },
    // [DESIGN_GUIDE.md 7절 / Phase 5c, 2026-09-10] radius 16→20(주요 콘텐츠 카드 티어).
    gameCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    gameCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    gameCardLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
    rankText: { fontSize: 13, fontWeight: "800", color: colors.textMuted },
    rankTextWin: { color: "#DC2626" },
    ballRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    resultActionRow: { flexDirection: "row", gap: 8, marginTop: 8 },
    primaryButton: { flex: 1, backgroundColor: brand.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
    primaryButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
    secondaryButton: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    secondaryButtonText: { color: colors.textSecondary, fontSize: 14, fontWeight: "700" },
  });
}
