import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { getPreferences, updatePreferences } from "../lib/storage/preferences";
import { clearAllLocalData } from "../lib/storage/storage";
import { scheduleWeeklyDrawReminder, cancelWeeklyDrawReminder } from "../lib/notifications/drawReminder";
import { DisclaimerCard } from "./DisclaimerCard";
import { useAppTheme, type AppColors, type AppTints } from "../theme";

/**
 * 홈 화면에 직접 붙는 커스텀 바텀시트형 설정.
 * 별도 라우트(/settings) 대신 홈 화면 위에 떠서 열리고, 배경을 탭하거나
 * 안드로이드 뒤로가기를 누르면 닫힌다. 새 패키지 없이 RN 코어 Modal + Animated로 구현.
 *
 * 화면 높이는 `Dimensions.get("window")`(모듈 로드 시 1회성 스냅샷) 대신
 * `useWindowDimensions()`(반응형 훅)로 읽는다 — 폴더블 기기에서 펼치고/접거나
 * 화면을 회전하는 동안에도 시트 최대 높이·닫힘 위치가 최신 화면 크기를 따라간다.
 */
export function SettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, tints } = useAppTheme();
  const { height: screenHeight } = useWindowDimensions();
  const styles = React.useMemo(() => createStyles(colors, tints, screenHeight), [colors, tints, screenHeight]);
  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const [notifyDrawDay, setNotifyDrawDay] = useState(false);

  useEffect(() => {
    if (visible) {
      getPreferences().then((prefs) => setNotifyDrawDay(prefs.notifyDrawDay));
      setMounted(true);
      translateY.setValue(screenHeight);
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
          toValue: screenHeight,
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
    try {
      await updatePreferences({ notifyDrawDay: value });
    } catch {
      Alert.alert("저장 실패", "알림 설정을 저장하지 못했어요. 다시 시도해주세요.");
    }
  }

  function handleClearData() {
    Alert.alert("모든 로컬 데이터 삭제", "저장한 번호, 선호번호, 설정이 모두 삭제됩니다.", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            await clearAllLocalData();
            await cancelWeeklyDrawReminder();
            Alert.alert("삭제되었습니다.");
          } catch {
            Alert.alert("삭제 실패", "데이터를 완전히 삭제하지 못했어요. 다시 시도해주세요.");
          }
        },
      },
    ]);
  }

  function handleOpenPrivacyPolicy() {
    onClose();
    router.push("/privacy");
  }

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="설정 닫기"
        />
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

          <Text style={styles.sectionTitle}>구매·추첨일 알림</Text>
          <DisclaimerCard text="서버 푸시가 아니라 이 기기에 예약되는 로컬 알림입니다. 매주 금요일(구매 마감 하루 전), 토요일 오후 6시(구매 마감일), 토요일 저녁(추첨 임박)까지 총 3번 알려드립니다." />
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>매주 구매·추첨 알림</Text>
            <Switch
              value={notifyDrawDay}
              onValueChange={handleToggleNotify}
              accessibilityLabel="매주 구매·추첨 알림"
              accessibilityRole="switch"
            />
          </View>

          <Text style={styles.sectionTitle}>데이터</Text>
          <Text style={styles.note}>모든 데이터는 이 기기에만 저장되며 서버로 전송되지 않습니다.</Text>
          <Pressable
            style={styles.dangerButton}
            onPress={handleClearData}
            accessibilityRole="button"
            accessibilityLabel="모든 로컬 데이터 삭제"
          >
            <Text style={styles.dangerButtonText}>모든 로컬 데이터 삭제</Text>
          </Pressable>
          <Pressable
            style={styles.linkButton}
            onPress={handleOpenPrivacyPolicy}
            accessibilityRole="button"
            accessibilityLabel="개인정보처리방침 보기"
          >
            <Text style={styles.linkButtonText}>개인정보처리방침</Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

function createStyles(colors: AppColors, tints: AppTints, screenHeight: number) {
  return StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "#000",
    },
    sheet: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: screenHeight * 0.8,
      backgroundColor: colors.surface,
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
      backgroundColor: colors.border,
      marginTop: 10,
      marginBottom: 4,
    },
    content: { paddingHorizontal: 20, paddingTop: 12 },
    title: { fontSize: 17, fontWeight: "800", color: colors.textPrimary, marginBottom: 4 },
    sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary, marginTop: 16, marginBottom: 8 },
    switchRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 8,
    },
    switchLabel: { fontSize: 14, color: colors.textPrimary, fontWeight: "600" },
    note: { fontSize: 12, color: colors.textMuted, marginBottom: 12 },
    dangerButton: {
      backgroundColor: tints.red.bg,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: "center",
      marginBottom: 8,
    },
    dangerButtonText: { color: tints.red.fg, fontWeight: "700", fontSize: 13 },
    linkButton: { alignItems: "center", paddingVertical: 10 },
    linkButtonText: { color: colors.textMuted, fontSize: 12, fontWeight: "600", textDecorationLine: "underline" },
  });
}
