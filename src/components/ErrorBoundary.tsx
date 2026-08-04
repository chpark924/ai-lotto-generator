import React from "react";
import { Appearance, Pressable, StyleSheet, Text, View } from "react-native";
import { darkColors, lightColors } from "../theme/colors";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error: Error | null };

/**
 * 렌더링 중 예외가 발생했을 때 RN 기본 빨간 에러 화면(또는 흰 화면)으로 떨어지는 대신
 * 복구 가능한 폴백 화면을 보여준다. 앱 전체를 감싸는 마지막 안전망.
 *
 * ThemeProvider보다 바깥(더 상위)에 위치해야 ThemeProvider 자체의 오류도 잡을 수 있으므로,
 * useAppTheme() 훅을 쓸 수 없다. 클래스 컴포넌트에서도 동작하는 Appearance API로
 * 다크모드 여부만 직접 확인한다(실시간 구독은 필요 없다 — 에러 화면은 그 순간의 시스템
 * 설정만 반영하면 충분하다).
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // 별도 크래시 리포팅 서버가 없으므로(서버 없음 원칙), 콘솔에만 남긴다.
    console.error("[AppErrorBoundary] 처리되지 않은 렌더링 오류:", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const colors = Appearance.getColorScheme() === "dark" ? darkColors : lightColors;
      const styles = createStyles(colors.background, colors.textPrimary, colors.textMuted);
      return (
        <View style={styles.container}>
          <Text style={styles.title}>문제가 발생했어요</Text>
          <Text style={styles.message}>
            화면을 표시하는 중 예상치 못한 오류가 발생했습니다. 아래 버튼으로 다시 시도해주세요.
            {"\n"}문제가 계속되면 앱을 완전히 종료했다가 다시 열어주세요.
          </Text>
          <Pressable
            style={styles.retryButton}
            onPress={this.handleRetry}
            accessibilityRole="button"
            accessibilityLabel="다시 시도"
          >
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

function createStyles(background: string, textPrimary: string, textMuted: string) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      backgroundColor: background,
    },
    title: { fontSize: 18, fontWeight: "800", color: textPrimary, marginBottom: 10 },
    message: {
      fontSize: 13,
      color: textMuted,
      textAlign: "center",
      lineHeight: 20,
      marginBottom: 20,
    },
    retryButton: {
      backgroundColor: "#0F172A",
      borderRadius: 14,
      paddingHorizontal: 24,
      paddingVertical: 14,
    },
    retryButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  });
}
