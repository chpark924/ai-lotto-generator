import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme, type AppColors } from "../theme";

export function DisclaimerCard({ text }: { text: string }) {
  const { colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.card}>
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
