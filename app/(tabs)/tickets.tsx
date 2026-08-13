import React, { useCallback, useRef, useState } from "react";
import { Alert, FlatList, Linking, Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { LottoBall } from "../../src/components";
import {
  getTickets,
  updateTicketStatus,
  updateTicketDrawNumber,
  updateTicketMatchedRank,
  deleteTicket,
  type SavedTicket,
  type TicketStatus,
} from "../../src/lib/storage";
import {
  getDrawByNumberWithStatus,
  estimateLatestDrawNumber,
  estimateDrawDate,
  computeRank,
  buildOfficialResultPageUrl,
  RANK_LABELS,
} from "../../src/lib/draws";
import { useAppTheme, type AppColors, type AppTints } from "../../src/theme";

/** 자동/수동 확인이 실패했을 때, 동행복권 공식 결과 페이지를 브라우저로 열어 직접 확인할 수 있게 한다. */
function openOfficialResultPage(drawNumber: number) {
  Linking.openURL(buildOfficialResultPageUrl(drawNumber)).catch(() => {
    Alert.alert("페이지를 열 수 없습니다.");
  });
}

/** 회차 번호 대신 사람이 바로 이해하는 날짜로 보여준다 (예: "8/8"). 대부분의 유저는 회차 번호를 외우지 않는다. */
function formatDrawDateShort(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  SAVED: "저장함",
  PLANNED: "구매 예정",
  PURCHASED: "구매 완료",
  CHECKED: "확인 완료",
};

const STATUS_ORDER: TicketStatus[] = ["SAVED", "PLANNED", "PURCHASED", "CHECKED"];

/** 상태별로 배지 색을 다르게 줘서 한눈에 구분되게 한다 (저장함/구매 예정이 같은 색이라 헷갈린다는 피드백 반영). */
function getStatusBadgeStyle(tints: AppTints, status: TicketStatus): { backgroundColor: string; color: string } {
  const byStatus: Record<TicketStatus, { backgroundColor: string; color: string }> = {
    SAVED: { backgroundColor: tints.slate.bg, color: tints.slate.fg }, // 그냥 저장만 해둔 상태
    PLANNED: { backgroundColor: tints.indigo.bg, color: tints.indigo.fg }, // 구매 예정
    PURCHASED: { backgroundColor: tints.green.bg, color: tints.green.fg }, // 구매 완료
    CHECKED: { backgroundColor: tints.orange.bg, color: tints.orange.fg }, // 당첨 확인 완료
  };
  return byStatus[status];
}

export default function TicketsScreen() {
  const router = useRouter();
  const { colors, tints } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [tickets, setTickets] = useState<SavedTicket[]>([]);
  const [drawNumberDrafts, setDrawNumberDrafts] = useState<Record<string, string>>({});
  // 회차 지정 입력칸을 펼쳐서 보여줄지 여부. 회차가 이미 있으면 평소엔 접어두고
  // "당첨 확인" 버튼 하나만 강조해서, 두 버튼이 나란히 있어 헷갈리는 걸 막는다.
  const [editingDraw, setEditingDraw] = useState<Record<string, boolean>>({});
  // 편집 모드를 펼쳤을 때 기본은 "이번 주/다음 주" 빠른 선택이고, 회차 번호를 직접 타이핑하는 건
  // 예외적인 경우에만 노출한다 — 유저 대부분은 회차 번호 자체를 신경 쓰지 않기 때문.
  const [manualEntry, setManualEntry] = useState<Record<string, boolean>>({});
  const isAutoChecking = useRef(false);

  // "이번 주"는 아직 추첨되지 않은 다음 회차(구매 대상), "다음 주"는 그 다음 회차.
  const thisWeekDrawNumber = estimateLatestDrawNumber() + 1;
  const nextWeekDrawNumber = thisWeekDrawNumber + 1;

  /** 회차 번호를 그대로 보여주지 않고 "이번 주/다음 주 추첨 (날짜)"처럼 사람이 바로 이해하는 문구로 바꾼다. */
  function describeDrawNumber(drawNumber: number): string {
    const dateLabel = formatDrawDateShort(estimateDrawDate(drawNumber));
    if (drawNumber === thisWeekDrawNumber) return `이번 주 추첨 (${dateLabel})`;
    if (drawNumber === nextWeekDrawNumber) return `다음 주 추첨 (${dateLabel})`;
    return `제 ${drawNumber}회 (${dateLabel} 추첨)`;
  }

  const load = useCallback(async () => {
    const list = await getTickets();
    setTickets(list);
    return list;
  }, []);

  const autoCheckPendingTickets = useCallback(async (list: SavedTicket[]) => {
    if (isAutoChecking.current) return;
    isAutoChecking.current = true;
    try {
      const pending = list.filter((t) => t.matchedRank === undefined && t.drawNumber);
      if (pending.length === 0) return;

      const newlyChecked: { drawNumber: number; rank: 0 | 1 | 2 | 3 | 4 | 5 }[] = [];
      for (const ticket of pending) {
        const result = await getDrawByNumberWithStatus(ticket.drawNumber as number);
        // 자동 확인은 조용히 진행하는 백그라운드 동작이라, 미발표/네트워크 오류는
        // 알림 없이 건너뛰고 다음 화면 방문 때 다시 시도한다. 수동 확인 버튼에서만
        // 실패 사유를 구체적으로 안내한다.
        if (result.status !== "success") continue;
        const rank = computeRank(ticket.game.numbers, result.draw);
        try {
          await updateTicketMatchedRank(ticket.id, rank);
          newlyChecked.push({ drawNumber: ticket.drawNumber as number, rank });
        } catch (e) {
          // 저장 실패도 백그라운드 동작이므로 조용히 넘어가고, 다음 화면 방문 때 다시 시도한다.
          // 사용자가 직접 누르는 수동 확인 버튼(handleCheckResult)에서만 실패를 알린다.
          console.error("[tickets] 자동 확인 결과 저장 실패:", e);
        }
      }

      if (newlyChecked.length > 0) {
        const winners = newlyChecked.filter((r) => r.rank > 0);
        const summary =
          winners.length > 0
            ? winners.map((w) => `제 ${w.drawNumber}회: ${RANK_LABELS[w.rank]}`).join("\n")
            : `${newlyChecked.length}건의 결과를 확인했어요. 아쉽게도 당첨은 없었습니다.`;
        Alert.alert("당첨 결과 자동 확인", summary);
        await load();
      }
    } finally {
      isAutoChecking.current = false;
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load().then((list) => {
        autoCheckPendingTickets(list);
      });
    }, [load, autoCheckPendingTickets])
  );

  async function cycleStatus(ticket: SavedTicket) {
    const currentIndex = STATUS_ORDER.indexOf(ticket.status);
    const next = STATUS_ORDER[(currentIndex + 1) % STATUS_ORDER.length];
    try {
      await updateTicketStatus(ticket.id, next);
      load();
    } catch {
      Alert.alert("변경 실패", "상태를 저장하지 못했어요. 다시 시도해주세요.");
    }
  }

  /** "회차 변경" 링크를 눌렀을 때: 기본은 "이번 주/다음 주" 빠른 선택 화면을 펼친다. */
  function startEditingDraw(ticket: SavedTicket) {
    setEditingDraw((prev) => ({ ...prev, [ticket.id]: true }));
    setManualEntry((prev) => ({ ...prev, [ticket.id]: false }));
  }

  function cancelEditingDraw(id: string) {
    setEditingDraw((prev) => ({ ...prev, [id]: false }));
    setManualEntry((prev) => ({ ...prev, [id]: false }));
    setDrawNumberDrafts((prev) => ({ ...prev, [id]: "" }));
  }

  /** "직접 입력"으로 전환: 회차 번호를 정확히 아는 드문 경우(과거 회차 재확인 등)를 위한 예외 경로. */
  function startManualEntry(ticket: SavedTicket) {
    setManualEntry((prev) => ({ ...prev, [ticket.id]: true }));
    setDrawNumberDrafts((prev) => ({
      ...prev,
      [ticket.id]: ticket.drawNumber ? String(ticket.drawNumber) : "",
    }));
  }

  async function finishAssigningDraw(ticket: SavedTicket, drawNumber: number) {
    try {
      await updateTicketDrawNumber(ticket.id, drawNumber);
      setDrawNumberDrafts((prev) => ({ ...prev, [ticket.id]: "" }));
      setEditingDraw((prev) => ({ ...prev, [ticket.id]: false }));
      setManualEntry((prev) => ({ ...prev, [ticket.id]: false }));
      load();
      Alert.alert(
        "회차를 지정했어요",
        `제 ${drawNumber}회(${formatDrawDateShort(estimateDrawDate(drawNumber))} 추첨 예정)로 지정됐어요.`
      );
    } catch {
      Alert.alert("변경 실패", "회차를 저장하지 못했어요. 다시 시도해주세요.");
    }
  }

  async function handleAssignDraw(ticket: SavedTicket) {
    const draft = drawNumberDrafts[ticket.id]?.trim();
    if (!draft) {
      Alert.alert("회차 번호를 입력해주세요.");
      return;
    }
    const parsed = Number(draft);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      Alert.alert("올바른 회차 번호를 입력해주세요.");
      return;
    }
    await finishAssigningDraw(ticket, parsed);
  }

  async function handleCheckResult(ticket: SavedTicket) {
    if (!ticket.drawNumber) {
      Alert.alert("먼저 확인할 회차를 지정해주세요.");
      return;
    }
    const drawNumber = ticket.drawNumber;
    const result = await getDrawByNumberWithStatus(drawNumber);

    if (result.status === "network_error") {
      Alert.alert(
        "지금은 확인할 수 없어요",
        "네트워크 연결을 확인하고 다시 시도해주세요. 동행복권 홈페이지에서 직접 확인할 수도 있어요.",
        [
          { text: "닫기", style: "cancel" },
          { text: "동행복권에서 확인", onPress: () => openOfficialResultPage(drawNumber) },
        ]
      );
      return;
    }

    if (result.status === "not_announced") {
      Alert.alert(
        "아직 발표되지 않은 회차예요",
        "발표 이후 다시 확인해주세요. 동행복권 홈페이지에서 발표 여부를 직접 확인할 수도 있어요.",
        [
          { text: "닫기", style: "cancel" },
          { text: "동행복권에서 확인", onPress: () => openOfficialResultPage(drawNumber) },
        ]
      );
      return;
    }

    const rank = computeRank(ticket.game.numbers, result.draw);
    try {
      await updateTicketMatchedRank(ticket.id, rank);
      Alert.alert(`결과: ${RANK_LABELS[rank]}`);
      load();
    } catch {
      Alert.alert("저장 실패", "확인 결과를 저장하지 못했어요. 다시 시도해주세요.");
    }
  }

  async function handleShare(ticket: SavedTicket) {
    const numbersText = ticket.game.numbers.join(" · ");
    try {
      await Share.share({
        message: `내 로또 번호 (${STATUS_LABELS[ticket.status]}): ${numbersText}`,
      });
    } catch {
      // 취소 등은 무시
    }
  }

  function handleDelete(id: string) {
    Alert.alert("번호 삭제", "저장한 번호를 삭제합니다. 삭제 후에는 되돌릴 수 없습니다.", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteTicket(id);
            load();
          } catch {
            Alert.alert("삭제 실패", "번호를 삭제하지 못했어요. 다시 시도해주세요.");
          }
        },
      },
    ]);
  }

  if (tickets.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>아직 저장한 번호가 없습니다.</Text>
        <Text style={styles.emptySub}>번호 만들기 탭에서 번호를 생성하고 저장해보세요.</Text>
        <Pressable
          style={styles.prefLinkButton}
          onPress={() => router.push("/preferences")}
          accessibilityRole="button"
          accessibilityLabel="선호번호 · 제외번호 세트 관리"
        >
          <Text style={styles.prefLinkText}>선호번호 · 제외번호 세트 관리</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      data={tickets}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <Pressable
          style={styles.prefLinkRow}
          onPress={() => router.push("/preferences")}
          accessibilityRole="button"
          accessibilityLabel="선호번호 · 제외번호 세트 관리"
        >
          <Text style={styles.prefLinkText}>선호번호 · 제외번호 세트 관리 &gt;</Text>
        </Pressable>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Pressable
              style={[styles.statusBadge, { backgroundColor: getStatusBadgeStyle(tints, item.status).backgroundColor }]}
              onPress={() => cycleStatus(item)}
              accessibilityRole="button"
              accessibilityLabel={`상태: ${STATUS_LABELS[item.status]}. 탭하면 다음 상태로 변경`}
            >
              <Text
                maxFontSizeMultiplier={1.3}
                style={[styles.statusBadgeText, { color: getStatusBadgeStyle(tints, item.status).color }]}
              >
                {STATUS_LABELS[item.status]}
              </Text>
            </Pressable>
            {item.matchedRank !== undefined ? (
              <Text style={styles.rankText}>{RANK_LABELS[item.matchedRank]}</Text>
            ) : null}
          </View>

          <View style={styles.ballRow}>
            {item.game.numbers.map((n) => (
              <LottoBall key={n} number={n} size={32} />
            ))}
          </View>

          {item.drawNumber && !editingDraw[item.id] ? (
            // 회차가 이미 정해진 평소 상태: "당첨 확인" 하나만 또렷한 버튼으로 보여주고,
            // 회차를 바꾸는 건 눈에 덜 띄는 텍스트 링크로 분리해 둘 중 뭘 눌러야 할지
            // 헷갈리지 않게 한다. 라벨도 회차 번호 대신 "이번 주/날짜"로 보여줘서
            // 회차 번호를 몰라도 무슨 뜻인지 바로 알 수 있게 한다.
            <View style={styles.drawSummaryRow}>
              <View style={styles.drawChip}>
                <Text style={styles.drawChipText}>{describeDrawNumber(item.drawNumber)}</Text>
              </View>
              <Pressable
                style={styles.checkButton}
                onPress={() => handleCheckResult(item)}
                accessibilityRole="button"
                accessibilityLabel={item.matchedRank !== undefined ? "다시 확인" : "당첨 확인"}
              >
                <Text style={styles.checkButtonText}>
                  {item.matchedRank !== undefined ? "다시 확인" : "당첨 확인"}
                </Text>
              </Pressable>
              <Pressable
                style={styles.linkButton}
                onPress={() => startEditingDraw(item)}
                accessibilityRole="button"
                accessibilityLabel="회차 변경"
              >
                <Text style={styles.linkButtonText}>회차 변경</Text>
              </Pressable>
            </View>
          ) : manualEntry[item.id] ? (
            // "직접 입력"을 고른 드문 경우에만 회차 번호를 타이핑하게 한다.
            <View style={styles.drawRow}>
              <TextInput
                style={styles.drawInput}
                placeholder="회차 번호 (예: 1235)"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                autoFocus
                value={drawNumberDrafts[item.id] ?? ""}
                onChangeText={(text) =>
                  setDrawNumberDrafts((prev) => ({ ...prev, [item.id]: text }))
                }
                accessibilityLabel="회차 번호 입력"
              />
              <Pressable
                style={styles.smallButton}
                onPress={() => handleAssignDraw(item)}
                accessibilityRole="button"
                accessibilityLabel="회차 지정"
              >
                <Text style={styles.smallButtonText}>지정</Text>
              </Pressable>
              <Pressable
                style={styles.linkButton}
                onPress={() => setManualEntry((prev) => ({ ...prev, [item.id]: false }))}
                accessibilityRole="button"
                accessibilityLabel="뒤로"
              >
                <Text style={styles.linkButtonText}>뒤로</Text>
              </Pressable>
            </View>
          ) : (
            // 기본은 회차 번호를 몰라도 되는 "이번 주 / 다음 주" 빠른 선택.
            <View style={styles.quickPickRow}>
              <Pressable
                style={styles.quickPickButton}
                onPress={() => finishAssigningDraw(item, thisWeekDrawNumber)}
                accessibilityRole="button"
                accessibilityLabel={`이번 주 ${formatDrawDateShort(estimateDrawDate(thisWeekDrawNumber))} 추첨으로 지정`}
              >
                <Text style={styles.quickPickButtonText}>
                  이번 주 ({formatDrawDateShort(estimateDrawDate(thisWeekDrawNumber))})
                </Text>
              </Pressable>
              <Pressable
                style={styles.quickPickButton}
                onPress={() => finishAssigningDraw(item, nextWeekDrawNumber)}
                accessibilityRole="button"
                accessibilityLabel={`다음 주 ${formatDrawDateShort(estimateDrawDate(nextWeekDrawNumber))} 추첨으로 지정`}
              >
                <Text style={styles.quickPickButtonText}>
                  다음 주 ({formatDrawDateShort(estimateDrawDate(nextWeekDrawNumber))})
                </Text>
              </Pressable>
              <Pressable
                style={styles.linkButton}
                onPress={() => startManualEntry(item)}
                accessibilityRole="button"
                accessibilityLabel="회차 직접 입력"
              >
                <Text style={styles.linkButtonText}>직접 입력</Text>
              </Pressable>
              {item.drawNumber ? (
                <Pressable
                  style={styles.linkButton}
                  onPress={() => cancelEditingDraw(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel="회차 변경 취소"
                >
                  <Text style={styles.linkButtonText}>취소</Text>
                </Pressable>
              ) : null}
            </View>
          )}

          <View style={styles.bottomRow}>
            <Pressable
              style={styles.shareButton}
              onPress={() => handleShare(item)}
              accessibilityRole="button"
              accessibilityLabel="번호 공유"
              hitSlop={{ top: 14, bottom: 14, left: 16, right: 16 }}
            >
              <Text style={styles.shareButtonText}>공유</Text>
            </Pressable>
            <Pressable
              style={styles.deleteButton}
              onPress={() => handleDelete(item.id)}
              accessibilityRole="button"
              accessibilityLabel="번호 삭제"
              hitSlop={{ top: 14, bottom: 14, left: 16, right: 16 }}
            >
              <Text style={styles.deleteButtonText}>삭제</Text>
            </Pressable>
          </View>
        </View>
      )}
    />
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    emptyText: { fontSize: 15, fontWeight: "700", color: colors.textPrimary, marginBottom: 6 },
    emptySub: { fontSize: 12, color: colors.textMuted },
    // 저장한 카드마다 똑같은 흰 사각형이 촘촘히 붙어 있어서 눈에 잘 안 들어오고 피곤하다는
    // QA 피드백(2026-08-13) — 카드 하나하나는 조금 더 컴팩트하게(padding·내부 여백 축소),
    // 카드와 카드 사이 간격은 넉넉하게 벌려서(marginBottom 확대) 목록을 훑어볼 때 각 카드가
    // 독립된 항목으로 눈에 띄게 한다.
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
    statusBadge: { backgroundColor: colors.surfaceAlt, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    statusBadgeText: { fontSize: 11, fontWeight: "700" },
    rankText: { fontSize: 13, fontWeight: "800", color: "#DC2626" },
    ballRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
    drawRow: { flexDirection: "row", gap: 6, alignItems: "center" },
    drawInput: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 12,
      color: colors.textPrimary,
    },
    smallButton: { backgroundColor: "#0F172A", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
    smallButtonText: { color: "#fff", fontSize: 11, fontWeight: "700" },
    drawSummaryRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    drawChip: {
      backgroundColor: colors.background,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    drawChipText: { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },
    // "당첨 확인"이 이 카드에서 지금 가장 중요한 행동이라는 걸 색으로도 드러낸다.
    checkButton: { backgroundColor: "#2563EB", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, flex: 1 },
    checkButtonText: { color: "#fff", fontSize: 12, fontWeight: "700", textAlign: "center" },
    linkButton: { paddingHorizontal: 4, paddingVertical: 8 },
    linkButtonText: { color: colors.textMuted, fontSize: 11, fontWeight: "600", textDecorationLine: "underline" },
    quickPickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
    quickPickButton: {
      backgroundColor: "#0F172A",
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    quickPickButtonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
    bottomRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
    // paddingVertical만으로는 44pt 최소 터치 타겟에 못 미쳐(텍스트 링크라 실제 박스가 작음),
    // 실제 박스는 그대로 작게 유지하고 hitSlop으로 터치 영역만 넓힌다(위 JSX 참고).
    shareButton: { paddingVertical: 6, paddingHorizontal: 2 },
    shareButtonText: { color: "#2563EB", fontSize: 11, fontWeight: "700" },
    deleteButton: { paddingVertical: 6, paddingHorizontal: 2 },
    deleteButtonText: { color: colors.textMuted, fontSize: 11 },
    prefLinkRow: { paddingVertical: 10, marginBottom: 4 },
    prefLinkButton: {
      marginTop: 16,
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    prefLinkText: { color: "#2563EB", fontSize: 12, fontWeight: "700" },
  });
}
