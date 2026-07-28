import React from "react";
import { StyleSheet, Text, View } from "react-native";

export function DisclaimerCard({ text }: { text: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    padding: 12,
    marginVertical: 8,
  },
  text: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 18,
  },
});
