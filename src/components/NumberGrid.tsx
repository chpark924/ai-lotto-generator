import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getBallColor } from "../constants/lottery";
import { useAppTheme, type AppColors } from "../theme";

export function NumberGrid({
  selected,
  disabled = [],
  onToggle,
}: {
  selected: number[];
  disabled?: number[];
  onToggle: (n: number) => void;
}) {
  const { colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const selectedSet = new Set(selected);
  const disabledSet = new Set(disabled);

  return (
    <View style={styles.grid}>
      {Array.from({ length: 45 }, (_, i) => i + 1).map((n) => {
        const isSelected = selectedSet.has(n);
        const isDisabled = disabledSet.has(n);
        return (
          <Pressable
            key={n}
            disabled={isDisabled}
            onPress={() => onToggle(n)}
            style={[
              styles.cell,
              isSelected && { backgroundColor: getBallColor(n) },
              isDisabled && styles.cellDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`번호 ${n}`}
            accessibilityState={{ selected: isSelected, disabled: isDisabled }}
          >
            <Text
              style={[
                styles.cellText,
                isSelected && styles.cellTextSelected,
                isDisabled && styles.cellTextDisabled,
              ]}
            >
              {n}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const CELL_SIZE = 44;

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    cell: {
      width: CELL_SIZE,
      height: CELL_SIZE,
      borderRadius: CELL_SIZE / 2,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cellDisabled: {
      backgroundColor: colors.background,
      opacity: 0.4,
    },
    cellText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
    // 선택된 셀은 로또공 색(밝은 색) 배경 위라 항상 짙은 남색 글자를 쓴다 — 테마와 무관.
    cellTextSelected: { color: "#0F172A" },
    cellTextDisabled: { color: "#CBD5E1" },
  });
}
