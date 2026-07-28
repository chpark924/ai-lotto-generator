import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { estimateLatestDrawNumber, getRecentDraws, getLongestAbsentNumbers, computeNumberFrequencies } from "../../src/lib/draws";
import { getGenerationHistory } from "../../src/lib/storage";
import { ENTERTAINMENT_NOTICE } from "../../src/constants/messages";
import { LottoBall, SettingsSheet } from "../../src/components";

function daysUntilNextSaturday(): number {
  const now = new Date();
  const day = now.getDay(); // 0=Sun ... 6=Sat
  const diff = (6 - day + 7) % 7;
  return diff === 0 ? 7 : diff;
}

export default function HomeScreen() {
  const router = useRouter();
  const [latestDrawNumber, setLatestDrawNumber] = useState<number | null>(null);
  const [absentNumbers, setAbsentNumbers] = useState<number[]>([]);
  const [myFrequentNumbers, setMyFrequentNumbers] = useState<number[]>([]);
  const [settingsVisible, setSettingsVisible] = useState(false);

  useEffect(() => {
    (async () => {
      const draws = await getRecentDraws(30);
      if (draws.length > 0) {
        setLatestDrawNumber(draws[0].drawNumber);
        const frequencies = computeNumberFrequencies(draws);
        const absent = getLongestAbsentNumbers(frequencies, draws[0].drawNumber, 6);
        setAbsentNumbers(absent.map((a) => a.number));
      } else {
        setLatestDrawNumber(estimateLatestDrawNumber());
      }

      const history = await getGenerationHistory();
      const counts = new Map<number, number>();
      for (const combo of history) {
        for (const n of combo) counts.set(n, (counts.get(n) ?? 0) + 1);
      }
      const top = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([n]) => n);
      setMyFrequentNumbers(top);
    })();
  }, []);

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
        <Pressable style={styles.settingsLink} onPress={() => setSettingsVisible(true)}>
          <Text style={styles.settingsLinkText}>설정</Text>
        </Pressable>
        <View style={styles.heroCard}>
          <Text style={styles.heroSubtitle}>
            {latestDrawNumber ? `제 ${latestDrawNumber + 1}회 추첨까지 D-${daysUntilNextSaturday()}` : "이번 주 운명을 만들어보세요"}
          </Text>
          <Text style={styles.heroTitle}>이번 주 운명을 만들어보세요</Text>
          <Pressable style={styles.ctaButton} onPress={() => router.push("/generate/ai-search")}>
            <Text style={styles.ctaButtonText}>AI로 번호 만들기</Text>
          </Pressable>
        </View>

        <View style={styles.quickMenuRow}>
          <QuickMenuItem label="제외하고 만들기" onPress={() => router.push("/generate/exclusion")} />
          <QuickMenuItem label="행운번호" onPress={() => router.push("/generate/lucky")} />
          <QuickMenuItem label="45면체 주사위" onPress={() => router.push("/generate/dice")} />
        </View>

        {myFrequentNumbers.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>내가 자주 선택한 번호</Text>
            <View style={styles.ballRow}>
              {myFrequentNumbers.map((n) => (
                <LottoBall key={n} number={n} size={30} />
              ))}
            </View>
            <Text style={styles.cardCaption}>평소와 다른 조합을 만들어볼까요?</Text>
          </View>
        ) : null}

        {absentNumbers.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>최근 오래 나오지 않은 번호</Text>
            <View style={styles.ballRow}>
              {absentNumbers.map((n) => (
                <LottoBall key={n} number={n} size={30} />
              ))}
            </View>
          </View>
        ) : null}

        <Text style={styles.footerNotice}>{ENTERTAINMENT_NOTICE}</Text>
      </ScrollView>

      <SettingsSheet visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
    </>
  );
}

function QuickMenuItem({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.quickMenuItem} onPress={onPress}>
      <Text style={styles.quickMenuText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  settingsLink: { alignSelf: "flex-end", marginBottom: 8 },
  settingsLinkText: { color: "#64748B", fontSize: 12, fontWeight: "600" },
  heroCard: {
    backgroundColor: "#0F172A",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  heroSubtitle: { color: "#94A3B8", fontSize: 13, marginBottom: 6 },
  heroTitle: { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 16 },
  ctaButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  ctaButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  quickMenuRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  quickMenuItem: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  quickMenuText: { fontSize: 12, fontWeight: "600", color: "#334155", textAlign: "center" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A", marginBottom: 10 },
  cardCaption: { fontSize: 12, color: "#64748B", marginTop: 8 },
  ballRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  footerNotice: { fontSize: 11, color: "#94A3B8", textAlign: "center", marginTop: 8, marginBottom: 24 },
});
