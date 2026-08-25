import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useAppTheme, type AppColors } from "../theme";

/**
 * QA_LOG 117번 — 기본 여백(marginVertical: 8, 위아래 동일)은 이 카드가 "바로 위 카드에 대한
 * 부연 설명"인지 "다음 섹션과 별개인 독립 문구"인지 구분하지 못한다. 호출부가 이 카드를
 * 특정 카드 바로 아래 붙여 "이 카드에 대한 안내"로 쓸 때는, 카드 쪽 여백과 함께 위쪽은 좁게,
 * 아래쪽(다음 섹션과의 경계)은 표준 간격으로 넓게 주는 식으로 세밀하게 조정할 수 있어야
 * 한다 — 그래서 필요할 때만 기본 여백을 덮어쓸 수 있는 style prop을 추가했다(생략 시 기존
 * 동작 그대로라 다른 화면에는 영향이 없다).
 */
export function DisclaimerCard({ text, style }: { text: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 10,
      padding: 12,
      marginVertical: 8,
    },
    text: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
  });
}
