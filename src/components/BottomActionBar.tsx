import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme, type AppColors } from "../theme";

/**
 * 화면 하단에 항상 고정되는 주요 액션 버튼 바.
 *
 * 스크롤 콘텐츠 "안"에 버튼을 두면 콘텐츠가 길어질 때(선호번호 그리드 등)
 * 버튼을 보려고 매번 끝까지 스크롤해야 한다. 이 컴포넌트는 버튼을 스크롤
 * 영역 밖, 화면 하단에 고정해서 스크롤 위치와 무관하게 항상 한 화면 안에
 * 보이게 하고, 기기의 제스처 내비게이션 바 영역만큼 자동으로 여백을
 * 확보해 버튼이 가려지지 않게 한다.
 */
export function BottomActionBar({
  label,
  onPress,
  disabled = false,
  color = "#2563EB",
  disabledColor = "#93C5FD",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  color?: string;
  disabledColor?: string;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: disabled ? disabledColor : color },
          pressed && !disabled && styles.buttonPressed,
        ]}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
      >
        <Text style={styles.buttonText}>{label}</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    bar: {
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    button: {
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
    },
    buttonPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  });
}
