import React, { useCallback, useRef, useState } from "react";
import { Alert, FlatList, Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
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
import { getDrawByNumber, estimateLatestDrawNumber, computeRank, RANK_LABELS } from "../../src/lib/draws";

const STATUS_LABELS: Record<TicketStatus, string> = {
  SAVED: "저장함",
  PLANNED: "구매 예정",
  PURCHASED: "구매 완료",
  CHECKED: "확인 완료",
};

const STATUS_ORDER: TicketStatus[] = ["SAVED", "PLANNED", "PURCHASED", "CHECKED"];

export default function TicketsScreen() {
  const router = useRouter();
  const [tickets, setTickets] = useState<SavedTicket[]>([]);
  const [drawNumberDrafts, setDrawNumberDrafts] = useState<Record<string, string>>({});
  const isAutoChecking = useRef(false);

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
        const draw = await getDrawByNumber(ticket.drawNumber as number);
        if (!draw) continue;
        const rank = computeRank(ticket.game.numbers, draw);
        await updateTicketMatchedRank(ticket.id, rank);
        newlyChecked.push({ drawNumber: ticket.drawNumber as number, rank });
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
    await updateTicketStatus(ticket.id, next);
    load();
  }

  async function handleAssignDraw(ticket: SavedTicket) {
    const draft = drawNumberDrafts[ticket.id];
    const drawNumber = Number(draft) || estimateLatestDrawNumber() + 1;
    await updateTicketDrawNumber(ticket.id, drawNumber);
    load();
  }

  async function handleCheckResult(ticket: SavedTicket) {
    if (!ticket.drawNumber) {
      Alert.alert("먼저 확인할 회차를 지정해주세요.");
      return;
    }
    const draw = await getDrawByNumber(ticket.drawNumber);
    if (!draw) {
      Alert.alert("아직 발표되지 않았거나 조회할 수 없는 회차입니다.");
      return;
    }
    const rank = computeRank(ticket.game.numbers, draw);
    await updateTicketMatchedRank(ticket.id, rank);
    Alert.alert(`결과: ${RANK_LABELS[rank]}`);
    load();
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

  async function handleDelete(id: string) {
    await deleteTicket(id);
    load();
  }

  if (tickets.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>아직 저장한 번호가 없습니다.</Text>
        <Text style={styles.emptySub}>번호 만들기 탭에서 번호를 생성하고 저장해보세요.</Text>
        <Pressable style={styles.prefLinkButton} onPress={() => router.push("/preferences")}>
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
        <Pressable style={styles.prefLinkRow} onPress={() => router.push("/preferences")}>
          <Text style={styles.prefLinkText}>선호번호 · 제외번호 세트 관리 &gt;</Text>
        </Pressable>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Pressable style={styles.statusBadge} onPress={() => cycleStatus(item)}>
              <Text style={styles.statusBadgeText}>{STATUS_LABELS[item.status]}</Text>
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

          <View style={styles.drawRow}>
            <TextInput
              style={styles.drawInput}
              placeholder={item.drawNumber ? String(item.drawNumber) : "확인할 회차 번호"}
              keyboardType="number-pad"
              value={drawNumberDrafts[item.id] ?? ""}
              onChangeText={(text) =>
                setDrawNumberDrafts((prev) => ({ ...prev, [item.id]: text }))
              }
            />
            <Pressable style={styles.smallButton} onPress={() => handleAssignDraw(item)}>
              <Text style={styles.smallButtonText}>회차 지정</Text>
            </Pressable>
            <Pressable style={styles.smallButton} onPress={() => handleCheckResult(item)}>
              <Text style={styles.smallButtonText}>당첨 확인</Text>
            </Pressable>
          </View>

          <View style={styles.bottomRow}>
            <Pressable style={styles.shareButton} onPress={() => handleShare(item)}>
              <Text style={styles.shareButtonText}>공유</Text>
            </Pressable>
            <Pressable style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
              <Text style={styles.deleteButtonText}>삭제</Text>
            </Pressable>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyText: { fontSize: 15, fontWeight: "700", color: "#0F172A", marginBottom: 6 },
  emptySub: { fontSize: 12, color: "#64748B" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  statusBadge: { backgroundColor: "#EEF2FF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { color: "#4338CA", fontSize: 11, fontWeight: "700" },
  rankText: { fontSize: 13, fontWeight: "800", color: "#DC2626" },
  ballRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  drawRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  drawInput: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
  smallButton: { backgroundColor: "#0F172A", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  smallButtonText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  shareButton: { paddingVertical: 4 },
  shareButtonText: { color: "#2563EB", fontSize: 11, fontWeight: "700" },
  deleteButton: { paddingVertical: 4 },
  deleteButtonText: { color: "#94A3B8", fontSize: 11 },
  prefLinkRow: { paddingVertical: 10, marginBottom: 4 },
  prefLinkButton: {
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  prefLinkText: { color: "#2563EB", fontSize: 12, fontWeight: "700" },
});
