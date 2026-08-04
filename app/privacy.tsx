import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme, type AppColors } from "../src/theme";

const EFFECTIVE_DATE = "2026-08-04";
const CONTACT_EMAIL = "park.changhyun@cashwalk.io";

type Section = { title: string; body: string };

const SECTIONS: Section[] = [
  {
    title: "1. 수집하는 개인정보 항목",
    body:
      "금손로또는 별도의 서버를 운영하지 않으며, 모든 번호 생성·저장·통계 계산이 이용자의 기기 내부에서만 이루어집니다. " +
      "따라서 이름, 연락처, 위치정보 등 개인정보를 서버로 전송받거나 수집하지 않습니다.\n\n" +
      "생년월일은 '나의 행운번호' 기능에서 이용자가 직접 입력을 선택한 경우에만 사용되며, 기본값은 '저장 안 함'입니다. " +
      "저장을 선택해도 이 정보는 기기 내부(로컬 저장소)에만 남고 외부로 전송되지 않습니다.",
  },
  {
    title: "2. 자동 수집 정보",
    body:
      "서버가 없어 접속 로그, 기기 식별자, 광고 식별자(IDFA/ADID) 등을 자동으로 수집·저장하지 않습니다.",
  },
  {
    title: "3. 외부 네트워크 통신",
    body:
      "당첨번호 조회를 위해 동행복권 공식 웹사이트에 결과를 요청(GET)합니다. 이 요청에는 인증이나 개인정보가 포함되지 않으며, " +
      "결과를 받아오는 용도로만 사용됩니다.",
  },
  {
    title: "4. 로컬 저장 데이터와 이용자의 통제권",
    body:
      "저장한 번호, 선호번호·제외번호 세트, 생년월일(선택 저장 시), 알림 설정 등은 모두 기기 로컬 저장소에만 보관됩니다. " +
      "설정 화면의 '모든 로컬 데이터 삭제'를 통해 언제든지 이 정보를 즉시, 전부 삭제할 수 있습니다.",
  },
  {
    title: "5. 제3자 제공 및 광고",
    body:
      "현재 금손로또는 광고 SDK를 포함하지 않으며, 어떤 개인정보도 제3자에게 제공하지 않습니다. " +
      "향후 광고(SDK) 기능이 추가될 경우, 관련 SDK가 수집하는 정보의 항목과 목적을 이 방침에 반영해 사전에 고지합니다.",
  },
  {
    title: "6. 알림",
    body:
      "구매·추첨일 알림은 서버 푸시가 아닌 기기에 예약되는 로컬 알림이며, 이 과정에서 외부로 전송되는 정보는 없습니다.",
  },
  {
    title: "7. 문의처",
    body: `본 방침에 대해 문의사항이 있으시면 ${CONTACT_EMAIL}로 연락해주세요.`,
  },
];

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24 }}
    >
      <Text style={styles.header}>개인정보처리방침</Text>
      <Text style={styles.effectiveDate}>시행일자: {EFFECTIVE_DATE}</Text>
      <Text style={styles.intro}>
        금손로또(이하 '앱')는 서버 없이 이용자의 기기 안에서만 동작하는 로또 번호 생성 앱입니다. 이 방침은
        앱이 개인정보를 어떻게 다루는지 설명합니다.
      </Text>

      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionBody}>{section.body}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { fontSize: 20, fontWeight: "800", color: colors.textPrimary, marginBottom: 4 },
    effectiveDate: { fontSize: 12, color: colors.textMuted, marginBottom: 16 },
    intro: { fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginBottom: 20 },
    section: { marginBottom: 18 },
    sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary, marginBottom: 6 },
    sectionBody: { fontSize: 13, color: colors.textSecondary, lineHeight: 21 },
  });
}
