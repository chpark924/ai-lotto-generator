import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getBallColor } from "../constants/lottery";

export function NumberGrid({
  selected,
  disabled = [],
  onToggle,
}: {
  selected: number[];
  disabled?: number[];
  onToggle: (n: number) => void;
}) {
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

const styles = StyleSheet.create({
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
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cellDisabled: {
    backgroundColor: "#F8FAFC",
    opacity: 0.4,
  },
  cellText: { fontSize: 14, fontWeight: "600", color: "#334155" },
  cellTextSelected: { color: "#0F172A" },
  cellTextDisabled: { color: "#CBD5E1" },
});
