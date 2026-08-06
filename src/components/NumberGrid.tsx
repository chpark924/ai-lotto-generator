import React from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { getBallColor } from "../constants/lottery";
import { useAppTheme, type AppColors } from "../theme";

const GAP = 6;
/** 이 화면들의 실제 컨테이너 패딩(좌우 16px씩)과 일치시켜, 화면 폭에서 뺄 값을 정확히 맞춘다. */
const HORIZONTAL_PADDING = 32;
/** 전화기 기준 화면(약 360~414px 폭)에서 기존 44px 셀과 거의 같은 결과가 나오도록 잡은 기준 열 수. */
const REFERENCE_COLUMNS = 7;
/** 기존에 이미 44pt로 확보돼 있던 최소 터치 타겟을 그대로 하한선으로 유지한다. */
const MIN_CELL_SIZE = 44;
/** 태블릿처럼 폭이 아주 넓어도 공이 지나치게 커지지 않도록 상한선을 둔다. */
const MAX_CELL_SIZE = 60;

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
  const { width: screenWidth } = useWindowDimensions();
  const cellSize = React.useMemo(() => {
    const containerWidth = screenWidth - HORIZONTAL_PADDING;
    const rawSize = (containerWidth - GAP * (REFERENCE_COLUMNS - 1)) / REFERENCE_COLUMNS;
    return Math.floor(Math.min(MAX_CELL_SIZE, Math.max(MIN_CELL_SIZE, rawSize)));
  }, [screenWidth]);
  const styles = React.useMemo(() => createStyles(colors, cellSize), [colors, cellSize]);
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
              maxFontSizeMultiplier={1.3}
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

// 화면 폭 기반으로 계산된 셀 크기(useWindowDimensions, 위 참고)를 그대로 받아 스타일을 만든다.
// 고정 44px이었을 때는 좁은 화면에선 문제없었지만 태블릿에서는 같은 크기의 작은 그리드가
// 넓은 여백 한가운데 떠 있는 것처럼 보였다 — 화면이 넓을수록 셀도 함께(다만 60px까지만) 커지도록
// 해서 화면을 더 알차게 채운다. 회전/폴더블 접힘·펼침에도 즉시 재계산된다.
function createStyles(colors: AppColors, cellSize: number) {
  return StyleSheet.create({
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: GAP,
    },
    cell: {
      width: cellSize,
      height: cellSize,
      borderRadius: cellSize / 2,
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
