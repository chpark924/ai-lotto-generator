import React, { useCallback, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";

/**
 * 홈 화면 히어로의 "AI로 번호 만들기" CTA를 하나의 오브젝트가 형태·색상·재질감을 바꿔가며
 * 등장하는 인터랙션으로 구현한다(2026-09-11, 사용자가 GPT로 작성한 상세 스펙 기반).
 *
 * [2026-09-13 3차 업데이트 — 실제 이미지 에셋을 다시 걷어내고 Native UI로 재구현]
 * 2차 업데이트(같은 날)에서는 사용자가 보내준 실제 구체→캡슐 PNG(`cta-pill.png`)를 와이프
 * 리빌 방식으로 그대로 붙여넣었었다. 그런데 사용자가 다시 피드백을 주며 "짐 제작된 cta
 * 이미지가 적합하지 않다"고, 그 이미지들은 스프라이트로 그대로 쓰라는 게 아니라 재질·형태를
 * 참고하는 레퍼런스일 뿐이니 Native UI로 재현해달라고 요청했다. 그래서 다시 방향을 바꿔서:
 *
 * - CTA 오브젝트는 더 이상 실제 PNG를 크롭/리빌하지 않는다. 1차(135번)처럼 코드로 그린
 *   `Animated.View` 하나의 `width`(구체 지름→트랙 전체 폭)와 `backgroundColor`(오렌지→
 *   블루)를 `progress` 하나로 보간하는 방식으로 되돌아갔다 — 다만 색상 값은 사용자가 보낸
 *   실제 레퍼런스 PNG에서 Python으로 직접 스포이드 추출한 값(`#FFE7A6→#FDBE55→#DCB9F2→
 *   #6E8FFC→#3D79FE`)으로 다시 캘리브레이션했다(1차 버전은 마지막 두 단계가 앱 브랜드
 *   토큰(`brand.primary`/`brand.dark`, 진네이비)이었는데, 레퍼런스의 실제 완성 색은 그보다
 *   훨씬 밝고 선명한 블루라 그쪽에 맞췄다).
 * - 레퍼런스 이미지들(스프라이트 시트, 연속 이미지)을 자세히 보면 단순 단색이 아니라 (1) 왼쪽
 *   위에서 들어오는 대각선 유리질 하이라이트 밴드, (2) 구체였던 왼쪽 부분에 남아있는 작은
 *   스페큘러(반사광) 반점, (3) 오브젝트 테두리 바깥으로 번지는 은은한 색 글로우(bloom) —
 *   이렇게 3가지 "재질" 요소가 있다. 이걸 전부 순수 RN 뷰/`expo-linear-gradient`(이미
 *   설치돼 있음, 새 의존성 추가 없음)만으로 재현했다:
 *     · 대각선 하이라이트 = `LinearGradient`(흰색 투명→반투명→투명, 대각선 방향)를 오브젝트
 *       안쪽에 `overflow:"hidden"`으로 클립해서 얹음.
 *     · 스페큘러 반점 = 왼쪽 위 고정 위치에 반투명 흰 원 3개를 크기/투명도 다르게 겹쳐서
 *       (작고 진한 원 + 크고 옅은 원) 부드러운 하이라이트처럼 보이게 함(진짜 블러 없이도
 *       여러 겹 겹치면 눈에는 충분히 부드럽게 보인다).
 *     · 글로우 = 오브젝트보다 한 단계씩 더 크고(패딩 12/26/44dp) 더 투명한(불투명도
 *       0.22/0.16/0.10) 같은 색의 캡슐 레이어를 오브젝트 "뒤"에 3겹 겹쳐서 바깥으로
 *       갈수록 옅어지는 후광을 흉내낸다(CSS의 다중 box-shadow와 같은 원리) — RN에는
 *       크로스플랫폼으로 동작하는 진짜 가우시안 블러가 없어서(이 프로젝트엔 `expo-blur`/
 *       `reanimated`/Skia 미설치) 완벽히 매끈한 블러는 아니지만, 실제 화면 크기에서는
 *       충분히 은은한 후광으로 보인다. 더 매끈하게 만들려면 나중에 `expo-blur`를 설치해
 *       글로우 레이어에 `BlurView`를 씌우는 걸 고려할 수 있다.
 * - 오브젝트 크기: 실제 PNG 에셋을 안 쓰므로 더 이상 고정 가로세로 비율 제약이 없다 —
 *   1차(135번) 스펙 그대로 트랙 전체 폭(`onLayout`으로 실측)까지 늘어나도록 되돌렸다(2차의
 *   `FINAL_WIDTH=230` 고정폭은 삭제). 사용자가 보낸 3단계 목업 레퍼런스도 완성된 버튼이
 *   카드 폭 거의 전체를 채우고 있어, 이쪽이 실제로도 더 레퍼런스에 가깝다.
 * - `onLayout`/`trackWidthRef`/`pendingPlayRef`로 포커스 이벤트와 레이아웃 이벤트 중 어느
 *   쪽이 먼저 도착하든 최초 진입 시 항상 정상적으로 재생되도록 하는 로직(135번에서 발견/
 *   수정한 타이밍 버그 대응)도 함께 복원했다 — 폭이 다시 화면 폭에 의존하게 됐기 때문.
 *
 * [2026-09-14 4차 업데이트 — 실기기 테스트 피드백 반영]
 * 사용자가 실제 기기에 빌드해 녹화한 영상 기준으로 3가지를 지적했다: (1) 구체→CTA 버튼
 * 전환 속도가 너무 빠르고 자연스럽지 않다, (2) 완성된 버튼 왼쪽에 동그란 얼룩(스페큘러
 * 하이라이트 반점)이 그대로 남아있어 어색하다, (3) 홈 탭에 재진입할 때마다(다른 탭 갔다가
 * 돌아올 때마다) 매번 재생되는데, 앱을 새로 켰을 때 딱 1번만 보여주고 그 이후에는 애니메이션
 * 없이 완성된 버튼이 바로 보여야 한다. 대응:
 * - (1) `MORPH_DURATION_MS`를 750→900ms로 늘리고, easing을 더 부드럽게 감속하는 커브
 *   (`Easing.bezier(0.16, 1, 0.3, 1)`, 흔히 "ease-out-expo"로 불리는 감속 곡선)로 교체했다.
 *   여전히 Bounce/Elastic/Overshoot는 쓰지 않는다(스펙 원칙 유지).
 * - (2) 스페큘러 반점은 "구체였던 부분에 남은 광택"이라는 의도였는데, 오브젝트가 완전히
 *   캡슐이 된 뒤(진행률 0.6 이후)에도 고정 위치·고정 불투명도로 계속 남아있다 보니 완성된
 *   버튼 위에 붙은 별개의 얼룩처럼 보였다. `progress`에 따라 0.35 지점부터 옅어지기
 *   시작해서 0.6 지점에는 완전히 사라지도록 `specularOpacity` 보간을 추가했다(각 반점
 *   레이어의 원래 불투명도에 `Animated.multiply`로 곱해서 적용) — 구체 형태를 벗어나는
 *   시점과 맞물려 하이라이트도 자연스럽게 사라지는 느낌으로 만들었다. PIL 프리뷰로 진행률
 *   60/75/90/100%에서 얼룩이 남지 않는지 확인 후 반영했다.
 * - (3) 모듈 스코프 변수 `hasPlayedOnceThisSession`(React state/ref가 아니라 파일 최상단
 *   변수 — 컴포넌트가 여러 번 마운트/언마운트돼도, 탭을 몇 번을 오가도 유지되고 오직 앱을
 *   완전히 새로 켜서 JS 컨텍스트 자체가 새로 시작될 때만 초기화됨)로 "이번 앱 세션에서
 *   이미 재생했는지"를 추적한다. `useFocusEffect`가 실행될 때 이미 재생한 적이 있으면
 *   애니메이션 없이 `progress.setValue(1)`로 즉시 완성 상태를 보여주고, 처음이면 그대로
 *   재생하고 플래그를 올린다. 모프 도중 탭해도 즉시 `onPress`가 동작하는 기존 동작(히트
 *   영역이 처음부터 트랙 전체 폭으로 고정돼 있음)은 그대로 유지된다.
 *
 * [2026-09-14 5차 업데이트 — "구체"라는 인지 + 디자인적 완성도 보강]
 * 4차 업데이트로 속도/얼룩/재생 횟수는 고쳤지만, 사용자가 "처음에 살짝 반짝여서 구체임을
 * 인지할 수 있어야 하고, 자연스럽게 색·형태가 CTA 버튼으로 변형되는 걸 체감해야 완성도가
 * 높아 보인다"고 추가 피드백을 줬다. 두 가지를 더했다:
 * - **시작 시 반짝임(shine sweep)**: `progress`와는 별개인 `shine` `Animated.Value`를
 *   새로 두고, 재생 시작 시 `Animated.sequence`로 (1) `shine` 0→1(`SHINE_DURATION_MS`
 *   =220ms) 먼저 재생한 뒤 (2) 기존 `progress` 0→1(900ms) 모프를 재생한다. `shine`
 *   구간 동안은 오브젝트가 아직 정지된 작은 구체 상태 그대로고, 그 위로 대각선 흰색 바
 *   하나가 원 모양 클립 안에서 왼쪽 바깥→오른쪽 바깥으로 한 번 스치듯 지나가며(빛이
 *   유리구슬 표면에 잠깐 반사되는 느낌) 빠르게 나타났다 사라진다(`shineOpacity`가
 *   0→0.85→0으로 보간) — 이 순간 덕분에 "지금 저건 반짝이는 구체구나"를 명확히 인지한
 *   뒤에 모프가 시작된다. PIL 프리뷰로 shine 10/35/60/85% 스냅샷을 렌더링해 바가 원
 *   범위 안에서만 보이고 자연스럽게 스치는지 확인했다.
 * - **형태가 색을 이끄는 느낌**: `COLOR_STOPS_INPUT`을 `[0, 0.25, 0.5, 0.75, 1]`(균등
 *   분포)에서 `[0, 0.35, 0.6, 0.85, 1]`로 바꿔, 색 변화를 진행률 뒷부분에 더 몰았다.
 *   width는 여전히 처음부터 매끄럽게 자라지만, 색은 초반엔 오렌지에 더 오래 머물다가
 *   후반에 블루로 집중적으로 바뀐다 — "형태가 먼저 자리를 잡고 색이 뒤따라와 완성되는"
 *   순서감을 줘서 단순히 모든 속성이 동시에 등속으로 바뀌는 것보다 더 디자인된 느낌을
 *   준다. PIL 프리뷰로 45%(아직 따뜻한 톤 유지) → 75%(블루로 많이 진행) 전환 체감을
 *   확인했다.
 *
 * [2026-09-14 6차 업데이트 — 전문가 톤 디테일 보강: 반짝임 절제, 완성 순간 펄스, 눌림
 * 피드백, 입체감(그림자)]
 * 5차 업데이트의 반짝임이 "너무 세다"는 피드백을 받았고, 사용자가 "능숙한 전문 디자이너가
 * 하는 방식으로" 완성도를 더 끌어올려달라 + 완성된 버튼이 "누르고 싶은 느낌"이 나는지
 * 다시 점검해달라고 요청했다. 네 가지를 손봤다:
 * - **반짝임을 절제**: 단색 사각형(불투명도 최대 0.85, 플래토 구간 존재) 대신, 가장자리가
 *   부드럽게 페이드되는 `LinearGradient` 바(투명→아이보리 반투명→투명)로 바꾸고, 폭도
 *   줄이고(0.3→0.22×CTA_HEIGHT), 불투명도 곡선도 플래토 없이 순간적으로 반짝였다 사라지는
 *   삼각형 곡선(정점 0.5)으로 바꿨다. 순백 대신 살짝 따뜻한 아이보리 톤(`#FFF8E6`)을 써서
 *   더 고급스러운 느낌을 준다. PIL 프리뷰로 shine 15/30/45/60/85% 스냅샷을 다시 렌더링해
 *   확인했다.
 * - **완성 순간의 은은한 펄스**: `settle`이라는 세 번째 `Animated.Value`를 추가해, 모프
 *   (`progress` 0→1)가 끝난 직후 짧게(120ms 상승 + 260ms 하강) 0→1→0으로 움직인다. 이
 *   값으로 글로우 3겹의 불투명도를 순간적으로 최대 1.5배까지 끌어올렸다가 원래대로
 *   되돌린다(`Animated.multiply`) — 오브젝트가 "완성되는 순간 살짝 빛나며 자리를 잡는"
 *   느낌을 준다. Bounce/Elastic/Overshoot(위치·크기 튐)는 여전히 쓰지 않고, 오직 빛
 *   불투명도 펄스만 사용해 스펙 원칙(절제된 움직임)은 유지했다.
 * - **눌림(press) 피드백 추가 — "누르고 싶은 느낌" 재점검 결과**: 기존 코드에는 탭 시
 *   시각적 피드백이 전혀 없었다(기능은 동작하지만 눌러도 아무 반응이 안 보임 — 이게
 *   "누르고 싶은 느낌"이 부족했던 실제 원인 중 하나로 보인다). `pressScale`
 *   `Animated.Value`를 추가해 `onPressIn`에 0.965로 빠르게(90ms) 축소, `onPressOut`에
 *   1로 부드럽게(150ms) 복원되도록 했다 — 히트 영역 전체(`hitArea`)에 적용해 버튼을
 *   누르는 순간 살짝 눌리는 촉각적 피드백을 준다.
 * - **입체감(드롭섀도) 추가**: 사실 PIL 프리뷰에는 처음부터 오브젝트 아래 은은한 드롭섀도가
 *   있었는데(카드 배경 위에 붕 떠 있는 느낌을 내려고), 실제 컴포넌트에는 이 레이어를 옮겨
 *   담는 걸 빠뜨렸었다 — 그래서 그동안 프리뷰보다 실물이 더 납작하고 배경에 눌려 보였을
 *   가능성이 있다. `shadowLayer`를 새로 추가해(글로우 뒤, pill 앞) iOS는
 *   `shadowColor`/`shadowOffset`/`shadowOpacity`/`shadowRadius`, Android는 `elevation`
 *   (그림자를 실제로 그리려면 불투명 배경이 필요해 pill과 같은 `animatedColor`를 그대로
 *   깔아뒀다 — 어차피 그 위를 pill이 완전히 덮으므로 보이는 건 그림자 부분뿐이다)으로
 *   구현했다. 살짝 아래로 떨어지는 남색 톤 그림자(`#13224D`)를 써서 "카드 위에 얹힌
 *   버튼"처럼 입체감을 주고, 이게 곧 "눌러볼 만한 물리적 버튼"이라는 인상을 강화한다.
 *
 * [2026-09-14 7차 업데이트 — "Apple 시니어 디자이너" 수준 완성도 + 성능/용량 영향 없음 확인]
 * 사용자가 "더 고급스럽고 Apple 시니어 디자이너가 만든 것 같은 느낌으로, 덜 만든 느낌이
 * 든다"며 완성도를 더 끌어올려달라 요청했고, 동시에 이 기능 때문에 앱이 느려지거나 용량이
 * 늘어나면 안 된다고 강조했다. 두 갈래로 대응했다:
 * - **완성도 — timing에서 spring(물리 기반)으로 교체**: iOS 시스템 애니메이션 대부분이
 *   지정된 시간에 커브를 그리는 방식(timing)이 아니라 질량·강성·감쇠로 물리 시뮬레이션되는
 *   스프링(spring) 기반이다 — 이게 "그냥 정해진 곡선을 따라가는 움직임"과 "무게감이 느껴지는
 *   자연스러운 움직임"의 체감 차이를 만드는 핵심이다. 메인 모프(`progress`)를
 *   `Animated.timing` + 커스텀 bezier에서 `Animated.spring`(`stiffness: 40, damping: 14,
 *   mass: 1`)으로 바꿨다. `damping`을 임계감쇠(critical damping, 이 stiffness/mass
 *   조합에서 약 12.6)보다 살짝 높게(약 1.08배) 잡아 이론상으로도 오버슈트가 없도록 했고,
 *   여기에 더해 `overshootClamping: true`까지 걸어서 물리 계산 오차와 무관하게 애니메이션
 *   값이 목표치(1)를 절대 넘지 않도록 이중으로 보장했다 — "Bounce/Elastic/Overshoot 금지"
 *   원칙은 그대로 지키면서 더 유기적인 감속감만 얻은 것이다. stiffness/damping 값은 기존
 *   900ms 체감 속도와 비슷하게 맞춰서, 지금까지 조정해온 반짝임→모프→완성 펄스의 전체
 *   타이밍 감각이 깨지지 않도록 했다.
 * - **성능/용량 — 이번 기능 전체에 걸쳐 확인**: (1) 새 npm 패키지를 하나도 추가하지 않았다
 *   — 처음부터 끝까지 이미 설치돼 있던 `expo-linear-gradient` 하나만 쓴다. (2) 이미지
 *   에셋은 136번에서 추가한 `assets/hero/hero-bg.jpg`(약 122KB) 하나뿐이고, 137번에서
 *   만들었던 `cta-pill.png`는 138번에서 실제 이미지 방식을 포기하면서 커밋 전에 삭제했다
 *   — 즉 이 기능이 앱 번들 용량에 더하는 건 순수 JS/TSX 코드 몇 KB뿐이다. (3) 애니메이션은
 *   앱 세션당 딱 1번(반짝임 220ms + 모프(스프링, 대략 900ms 안팎) + 완성 펄스 약 380ms,
 *   총 1.5초 내외)만 재생되고 끝나면 완전히 정지한다 — 반복 재생되는 루프나 상시 대기 중인
 *   타이머가 전혀 없으므로, 이 화면을 그냥 보고만 있을 때는 CPU/배터리 추가 소모가 없다.
 *   (4) 각 레이어(글로우 3겹, 그림자 1겹, 본체, 스페큘러 3겹, 하이라이트/반짝임 그라디언트
 *   각 1겹)는 전부 가벼운 `View`/`LinearGradient`이고 이미지 디코딩·네트워크 요청이 전혀
 *   없다. 실기기에서 프레임 드랍이 느껴진다면 알려주면 레이어 수를 더 줄이는 것도 고려할
 *   수 있지만, 현재 구조상 무거운 연산(이미지 처리, 대용량 텍스처 등)은 전혀 없다.
 * - **눌림 피드백 보강**: 누를 때 크기만 줄어드는 게 아니라 그림자/글로우도 함께
 *   옅어지도록(`pressDim`, `pressScale`과 동일한 값을 재사용) 해서, 버튼이 표면 속으로
 *   살짝 가라앉는 듯한 물리적 눌림감을 더했다 — iOS 네이티브 버튼의 눌림 반응에 더 가깝다.
 *
 * [2026-09-14 8차 업데이트 — spring 설정값 실측 버그 수정 + "구체" 입체감 보강(코어 셰이딩)]
 * 사용자가 "구체 느낌이 처음에 명확해야 하고, 전문 디자이너가 심혈을 기울인 것처럼 되었는지
 * 다시 정확하게(정밀하게) 체크해서 반영해달라"고 요청했다. 눈으로 보고 느낌만으로 판단하는
 * 대신, 실제로 수치를 검증하는 방식으로 점검했고 그 과정에서 심각한 회귀 버그를 하나
 * 발견해서 함께 고쳤다:
 * - **[버그 수정] spring 설정값이 실제로는 900ms가 아니라 2~2.5초 걸리고 있었다**: 7차에서
 *   넣은 `stiffness: 40, damping: 14`는 "기존 900ms 체감과 비슷할 것"이라는 감으로 잡은
 *   값이었는데, 이번에 Python으로 RN의 spring 적분 방식(semi-implicit Euler, `accel =
 *   (-stiffness*(x-1) - damping*v) / mass`)을 그대로 재현해 직접 시뮬레이션해보니 목표치에
 *   수렴하기까지 실제로는 약 2.0~2.5초가 걸리는 것으로 확인됐다 — 의도했던 900ms의 2배가
 *   넘는, 실기기에서 "느리고 밍밍하게" 느껴졌을 만한 명백한 회귀였다. `damping = 2.05 ×
 *   √stiffness`(임계감쇠보다 살짝 높은 동일 감쇠비 유지, 오버슈트 없음) 조건으로
 *   stiffness를 120~280 구간에서 스윕하며 정착 시간을 다시 계산한 결과, `stiffness: 240,
 *   damping: 31.8` 조합이 약 0.98초 만에 정착해 원래 의도했던 900ms~1초 체감에 가장
 *   가까웠다(참고: stiffness 200→약 1.07초, 280→약 0.93초 — 어느 쪽도 크게 벗어나지 않지만
 *   240이 가장 근접). `mass: 1`, `overshootClamping: true`는 그대로 유지해 오버슈트 없는
 *   원칙은 변함없다.
 * - **[보강] 오브젝트 반대편(오른쪽 아래)에 "코어 셰이딩" 추가 — 구체 입체감 강화**: 지금까지는
 *   왼쪽 위 하이라이트(밝음)만 있고 그 반대편에는 아무 셰이딩이 없어서, 확대해서 보면 "빛나는
 *   평평한 색 원반"에 가깝게 읽힐 여지가 있었다. 실제 유리구슬/보석 렌더링에서는 하이라이트의
 *   반대쪽에 옅은 그림자(코어 셰이딩 / ambient occlusion)가 있어야 표면이 진짜로 굽어있다는
 *   걸 뇌가 인식한다. 오른쪽 아래로 갈수록 짙어지는 아주 옅은 남색 그라디언트
 *   (`rgba(10,16,36,0)` → `rgba(10,16,36,0.2)`, 대각선, 앞쪽 절반은 거의 안 보이다가 뒤쪽
 *   절반부터 옅게 번짐)를 기존 하이라이트 레이어 바로 뒤에 추가했다. PIL 프리뷰로 progress
 *   0%(아직 구체)와 100%(완성된 캡슐) 양쪽 모두에서 확인한 결과, 구체 상태에서는 입체감이
 *   뚜렷하게 살아나고, 완성된 캡슐 상태에서도 과하게 어두워 보이지 않고 은은한 깊이감만
 *   더해주는 정도로 자연스럽다. 새 이미지 에셋·새 npm 패키지는 이번에도 전혀 추가하지
 *   않았다(순수 `LinearGradient` 레이어 1겹 추가) — 7차에서 확인한 성능/용량 무영향 원칙은
 *   그대로 유지된다.
 */

const CTA_HEIGHT = 60;
const ORB_SIZE = 60; // width === height(=CTA_HEIGHT)일 때 정원(구체)이 되는 시작 크기

const SHINE_DURATION_MS = 220; // 구체 위를 한 번 스치는 반짝임의 재생 시간(모프 시작 전)
const SETTLE_RISE_MS = 120; // 모프 완료 직후 글로우가 살짝 밝아지는 시간
const SETTLE_FALL_MS = 260; // 그 뒤 원래 밝기로 되돌아오는 시간

// 앱을 새로 켰을 때(JS 번들이 새로 로드될 때)만 초기화되는 모듈 스코프 플래그 — 탭을
// 오가며 컴포넌트가 여러 번 focus/unfocus 되더라도 "이번 앱 세션에서 이미 재생했는지"를
// 기억한다. React state로 만들면 컴포넌트가 언마운트될 때 같이 사라지므로 일부러 모듈
// 스코프에 뒀다(자세한 이유는 파일 상단 2026-09-14 4차 업데이트 설명 참고).
let hasPlayedOnceThisSession = false;

const HERO_BG = require("../../assets/hero/hero-bg.jpg");

// 사용자가 보낸 실제 레퍼런스 PNG(구체→캡슐 연속 이미지)에서 Python(PIL)으로 좌표를 찍어
// 직접 추출한 색상 값. 대략 15%/25%/40~55%/70% 지점을 스포이드한 값을 5단계로 정리했다.
// 입력 구간을 뒤로 몰아서(0.35/0.6/0.85) 색 변화가 진행률 후반부에 집중되게 했다 — 형태가
// 먼저 자라고 색이 뒤따라 완성되는 순서감(5차 업데이트, 디자인 완성도 피드백 반영).
const COLOR_STOPS_INPUT = [0, 0.35, 0.6, 0.85, 1];
const COLOR_STOPS_OUTPUT = ["#FFE7A6", "#FDBE55", "#DCB9F2", "#6E8FFC", "#3D79FE"];

// 오브젝트 바깥으로 번지는 글로우(후광) — 패딩이 클수록(더 바깥 레이어일수록) 더 투명하게.
const GLOW_RINGS = [
  { pad: 44, opacity: 0.1 },
  { pad: 26, opacity: 0.16 },
  { pad: 12, opacity: 0.22 },
] as const;

// 왼쪽(구체였던 부분) 위쪽에 고정되는 스페큘러 하이라이트 반점 3겹(큰 원일수록 옅게).
const SPECULAR_CX = CTA_HEIGHT * 0.34;
const SPECULAR_CY = CTA_HEIGHT * 0.3;
const SPECULAR_LAYERS = [
  { radius: CTA_HEIGHT * 0.34, opacity: 0.2 },
  { radius: CTA_HEIGHT * 0.2, opacity: 0.4 },
  { radius: CTA_HEIGHT * 0.11, opacity: 0.65 },
] as const;

export function HeroCtaMorph({
  subtitle,
  title,
  ctaLabel,
  onPress,
  accessibilityLabel,
}: {
  /** 문자열 또는 로딩 중 스켈레톤 같은 커스텀 노드. */
  subtitle: React.ReactNode;
  title: string;
  ctaLabel: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  // progress와 별개로, 재생 시작 시 아주 짧게 한 번만 도는 "반짝임(shine)" 전용 값 —
  // 구체가 아직 그대로인 상태에서 빛이 한 번 스치고 지나가는 연출만 담당한다.
  const shine = useRef(new Animated.Value(0)).current;
  // 모프가 끝나는 순간 글로우를 잠깐 밝혔다 되돌리는 "완성 펄스" 전용 값.
  const settle = useRef(new Animated.Value(0)).current;
  // 탭(press) 시 버튼이 살짝 눌리는 촉각적 피드백 전용 값 — 1(평상시)~0.965(눌림).
  const pressScale = useRef(new Animated.Value(1)).current;
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);
  const pendingPlayRef = useRef(false);

  const playNow = useCallback(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (reduced) {
          // 시스템 "동작 줄이기" 설정 — 애니메이션 없이 바로 완성된 CTA 상태로 보여준다.
          // 어떤 경우에도 CTA 기능 자체는 사라지지 않는다.
          progress.setValue(1);
          return;
        }
        progress.setValue(0);
        shine.setValue(0);
        settle.setValue(0);
        // 반짝임(구체 인지) → 모프(형태+색 변화) → 완성 펄스 순서로 이어서 재생한다.
        Animated.sequence([
          Animated.timing(shine, {
            toValue: 1,
            duration: SHINE_DURATION_MS,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
          }),
          // 정해진 시간에 걸쳐 커브를 그리는 timing 대신, 질량-감쇠-강성 물리 모델로 움직이는
          // spring으로 교체했다(7차 업데이트) — iOS 시스템 애니메이션 대부분이 스프링
          // 기반이라 이쪽이 훨씬 "자연스럽고 고급스러운" 감속감을 준다. `damping`을
          // 임계감쇠보다 살짝 높게 잡고(약 1.08배, `damping ≈ 2.05×√stiffness`)
          // `overshootClamping: true`까지 이중으로 걸어서, 물리 계산이 어떻든 애니메이션
          // 값이 목표치를 절대 넘어서지 않도록 보장했다 — Bounce/Elastic/Overshoot 금지
          // 원칙은 그대로 지킨다.
          // [8차 업데이트] stiffness:40/damping:14는 실제로 정착까지 약 2~2.5초가 걸리는
          // 회귀 버그였다(RN spring 적분식을 그대로 Python으로 시뮬레이션해 확인). 같은
          // 감쇠비를 유지하며 stiffness를 다시 스윕한 결과 stiffness:240/damping:31.8이
          // 약 0.98초 만에 정착해 원래 의도했던 900ms~1초 체감에 가장 가까웠다.
          Animated.spring(progress, {
            toValue: 1,
            stiffness: 240,
            damping: 31.8,
            mass: 1,
            overshootClamping: true,
            // width/backgroundColor는 네이티브 드라이버를 지원하지 않는다.
            useNativeDriver: false,
          }),
          Animated.sequence([
            Animated.timing(settle, {
              toValue: 1,
              duration: SETTLE_RISE_MS,
              easing: Easing.out(Easing.quad),
              useNativeDriver: false,
            }),
            Animated.timing(settle, {
              toValue: 0,
              duration: SETTLE_FALL_MS,
              easing: Easing.out(Easing.quad),
              useNativeDriver: false,
            }),
          ]),
        ]).start();
      })
      .catch(() => {
        // Reduce Motion 조회 실패 시에도 최소한 완성된 CTA는 보이게 한다.
        progress.setValue(1);
      });
  }, [progress, shine, settle]);

  const handlePressIn = useCallback(() => {
    Animated.timing(pressScale, {
      toValue: 0.965,
      duration: 90,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [pressScale]);

  const handlePressOut = useCallback(() => {
    Animated.timing(pressScale, {
      toValue: 1,
      duration: 150,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [pressScale]);

  // 트랙 실제 폭 실측(용도는 아래 useFocusEffect 안 주석 참고).
  const handleTrackLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number } } }) => {
      const w = e.nativeEvent.layout.width;
      trackWidthRef.current = w;
      setTrackWidth(w);
      if (pendingPlayRef.current) {
        pendingPlayRef.current = false;
        playNow();
      }
    },
    [playNow]
  );

  // 이번 앱 세션에서 이미 한 번 재생했다면, 홈 탭에 다시 들어올 때마다 재생하지 않고
  // 애니메이션 없이 바로 완성된 CTA 상태로 보여준다 — 앱을 새로 켜서 홈 탭에 처음
  // 진입했을 때만 1회 재생하면 충분하다는 사용자 피드백 반영(4차 업데이트 참고).
  useFocusEffect(
    useCallback(() => {
      if (hasPlayedOnceThisSession) {
        progress.setValue(1);
        return;
      }
      hasPlayedOnceThisSession = true;
      // 트랙의 실제 폭은 화면 크기에 따라 달라지므로 onLayout으로 실측해야 한다. 이
      // 실측값과 "탭에 포커스가 들어왔다"는 이벤트는 둘 다 비동기라 어느 쪽이 먼저
      // 도착할지 보장되지 않는다 — layout을 아직 모르는 채로 재생을 시작하면 width가
      // 구체 크기에 머물러버리는 문제(135번에서 발견)가 있어, layout을 아직 모르면
      // 재생을 "예약"만 해두고 onLayout이 도착하는 즉시 재생한다.
      if (trackWidthRef.current > 0) {
        playNow();
      } else {
        pendingPlayRef.current = true;
      }
    }, [playNow, progress])
  );

  const width = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [ORB_SIZE, Math.max(trackWidth, ORB_SIZE)],
    extrapolate: "clamp",
  });
  const animatedColor = progress.interpolate({
    inputRange: COLOR_STOPS_INPUT,
    outputRange: COLOR_STOPS_OUTPUT,
  });
  // 텍스트는 형태 변화가 충분히 진행돼 가로 공간이 확보된 뒤(약 62% 지점)에만 나타난다.
  const textOpacity = progress.interpolate({ inputRange: [0, 0.62, 1], outputRange: [0, 0, 1] });
  const textTranslateY = progress.interpolate({ inputRange: [0, 0.62, 1], outputRange: [4, 4, 0] });
  // 스페큘러 반점은 "구체였던 부분에 남은 광택"이라는 의도라, 오브젝트가 캡슐 형태로
  // 완전히 바뀌는 시점(0.35→0.6)에 맞춰 함께 옅어지다 사라진다 — 완성된 버튼 위에 별개의
  // 얼룩처럼 남지 않도록(4차 업데이트, 실기기 피드백 반영).
  const specularFade = progress.interpolate({
    inputRange: [0, 0.35, 0.6, 1],
    outputRange: [1, 1, 0, 0],
    extrapolate: "clamp",
  });
  // 반짝임 바 — 구체(폭 ORB_SIZE) 왼쪽 바깥에서 오른쪽 바깥까지 한 번 스치듯 지나간다.
  // shine이 끝나면(=1) opacity가 0으로 떨어져 이후 모프/완성 상태에는 전혀 남지 않는다.
  const shineTranslateX = shine.interpolate({
    inputRange: [0, 1],
    outputRange: [-ORB_SIZE * 0.6, ORB_SIZE * 1.6],
  });
  // 플래토 없는 삼각형 곡선(순간적으로 반짝였다 사라짐) + 정점 불투명도를 0.85→0.5로
  // 낮춰 "너무 세다"는 피드백에 대응했다(6차 업데이트).
  const shineOpacity = shine.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0, 0.5, 0],
  });
  // 모프가 끝난 직후 글로우를 잠깐 최대 1.5배까지 밝혔다가 되돌리는 "완성 펄스" 배율.
  const settleBoost = settle.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.5],
  });
  // 눌렀을 때 그림자/글로우가 함께 옅어지며 "버튼이 표면 속으로 살짝 가라앉는" 물리적
  // 눌림감을 더한다(7차 업데이트) — 단순히 크기만 줄어드는 것보다 iOS 네이티브 버튼의
  // 눌림 반응에 더 가깝다. pressScale과 같은 값을 재사용해 별도 Animated.Value 없이 구현.
  const pressDim = pressScale.interpolate({
    inputRange: [0.965, 1],
    outputRange: [0.7, 1],
  });

  return (
    <View style={styles.card}>
      {/* 실제 레퍼런스 배경 에셋 — resizeMode="cover"라 카드 실제 비율(기기 화면 너비에 따라
          달라짐)에 맞춰 중앙 기준으로 자동 크롭된다. */}
      <Image source={HERO_BG} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <View style={styles.scrim} pointerEvents="none" />

      <View style={styles.textBlock}>
        {typeof subtitle === "string" ? <Text style={styles.subtitle}>{subtitle}</Text> : subtitle}
        <Text style={styles.title}>{title}</Text>
      </View>

      <View style={styles.track} onLayout={handleTrackLayout}>
        {/* 히트 영역은 트랙 전체 폭 — 오브젝트가 아직 작은 구체일 때도 완성될 버튼 자리를
            그대로 누르면 즉시 동작한다(모프가 끝날 때까지 기다리게 하지 않는다). 글로우/
            오브젝트는 전부 position:"absolute"로 같은 원점(left:0, top:0)에 겹쳐 중심을
            맞춘다. */}
        <Pressable
          style={[styles.hitArea, { transform: [{ scale: pressScale }] }]}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
        >
          {GLOW_RINGS.map((ring) => (
            <Animated.View
              key={ring.pad}
              pointerEvents="none"
              style={[
                styles.glowRing,
                {
                  width: Animated.add(width, ring.pad),
                  height: CTA_HEIGHT + ring.pad,
                  borderRadius: (CTA_HEIGHT + ring.pad) / 2,
                  marginLeft: -ring.pad / 2,
                  marginTop: -ring.pad / 2,
                  backgroundColor: animatedColor,
                  opacity: Animated.multiply(Animated.multiply(settleBoost, ring.opacity), pressDim),
                },
              ]}
            />
          ))}

          {/* 입체감을 주는 드롭섀도 — pill과 같은 크기/모양이지만 overflow:hidden이 없어야
              그림자가 잘리지 않는다(iOS는 shadow*, Android는 elevation). pill이 바로 위에서
              완전히 덮으므로 이 레이어의 배경색 자체는 보이지 않고 그림자만 드러난다. 눌렀을
              때는 pressDim으로 그림자도 함께 옅어져 "눌려서 살짝 가라앉는" 느낌을 준다. */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.shadowLayer,
              {
                width,
                backgroundColor: animatedColor,
                opacity: pressDim,
              },
            ]}
          />

          <Animated.View style={[styles.pill, { width, backgroundColor: animatedColor }]}>
            {/* 대각선 유리질 하이라이트 — 왼쪽 위가 밝고 오른쪽 아래로 갈수록 옅어진다. */}
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.32)", "rgba(255,255,255,0)"]}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.65, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {/* 코어 셰이딩(8차 업데이트) — 하이라이트의 정반대(오른쪽 아래)에 아주 옅은
                남색 그라디언트를 더한다. 하이라이트만 있으면 "빛나는 평면 원반"처럼
                보이기 쉬운데, 반대쪽에 은은한 그림자가 같이 있어야 실제 유리구슬/보석처럼
                표면이 굽어있다는 게 눈에 명확하게 읽힌다("구체 느낌이 명확해야" 피드백
                대응). 앞쪽 절반(locations 0~0.55)은 거의 투명하게 두고 뒤쪽 절반에서만
                옅게 번지도록 해 과하게 어두워 보이지 않게 했다 — PIL 프리뷰로 구체(0%)와
                완성된 캡슐(100%) 양쪽에서 자연스러움을 확인했다. */}
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(10,16,36,0)", "rgba(10,16,36,0)", "rgba(10,16,36,0.2)"]}
              locations={[0, 0.55, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {/* 스페큘러(반사광) 반점 — 구체였던 왼쪽 부분에 고정된 위치. 캡슐로 완전히
                바뀌면(progress 0.6+) specularFade가 0이 돼 자연스럽게 사라진다. */}
            {SPECULAR_LAYERS.map((s) => (
              <Animated.View
                key={s.radius}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: SPECULAR_CX - s.radius,
                  top: SPECULAR_CY - s.radius,
                  width: s.radius * 2,
                  height: s.radius * 2,
                  borderRadius: s.radius,
                  backgroundColor: "#fff",
                  opacity: Animated.multiply(specularFade, s.opacity),
                }}
              />
            ))}
            {/* 반짝임(shine) 바 — 재생 시작 직후 구체 위를 한 번 은은하게 스치고 사라진다.
                가장자리가 부드럽게 페이드되는 그라디언트라 딱딱한 사각형으로 보이지 않는다.
                pill의 overflow:"hidden"에 의해 그 순간의 오브젝트 모양(이때는 원)으로
                자연히 클립된다. */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.shineBarWrap,
                {
                  opacity: shineOpacity,
                  transform: [{ translateX: shineTranslateX }, { rotate: "-22deg" }],
                },
              ]}
            >
              <LinearGradient
                colors={["rgba(255,248,230,0)", "rgba(255,248,230,0.9)", "rgba(255,248,230,0)"]}
                locations={[0, 0.5, 1]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </Animated.View>

          <View style={styles.textOverlay} pointerEvents="none">
            <Animated.Text
              style={[styles.ctaText, { opacity: textOpacity, transform: [{ translateY: textTranslateY }] }]}
              numberOfLines={1}
            >
              {ctaLabel}
            </Animated.Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    overflow: "hidden",
    marginBottom: 20,
    paddingTop: 26,
    paddingBottom: 26,
    paddingHorizontal: 22,
  },
  // 헤드라인 텍스트가 실제 배경 에셋의 밝은 영역(카드 상단은 흰색에 가까운 라벤더) 위에서도
  // 충분한 대비를 갖도록, 아주 옅은 어두운 스크림 + 텍스트 자체의 그림자를 함께 쓴다.
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(8,12,30,0.12)" },
  textBlock: { marginBottom: 22 },
  subtitle: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
    textShadowColor: "rgba(15,23,42,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    textShadowColor: "rgba(15,23,42,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  track: { height: CTA_HEIGHT },
  hitArea: { position: "relative", height: CTA_HEIGHT, width: "100%" },
  glowRing: { position: "absolute", left: 0, top: 0 },
  pill: {
    position: "absolute",
    left: 0,
    top: 0,
    height: CTA_HEIGHT,
    borderRadius: CTA_HEIGHT / 2,
    overflow: "hidden",
  },
  shadowLayer: {
    position: "absolute",
    left: 0,
    top: 0,
    height: CTA_HEIGHT,
    borderRadius: CTA_HEIGHT / 2,
    // Android는 elevation이 실제 그림자를 그리려면 불투명 배경이 있어야 하고, iOS는
    // shadow*로 그린다 — 둘 다 pill 바로 아래 깔려서 "카드 위에 얹힌 버튼" 같은 입체감을
    // 준다(6차 업데이트, "누르고 싶은 느낌" 보강). pill이 완전히 덮으므로 몸통 색 자체는
    // 보이지 않고 가장자리 그림자만 드러난다.
    ...Platform.select({
      ios: {
        shadowColor: "#13224D",
        shadowOffset: { width: 0, height: 7 },
        shadowOpacity: 0.26,
        shadowRadius: 12,
      },
      android: { elevation: 9 },
      default: {},
    }),
  },
  shineBarWrap: {
    position: "absolute",
    left: 0,
    top: -CTA_HEIGHT * 0.35,
    width: CTA_HEIGHT * 0.22,
    height: CTA_HEIGHT * 1.7,
    overflow: "hidden",
  },
  textOverlay: {
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: CTA_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  ctaText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
