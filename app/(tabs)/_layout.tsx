import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useAppTheme } from "../../src/theme";

/**
 * [DESIGN_GUIDE.md Phase 2, 2026-09-10] 하단 탭 아이콘을 기존 "입체(글로시) 풀컬러 PNG"
 * (assets/tab-icons/*.png)에서 2D 선 아이콘(Ionicons)으로 교체했다. 가이드 11절이 지적한
 * 대로, 3D/글로시 스타일은 "번호 만들기" 탭의 숏컷 아이콘·홈 히어로처럼 실제로 제작
 * 리소스를 들인 곳에서만 써야 "고급스럽다"는 인상을 만든다 — 하단 내비게이션처럼 항상
 * 떠 있는 자리에까지 풀컬러 글로시 아이콘을 쓰면 그 소수의 "진짜 제작한" 그래픽과
 * 구분이 안 돼 오히려 특별함이 옅어진다. 그래서 여기는 새 에셋 제작 없이 이미 쓰고
 * 있는 Ionicons만으로 정리하고, 선택 상태는 아이콘 채움(outline→filled)과 색
 * (tabBarActiveTintColor/InactiveTintColor) 두 가지로 함께 표현한다.
 * (기존 홈 아이콘의 다크모드 전용 반전 버전이 필요했던 이유 — 로고 자체가 고정 색
 * PNG라 어두운 탭바 배경 위에서 대비가 낮았던 문제 — 도 색을 테마별 tint로 그리는
 * Ionicons로 바꾸면서 자연히 해소된다.)
 */
function TabIcon({
  name,
  focusedName,
  focused,
  color,
  size,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focusedName: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  color: string;
  size: number;
}) {
  return <Ionicons name={focused ? focusedName : name} size={size} color={color} />;
}

export default function TabsLayout() {
  const { colors, scheme, brand } = useAppTheme();
  return (
    <>
      {/* QA_LOG 104번 — 루트 레이아웃(app/_layout.tsx)의 <StatusBar style="light" />는
          "번호 만들기의 각 기능 화면"(45면체 주사위 등, app/generate/*)이 항상 쓰는 짙은
          남색(#0F172A) 헤더와 짝을 맞춘 값이라, 흰 글씨/아이콘 상태표시줄이 잘 보인다.
          그런데 94번에서 이 4개 탭 화면의 네비게이션 헤더를 없애면서, 라이트 모드에서는
          이 탭들의 배경이 거의 흰색(colors.background)이 되어 그 위에 흰색 상태표시줄
          아이콘(시계·배터리)이 겹쳐 사실상 안 보이게 되는 문제가 있었다 — "영역이 안 잡힌
          것"처럼 보인 진짜 원인. expo-status-bar는 화면(레이아웃)마다 자기만의 <StatusBar>를
          따로 선언할 수 있고 가장 안쪽(현재 포커스된) 것이 우선 적용되므로, 이 4개 탭
          화면에서만 시스템 테마에 맞춰(라이트→어두운 아이콘, 다크→밝은 아이콘) 상태표시줄
          색을 뒤집어준다. app/generate/* 같은 항상-짙은-헤더 화면들은 루트의 기본값(항상
          밝은 아이콘)을 그대로 물려받아 원래대로 잘 보인다. */}
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Tabs
        screenOptions={{
          // 62/63번에서 "홈" 등 헤더 타이틀 글자 크기·영역을 줄였는데, 실기기에서 보니 그 작아진
          // 텍스트가 어색하고 깨진 것처럼 보인다는 후속 피드백(94번) — 네비게이션 헤더 자체를
          // 완전히 숨기고 화면을 깔끔하게 쓴다. "번호 만들기"/"로또 연구소" 탭은 이미 화면 콘텐츠
          // 안에 자체 제목(styles.header)이 따로 있어 헤더를 숨겨도 제목이 사라지지 않고, "홈"/
          // "내 번호" 탭은 원래도 화면 콘텐츠 쪽에 별도 제목 텍스트가 없었으므로(홈은 히어로
          // 카드로, 내 번호는 "선호번호·제외번호 세트 관리" 링크로 바로 시작) 헤더를 숨기면
          // 그 화면들은 최상단에 제목 텍스트가 아예 없어진다 — "깨끗하게 쓰자"는 요청에 맞는
          // 의도된 결과.
          headerShown: false,
          // [Phase 1] 기존 하드코딩 "#2563EB" → brand.primary 토큰으로 교체(값은 동일, 출처만 정리).
          tabBarActiveTintColor: brand.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "홈",
            tabBarIcon: ({ focused, color, size }) => (
              <TabIcon name="home-outline" focusedName="home" focused={focused} color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="generate"
          options={{
            title: "번호 만들기",
            tabBarIcon: ({ focused, color, size }) => (
              <TabIcon
                name="color-wand-outline"
                focusedName="color-wand"
                focused={focused}
                color={color}
                size={size}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="lab"
          options={{
            title: "로또 연구소",
            tabBarIcon: ({ focused, color, size }) => (
              <TabIcon name="flask-outline" focusedName="flask" focused={focused} color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="tickets"
          options={{
            title: "내 번호",
            tabBarIcon: ({ focused, color, size }) => (
              <TabIcon name="ticket-outline" focusedName="ticket" focused={focused} color={color} size={size} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}
