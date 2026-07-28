import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getPreferences, updatePreferences } from "../lib/storage/preferences";
import { clearAllLocalData } from "../lib/storage/storage";
import { scheduleWeeklyDrawReminder, cancelWeeklyDrawReminder } from "../lib/notifications/drawReminder";
import { DisclaimerCard } from "./DisclaimerCard";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

/**
 * 홈 화면에 직접 붙는 커스텀 바텀시트형 설정.
 * 별도 라우트(/settings) 대신 홈 화면 위에 떠서 열리고, 배경을 탭하거나
 * 안드로이드 뒤로가기를 누르면 닫힌다. 새 패키지 없이 RN 코어 Modal + Animated로 구현.
 */
export function SettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const [notifyDrawDay, setNotifyDrawDay] = useState(false);

  useEffect(() => {
    if (visible) {
      getPreferences().then((prefs) => setNotifyDrawDay(prefs.notifyDrawDay));
      setMounted(true);
      translateY.setValue(SCREEN_HEIGHT);
      backdropOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function handleToggleNotify(value: boolean) {
    if (value) {
      const granted = await scheduleWeeklyDrawReminder();
      if (!granted) {
        Alert.alert("알림 권한이 필요합니다.", "기기 설정에서 알림 권한을 허용해주세요.");
        return;
      }
    } else {
      await cancelWeeklyDrawReminder();
    }
    setNotifyDrawDay(value);
    await updatePreferences({ notifyDrawDay: value });
  }

  function handleClearData() {
    Alert.alert("모든 로컬 데이터 삭제", "저장한 번호, 선호번호, 설정이 모두 삭제됩니다.", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          await clearAllLocalData();
          await cancelWeeklyDrawReminder();
          Alert.alert("삭제되었습니다.");
        },
      },
    ]);
  }

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + 16, transform: [{ translateY }] },
        ]}
      >
        <View style={styles.handle} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>설정</Text>

          <Text style={styles.sectionTitle}>추첨일 알림</Text>
          <DisclaimerCard text="서버 푸시가 아니라 이 기기에 예약되는 로컬 알림입니다. 매주 토요일 저녁, 발표 전에 알려드립니다." />
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>매주 토요일 추첨 알림</Text>
            <Switch value={notifyDrawDay} onValueChange={handleToggleNotify} />
          </View>

          <Text style={styles.sectionTitle}>데이터</Text>
          <Text style={styles.note}>모든 데이터는 이 기기에만 저장되며 서버로 전송되지 않습니다.</Text>
          <Pressable style={styles.dangerButton} onPress={handleClearData}>
            <Text style={styles.dangerButtonText}>모든 로컬 데이터 삭제</Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: SCREEN_HEIGHT * 0.8,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
    marginTop: 10,
    marginBottom: 4,
  },
  content: { paddingHorizontal: 20, paddingTop: 12 },
  title: { fontSize: 17, fontWeight: "800", color: "#0F172A", marginBottom: 4 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A", marginTop: 16, marginBottom: 8 },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  switchLabel: { fontSize: 14, color: "#0F172A", fontWeight: "600" },
  note: { fontSize: 12, color: "#64748B", marginBottom: 12 },
  dangerButton: {
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  dangerButtonText: { color: "#DC2626", fontWeight: "700", fontSize: 13 },
});
