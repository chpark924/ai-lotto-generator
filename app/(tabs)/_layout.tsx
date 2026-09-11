import { Image, type ImageSourcePropType } from "react-native";
import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useAppTheme } from "../../src/theme";

/**
 * [2026-09-11 원복] Phase 2(2026-09-10)에서 이 탭바 아이콘을 기존 "입체(글로시) 풀컬러
 * PNG"(assets/tab-icons/*.png)에서 2D 선 아이콘(Ionicons)으로 바꿨었는데, 실기기로 직접
 * 확인한 뒤 원래 PNG 쪽으로 되돌리기로 했다. 다만 그대로 복원하지 않고 한 가지를
 * 더했다 — 예전엔 탭이 선택돼도 아이콘 자체는 항상 같은 색이었고(하단 텍스트만
 * tabBarActiveTintColor로 파랗게 바뀜) 아이콘은 늘 고정 컬러였는데, 이번엔 아이콘도
 * 미선택 시 회색, 선택 시 각 탭 고유 색이 보이도록 `focused`에 따라 이미지 자체를
 * 바꿔 끼운다(벡터 아이콘의 color prop처럼 런타임 tint를 주는 게 아니라, 회색 버전 PNG와
 * 컬러 버전 PNG 두 장을 준비해 교체하는 방식 — 래스터 이미지라 동적 tint가 안 된다).
 *
 * 회색 버전(assets/tab-icons/grey-*.png)은 원본 PNG를 채도만 제거해(명암·그라디언트는
 * 그대로 유지) 새로 만들었다. 로또 연구소(lab.png) 원본은 보라 계열 그라디언트였는데,
 * 사용자가 선택 시 다크 네이비(brand.dark 계열) 쪽을 원해 같은 방식(명암 유지, 색상만
 * 교체)으로 새로 그렸다 — 번호 만들기(generate.png)·내 번호(tickets.png)는 원래도 보라
 * 계열이라 그대로 뒀다(겹치는 보라를 사용자가 확인·승인).
 *
 * 홈 아이콘만 라이트/다크 테마별로 별도 파일(-dark 접미사)이 필요하다 — 로고 자체가
 * 고정 색 PNG라, 어두운 탭바 배경 위에서 라이트용 파일(짙은 남색 하우스)을 그대로 쓰면
 * 대비가 낮아지는 문제가 있어서다(기존에도 있던 문제, Phase 2 이전부터의 이유).
 * 나머지 3개 아이콘은 테마 무관 단일 컬러 버전 하나만 쓴다(기존 관례와 동일).
 */
const ICONS: Record<
  "home" | "generate" | "lab" | "tickets",
  { grey: ImageSourcePropType; color: ImageSourcePropType }
> = {
  home: {
    grey: require("../../assets/tab-icons/grey-home.png"),
    color: require("../../assets/tab-icons/home.png"),
  },
  generate: {
    grey: require("../../assets/tab-icons/grey-generate.png"),
    color: require("../../assets/tab-icons/generate.png"),
  },
  lab: {
    grey: require("../../assets/tab-icons/grey-lab.png"),
    color: require("../../assets/tab-icons/lab.png"),
  },
  tickets: {
    grey: require("../../assets/tab-icons/grey-tickets.png"),
    color: require("../../assets/tab-icons/tickets.png"),
  },
};
// 홈만 다크모드 전용 컬러/회색 쌍이 따로 있다.
const HOME_DARK = {
  grey: require("../../assets/tab-icons/grey-home-dark.png"),
  color: require("../../assets/tab-icons/home-dark.png"),
};

function TabIcon({
  tab,
  focused,
  size,
  darkTheme,
}: {
  tab: keyof typeof ICONS;
  focused: boolean;
  size: number;
  darkTheme: boolean;
}) {
  const set = tab === "home" && darkTheme ? HOME_DARK : ICONS[tab];
  const source = focused ? set.color : set.grey;
  return <Image source={source} style={{ width: size, height: size }} resizeMode="contain" />;
}

export default function TabsLayout() {
  const { colors, scheme, brand } = useAppTheme();
  const darkTheme = scheme === "dark";
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
          // 하단 라벨 텍스트 색은 기존과 동일하게 유지한다 — 선택 시 brand.primary(파랑)
          // 하나로 통일, 아이콘 자체의 색(탭마다 다름)과는 별개다. 위 TabIcon 주석 참고.
          tabBarActiveTintColor: brand.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "홈",
            tabBarIcon: ({ focused, size }) => (
              <TabIcon tab="home" focused={focused} size={size} darkTheme={darkTheme} />
            ),
          }}
        />
        <Tabs.Screen
          name="generate"
          options={{
            title: "번호 만들기",
            tabBarIcon: ({ focused, size }) => (
              <TabIcon tab="generate" focused={focused} size={size} darkTheme={darkTheme} />
            ),
          }}
        />
        <Tabs.Screen
          name="lab"
          options={{
            title: "로또 연구소",
            tabBarIcon: ({ focused, size }) => (
              <TabIcon tab="lab" focused={focused} size={size} darkTheme={darkTheme} />
            ),
          }}
        />
        <Tabs.Screen
          name="tickets"
          options={{
            title: "내 번호",
            tabBarIcon: ({ focused, size }) => (
              <TabIcon tab="tickets" focused={focused} size={size} darkTheme={darkTheme} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}
