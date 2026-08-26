# QA 수정 로그

세션별 QA 피드백과 수정 내역을 기록한다. 새 세션에서 이어서 작업할 때 "이전에 뭘 했는지" 빠르게 파악하는 용도.

## 2026-08-03

### 1. 제외하고 생성 — "최근 당첨번호 자동 제외" 버튼 무반응
- **원인**: `getRecentDraws`가 네트워크 실패 시 예외 처리 없이 실패해도 아무 피드백이 없었음 (버튼을 눌러도 조용히 아무 일도 안 일어남).
- **수정**: `src/lib/draws/drawCache.ts`에 `RecentDrawsFetchError` 도입 — 네트워크 오류로 일부/전부 못 받아오면 예외를 던지고 부분 결과를 담아 호출부에 알림. `app/generate/exclusion.tsx`는 로딩 상태 표시("불러오는 중...") + 실패 시 Alert 처리.

### 2. AI 조합 탐색 — 10만 회 정밀 탐색이 너무 느림
- **원인**: 후보 1개(6개 숫자) 뽑을 때마다 45개 전체를 셔플했고, 셔플 스텝마다 `expo-crypto` 네이티브 브릿지를 왕복 호출 (10만 회면 수백만 번 브릿지 호출).
- **수정**: `src/lib/lottery/random.ts`에 난수 바이트 풀링(브릿지 호출 횟수 대폭 감소) + `securePartialShuffle`(45개 중 필요한 6개만 부분 셔플, 44회→6회) 도입.
- **탐색 강도 옵션 변경**: 바로 생성 / 1만 회 / 10만 회 → **바로 생성 / 1만 회 / 3만 회 / 5만 회 정밀 탐색** (`src/constants/lottery.ts`, `src/lib/lottery/types.ts`, `app/generate/ai-search.tsx`, README).

### 3. AI 조합 탐색 — 로딩 문구/애니메이션
- 문구 변경: "서버나 AI 모델 호출이 없습니다" → **"무작위 알고리즘을 통해 조합을 탐색하고 온디바이스로 연산이 이뤄집니다"** (AI 모델 호출 언급이 오해 소지가 있다는 피드백).
- 로딩 스피너(`ActivityIndicator`) → `src/components/LottoBallLoader.tsx` 신규 — 숫자 없는 로또 공 5개(색상별)가 순차적으로 통통 튀는 애니메이션. `LottoBall`에 `hideNumber` prop 추가해서 재사용.

### 4. 내 번호 탭 — "구매 예정"/"저장함" 배지 색상 동일해서 구분 안 됨
- `app/(tabs)/tickets.tsx`에 `STATUS_BADGE_STYLES` 추가: 저장함(회색) / 구매 예정(인디고) / 구매 완료(초록) / 확인 완료(주황).

### 5. 로또 연구소 — "다시 시도" 버튼 무반응, 조합 패턴 통계 점검
- **원인**: 위 1번 수정(`RecentDrawsFetchError` throw)이 `lab.tsx`/`index.tsx`(홈)/`result.tsx`에는 반영이 안 돼 있었음. 예외가 처리되지 않고 전파되면서 당첨번호 조회 이후의 다른 섹션(내 번호 분석, 이번 주 리포트 등)까지 전부 갱신이 멈췄음.
- **수정**: `getRecentDrawsSafe`(실패해도 던지지 않고 빈 배열/부분 결과로 대체) 신규 추가 후 `lab.tsx`/`index.tsx`/`result.tsx`에 적용. 사용자가 직접 액션하는 `exclusion.tsx`는 기존 throw 버전 + Alert 유지.
- 회귀 검증 중 첫 번째 네트워크 확인 단계(가장 최신 회차 탐색)에서도 같은 silent-fail이 남아있던 걸 추가로 발견해 마저 수정.
- 조합 패턴 통계 자체 로직은 정상 확인 (`tests/drawStats.test.ts` 5개 테스트로 검증). 화면에 0으로 보인 건 당첨번호 조회 실패의 연쇄 효과였을 뿐.

### 6. 내 번호 탭 — "회차 지정"/"당첨 확인" 버튼 두 개 나란히 있어 혼동
- **부가 발견**: `handleAssignDraw`가 입력칸이 비어있고 이미 회차가 지정된 경우 아무 안내 없이 조용히 아무 일도 안 함(진짜 버그).
- **수정**: 평소엔 회차 칩 + 파란색 "당첨 확인"(주 행동) 버튼 + "회차 변경" 텍스트 링크(부 행동)로 분리. 회차 미지정/변경 시에만 입력 UI 노출.

### 7. 내 번호 탭 — 회차 번호 대신 날짜 기반 기본값
- 유저는 회차 번호(예: "제 1235회")를 신경 쓰지 않는다는 피드백 반영.
- `src/lib/draws/drawApi.ts`에 `estimateDrawDate`(회차→추첨일 역산) 추가.
- "회차 변경" 시 회차 번호 입력 대신 **"이번 주 (8/8)" / "다음 주 (8/15)" 원터치 버튼**이 기본으로 뜨도록 변경. 회차 번호를 직접 아는 드문 경우만 "직접 입력" 링크로 노출.
- 회차 칩 라벨도 "제 1235회" → "이번 주 추첨 (8/8)" 형태로 변경.

### 8. 미추첨 회차를 당첨번호로 오인할 위험 점검 (신뢰성 하드닝)
- **점검 결과**: 등수 계산(`computeRank`)은 `status === "success"`일 때만 호출되도록 이미 올바르게 짜여 있었음. 다만 `fetchWinningDrawWithStatus`가 서버의 `returnValue: "success"` 플래그를 검증 없이 그대로 신뢰하는 구멍이 있었음 — 형식만 success인 비정상 응답(번호 0, 회차 불일치 등)이 오면 미추첨 회차를 당첨번호로 잘못 보여줄 수 있는 구조.
- **수정**: `isPlausibleWinningDraw` 검증 추가 (회차 일치, 번호 6개 1~45 범위·중복 없음, 보너스번호 유효성, 추첨일 존재) — 하나라도 어긋나면 `network_error`로 안전 처리, 가짜 결과를 보여주지 않음.

### 9. 실기기 테스트 중 발견 — 번호 생성 전체 화면 "생성 실패" (긴급, 회귀 버그)
- **증상**: 운명의 신 / AI 조합 탐색(1만 이상) / 나의 행운번호 등 번호를 생성하는 화면에서 `expo-crypto: getRandomBytes(8192) expected a valid number from range 0...1024` 에러와 함께 생성 실패.
- **원인**: 2번(성능 개선) 항목에서 도입한 난수 바이트 풀링이 한 번에 8192바이트를 요청하도록 했는데, `expo-crypto`의 실제 네이티브 구현은 1회 요청당 최대 1024바이트까지만 허용함. 테스트용 목(mock)은 Node `crypto` 기반이라 이 상한이 없어 유닛 테스트로는 못 잡고 실기기 EAS 빌드 테스트에서 처음 발견됨.
- **수정**: `src/lib/lottery/random.ts`의 `POOL_SIZE`를 1024 이하로 낮추고, 혹시 플랫폼별로 실제 허용치가 더 낮을 경우까지 대비해 1024→256→64→16→1 순으로 재시도하는 폴백 추가.
- **재발 방지 테스트**: `tests/random.test.ts` 신규 — expo-crypto의 1024바이트 상한을 그대로 흉내내는 mock으로 교체해서, `getRandomBytes`가 1024 초과로 호출되는 일이 없는지, 그 상한 아래에서도 `secureRandomInt`/`secureShuffle`/`securePartialShuffle`/`randomInt`가 전부 정상 동작하는지 검증 (4개 테스트).

### 10. 앱 이름 변경 — "AI 로또 번호 생성기" → "금손로또"
- 검색 용이성·목적 부합·기억 용이성·중장년층 임팩트·젊은층 포괄을 기준으로 여러 후보(테크로또, 로또랩, 로또의신, 로또박사, 로또도사, 번호점집, 오늘의로또, 픽로또, 로또핏, 돈워리로또, 플레이로또, 골드핸드로또, 황금손로또 등)를 웹 검색으로 기존 앱과의 충돌 여부까지 확인하며 검토.
- "플레이로또"(기존 17년 된 로또 정보 사이트), "돈워리"(기존 금전거래 기록 앱), "골드로또"(기존 앱과 패턴 겹침) 등은 혼선 우려로 제외.
- 최종 확정: **금손로또**. "황금손"(손대면 잘 풀린다)의 준말로 전 연령대에 익숙하면서, 기존 로또 앱과 이름이 겹치지 않아 브랜드로 온전히 가져갈 수 있음.
- 반영: `app.json`(name: "금손로또", slug: "geumson-lotto", scheme: "geumsonlotto"), `package.json`(name), `README.md`(제목). 안드로이드/iOS 패키지명(`com.yourcompany.ailotto`)은 사용자 요청으로 그대로 유지(출시 전 언제든 변경 가능하나 지금은 유지하기로 결정).

### 11. EAS 빌드 실패 — slug 불일치
- **증상**: `eas build --platform android --profile preview` 실행 시 `Project config: Slug for project identified by "extra.eas.projectId" (ai-lotto-generator) does not match the "slug" field (geumson-lotto)` 에러로 빌드 자체가 시작되지 않음.
- **원인**: EAS 프로젝트(`extra.eas.projectId`)는 최초 생성 시의 slug(`ai-lotto-generator`)에 영구적으로 묶여 있음(EAS 정책상 프로젝트 ID의 slug는 변경 불가). 앱 이름을 "금손로또"로 바꾸면서 `app.json`의 `slug`도 `geumson-lotto`로 같이 바꿨는데, EAS 서버에 등록된 프로젝트는 여전히 옛 slug를 참조하고 있어 충돌.
- **수정**: `app.json`의 `slug`를 다시 `ai-lotto-generator`로 되돌림. slug는 사용자에게 보이지 않는 내부 식별자일 뿐이고, 실제 화면에 노출되는 앱 이름(`name: "금손로또"`)은 그대로 유지되므로 브랜딩에는 영향 없음. 기존 EAS 프로젝트(빌드 이력 포함)도 그대로 유지됨.
- (참고: 굳이 새 slug로 된 새 EAS 프로젝트를 새로 만들고 싶다면 `extra.eas.projectId`를 지우고 `eas init`으로 재생성하는 방법도 있으나, 지금은 기존 프로젝트 유지가 더 간단해 이 방식으로 처리하지 않음.)

### 12. 앱 아이콘 시안 — 3개 전부 반려
- `assets/icon-concepts/`에 만든 시안 3개(손+로또공, 금 메달리온, 로또공 클러스터 — 클러스터는 가운데 공 색상 구분/별 제거/입체감 강화 1차 수정까지 진행) 전부 사용자가 마음에 안 든다고 반려.
- 다음 세션에서 아이콘 방향을 처음부터 다시 잡아야 함 (완전히 새로운 컨셉 필요, 기존 3개 재활용 안 함).

### 13. 45면체 주사위 — "한 번 굴리기"/"자동 6회 굴리기"/"초기화" 버튼 색상이 똑같아 혼동
- **원인**: 세 버튼이 전부 같은 진한 남색 채움 스타일이라 어떤 게 주 행동인지 구분이 안 됨.
- **수정**: `app/generate/dice.tsx` — 화면의 목표(6개 채워서 결과 확인)에 가장 빨리 도달하는 "자동 6회 굴리기"를 Primary(브랜드 블루 채움)로, "한 번 굴리기"는 Secondary(동일 블루 아웃라인)로, "초기화"는 Tertiary(회색 아웃라인)로 위계를 분리. 다른 화면(`GeneratedGameCard`, `BottomActionBar`)에서 이미 쓰는 브랜드 컬러(#2563EB)와 통일.

### 14. 제외하고 생성 — "세트 저장" 눌러도 아무 반응 없음
- **원인**: `saveExclusionSet` 저장 후 피드백이 전혀 없고, 저장된 세트는 목록 맨 앞에 추가되는데 그 목록이 입력창보다 위쪽(스크롤 밖)이라 저장됐는지 알 방법이 없었음.
- **수정**: `app/generate/exclusion.tsx` — 저장 성공 시 화면 하단에 "OO 세트가 저장됐어요" 토스트(체크 아이콘, 자동 소멸)를 띄우고, 방금 저장된 세트를 목록에서 파란 테두리 + "NEW" 배지로 2.2초간 강조. 저장 버튼은 "저장 중..."으로 바뀌며 연타 방지, 저장 실패 시 Alert 추가.

### 15. 제외하고 생성 — "최근 N주" 자동 제외 시 "일부 회차 조회 실패" 네트워크 에러
- **점검**: dhlottery.co.kr API에 아무 헤더 없이 요청 중이었음. 사용자가 브라우저 주소창에 API URL을 직접 입력했을 때 동행복권 서버가 `error` 페이지(404)로 리다이렉트하는 걸 확인 — Referer 없는 요청을 걸러내는 것으로 추정(다만 이 개발 환경엔 실인터넷이 없어 dhlottery.co.kr 자체를 확인할 수 없어 100% 확정은 아님).
- **수정**: `src/lib/draws/drawApi.ts`의 fetch 요청에 브라우저와 유사한 User-Agent/Referer/Accept 헤더 추가. `drawCache.ts`의 "최신 회차 찾기" 단계도 과거 회차 조회 루프와 동일하게 network_error 시 3회 재시도하도록 통일(기존엔 이 단계만 재시도 없이 단발 실패 처리). `exclusion.tsx`의 실패 Alert에 "다시 시도" 버튼 추가(기존엔 확인만 누르고 사용자가 직접 버튼을 다시 찾아 눌러야 했음).
- **한계**: 헤더 추가가 실제로 효과가 있는지는 dhlottery.co.kr 접근이 막힌 이 환경에서 검증 불가 — 실기기 재현 테스트 필요.

### 16. 로또 연구소 — 당첨번호 조회 실패 시 "번호별 출현 빈도 Top 6"에 1~6번이 전부 "0회"로 표시
- **원인**: `draws`가 빈 배열일 때 `computeNumberFrequencies([])`가 1~45번 전부 totalCount 0인 배열을 반환하고, 그중 상위 6개를 그대로 보여주다 보니 정렬이 안정적이라 항상 1,2,3,4,5,6이 "진짜 Top 6"인 것처럼 보임. "조합 패턴 통계"도 같은 이유로 전부 0.00/0%. 계산 로직 자체(`drawStats.ts`)는 정상(`tests/drawStats.test.ts` 통과) — 화면이 "데이터 없음"과 "정상 데이터 0"을 구분 안 한 게 문제.
- **수정**: `app/(tabs)/lab.tsx` — 두 카드 모두 `draws.length === 0`이면 가짜 0값 대신 "당첨번호 데이터를 불러오지 못해 통계를 계산할 수 없어요" 안내로 교체. "다시 시도" 버튼은 눌러도 재실패 시 화면이 그대로라 눌렸는지 불분명했던 문제도 같이 고쳐서, 재시도 후에도 실패하면 명시적으로 Alert 표시.

### 17. AI 조합 탐색 — 탐색 강도 옵션 재변경 + 100만 회 성능 실측
- **변경**: 2번 항목에서 정한 "바로 생성 / 1만 회 / 3만 회 / 5만 회 정밀 탐색"을 다시 **"바로 생성 / 3만 회 탐색 / 10만 회 탐색 / 100만 회 부스터 탐색"**으로 변경 (`src/constants/lottery.ts`, `app/generate/ai-search.tsx` 기본값 3만 회로 조정). `GenerationRequest.searchCount` 타입은 특정 리터럴 값에 묶이지 않도록 `number`로 완화.
- **100만 회가 10만 회의 몇 배인지 실측**: Jest는 계측 오버헤드가 커서 실측에 부적합해 제외하고, `generator.ts`를 그대로 Node로 뽑아 직접 벤치마크. 결과 — 3만 회 307ms, 10만 회 737ms, 100만 회 7,943ms. **10만→100만이 약 10.8배**로, 예상한 "10배"와 거의 일치(초과분은 후보 수가 늘수록 정렬(O(n log n))/GC 부담이 커지는 정상적인 원인). 단, 이 수치는 데스크톱 Node 기준이라 실기기(Hermes/JSC) 절대 시간은 별도 확인 필요.

### 18. 스켈레톤 UI 도입 검토 및 적용
- **검토**: 화면별 로딩 피드백 실태 점검 — 홈 화면은 dhlottery.co.kr 조회/내 생성 이력 로딩 중 아무 표시가 없어서 "내가 자주 선택한 번호"/"최근 오래 나오지 않은 번호" 카드가 갑자기 팝업되는 레이아웃 점프가 있었음. 로또 연구소는 전체 화면을 중앙 스피너로 가리는 방식이라 "멈춘 것 같은" 인상. 내 번호 탭은 로컬 저장소만 읽어서 체감 지연이 거의 없어 제외, 결과 화면의 AI 설명 문구는 영향이 작아 제외.
- **적용**: `src/components/Skeleton.tsx` 신규(`SkeletonBlock`, `SkeletonBall` — 은은하게 깜빡이는 회색 블록). `app/(tabs)/index.tsx`에 `loading` 상태 추가해 히어로 문구/두 카드가 로딩 중엔 실제 레이아웃 모양의 스켈레톤으로 표시. `app/(tabs)/lab.tsx`는 전체 화면 스피너를 실제 카드 3개(당첨결과/출현빈도/패턴통계) 모양을 흉내낸 스켈레톤으로 교체.

### 19. 전체 앱 종합 점검 (개발자·보안·기획·UX 4개 관점) — `APP_REVIEW_2026-08-03.md`
- 코드베이스 전체(app/, src/, tests/ 약 60개 파일)를 직접 읽고 점검한 결과를 별도 리포트로 작성. 이 로그에는 요약만 남기고, 상세 근거·전체 항목은 `APP_REVIEW_2026-08-03.md` 참고.
- **종합 점수(100점 만점)**: 보안 88 / 안정성 74 / 최적화 80 / UX 78 / 경쟁 앱 대비 72 → **종합 약 79**.
- **바로 고쳐야 할 것(Critical, 아직 미수정)**:
  1. `app/(tabs)/generate.tsx` MENU_ITEMS의 "AI 조합 탐색" 설명이 아직 "최대 5만 개 후보"로 되어 있음 — 17번 항목에서 100만 회로 바꿨는데 문구가 안 따라감(오늘자 정합성 오류).
  2. `app/(tabs)/tickets.tsx`의 `handleDelete`가 확인 다이얼로그 없이 즉시 삭제됨(설정 화면의 전체 삭제는 확인을 거치는 것과 비일관).
  3. `app/generate/result.tsx`의 `handleRegenerate`(AI_SEARCH 재생성)에 로딩 상태/중복 실행 방지가 없음 — 100만 회 재탐색 시 화면이 멈춘 것처럼 보일 수 있음.
- **출시 전 정리(High)**: `app.json` 패키지명이 아직 `com.yourcompany.ailotto` 플레이스홀더, 앱 아이콘 미확정(12번 항목), 개인정보처리방침 페이지 없음, 전역 에러 바운더리 없음.
- **중기(Medium)**: 접근성 라벨(`accessibilityLabel`) 전 화면에 전무, 캡션 텍스트 색상(`#94A3B8`)이 WCAG AA 대비 기준 미달, `writeJson` 실패 시 에러 처리 없음, 경쟁 앱 대비 QR 스캔 당첨확인 기능 없음.
- **강점으로 확인된 것**: 서버 없는 구조라 개인정보 수집이 원천적으로 없음, CSPRNG 기반 정직한 난수, 미추첨 회차 오인 방지 검증, "모든 로컬 데이터 삭제" 원터치 기능, 확률에 대한 일관되고 정직한 문구 — 경쟁 앱 대비 뚜렷한 차별점.

### 추가된 테스트
- `tests/drawStats.test.ts` — 조합 패턴 통계/출현 빈도 계산 검증
- `tests/tickets.test.ts` — 티켓 저장소(회차 지정/당첨 확인/삭제) 검증
- `tests/drawApi.test.ts` — 회차↔날짜 변환, 비정상 응답 방어 로직 검증 (17개)
- `tests/random.test.ts` — expo-crypto 1024바이트 상한 회귀 방지 (4개)

### 알려진 한계
- 이 개발 환경(샌드박스)에는 실제 인터넷이 없어 dhlottery.co.kr 실서버 연동은 실기기에서 직접 확인 필요.
- **테스트 mock과 실기기 네이티브 모듈의 동작 차이(예: 바이트 크기 상한)는 유닛 테스트만으로 100% 보장되지 않는다** — 성능/네이티브 관련 변경은 실기기(EAS 빌드) 테스트를 꼭 거칠 것.

## 2026-08-04

### 20. 홈 화면 — QR 당첨확인 기능 신규 추가 (19번 항목 Medium "경쟁 앱 대비 QR 스캔 당첨확인 기능 없음" 해소)
- **UX 리뷰**: 퀵메뉴 3개(제외하고 만들기/행운번호/45면체 주사위) 뒤, "내가 자주 선택한 번호" 카드 앞자리에 4번째 버튼으로 배치. 기존 3개와 형태·톤은 동일하게 두고 테두리 색만 살짝 인디고 톤(`#A5B4FC`)으로 차등을 줘서 "생성"이 아니라 "조회" 기능임을 은근히 구분(`app/(tabs)/index.tsx`의 `QuickMenuItem` `variant="qr"`).
- **패키지**: `expo-camera` (~17.0.10, 이 프로젝트의 expo SDK 54와 호환되는 버전으로 `expo/bundledNativeModules.json` 기준 고정 설치) 추가. `app.json`에 카메라 권한 설명 문구와 함께 플러그인 등록.
- **QR 파싱**: `src/lib/qr/parseLottoQr.ts` 신규. 동행복권이 공식 포맷을 공개하지 않아 실제 QR URL 여러 건(제0843/1031/1107/1131/1147/1195회)을 비교해 구조를 역으로 추정 — `회차 4자리 + (게임유형 1글자 + 번호 12자리) × 1~5게임`. 뒤에 붙는 정체불명의 꼬리 문자열(체크섬 추정)은 서로 다른 회차인데도 동일한 값이 관찰돼 신뢰할 수 없다고 판단, 아예 파싱하지 않고 무시.
- **당첨 판정 원칙**: QR 안에 있을지 모르는 자체 "당첨" 표시는 처음부터 신뢰하지 않는다. QR에서는 회차 번호 + 번호만 뽑아내고, 실제 당첨 여부는 항상 `getDrawByNumberWithStatus`로 동행복권 공식 당첨번호를 다시 조회해 `computeRank`로 로컬 재계산한다(내 번호 탭과 동일한 신뢰 구조) — QR 리버스 엔지니어링이 100% 정확하지 않아도 최종 결과의 정확성에는 영향이 없도록 설계.
- **신규 화면**: `app/generate/qr-check.tsx` — 카메라 권한 요청 → `expo-camera`의 `CameraView`로 QR 스캔 → 파싱 실패 시 Alert로 재스캔 안내 → 파싱 성공 시 회차별 당첨번호 재조회 → 게임별 등수 표시(당첨 시 빨간색 강조) + 결과 공유 + 다시 스캔.
- **테스트**: `tests/parseLottoQr.test.ts` 신규 (11개) — 실제 QR 샘플 기반 정상 파싱, 도메인 불일치, 형식 불일치, 범위 초과 번호, 중복 번호, URL 없이 v값만 스캔된 경우 등 커버.
- **검증**: `npx tsc --noEmit` 클린, 기존 테스트 스위트 13개 전부(106개 테스트) 회귀 없이 통과.
- **알려진 한계**: 게임유형 글자(수동/자동/반자동 추정)는 실제로 자동·반자동 샘플을 구하지 못해 100% 검증되지 않았음 — UI에는 참고용으로만 노출하고 당첨 판정 로직에는 전혀 사용하지 않으므로 결과 정확성과는 무관. 실기기 카메라 스캔 동작(조도, 손상된 QR 등)은 시뮬레이터로 확인 불가 — 실기기 테스트 필요.

### 21. 종합 재점검(`APP_REVIEW_2026-08-04.md`) Critical/High 3건 수정

- **로또 연구소 "내 번호 분석"·"이번 주 리포트" 항상 빈 상태로 나오는 버그 수정**: `app/(tabs)/lab.tsx`의 `loadLabData()`에 조기 `return recentDraws;`가 함수 중간(당첨번호 조회 직후)에 있어, 그 아래 `getGenerationHistory()`/`getTickets()` 기반 분석 코드 전체가 도달 불가능한 죽은 코드였다. `return`을 함수 맨 끝(두 분석 블록을 모두 계산한 뒤)으로 옮겨 수정. `npx tsc --noEmit` 클린 재확인.
- **ESLint 최소 설정 도입**: 위 버그가 `no-unreachable`/`no-unused-vars` 같은 기본 규칙만 있어도 즉시 잡혔을 문제라, `eslint.config.mjs`(flat config, `@eslint/js` + `typescript-eslint` 권장 프리셋)와 `package.json`의 `lint` 스크립트를 추가했다. **알려진 한계**: 이 개발 환경(샌드박스, Windows 마운트 폴더)에서 `npm install`이 `node_modules/ajv` 임시 디렉터리 rename 단계에서 `ENOTEMPTY`로 반복 실패했고, 그 임시 디렉터리는 권한 문제(`Operation not permitted`)로 삭제도 되지 않아 정리하지 못했다(gitignore 대상이라 저장소 자체에는 영향 없음). `eslint`/`typescript-eslint`/`@eslint/js`는 `package.json`에 devDependency로 추가해뒀지만, 실제 패키지 설치는 로컬 환경에서 `npm install`을 한 번 더 실행해야 완료된다.
- **앱 아이콘 확정**: 사용자가 별도로 확인해준 집+G 로고(네이비 `#0F172A` + 오렌지 포인트)를 최종 아이콘으로 채택. 원본(1254×1254, 흰 배경)에서 `assets/icon.png`(1024×1024, iOS/기본 아이콘)과 `assets/adaptive-icon.png`(흰 배경 제거 후 안전 영역 62%로 축소·중앙 배치한 안드로이드 어댑티브 아이콘 전경, 투명 배경)을 생성. `app.json`에 `icon` 필드와 `android.adaptiveIcon.foregroundImage`를 추가하고, 어댑티브 아이콘 배경색을 기존 `#0F172A`(로고가 네이비 선이라 네이비 배경 위에서는 거의 안 보임)에서 `#FFFFFF`로 변경. 기존 3개 반려 시안(`assets/icon-concepts/`)은 그대로 보관.

### 22. `APP_REVIEW_2026-08-04.md` Medium/Low 3건 반영 (README BYOK 문구·온보딩은 사용자 판단으로 보류)

- **`tickets.tsx` 공유/삭제 버튼 터치 타겟 확대**: 텍스트 링크형 버튼이라 박스 자체를 키우면 UI 톤이 무거워지므로, 박스는 `paddingVertical 4→6`으로만 살짝 키우고 `hitSlop={{ top:14, bottom:14, left:16, right:16 }}`으로 실제 터치 영역을 44pt 이상으로 확보.
- **생년월일 SecureStore 이전**: "서버로 데이터를 보내지 않는데도 암호화가 필요한가?"라는 질문에 대한 답 — 위협 대상은 개발자의 서버 수집이 아니라 **기기 자체에 대한 접근**(잠금 해제된 폰을 잠깐 만지는 경우, 루팅/탈옥된 기기, 백업 파일 분석)이다. 기존엔 생년월일이 AsyncStorage에 다른 설정과 함께 평문으로 저장돼 있었다. `src/lib/storage/secureStorage.ts` 신규(`expo-secure-store`, iOS Keychain/Android Keystore 기반) 후, `preferences.ts`가 `birthProfile`만 이 계층으로 분리 저장하도록 수정(나머지 선호번호·알림 설정 등은 그대로 AsyncStorage 유지 — 민감도가 낮고 SecureStore는 항목당 용량 제한이 있어 전체를 옮기는 건 과함). 이전 버전에서 평문으로 저장된 생년월일은 다음 조회 시점에 자동으로 SecureStore로 옮기고 평문 원본은 지우는 1회성 마이그레이션도 포함. `storage.ts`의 `clearAllLocalData()`도 SecureStore 키를 함께 지우도록 수정(안 그러면 "모든 로컬 데이터 삭제"를 눌러도 암호화된 생년월일만 남는 불완전 삭제가 됨).
- **컴포넌트 렌더링 테스트 도입**: `jest-expo` + `@testing-library/react-native`로 `tests/components/lab.test.tsx` 신규 추가. `app/(tabs)/lab.tsx`를 실제로 렌더링해서 "내 번호 분석"·"이번 주 리포트" 카드가 화면에 나타나는지 확인 — 8/4에 발견한 dead-code 버그(순수 함수 테스트만으로는 못 잡았던 유형)를 정확히 겨냥한 회귀 테스트다. `jest.config.js`를 `projects` 기반으로 나눠 기존 순수 함수 테스트(`unit`, ts-jest)와 화면 렌더링 테스트(`components`, jest-expo)를 분리했다.
- **README BYOK 문구**: 사용자 판단에 따라 수정하지 않음(AI 관련 문구를 의도적으로 유지하고 싶다는 요청) — 현행 유지.
- **온보딩**: 사용자 판단에 따라 도입하지 않음(이전 QA에서 이미 "직관적이라 불필요"로 결론).
- **알려진 한계(중요)**: 이 세션의 연결 폴더(Windows 마운트)는 파일 삭제/rename이 제한되는 정책이 걸려 있어, `npm install`이 `node_modules` 내부 임시 디렉터리를 정리하지 못하고 `ENOTEMPTY`로 매번 실패했다. 그래서 `expo-secure-store`/`jest-expo`/`@testing-library/react-native`/`react-test-renderer`는 `package.json`에 정확한 버전으로 추가는 해뒀지만(SDK 54 호환 버전 기준), **실제 설치와 테스트 실행 확인은 로컬 환경에서 `npm install` 후 `npm test`/`npm run typecheck`로 한 번 더 검증이 필요하다.** `npx tsc --noEmit`로 미설치된 두 패키지(`expo-secure-store`, `@testing-library/react-native`) 관련 모듈 해석 에러 2건 외에는 클린인 것까지는 이번 세션에서 확인했다.

### 23. 인증서 고정(cert pinning) 검토 결과 — 미반영 / 최소 CI 구성 — 반영

- **인증서 고정: 검토 후 미반영으로 결정**. 이유는 두 가지다. (1) **필요성이 낮다** — dhlottery.co.kr 호출은 인증·결제가 없는 읽기 전용 GET이고, 응답 내용 자체를 `isPlausibleWinningDraw`로 이미 검증하고 있어(회차 일치·번호 범위·중복·보너스번호 유효성) MITM이 성공해도 "그럴듯한 가짜 당첨결과"를 보여주는 정도가 최대 피해다 — 실제 금전 피해나 개인정보 유출로 이어지지 않는다. (2) **이 환경에서 안전하게 구현할 방법이 없다** — RN/Expo에서 진짜 인증서 고정을 하려면 Android는 Network Security Config, iOS는 URLSession 위임을 다루는 네이티브 코드/커스텀 Expo config plugin이 필요한데(Expo 매니지드 워크플로 기본 기능이 아님), 이 샌드박스에는 실인터넷이 없어 dhlottery.co.kr의 실제 인증서 지문(fingerprint)조차 확인할 수 없다. 지문을 잘못 넣거나 사이트가 인증서를 갱신하면(고정을 백업 핀 없이 하면 흔히 발생) 네트워크 요청이 전부 실패해버려 "에러 안 나게"라는 요청 조건과 정면으로 충돌할 위험이 크다. 결론: 얻는 보안 이득 대비 구현·유지보수 비용과 오작동 리스크가 크게 앞서 보류.
- **최소 CI 구성: 반영**. `.github/workflows/ci.yml` 신규 — push/PR 시 `npm install` → `typecheck` → `lint` → `test` 순서로 실행. **`npm ci`가 아니라 `npm install`을 쓴 이유**: 21·22번 항목에서 추가한 패키지들이 이 세션에서 `package.json`에는 반영됐지만 `package-lock.json`은 갱신하지 못해(위 알려진 한계와 동일 원인) 현재 둘이 어긋난 상태다. 이 상태에서 `npm ci`를 쓰면 잠금 파일 불일치로 CI가 항상 실패한다. 로컬에서 `npm install`을 한 번 실행해 `package-lock.json`을 최신화하고 커밋하면, 그때는 `npm ci`로 바꿔 재현성을 높이는 걸 권장(워크플로 파일에 주석으로 남겨둠). 이 저장소는 아직 원격(GitHub) 연결이 없어(`git remote -v` 결과 없음) 실제로 CI가 동작하는지는 GitHub에 올린 뒤에만 확인 가능하다 — 이번 세션에서는 YAML 문법 유효성만 확인했다.

### 24. 홈 탭 아이콘을 브랜드 로고로 교체

- 하단 탭바 "홈" 아이콘을 기본 `Ionicons name="home"`에서 브랜드 로고(집+G)로 교체 — 사용자 요청("홈 버튼을 로고 이미지로 대체하면 앱 인지에 좋을 것 같다"). 원본 로고에서 그림자·안티에일리어싱 잔상을 걸러낸 단색 실루엣에 가까운 투명 배경 PNG(`assets/tab-icon-home.png`)를 새로 뽑았다(기존 `assets/adaptive-icon.png`는 안드로이드 안전영역 패딩이 커서 탭 아이콘으로 쓰면 로고가 작게 보임 — 탭바 전용으로 타이트하게 크롭한 별도 에셋).
- `app/(tabs)/_layout.tsx`에 `HomeTabIcon` 컴포넌트 추가: `Image`의 `tintColor`로 활성(`#2563EB`)/비활성(회색) 색을 그대로 입혀서, 나머지 3개 탭(Ionicons)과 같은 방식으로 활성 상태가 색으로 구분되도록 유지. `npx tsc --noEmit` 클린 확인.

### 25. 사용자가 로컬에서 처음 실행한 `npm install`/`npm run lint`/`npm test` 결과 반영

- 사용자가 로컬 환경에서 `npm install`을 처음 성공시키고(제 세션에서는 폴더 삭제 제약 때문에 끝까지 못 했던 부분), `npm run typecheck`(클린) / `npm run lint`(11 errors, 3 warnings) / `npm test`(unit 15개 스위트 전부 통과, `components` 1개는 AsyncStorage 네이티브 모듈 에러로 실행 자체가 실패)를 실제로 돌려 결과를 공유해줬다. 이게 이번 프로젝트에서 **eslint와 컴포넌트 렌더링 테스트가 처음으로 실제 실행된 순간**이라, 제가 사전에 예상만 하고 검증하지 못했던 문제들이 정확히 드러났다. 전부 원인 파악 후 수정:
  - `no-require-imports`(`app/(tabs)/_layout.tsx`의 로고 이미지 `require()`): RN/Expo에서 정적 에셋을 불러오는 표준 방식이라 이 규칙을 프로젝트 전역에서 끔.
  - `no-undef`(`babel.config.js`/`jest.config.js`의 `module`, `smoke_test.mjs`의 `console`): 이 파일들은 TypeScript가 아니라 Node에서 바로 실행되는 순수 JS라 `no-undef`가 꺼지지 않는데, Node 전역이 등록 안 돼 있었음 — 해당 파일 패턴에 Node 전역(`module`/`require`/`process`/`console`/`__dirname`) 등록.
  - `Definition for rule 'react-hooks/exhaustive-deps' was not found`(`Dice45.tsx`, `SettingsSheet.tsx`): 두 파일에 이미 있던 `eslint-disable-next-line react-hooks/exhaustive-deps` 주석이 정작 그 규칙을 제공하는 `eslint-plugin-react-hooks`가 없어서 "존재하지 않는 규칙"으로 에러가 남. 플러그인 추가(`react-hooks/rules-of-hooks: error`, `react-hooks/exhaustive-deps: warn`).
  - 안 쓰는 변수 경고 3건 정리: `lab.tsx`의 `getSectionCounts`(안 쓰는 import 제거), `qr-check.tsx`의 `tints`(애초에 이 화면엔 안 쓰여서 `useAppTheme()` 구조분해·`createStyles` 시그니처·`AppTints` import까지 함께 정리), `Skeleton.tsx`의 `View`(안 쓰는 import 제거).
  - **`components` 테스트 스위트 실행 실패**(`[@RNC/AsyncStorage]: NativeModule: AsyncStorage is null`): jest-expo가 AsyncStorage 네이티브 모듈을 기본으로 목(mock) 처리해주지 않아서 발생. `@react-native-async-storage/async-storage` 공식 문서가 권장하는 방식대로 `jest.config.js`의 `components` 프로젝트에 `setupFiles: ["@react-native-async-storage/async-storage/jest/async-storage-mock"]` 추가.
- **이번엔 실제로 검증함**: 위 수정 후 제 세션 환경에서도 `node_modules`가 사용자의 로컬 `npm install` 결과와 실시간으로 동기화된다는 걸 확인해(연결 폴더가 실시간 마운트), `npm install`(eslint-plugin-react-hooks 등 3개 패키지 추가 설치 성공) → **`npm run lint` 재실행 결과 0 errors, 0 warnings**로 클린 확인. `components` 프로젝트는 `--listTests`로 설정 자체는 정상 인식됨을 확인했으나, 실제 렌더링까지는 이 환경의 첫 실행 속도 제약(수십 초 이상 걸리는 jest-expo 콜드스타트)으로 끝까지 지켜보지 못함 — **사용자 로컬에서 `npm test` 재실행으로 AsyncStorage 에러가 실제로 해소됐는지 최종 확인 필요**.

### 26. `AsyncStorage is null` 재현 — `setupFiles` mock만으로는 부족했던 진짜 원인 발견·수정

- 25번 항목의 `setupFiles` mock 추가 후에도 사용자가 재실행한 결과 **똑같은 에러가 그대로 재현**됨. 스택 트레이스를 다시 보니 `at requireActual (tests/components/lab.test.tsx:26:23)` — 문제는 jest 설정이 아니라 **테스트 파일 자체**에 있었다.
- **진짜 원인**: `tests/components/lab.test.tsx`의 `jest.mock("../../src/lib/draws", () => { const actual = jest.requireActual("../../src/lib/draws"); ... })`에서 바렐(`src/lib/draws/index.ts`) 전체를 `requireActual`로 불러오고 있었다. 그런데 이 바렐은 `drawCache.ts`도 함께 export하고, `drawCache.ts`는 `storage.ts`를 거쳐 실제 AsyncStorage 네이티브 모듈을 불러온다. **`jest.requireActual`은 정의상 "진짜 모듈"을 강제로 가져오는 API라, `setupFiles`에 등록해 둔 AsyncStorage mock을 포함해 어떤 jest mock 처리도 전부 우회한다** — 그래서 mock을 제대로 추가했는데도 정확히 같은 자리에서 계속 죽었던 것.
- **수정**: 순수 계산 함수(`computeNumberFrequencies` 등)가 필요한 건 `src/lib/draws/drawStats.ts`뿐이고 이 파일은 AsyncStorage와 전혀 무관하므로, 바렐 전체가 아니라 `drawStats.ts` 서브모듈만 콕 집어 `requireActual`하도록 좁혔다. `storage` 쪽은 이 화면이 쓰는 `getGenerationHistory`/`getTickets` 두 함수만 필요해서 `requireActual` 없이 완전히 mock으로만 채우도록 단순화(원래도 두 함수 다 override하고 있어서 `actual`을 섞을 이유가 애초에 없었음).
- **검증**: 제 세션에서 `npx tsc --noEmit` 클린, 수정한 테스트 파일만 `npx eslint tests/components/lab.test.tsx`로 클린 확인(전체 `npm run lint`는 이 시점 세션이 느려져 끝까지 못 돌림 — 파일 자체는 문제없음). **실제 테스트 실행(`npm test`)은 이번에도 사용자 로컬에서 최종 확인 필요.**

### 27. `AsyncStorage is null` 3차 재현 — 이번엔 `setupFiles` 자체가 애초에 틀린 접근이었음을 발견

- 26번 수정 후에도 사용자가 재실행하니 **또 같은 에러**가 남(스택은 이번엔 `tests/components/lab.test.tsx` requireActual 경로가 아니라 `src/components/SettingsSheet.tsx → storage/preferences.ts → storage/storage.ts` 경로 — 즉 26번 수정(requireActual 범위 축소)은 제대로 효과가 있었고, 남은 문제는 `jest.config.js`에 25번에서 넣은 `setupFiles: ["@react-native-async-storage/.../async-storage-mock"]` 자체였다).
- **진짜 원인**: `node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock.js`를 직접 열어 확인해보니, 이 파일은 `jest.mock(...)`을 스스로 호출하는 "자동 등록 스크립트"가 아니라 **그냥 목 구현체 객체 하나를 `module.exports`로 내보낼 뿐**이었다. `setupFiles`에 이 경로를 넣으면 Jest가 그 파일을 그냥 한 번 `require`만 하고 반환값은 아무 데도 등록하지 않은 채 버린다 — 즉 25번의 수정은 처음부터 실질적인 효과가 없는 조치였다(제가 공식 문서의 안내 문구만 보고 정확한 사용법을 검증 없이 적용한 게 원인).
- **수정**: `setupFiles` 대신 `moduleNameMapper`로 `@react-native-async-storage/async-storage` 패키지 경로 자체를 이 목 파일로 치환하도록 변경(`jest.config.js`의 `components` 프로젝트). 이러면 `storage.ts`든 `SettingsSheet.tsx`든 이 패키지를 어디서 얼마나 깊이 import하든 전부 일괄적으로 목으로 대체된다 — 특정 파일 하나만 손보는 게 아니라 근본적으로 막는 방식이라 더 이상 같은 에러가 다른 경로에서 재발할 여지가 없다.
- **참고로 미리 안내**: `SettingsSheet.tsx`는 생년월일 저장에 쓰는 `expo-secure-store`도 (preferences.ts를 통해) 불러온다. 이건 AsyncStorage와 달리 Expo 공식 SDK 모듈(Expo Modules API 기반)이라 `jest-expo` 프리셋이 자동으로 처리해줄 가능성이 높다고 보지만, 실행으로 직접 확인은 못 했다 — 혹시 이번 수정 후 `AsyncStorage` 대신 `SecureStore` 관련 에러가 새로 뜨면(다른 에러로 바뀌는 것 자체는 AsyncStorage 문제는 해결됐다는 뜻이니) 그 내용 그대로 알려주면 같은 방식(moduleNameMapper)으로 처리하면 된다.
- **한계**: 이번에도 제 세션 환경(연결 폴더의 파일 I/O가 느림)에서는 `jest-expo` 콜드스타트가 45초 넘게 걸려 실행 결과를 끝까지 못 봤다. 다만 이번엔 목 파일의 실제 소스 코드를 직접 열어 문제의 정확한 메커니즘(자동 등록 아님)을 확인하고 고친 것이라, 이전 두 번의 "추측 기반 수정"보다 확신도가 높다.
- **최종 확인 완료**: 사용자가 로컬에서 재실행 — **`unit`/`components` 두 프로젝트, 16개 스위트, 102개 테스트 전부 통과**(`components  tests/components/lab.test.tsx` 포함). `expo-secure-store` 관련 에러는 뜨지 않아, jest-expo가 이를 자동으로 처리해준다는 예상이 맞았다. `tests/components/lab.test.tsx`가 실제로 통과했다는 건 `loadLabData()` dead-code 버그(21번 항목)가 화면 렌더링 기준으로도 정말 고쳐졌다는 걸 테스트로 증명한 것 — 이 회귀 테스트가 원래 의도했던 목적을 정확히 달성했다.

### 28. `git commit` + 첫 실기기 빌드(`eas build --platform android --profile preview`) 진행

- 그동안(오늘 이전 세션들 포함) 쌓여있던 미커밋 변경사항 77개 파일을 이번에 처음으로 커밋함(`29bfcb3`). 이 과정에서 `.gitignore`에 `android/`·`ios/`를 추가하기로 결정 — 이 프로젝트는 네이티브 코드를 직접 손댄 적이 없고 전부 `app.json`의 plugins로만 관리해왔으므로, `android/`를 커밋된 채로 두면 `app.json` 변경(아이콘, 신규 네이티브 모듈)이 EAS Build에 반영되지 않는 문제가 재발할 수 있다고 판단(실제로 이번에 `android/`가 커밋 안 된 채로 남아있던 것 자체가 "EAS가 android.package를 무시하고 낡은 네이티브 코드를 그대로 씀" 경고의 원인이었음). 앞으로는 `npx expo prebuild --clean`으로 매번 새로 생성하는 걸 표준 워크플로로 삼는다.
- `npx expo prebuild --platform android --clean` → `eas build --platform android --profile preview` 진행. prebuild 중 `expo-system-ui`가 없어 `userInterfaceStyle` 관련 일부 네이티브 설정(앱이 켜진 채로 시스템 다크모드를 실시간 토글하는 경우, 네이티브 스플래시의 초기 배경색)이 적용되지 않는다는 경고 발생 — 앱 내부 다크모드 자체(JS 레벨 `useColorScheme` 기반)는 이 경고와 무관하게 정상 동작하므로 긴급하지 않다고 판단, 사용자 확인 후 `package.json`에 `expo-system-ui` `~6.0.9`(SDK 54 호환 버전)만 미리 추가해두고 실제 반영은 다음 prebuild 사이클로 미룸(빌드 하나 더 새로 돌릴 정도로 급한 사안은 아님).
- **참고**: `eas build`는 실행 시점에 프로젝트 파일을 압축해 EAS 서버로 업로드하고 그 스냅샷으로 클라우드에서 독립적으로 빌드하므로, 빌드가 진행되는 동안 로컬 파일을 수정해도 이미 큐에 올라간 빌드에는 전혀 영향이 없다(사용자가 빌드 중 이 부분을 확인 요청해 안내함).

## 2026-08-05

### 29. 실기기 홈 화면 — 앱 아이콘 로고가 가운데 정렬 안 됨

- **증상**: 실기기 홈 화면에서 지도/TMAP/네이버지도 등 옆 앱들과 비교했을 때 금손로또 아이콘만 로고(집+G)가 아이콘 도형 정 가운데가 아니라 위쪽으로 쏠려 보임(사용자가 스크린샷에 빨간 박스+화살표로 표시해 전달).
- **원인**: `assets/adaptive-icon.png`(안드로이드 어댑티브 아이콘 전경, 21번 항목에서 생성)를 픽셀 단위로 분석한 결과 로고 도형의 실제 중심이 캔버스(1024×1024) 중심에서 x −17px, **y −84.5px**(세로로 캔버스 높이의 약 8% 만큼 위로) 벗어나 있었음. 21번 항목 로그에는 "안전영역 62%로 축소·중앙 배치"라고 적었지만 실제로는 중앙 배치가 정확하지 않았던 것 — 안드로이드 런처가 이 전경 이미지에 원형/스퀴클 마스크를 씌우면서 로고 아래쪽에 여백이 많이 남아 위로 쏠려 보이는 현상으로 이어짐. (참고로 `assets/icon.png`(iOS/기본 아이콘, 흰 카드+그림자 포함)는 같은 방식으로 측정했을 때 오차가 y −15.5px 수준으로 미미해 건드리지 않음.)
- **수정**: `assets/adaptive-icon.png`의 로고 픽셀 바운딩박스를 계산해 그 중심이 캔버스 정중앙(512, 512)에 오도록 이미지 전체를 (dx −17, dy +84) 만큼 평행이동 후 재저장. 로고 크기·비율은 그대로 유지(단순 재배치만 수행), 안드로이드 세이프존(66%) 안에 여유 있게 들어가는 것도 재확인.
- **한계/다음 단계**: 28번 항목에서 정한 워크플로대로 `android/`는 gitignore 대상이라 다음 `npx expo prebuild --platform android --clean` → `eas build` 시 이번에 고친 `assets/adaptive-icon.png`가 자동 반영된다. 이 세션에서는 새 빌드를 새로 돌리지 않았으므로 **실기기 홈 화면에서 실제로 가운데 정렬됐는지는 다음 빌드 후 확인 필요**.

### 30. 홈 화면 퀵메뉴 4개 — 텍스트 버튼 → 아이콘+제목 카드로 교체

- **배경**: 기존 퀵메뉴 4개(제외하고 만들기/행운번호/45면체 주사위/QR 당첨확인)가 텍스트만 있는 버튼이었고, 특히 "제외하고 만들기"는 좁은 4분할 폭에서 "제외하고\n만들기"로 두 줄 줄바꿈되는 문제가 있었음. 사용자가 아이콘+제목 형태의 참고 이미지를 제공하며 이걸로 대체 + QR 항목 테두리 색을 나머지 3개와 동일하게 맞춰달라고 요청.
- **아이콘 에셋**: 사용자가 첨부한 4개 아이콘 시트 이미지(1688×932)에서 각 아이콘 카드를 좌표 기반으로 크롭(그림자 포함 정사각형 380×380 → 256×256 리사이즈)해 `assets/quick-menu-icons/{exclusion,lucky,dice,qr}.png` 4개 파일로 저장.
- **수정**: `app/(tabs)/index.tsx`
  - `QuickMenuItem`에 `icon` prop 추가, 아이콘 이미지(40×40, `resizeMode="contain"`) + 라벨을 세로로 배치.
  - 라벨 문구를 참고 이미지와 동일하게 축약: "제외하고 만들기"→"제외해보기", "QR 당첨확인"(공백 있음)→"QR당첨확인"(공백 없음). 나머지 2개("행운번호", "45면체 주사위")는 원래도 짧아 그대로 유지.
  - 줄바꿈 방지: `numberOfLines={1}` + `adjustsFontSizeToFit`(`minimumFontScale={0.75}`)로 어떤 화면 폭에서도 안전망 확보. 실제로는 폰트 11px 기준 가장 긴 라벨("45면체 주사위")도 폭 66px로, 360~430pt 폭 화면의 컬럼 여유폭(72~90px) 안에 넉넉히 들어가 축소 없이도 한 줄 유지됨을 별도 스크립트로 검증(Noto Sans CJK 폰트 실측).
  - QR 항목만 다르게 주던 인디고 테두리(`quickMenuItemQr`, 20번 항목에서 도입)를 제거 — 이제 4개 항목 모두 동일한 `colors.border` 테두리 사용.
- **검증**: `npx tsc --noEmit` 클린. 실제 폰트 폭 실측 + 목업 렌더로 4개 카드가 한 줄 라벨로 깨지지 않고 나란히 표시되는 것 확인(RN 시뮬레이터/실기기 렌더링 자체는 이 세션에서 직접 못 봄 — 다음 빌드/로컬 실행 시 최종 확인 권장).

### 31. 홈 화면 히어로 카드 — 어두운 카드+플랫 블루 버튼 → 밝은 카드+남색 그라디언트 버튼으로 교체

- **배경**: 사용자가 디자인 참고 스크린샷을 첨부하며 "이번 주 운명을 만들어보세요 / AI로 번호 만들기" 히어로 영역을 이 디자인으로 교체 요청. 참고 이미지를 픽셀 단위로 분석한 결과, 기존과 달리 카드 배경 자체는 다크 네이비가 아니라 페이지와 같은 밝은 톤이고(제목/부제가 어두운 텍스트로 카드 위에 직접 표시), 버튼만 남색 계열 세로 그라디언트 필(위 `#496DA3` 밝은 슬레이트블루 → 아래 `#20385E` 짙은 네이비)로 되어 있었음 — 참고 이미지에서 좌우 여러 지점을 샘플링해 상단/하단 색을 확정.
- **패키지 추가**: `expo-linear-gradient` `~15.0.8`(이 프로젝트 Expo SDK 54의 `bundledNativeModules.json` 기준 정확한 호환 버전) 설치. 이번엔 제 세션 환경에서도 `npm install`이 정상 완료됨(과거 세션들에서 반복되던 `ENOTEMPTY` 문제가 이번엔 발생하지 않음).
- **수정**: `app/(tabs)/index.tsx`
  - `heroCard`: `backgroundColor: "#0F172A"` 고정 → `colors.surface` + `colors.border` 테두리(다른 카드들과 동일한 스타일 언어로 통일).
  - `heroSubtitle`/`heroTitle`: 흰색/회색(다크 카드용) → `colors.textMuted`/`colors.textPrimary`(라이트 카드용 다크 텍스트). 다크모드에서도 자동으로 올바른 대비를 유지하도록 하드코딩 대신 테마 토큰 사용.
  - `heroSkeletonSubtitle`의 다크 전용 스켈레톤 색(`#293045`) 오버라이드 제거 — 이제 카드가 밝아졌으니 `SkeletonBlock` 기본값(`colors.skeleton`)이 그대로 맞음.
  - CTA 버튼을 `Pressable` + `LinearGradient`(세로, `#496DA3`→`#20385E`) 조합으로 교체, `borderRadius` 12→16으로 살짝 더 둥글게. 안드로이드 리플이 둥근 모서리 밖으로 새지 않도록 `Pressable`에 `borderRadius/overflow:hidden` 래퍼 스타일 추가.
- **검증**: `npx tsc --noEmit`, `npx eslint "app/(tabs)/index.tsx"` 둘 다 클린. PIL로 동일 좌표/색상값을 재현한 목업 이미지를 만들어 참고 디자인과 육안 대조 확인. **실제 기기/시뮬레이터 렌더링(그라디언트 방향, 다크모드 대비 등)은 다음 로컬 실행 시 최종 확인 필요.**
- **추가 반영**: 같은 참고 이미지에 있던 우측 상단 "설정" 링크도 텍스트만 있던 기존 버튼에 톱니바퀴 아이콘을 추가(`Ionicons name="settings-sharp"`, 16px, `colors.textMuted` — 텍스트와 동일 색으로 통일). `settingsLink`를 `flexDirection: row` + `gap: 4`로 바꿔 텍스트 오른쪽에 아이콘이 나란히 오도록 배치, 텍스트 크기도 12→13으로 살짝 키움.

### 32. 문의처 이메일 변경 + 프로젝트 무관 문자열 점검

- `app/privacy.tsx`의 `CONTACT_EMAIL` 상수와 `legal/privacy-policy.html`의 문의처 문구를 `park.changhyun@cashwalk.io` → `jasanups@gmail.com`으로 변경.
- 사용자가 "이 프로젝트는 nudge/cashwalk와 무관하다"고 확인 요청 — 코드/문서/git 히스토리/git config/커밋 작성자 전체를 대소문자 무관 검색했으나 해당 단어 없음(커밋 작성자는 `chpark924 <m2pch@naver.com>`). 조치할 항목 없음으로 확인 종료.

### 33. 홈 화면 — 왼쪽 스와이프 시 "번호 만들기" 탭으로 이동

- **요청**: 홈 화면에서 옆으로 스와이프하면 바로 오른쪽 탭("번호 만들기")으로 넘어가도록 추가.
- **수정**: `app/(tabs)/index.tsx` — 기존 세로 `ScrollView`를 감싸는 `View`에 `PanResponder`(RN 코어 API, 별도 패키지 설치 불필요)를 붙임. `onMoveShouldSetPanResponderCapture`가 가로 이동량이 세로 이동량의 2배를 넘고 24px 이상일 때만 제스처를 가져가도록 해서, "내가 자주 선택한 번호" 카드 등 기존 세로 스크롤이나 버튼 탭(움직임 없음)과 충돌하지 않게 함. `onPanResponderRelease`에서 왼쪽으로 60px 이상 스와이프(가로가 세로의 1.5배 이상)면 `router.push("/generate")`로 "번호 만들기" 탭 전환.
- **경로 확인**: `app/(tabs)/generate.tsx`(탭 자체 허브 화면)와 `app/generate/*.tsx`(개별 생성 화면 스택)가 이름은 겹치지만, `app/generate/`에는 `index.tsx`가 없어 `"/generate"` 단독 경로는 항상 탭의 허브 화면으로만 해석됨을 확인.
- **검증**: `npx tsc --noEmit`, `npx eslint "app/(tabs)/index.tsx"` 둘 다 클린. **실제 기기에서 스와이프 민감도(오작동/둔감 여부)는 로컬 실행 시 확인 필요** — 필요하면 임계값(24px/60px) 조정 가능.
- **민감도 조정(사용자 요청 — "가장 일반적으로 많이 쓰이는 값")**: 자체 정한 임의 값(24px/60px, dy 대비 1.5~2배) 대신, RN 스와이프 제스처 구현에서 흔히 쓰이는 관용값으로 교체.
  - 제스처 캡처 시작: 최소 이동량 10px(안드로이드 기본 touch slop ≈8~10dp와 유사) + 가로 이동이 세로 이동보다 크면(배수 없이 1:1) 캡처 — 과도하게 뚜렷한 대각선만 인정하던 기존 조건(dy의 2배)보다 자연스러운 사선 스와이프도 인식.
  - 스와이프 인정 기준: 이동거리(dx) 50px **또는** 손을 뗄 때 속도(vx) 0.3 중 하나만 충족해도 인정(OR 조건) — 천천히 길게 미는 동작과 짧고 빠른 플릭 동작을 모두 자연스럽게 처리. 두 수치(50px, 0.3)는 RN 커뮤니티의 PanResponder 스와이프 예제에서 가장 널리 쓰이는 기본값.

### 34. AI 조합 탐색 — 100만 회 탐색 시 진행률이 "100%에서 멈춘 것처럼" 보이는 문제 수정

- **증상**: 사용자가 100만 회 정밀 탐색 시 로딩 화면이 100%를 찍은 뒤에도 몇 초간 그대로 멈춰 있어, 실제로는 연산 중인데도 앱이 뻗은 것처럼 느껴짐.
- **원인 분석**: `src/lib/lottery/generator.ts`의 `generateAiSearchGames`를 보니, `onProgress` 콜백이 **후보 생성 루프(while)에서만** 호출되고 있었다. 그런데 그 뒤에 이어지는 점수 계산(`pool.map(scoreCandidate)`, pool이 최대 100만 개)과 정렬(`scored.sort`)이 **진행률 보고도, 이벤트 루프 양보(yield)도 전혀 없이 한 번에 동기 실행**되고 있었다. 즉 후보 생성이 100%를 찍은 뒤에도 점수 계산+정렬이라는, 어쩌면 생성 자체보다 더 무거운 단계(저장번호 대비 중복도 검사 등 후보당 비용이 결코 가볍지 않음)가 조용히 실행되고 있었던 것 — "멈춘 것처럼 보인다"가 아니라 실제로 화면 갱신 자체가 이 구간 동안 전혀 일어나지 않고 있었다(순수 동기 블로킹).
- **수정**: 화면이 멈춘 것처럼 보이지 않게 처리하는, 다른 앱들이 흔히 쓰는 패턴 두 가지를 함께 적용.
  1. **진행률이 항상 실제 작업과 함께 움직이게(핵심 수정)**: 점수 계산 단계도 후보 생성과 동일하게 배치+`setTimeout(0)` 양보 방식으로 바꾸고(`AiSearchPhase = "GENERATING" | "SCORING" | "FINALIZING"` 3단계 도입), 세 단계를 합쳐 0~100 사이에서 **단조 증가**하는 하나의 percent로 보고하도록 `onProgress` 시그니처를 `(percent, phase)`로 변경(기존엔 `(completedIterations, requestedIterations)`를 받아 화면이 임의의 퍼센트 임계값 60/85로 라벨을 추측했음 — 이제는 실제 계산 단계와 라벨이 항상 일치). 배분은 생성 70% · 점수계산 25% · 정렬/최종선정 5%(기기마다 실제 비율은 다를 수 있으나 "항상 뭔가 움직인다"는 목적에 맞춘 근사치). **실제로 결과가 준비된 시점에만 100%를 보고**하도록 해서 "100%인데 안 끝남" 자체가 구조적으로 불가능하게 만듦.
  2. **오래 걸리는 로딩에서 지루하지 않게(UX 다듬기)**: `app/generate/ai-search.tsx` 로딩 화면에 얇은 진행률 막대 바를 추가(퍼센트 숫자 옆에 시각적으로도 계속 움직임이 보이게), 95% 이상일 때는 안내 문구를 "무작위 알고리즘을 통해..."에서 "거의 다 됐어요, 조금만 기다려주세요."로 바꿔 막바지 구간에서도 안심시킴. 기존 통통 튀는 공 애니메이션(`LottoBallLoader`)은 `useNativeDriver: true`라 JS 스레드가 바쁜 순간에도 끊기지 않는 것도 재확인.
- **검증**: `npx tsc --noEmit`, `npx eslint .` 클린. 임시 테스트(실행 후 삭제)로 `searchCount: 50000` 기준 실제 콜백 시퀀스를 로그로 확인 — 102회 호출 모두 percent가 단조증가, 마지막 호출이 정확히 `{percent: 100, phase: "FINALIZING"}`로 끝나는 것 확인. `tests/generator.test.ts` 기존 테스트 7개 모두 회귀 없이 통과. **실제 기기에서 100만 회 기준 체감 속도/버벅임 여부는 로컬 실행 시 최종 확인 필요** — 배치 크기(현재 1000)를 조정하면 "진행률 갱신 빈도"와 "양보(yield) 오버헤드로 인한 총 소요시간 증가"를 서로 트레이드오프할 수 있음.

### 35. 당첨번호 조회 반복 실패 — 근본 원인 발견(동행복권 사이트 개편) + GitHub 정적 JSON 파이프라인 도입

- **배경**: "당첨번호를 불러오지 못했다"는 문제가 5·9·15·16번 항목 등 여러 세션에 걸쳐 반복 보고됐고, 그때마다 헤더 추가·재시도 로직·에러 구분 같은 대증 처방만 했다. 이번엔 사용자가 실기기 스크린샷 4장(로또 연구소 "불러오기 실패", 제외하고 생성 "일부 회차 조회 실패", 그리고 결정적으로 **"동행복권에서 확인" 버튼을 눌렀더니 `dhlottery.co.kr/erro...`가 `ERROR 404`를 띄우는 화면**)과 ChatGPT로 미리 구상해둔 "GitHub에 JSON으로 캐싱" 대안을 함께 제시하며, 이 대안이 타당한지 검토하고 최적안을 적용해달라고 요청.
- **근본 원인 발견(이번 세션에서 새로 확인, 이전 세션들과 다른 점)**: 이 프로젝트 개발 환경엔 평소 실인터넷이 없지만, 이번엔 `WebSearch`/`WebFetch` 도구로 실제 웹 상태를 조사할 수 있었다.
  - `www.dhlottery.co.kr`의 여러 경로(`/`, `/common.do?method=main`, `/common.do?method=getLottoNumber&...`, `/gameResult.do?...`)를 전부 `WebFetch`로 시도했으나 **전부 빈 응답**(연결 자체가 안 되는 것으로 보임).
  - 반면 `donghanglottery.com`(신규 도메인)은 정상적으로 열렸고, 메인 페이지에 최근 회차(1201~1205회, 2025.12~2026.01)가 실제 날짜·형식과 일치하는 데이터로 서버 렌더링돼 있는 것을 확인.
  - 웹 검색으로 "동행복권 인터넷 서비스 개편 안내"(공식 공지), "동행복권 사이트 리뉴얼됬네"(커뮤니티 글)를 찾아, 사이트 자체가 `dhlottery.co.kr` → `donghanglottery.com`으로 개편·이전된 정황을 재확인.
  - **결론**: 이 앱이 지금껏 하드코딩해온 `dhlottery.co.kr` JSON 엔드포인트(`common.do?method=getLottoNumber`)와 결과 페이지(`gameResult.do?method=byWin`)가 **이미 죽었을 가능성이 높다** — 헤더/재시도 문제가 아니라 애초에 존재하지 않는 주소를 계속 두드리고 있었던 것. 사용자가 스크린샷으로 보여준 "동행복권에서 확인" 버튼의 404가 바로 이 증거.
  - **한계(중요)**: `donghanglottery.com/lt645/result`, `/lt645/stats` 등 실제 회차별 데이터 API는 자바스크립트로 렌더링되는 SPA라 `WebFetch`(JS 미실행)로는 내용을 못 봤고, 이 세션에선 Claude in Chrome 브라우저 도구도 연결돼 있지 않아 실제 렌더링 결과를 확인하지 못했다. 즉 **새 사이트의 정확한 신규 API 엔드포인트는 이번에도 확정하지 못했다** — "구 도메인이 죽었다"는 것과 "정확한 신규 API가 무엇인지"는 별개의 확인 수준이다.
- **채택한 방안 — GitHub 정적 JSON 파이프라인 (사용자가 제시한 방향이 타당하다고 판단해 그대로 채택, 이 코드베이스에 맞게 세부 구현)**:
  - `scripts/update-lotto-data.mjs`(신규, 순수 Node, 의존성 0개): 기존 `drawApi.ts`와 동일한 엔드포인트/검증 로직으로 당첨번호를 받아와 `data/lotto-draws.json`에 병합 저장. 연속 3회 실패 시 "엔드포인트 자체가 죽은 것으로 보인다"고 판단해 조기 중단하고 비정상 종료 코드를 반환(=GitHub Actions 로그에서 바로 티가 남).
  - `.github/workflows/update-lotto-data.yml`(신규): 매주 토요일 21:30 KST(추첨 20:35 KST 이후) 자동 실행 + `workflow_dispatch`로 수동 실행도 가능. 변경 있을 때만 커밋·푸시(`GITHUB_TOKEN` 기본 권한만 사용, 별도 시크릿 불필요 → 완전 무료).
  - `src/lib/draws/githubDataSource.ts`(신규): 앱이 `raw.githubusercontent.com`에서 `data/lotto-draws.json`을 받아오는 계층. **절대 throw하지 않고**, 미설정/오프라인/형식 오류 등 무엇이든 `null`을 반환해 호출부가 항상 기존 방식으로 안전하게 폴백하게 설계. 항목별로 `drawApi.ts`의 `isPlausibleWinningDraw`와 동일한 원칙으로 구조 검증(범위·중복·보너스번호 유효성) 후에만 신뢰 — GitHub JSON도 결국 스크래핑 결과물이라 무조건 신뢰하지 않는다.
  - `src/lib/draws/drawCache.ts` 수정: `getCachedMap()`이 (설정돼 있다면) 6시간에 한 번만 GitHub 소스와 동기화해 로컬 캐시를 채운다. 이미 있는 회차는 절대 직접 조회로 다시 묻지 않으므로, 원래 문제였던 "기기가 매번 불안정한 소스에 직접 의존"하는 구조 자체가 개선된다. GitHub 소스가 실패해도 이후 로직(기존 `fetchWinningDrawWithStatus` 직접 호출)이 그대로 폴백으로 동작 — 이 계층 때문에 기능이 아예 죽는 일은 없다.
  - `src/lib/draws/drawApi.ts`의 `buildOfficialResultPageUrl`을 확인된 죽은 주소(`dhlottery.co.kr/gameResult.do`)에서 살아있는 신규 도메인(`donghanglottery.com/lt645/result?drwNo=`)으로 변경 — 정확한 쿼리 파라미터 지원 여부는 미확인이지만, 최소한 죽은 링크보다는 나음(사용자가 최소한 정상 사이트에는 도착).
  - `src/lib/qr/parseLottoQr.ts`의 QR 도메인 검증 정규식을 `dhlottery.co.kr` 단독에서 `dhlottery.co.kr` **또는** `donghanglottery.com` 둘 다 허용하도록 넓힘 — 사이트 개편 이후 발급된 실물 용지의 QR이 새 도메인을 가리킬 가능성에 대비. 이렇게 넓혀도 안전한 이유: 이 파서가 뽑아낸 번호는 항상 서버에서 그 회차의 공식 당첨번호를 다시 조회해 재계산하므로(문서화된 기존 설계), 도메인 검사를 완화해도 오탐(가짜 당첨 표시) 위험이 없다.
- **왜 이 방향이 "최적"이라고 판단했는지**: (1) 비용 0원 — GitHub Actions/raw content 모두 이 사용량에서 무료. (2) 정확성 — 사람이 매주 1회 실행 로그를 확인할 수 있는 지점이 생겨, 기기에서 조용히 실패하던 것보다 훨씬 빨리 이상을 발견할 수 있고, 데이터 자체는 여전히 동행복권 공식 소스에서만 가져온다(GitHub이 자체적으로 번호를 만들어내지 않음). (3) 기존 폴백 유지 — 완전히 새 구조로 갈아엎지 않고 기존 직접-조회 로직을 그대로 안전망으로 남겨, 회귀 위험을 최소화. 참고로 사용자가 첨부한 ChatGPT 제안(GitHub Actions로 완전 자동화, `stats.json`/`pairs.json`/`ai.json` 등 여러 파일 분리, SQLite 저장)은 방향은 동일하게 타당하다고 판단했지만, `stats.json` 등 파생 통계 파일은 이미 `drawStats.ts`가 기기에서 값싸게 즉시 계산하고 있어 별도 파일로 나눌 실익이 적고, SQLite도 기존 AsyncStorage 캐시(`drawCache.ts`)가 이미 같은 역할을 하고 있어 이 프로젝트 규모(연 52건 추가)에 굳이 도입할 필요가 없다고 판단해 채택하지 않음.
- **아직 사용자가 해야 하는 일(중요, 이 세션에서는 완료 불가능)**:
  1. `src/lib/draws/githubDataSource.ts`의 `GITHUB_OWNER`/`GITHUB_REPO`를 실제 값으로 채우기(현재 플레이스홀더 `"__SET_ME__"`라 이 데이터 소스는 지금 상태로는 완전히 비활성).
  2. 저장소를 GitHub에 푸시.
  3. `node scripts/update-lotto-data.mjs`를 실인터넷이 되는 로컬 환경에서 실행해 초기 데이터를 채우고 커밋(`data/README.md` 참고) — 만약 이 단계에서도 계속 network_error만 난다면, 위에서 밝힌 "구 도메인이 죽었다"는 추정이 맞다는 뜻이므로 새 API를 직접 찾아 스크립트를 교체해야 한다(브라우저 개발자도구 Network 탭에서 `donghanglottery.com/lt645/result` 진입 시 호출되는 XHR 확인 — 이 방법이 가장 확실함).
  4. GitHub Actions 수동 실행(`workflow_dispatch`)으로 파이프라인이 실제로 동작하는지 1회 확인.
- **검증**: `npx tsc --noEmit`, `npx eslint .` 전체 클린. 신규 테스트 `tests/drawCache.test.ts`(4개 — GitHub 미설정 시 기존 방식 그대로 동작/GitHub 캐시 적중 시 직접조회 생략/GitHub 실패 시 폴백/동기화 주기 내 재조회 안 함) + `tests/githubDataSource.test.ts`(미설정 시 fetch 자체를 시도 안 함) 전부 통과. 전체 `unit` 프로젝트 17개 스위트 107개 테스트 회귀 없이 통과. `scripts/update-lotto-data.mjs`는 이 샌드박스에서 직접 실행해 "연속 3회 실패 시 조기 중단 + 종료코드 1" 로직이 의도대로 동작하는 것까지는 확인(다만 이 환경 자체가 dhlottery.co.kr에 못 붙는 게 스크립트 버그 때문인지 진짜 사이트가 죽어서인지는 이 환경에서 최종 구분 불가 — 그래서 위 "사용자가 해야 하는 일" 3번이 필요).

### 36. ⚠️ 정정 — 35번 항목의 `donghanglottery.com` 판단은 오판이었음(한국 정부 법적 차단 사이트로 확인)

- **배경**: 35번 항목에서 GitHub JSON 파이프라인을 실제로 GitHub에 올리고 사용자가 실기기(한국 네트워크)에서 직접 검증에 들어감.
  1. `GITHUB_OWNER`/`GITHUB_REPO`를 `chpark924`/`ai-lotto-generator`로 채우고 GitHub에 푸시 성공.
  2. `node scripts/update-lotto-data.mjs`를 로컬(실인터넷)에서 실행 — **3회 연속 `network_error: JSON 파싱 실패(HTML 등 다른 응답이 온 것으로 보임)`로 실패, 0건 수집.** 즉 `dhlottery.co.kr` 엔드포인트는 완전히 죽은 게 아니라 **응답은 하지만 기대한 JSON이 아닌 다른 응답**을 준다 — 이건 35번 항목에서 "구 도메인이 완전히 죽었다"고 판단한 것과는 다른, 더 정확한 관찰.
  3. 35번 항목에서 `buildOfficialResultPageUrl`에 넣은 `donghanglottery.com/lt645/result`로 실기기에서 이동했더니 **`ERR_CONNECTION_RESET`**(PC 크롬)이 뜸.
  4. 이어서 모바일 브라우저로 직접 접속을 시도한 결과, **`HTTP 451 — 법적 사유로 이용 불가`** 오류 페이지가 표시됨. Cloudflare가 띄우는 이 차단 페이지는 한국 방송통신심의위원회(정부 기관) 명령에 따른 것이라고 명시하고 있었고, `lumendatabase.org` 링크로 차단 근거를 확인할 수 있게 되어 있었음(사용자가 스크린샷으로 전달).
- **원인 분석(제 실수)**: 35번 항목에서 `WebFetch`/`WebSearch`로 `donghanglottery.com`을 조사했을 때, 실제 회차와 일치하는 그럴듯한 로또 데이터가 렌더링된 페이지가 응답했고, "동행복권 사이트 개편" 류의 검색 결과도 함께 나와 이를 "동행복권의 공식 신규 도메인"이라고 결론 내렸다. **하지만 이 결론은 확정 근거(공식 발표문 원문 확인, 공식 SNS/앱스토어 링크 대조 등) 없이 정황만으로 내린 성급한 판단이었다.** `WebFetch`는 Anthropic 인프라(해외 네트워크로 추정)에서 요청을 보내므로, 한국 정부가 국내 ISP 단에서 거는 접속 차단(HTTP 451)의 영향을 받지 않아 마치 정상 사이트처럼 응답을 받을 수 있었던 것으로 보인다 — 이게 바로 오판을 만든 맹점이었다. 이런 종류의 지역 기반 법적 차단은 실제로 그 지역(한국) 네트워크에서 접속해보지 않으면 절대 알 수 없다.
- **위험성**: 이 오판을 기반으로 앱 코드 두 곳에 `donghanglottery.com`을 실제로 반영했었다.
  1. `src/lib/draws/drawApi.ts`의 `buildOfficialResultPageUrl` — 조회 실패 시 사용자에게 "동행복권에서 확인" 링크로 이 도메인을 노출.
  2. `src/lib/qr/parseLottoQr.ts`의 `KNOWN_WIN_QR_URL_PATTERN` — QR 스캔 시 이 도메인도 정상 동행복권 QR로 인식하도록 정규식을 넓힘(당첨 여부 자체는 항상 서버 재조회로 재계산하므로 QR 오인식이 가짜 당첨 결과를 만들지는 않지만, "이 도메인이 신뢰할 수 있는 동행복권 소유"라는 잘못된 전제를 코드에 심은 것 자체가 문제).
  만약 사용자가 실기기 테스트 없이 이 상태로 배포했다면, 앱 사용자들이 정부가 차단한(=불법/사기 가능성이 있는) 사이트로 유도됐을 수 있었다 — **품질 문제를 넘어 사용자 안전 문제였다.**
- **수정(전부 원복)**:
  1. `src/lib/draws/drawApi.ts`: `buildOfficialResultPageUrl`을 원래의 `https://www.dhlottery.co.kr/gameResult.do?method=byWin&drwNo=${drawNumber}`로 되돌리고, 이번 정정 내용을 설명하는 doc comment로 교체.
  2. `src/lib/qr/parseLottoQr.ts`: `KNOWN_WIN_QR_URL_PATTERN`을 원래의 `/dhlottery\.co\.kr\/qr\.do\?/` 단독으로 되돌리고, 같은 이유를 설명하는 주석 추가 — "서버 재검증이 있으니 도메인 검사를 완화해도 안전하다"는 논리 자체가 틀린 게 아니라, **검증 안 된(심지어 정부가 차단한) 도메인을 애초에 신뢰 후보에 올린 것 자체가 잘못**이었다는 점을 명확히 함.
  3. `src/lib/draws/githubDataSource.ts`, `scripts/update-lotto-data.mjs`, `data/README.md`, `README.md`의 관련 docstring/설명을 모두 "donghanglottery.com이 신규 공식 도메인"이라는 전제에서 "그 도메인은 정부 차단 사이트로 확인됨, 절대 신뢰하지 않음 + 정확한 원인/대체 주소는 여전히 미확정"으로 정정.
- **현재 상태(정직하게 요약)**:
  - GitHub 정적 JSON 파이프라인 구조(35번 항목) 자체는 여전히 유효하고 그대로 유지 — 이 구조는 어떤 데이터 소스를 쓰든 도움이 된다.
  - 다만 그 파이프라인이 의존하는 `dhlottery.co.kr` 스크래핑이 지금 실제로 작동하지 않는다(3회 연속 network_error 확인됨) — **아직 미해결**.
  - `donghanglottery.com`은 확실히 배제됐다 — 이건 명확한 진전.
  - **다음 단계(추측 대신 검증 우선으로 진행할 것)**: (a) `dhlottery.co.kr`을 실제 브라우저로 직접 열어 사이트 자체 생사와 결과 조회 페이지 동작 여부 확인, (b) 정상 동작하면 개발자도구 Network 탭에서 실제 API 요청을 캡처해 스크립트 교체, (c) 사이트가 다른 주소로 완전히 옮겨간 것 같다면 검색 결과/커뮤니티 글만으로 판단하지 말고 동행복권 공식 고객센터(1588-6450) 또는 공식 앱스토어 앱 내 안내로 새 주소를 직접 대조 확인한 뒤에만 코드에 반영 — 이번 사고의 교훈을 반영해, 앞으로는 "그럴듯해 보인다"만으로 도메인을 신뢰 후보에 올리지 않는다.
  - **사용자 확인 요청**: `donghanglottery.com`에 개인정보(로그인, 결제정보 등)를 입력한 적이 없는지 다시 한번 확인 권장(사용자 확인 완료 — 입력한 적 없음).
- **검증**: 원복한 두 파일(`drawApi.ts`, `parseLottoQr.ts`) 관련 기존 테스트 회귀 여부는 재확인 필요(이 세션 마지막에 `tsc`/`eslint`/`jest` 재실행 예정).

### 37. 진짜 원인 발견 및 해결 — dhlottery.co.kr은 살아있었다, 사이트 개편으로 URL 구조만 바뀐 것

- **배경**: 36번 항목에서 `donghanglottery.com`을 완전히 배제한 뒤에도 근본 문제(`dhlottery.co.kr`의 옛 JSON 엔드포인트가 network_error만 반환하는 것)는 미해결로 남아있었다. 사용자가 "빨리 수정해서 정상작동되도록 해"라고 요청 — 이번엔 추측이 아니라 사용자의 실제 기기로 직접 검증하는 방법을 택했다.
- **방법**: 이 세션에서 처음으로 Claude in Chrome 브라우저 도구가 연결되어 있었고, `list_connected_browsers`로 확인한 결과 사용자의 실제 로컬 PC(Windows, `isLocal: true`)와 연결된 것임을 확인했다. 즉 이 브라우저로 접속하면 **한국 네트워크에서 실제로 보이는 화면을 그대로** 볼 수 있다 — 36번 항목에서 오판을 만들었던 "해외 네트워크라 한국 내 차단/개편이 반영 안 됨" 문제 자체가 원천적으로 없는 방법이다.
  1. `https://www.dhlottery.co.kr/`에 접속 → 정상적으로 로드됨. 실제 최신 회차(1235회, 2026.08.01), 실제 사업자 정보(주소, 대표자, 사업자등록번호, 고객센터 1588-6450)까지 전부 진짜 동행복권 공식 정보와 일치 — **이 도메인은 여전히 100% 살아있는 진짜 공식 사이트임을 확인.**
  2. 기존에 쓰던 `gameResult.do?method=byWin&drwNo=1235`로 이동 → **`ERROR 404`** 확인(사용자가 이전에 스크린샷으로 보여줬던 것과 동일한 증상 재현). 즉 도메인이 아니라 **이 특정 경로 자체가 폐지**된 것.
  3. 사이트 상단 메뉴("추첨식 복권" → "로또6/45" → "추첨결과")를 실제로 클릭해 들어가 보니 새 경로 `https://www.dhlottery.co.kr/lt645/result`가 정상적으로 로또 6/45 당첨결과를 보여줌 — 최신 회차(1234, 1235회) 번호가 `selectMainInfo.do`(홈 화면이 자동으로 호출하는 API)의 데이터와 정확히 일치.
  4. 이 페이지에는 회차 범위를 지정해 조회하는 UI(`srchStrLtEpsd`~`srchEndLtEpsd` select 두 개 + "조회하기" 버튼)가 있었다. `devtools` 네트워크 탭 대신 `read_network_requests`로 실제 호출을 캡처해, 진짜 새 API를 특정했다: `GET https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do?srchStrLtEpsd={시작회차}&srchEndLtEpsd={끝회차}`.
  5. 이 API를 직접 `fetch()`로 호출해 검증: 1~3회차 응답이 실제 역사적 기록과 정확히 일치(1회차: 2002-12-07, 번호 10 23 29 33 37 40, 보너스 16 — 이 프로젝트 코드에 이미 있던 `FIRST_DRAW_DATE` 상수와도 일치). **1~1235회 전체를 단 한 번의 요청으로 조회해도 정상 응답**함을 확인(회차 범위 제한 없음, 응답 크기 약 746KB). 존재하지 않거나 아직 추첨 전인 회차를 요청하면 에러 없이 빈 배열을 반환하는 것도 확인(1236~1240회 요청 시 `{"data":{"list":[]}}`).
  6. 결과 상세 페이지도 `?ltEpsd={회차}` 쿼리로 특정 회차를 바로 열 수 있음을 확인(`/lt645/result?ltEpsd=1000` → 999/1000/1001회 표시).
- **결론**: 여러 세션에 걸쳐 반복됐던 "당첨번호를 불러오지 못했다" 문제의 진짜 원인은 도메인이 바뀐 것도, 사이트가 죽은 것도 아니라 **2026년에 dhlottery.co.kr이 프론트엔드를 전면 개편하며 옛 API/페이지 경로(`common.do`, `gameResult.do`)를 전부 폐지했기 때문**이었다. 새 경로로 바꾸기만 하면 되는 문제였다.
- **수정**:
  1. `src/lib/draws/drawApi.ts`: `ENDPOINT`를 `lt645/selectPstLt645Info.do`로 교체, 응답 구조(`{resultCode, resultMessage, data: {list: [...]}}`, 필드명 `ltEpsd`/`tm1WnNo`~`tm6WnNo`/`bnsWnNo`/`ltRflYmd`(YYYYMMDD, 하이픈 변환 필요)/`rnk1WnNope`/`rnk1WnAmt`/`rlvtEpsdSumNtslAmt`)에 맞게 `RawDrawResponse`/`RawDrawListItem` 타입과 `isPlausibleWinningDraw`, `fetchWinningDrawWithStatus`를 전면 수정. 빈 배열 응답을 `not_announced`로 자연스럽게 처리(기존엔 `returnValue !== "success"`로 판단했던 것을 대체). `buildOfficialResultPageUrl`도 `lt645/result?ltEpsd=` 형식으로 교체.
  2. `scripts/update-lotto-data.mjs`: 동일한 새 엔드포인트로 교체하면서, 새 API가 회차 범위를 한 번에 조회할 수 있다는 점을 활용해 **기존의 회차 하나씩 순회하는 루프(요청 간 200ms 지연 포함)를 완전히 제거**하고 필요한 범위 전체를 단 한 번의 요청으로 가져오도록 재작성 — 초기 백필(1~1235회)도 이제 요청 1번이면 끝난다. 실패 시 진단을 쉽게 하려고 응답 본문 앞부분을 콘솔에 출력하도록 추가(이전엔 "network_error"라고만 뜨고 실제 응답 내용을 볼 방법이 없어 원인 파악이 오래 걸렸던 것을 반영한 개선).
  3. `data/README.md`, `README.md`의 관련 설명을 전부 새 엔드포인트/새 상황에 맞게 갱신.
- **불확실성 해소(사용자 로컬 실행으로 확인 완료)**: 새 API가 브라우저 세션(쿠키 등) 없이 서버 환경에서 콜드하게 호출해도 정상 동작하는지가 남은 우려였는데, 사용자가 실제로 `node scripts/update-lotto-data.mjs`를 로컬 PC에서 실행한 결과 **1~1238회 범위를 단 한 번의 요청으로 전부 성공적으로 확보**했다(1235건, 0건 실패). 즉 봇 차단 트레이서가 있어도 이 API 자체는 세션 없는 요청을 막지 않는 것으로 확인됐다 — GitHub Actions(별도 서버 환경)에서도 동일하게 동작할 가능성이 높다고 판단.
- **검증**: `npx tsc --noEmit`, `npx eslint .`, `npx jest --selectProjects unit` 전체 클린(17개 스위트, 115개 테스트 통과). `tests/drawApi.test.ts`를 새 응답 구조에 맞게 전면 재작성(URL 형식 검증 테스트 추가 포함). `data/lotto-draws.json`이 실제로 1235건(1~1235회) 전체로 채워진 것을 `git diff`로 확인 후 커밋·푸시 완료(`59cff7e`).
- **남은 확인 사항**: GitHub Actions 워크플로(`workflow_dispatch` 수동 실행 또는 다음 토요일 정기 실행)가 실제로 자동 커밋까지 성공하는지는 아직 미확인 — 로컬 Node 실행은 성공했지만 GitHub Actions 러너 환경(IP 대역이 다름)에서도 똑같이 통과하는지는 별개 확인이 필요하다.

### 38. 로또 연구소 — 당첨번호 합계 고/저 추세 그래프 추가

- **요청**: 로또 연구소 탭 하단에, 당첨번호 6개의 합계가 이론적 중간값(138) 대비 높았는지/낮았는지를 그래프로 보고 싶다는 요청. 최소합(1+2+3+4+5+6=21)과 최대합(40+41+42+43+44+45=255)의 정중앙이 138이라는 점을 사용자가 이미 정확히 알고 있었음(코드로도 확인: `(21+255)/2 = 138`).
- **구현**:
  1. `src/lib/lottery/pattern.ts`에 이미 있던 `getNumberSum`을 재사용해 `src/lib/draws/drawStats.ts`에 `SUM_MIDPOINT`(138) 상수와 `computeSumTrend(draws)` 함수를 추가. 이 함수는 회차별 합계를 계산해 중간값 이상(`isHigh: true`)/미만으로 분류하고, 항상 회차 오름차순(과거→최신)으로 정렬해 반환한다 — `drawCache.ts`의 `getRecentDraws`가 최신순으로 주는 것과 반대라, 그래프에서 왼쪽이 과거·오른쪽이 최신이 되도록 여기서 뒤집었다.
  2. `src/components/SumTrendChart.tsx`(신규): 순수 `View`만으로 그리는 막대그래프. **외부 차트 라이브러리를 새로 추가하지 않았다** — `package.json`을 확인해보니 이 프로젝트엔 애초에 차트 라이브러리가 없었고, 과거 세션들에서 새 패키지 설치 시 `ENOTEMPTY` 등 문제가 반복됐던 것과 비용 최소화 원칙을 감안하면 이 정도 시각화(막대 + 중앙선)는 라이브러리 없이 충분히 구현 가능하다고 판단. 중앙 가로선(138)을 기준으로 위로 솟은 빨간 막대(고합)·아래로 내려간 파란 막대(저합)를 그리고, 회차 수가 많아도 가로 스크롤로 전체를 볼 수 있게 함. 막대 높이는 절대 편차가 아니라 화면에 표시된 데이터 안에서의 최대 편차 대비 정규화해서, 실제 로또 합계가 138 근처에 몰려있어도(이론적 편차 범위 ±117보다 훨씬 좁음) 그래프가 눈에 띄게 그려지도록 함.
  3. `app/(tabs)/lab.tsx`: 기존 카드들과 같은 스타일로 하단(마지막 `DisclaimerCard` 바로 위)에 새 카드 추가. 다른 통계 카드들과 동일하게 `RECENT_DRAW_SAMPLE_SIZE`(52회, 약 1년치)를 그대로 사용.
  4. `src/constants/messages.ts`에 `SUM_TREND_NOTICE` 추가: "로또 추첨은 매회 독립 사건이라 과거 고/저 흐름이 다음 회차 확률에 영향을 주지 않는다"는 안내문(기획서 23장 원칙 — `ALL_COMBINATIONS_EQUAL_NOTICE`와 같은 취지). 이 그래프가 마치 다음 회차를 예측하는 도구처럼 오인되지 않도록, 그래프 바로 아래 `DisclaimerCard`로 항상 표시.
- **검증**: `npx tsc --noEmit`, `npx eslint .` 클린. `tests/drawStats.test.ts`에 `computeSumTrend` 테스트 4개 추가(이론적 중간값 계산 검증, 고/저 경계값(합계 정확히 138은 고로 분류) 검증, 입력 순서와 무관하게 항상 회차 오름차순 반환하는지, 빈 배열 처리) — `unit` 프로젝트 17개 스위트 119개 테스트 전부 통과. `components` 프로젝트(`tests/components/lab.test.tsx`, 화면 실제 렌더링 테스트)도 회귀 없이 통과했으나, 이 세션 환경에서 jest-expo 콜드스타트가 느려 기본 5초 타임아웃을 넘겨 `--testTimeout=60000`으로 재실행해서 확인함(과거 세션들에서도 반복된 이 샌드박스 고유의 느린 I/O 문제이지 이번 변경의 버그가 아님 — 실제 테스트 자체는 4.7초 만에 통과함). **사용자 로컬 환경에서는 기본 타임아웃으로도 정상 통과할 것으로 예상**(27번 항목에서 실제로 그랬음).

### 39. 로또 연구소 그래프 — 사용자 피드백 반영, 막대그래프 → 선그래프(애니메이션 포함)로 전면 교체

- **요청**: 38번 항목의 막대그래프(중앙선 기준 위/아래로 뻗는 형태)에 대해, "가장 일반적으로 타 앱에서 보여주는 형태"로 바꾸고, 화면에 나타날 때 왼쪽→오른쪽으로 그려지는 애니메이션(선그래프 기준) 또는 아래→위로 솟아오르는 애니메이션(막대그래프 기준)을 넣어서 "앱이 잘 만들어졌다는 인상"을 주고 싶다는 요청.
- **판단**: 추세(시간에 따른 변화)를 보여주는 데이터라 주식·건강 앱 등에서 가장 흔히 쓰이는 형태는 막대그래프가 아니라 **선그래프**라고 판단해, 기존 막대그래프를 선그래프로 전면 교체했다. 애니메이션은 사용자가 언급한 "왼쪽에서 오른쪽으로 그려지는 효과"를 구현했다.
- **구현**:
  1. **`react-native-svg` 신규 설치**(`~15.12.1`, `expo/bundledNativeModules.json`에서 확인한 Expo SDK 54 정확한 호환 버전 — `npx expo install` 없이 직접 버전을 맞춰 `npm install`). 순수 `View`만으로는 매끄러운 대각선을 그리기 어렵고(회전시킨 사각형을 이어붙이면 각도에 따라 픽셀이 지저분해짐), 이 라이브러리는 Expo Go에 기본 포함돼 있어 네이티브 재빌드 없이 바로 미리보기가 가능해 안전하다고 판단(과거 세션들에서 겪은 `expo-linear-gradient` 설치 시행착오와 달리 이번엔 SDK가 정확한 버전을 명시해두고 있어 버전 불일치 위험이 낮음).
  2. `src/components/SumTrendChart.tsx`를 전면 재작성: `Svg`의 `Path`로 회차별 합계를 잇는 선을 그리고, 각 점은 138 이상이면 빨강·미만이면 파랑 원으로 표시. 중간값(138) 위치에 점선 기준선을 긋고 라벨을 표시. 가로 스크롤로 전체 회차(최근 52회)를 볼 수 있는 건 기존과 동일.
  3. **리빌(reveal) 애니메이션**: `Animated.Value`로 그래프를 감싼 `View`의 너비를 0→전체 너비로 900ms 동안 애니메이션하고 `overflow: hidden`으로 잘라내는 방식("와이프" 기법)을 사용했다. SVG Path의 실제 길이(`strokeDashoffset`)를 이용한 "펜으로 그리는" 애니메이션도 검토했으나, 이 방식은 `getTotalLength()`가 `react-native-svg` 버전/플랫폼별로 동작이 갈릴 수 있어(이 세션에선 실제 기기 렌더링을 눈으로 확인할 방법이 없어 검증이 어려움) 더 예측 가능하고 검증하기 쉬운 와이프 방식을 택했다. 화면 전환 등으로 애니메이션 도중 컴포넌트가 사라지면 `useEffect` cleanup에서 애니메이션을 멈추도록 처리(안 그러면 언마운트된 컴포넌트에 계속 업데이트를 시도해 경고가 남을 수 있음).
- **한계(정직하게 밝힘)**: 이 세션 환경에는 실제 기기/시뮬레이터가 없어 **애니메이션이 실제로 매끄럽게 동작하는지는 코드 리뷰로만 확인했고 눈으로 직접 보지는 못했다.** 로직상으로는 `Animated.timing`이 표준적인 패턴이라 정상 동작할 것으로 예상하지만, 사용자가 Expo Go로 직접 열어서 확인 후 어색하거나 속도가 안 맞으면 알려주면 바로 조정 가능하다(현재 900ms).
- **검증**: `npx tsc --noEmit`, `npx eslint .` 클린. `unit`/`components` 두 프로젝트 전부 회귀 없이 통과(`computeSumTrend`는 38번 항목에서 이미 테스트됨 — 이번 변경은 순수 시각화 레이어라 로직 테스트는 그대로 유효). `components` 테스트에서 애니메이션 타이머로 인한 "act(...) 밖 업데이트" 콘솔 경고가 뜨지만 테스트 자체는 통과함(애니메이션이 있는 컴포넌트를 RNTL로 테스트할 때 흔히 나타나는 무해한 경고 — 이 프로젝트의 `LottoBallLoader`도 비슷한 패턴).

### 40. AI 조합 탐색 — "당첨숫자 총합 평균값 UP/DOWN 선택" 옵션 추가 (실제 생성 결과에 반영)

- **요청**: `ai-search.tsx`의 탐색강도·연속번호설정·인기번호 회피·내 저장번호 회피 다음 자리에 "당첨숫자 총합 평균값 UP/DOWN 선택" 옵션을 추가해달라는 요청. 38번 항목의 그래프가 쓰는 고정된 이론적 중간값(138)이 아니라, **최근 52주 실제 당첨번호 합계의 평균값**을 기준으로 UP(그보다 높게)/DOWN(그보다 낮게) 조합을 우선 탐색하도록 하는 개념. 사용자가 특히 강조한 요구사항: 장식용 UI가 아니라 **실제로 선택에 따라 생성되는 번호가 달라져야 한다**.
- **구현 방향 판단**: `src/lib/lottery/types.ts`의 `GenerationRequest`에 이미 `minSum?`/`maxSum?` 필드가 있었고, `src/lib/lottery/scoring.ts`의 `conditionMatchScore()`가 이미 이 값을 소프트 페널티(합계가 범위를 벗어난 만큼 점수 차감)로 반영하도록 구현돼 있었다 — 다만 지금까지 어떤 화면에서도 이 필드를 실제로 채워서 쓰지 않고 있었을 뿐이다. 그래서 `types.ts`/`scoring.ts`/`generator.ts`는 전혀 건드리지 않고, `app/generate/ai-search.tsx`에서 최근 52주 평균 합계를 계산해 이 필드에 채워 넣는 것만으로 기존 검증된 인프라를 그대로 재사용했다.
- **구현**:
  1. `src/constants/lottery.ts`: `SUM_AVERAGE_PREFERENCE_OPTIONS`(상관없음/UP/DOWN 3개 버튼 라벨) 추가.
  2. `src/constants/messages.ts`: `SUM_AVERAGE_PREFERENCE_NOTICE` 추가 — "최근 52주 실제 평균값 기준"이라는 점과, 이 역시 서술적 통계일 뿐 다음 회차 확률과 무관하다는 안내를 함께 명시(기획서 23장 원칙 유지).
  3. `app/generate/ai-search.tsx`: 화면 진입 시 `getRecentDrawsSafe(52)` + `computeCombinationPatternStats(draws).averageSum`으로 실제 평균 합계를 계산해 옵션 설명 문구 옆에 함께 표시(예: "최근 52주 평균 합계: 137.4") — 근거 숫자를 눈으로 보여줘야 신뢰할 수 있다고 판단. `handleGenerate()`에서는 이 값을 그대로 믿지 않고, 화면 진입 직후 곧바로 "탐색 시작"을 눌러 아직 로딩이 안 끝났을 가능성까지 감안해 필요 시 한 번 더 실제로 가져온 뒤(`resolveRecentAverageSum`), UP이면 `minSum`에 DOWN이면 `maxSum`에 그 값을 넣어 `GenerationRequest`를 구성한다. 데이터를 끝내 못 가져온 경우엔 조용히 무시하지 않고 "이번 탐색에는 적용되지 않았다"고 `Alert`로 알림(데이터 정확성 원칙 — 안 될 때 안 된다고 말하는 것도 정확성의 일부).
- **검증**: `npx tsc --noEmit`, `npx eslint .` 클린. `unit`/`components` 두 프로젝트 전체 18개 스위트 회귀 없이 통과. **"실제로 작동하는지"를 말로만 확인하지 않고**, `tests/generator.test.ts`에 새 테스트 3개를 추가해 직접 검증: `minSum: 138`을 넘겼을 때 실제 생성된 5게임의 합계 평균이 138을 확실히 웃도는지, `maxSum: 138`을 넘겼을 때 138을 확실히 밑도는지, 그리고 UP/DOWN을 각각 적용한 두 결과의 합계 평균이 서로 반대 방향으로 뚜렷하게 갈라지는지까지 통계적으로 확인 — 3개 전부 통과(`npx jest generator.test.ts` 개별 재실행으로도 재확인). 즉 이 옵션은 장식이 아니라 실제로 결과에 반영된다는 것을 테스트로 못박아 뒀다.

### 41. 디바이스/AOS 버전별 해상도 최적화 정적 점검 — 할 일 목록 (아직 미착수)

- **배경**: "디바이스/AOS 버전별 해상도 최적화도 지원이 잘되는지 점검해달라"는 요청으로 코드/설정 기준 정적 점검 진행(실기기 테스트는 아님).
- **양호하게 확인된 부분**: 레이아웃 전반이 flex/flexWrap 기반이라 해상도별 분기 없이도 자연 대응, `SafeAreaProvider`/`useSafeAreaInsets`가 루트와 주요 화면(BottomActionBar, result.tsx, preferences.tsx, privacy.tsx, SettingsSheet.tsx)에 적용됨, 아이콘 1024x1024 원본 + Expo 자동 밀도별 생성, `android/` 네이티브 폴더가 gitignore 처리되고 `compileSdk`/`targetSdk`/`minSdk`가 설치된 Expo 버전에서 자동 산출(현재 Expo SDK 54 → compileSdk/targetSdk 36 = Android 16, minSdk 24 = Android 7.0+).
- **미착수 개선 항목(우선순위순, 이 세션 태스크 목록에도 등록함)**:
  1. Android 16(API 36)부터 edge-to-edge가 강제 적용됨(끌 수 없음) — safe-area insets는 이미 적용돼 있으나, 실제 Android 15/16 기기·에뮬레이터에서 상태바/하단 네비바에 콘텐츠가 가려지는 화면이 없는지 육안 확인 필요.
  2. `src/components/SettingsSheet.tsx:23`의 `Dimensions.get("window")`이 모듈 로드 시 1회만 읽힘 — 폴더블/멀티윈도우 대응을 위해 `useWindowDimensions()` 훅으로 교체 권장.
  3. `src/components/NumberGrid.tsx`의 45개 공 그리드가 고정 `CELL_SIZE=44`px — 좁은 화면은 flexWrap으로 문제없으나 태블릿(`ios.supportsTablet: true`)에서 빈 공간이 많이 남음. 화면 폭 기반 셀 크기 조정 검토.
  4. 로또 공 안 숫자, HOT/추천 배지 등 고정 크기 작은 요소에 `maxFontSizeMultiplier` 제한이 없어 시스템 큰 글씨 설정 시 텍스트가 잘릴 가능성.
  5. `app.json`의 최상위 `splash` 키(이미지 없이 배경색만)가 Expo에서 deprecated 처리됨 — 현재는 하위호환 자동 매핑으로 정상 동작하지만, 다음 SDK 업그레이드 전에 `expo-splash-screen` 플러그인 방식으로 이전 필요.
  6. (하우스키핑, 낮은 우선순위) 프로젝트 루트의 `android_backup_before_clean/` 폴더가 이전 세션 잔여물로 보임 — gitignore돼있어 무해하나 정리 권장.
- **한계**: 정적 코드/설정 점검이며, 다양한 실제 기기·해상도에서의 시각적 확인(특히 1번 edge-to-edge 건)은 아직 수행하지 못했다.

### 42. 앱 구현 최적화 전문 점검 — 핫패스 성능 버그 발견 및 수정(`overlapCount`)

- **배경**: "앱 구현 최적화가 잘되었는지 전문적으로 점검해달라"는 요청으로 렌더링 성능, 리스트 렌더링 방식, 무거운 연산의 스레드 블로킹 여부, 비동기 스토리지 패턴, 애니메이션 driver 설정, 에셋 용량, eslint 훅 규칙 등을 코드 레벨로 점검.
- **양호하게 확인된 부분**:
  - `generator.ts`의 AI 조합 탐색(최대 100만 회)이 이미 배치+`setTimeout(0)` 양보 방식으로 구현돼 있어 UI 스레드를 막지 않음(34번 항목에서 이미 다듬어짐).
  - `random.ts`의 CSPRNG가 바이트 풀링으로 네이티브 브릿지 왕복을 최소화(2번 항목에서 이미 다듬어짐), rejection sampling으로 균등분포도 보장.
  - 애니메이션은 전부 `useNativeDriver: true`이고, 레이아웃 속성(width) 때문에 못 쓰는 `SumTrendChart` 한 곳만 예외 처리 + 근거 주석 있음.
  - `eslint-plugin-react-hooks`의 `exhaustive-deps` 규칙이 활성화돼 있고 `npx eslint .` 결과 경고 0건 — 의존성 배열 누락 문제 없음.
  - 리스트는 전부 `ScrollView`+`.map()`인데, 가장 큰 리스트가 번호 그리드 45개·게임 결과 최대 10개 수준이라 `FlatList` 가상화가 필요한 규모가 아님(과도한 엔지니어링을 피한 합리적 선택으로 판단, 별도 조치 불필요).
  - `storage.ts`의 AsyncStorage 래퍼도 이 앱 데이터 규모(저장 티켓 수십~수백 개 수준)에서 문제될 게 없음.
- **발견 및 수정한 실제 성능 버그**: `src/lib/lottery/similarity.ts`의 `overlapCount(a, b)`가 매 호출마다 `new Set(b)`를 새로 생성한 뒤 조회하고 있었다. 이 함수는 `scoring.ts`의 `personalNoveltyScore`(→ `scoreCandidate`, AI 조합 탐색에서 후보 1개당 1회 호출, 최대 100만 회)와 `destiny.ts`의 `buildPopularityFeatures`(운명의 신, 최대 2000회)에서 **저장번호 목록(최대 수십 개) 전체와 비교할 때마다** 반복 호출된다. 즉 최악의 경우 100만 후보 × 저장번호 20개 = 2천만 번 Set이 새로 만들어지고 있었다는 뜻.
  - `a`/`b`는 항상 로또 번호 6개짜리 고정 크기 배열이라, N=6처럼 아주 작은 고정 크기에서는 Set 생성(해시테이블 할당)의 고정 비용이 6번의 순차 비교보다 오히려 크다고 판단해, 단순 배열 `includes()` 비교로 교체했다.
  - **실측 검증(추측 대신 벤치마크)**: Node에서 동일 워크로드(후보 100만 개 × 저장번호 20개 비교)로 직접 벤치마크한 결과, Set 방식 약 4.6초 → 배열 비교 방식 약 1.15초로 **약 4배 단축**을 확인(체크섬 동일 — 결과값 자체는 완전히 동일함도 함께 확인).
  - `overlapCount`는 `scoring.ts`/`destiny.ts`/`generator.ts`/`src/lib/ai/explain.ts` 전부에서 공유하는 함수라, 이 한 곳만 고쳐도 네 경로 전부에 동일하게 이득이 적용된다.
- **검증**: `npx tsc --noEmit`, `npx eslint .` 클린. `tests/similarity.test.ts`가 블랙박스 동작 테스트(입출력만 검증, 내부 구현 방식에 의존하지 않음)라 별도 수정 없이 그대로 통과. 전체 `unit`/`components` 18개 스위트 123개 테스트 회귀 없이 통과 — 특히 40번 항목에서 추가한 UP/DOWN 통계 검증 테스트도 그대로 통과해, 순위/점수 계산 결과 자체는 변하지 않고 속도만 개선됐음을 재확인.
- **점검했으나 즉시 조치하지 않은 낮은 우선순위 항목(태스크 목록에 등록)**: `assets/tab-icon-home.png`가 859×859px·204KB로 실제 표시 크기(~24~28dp) 대비 과도하게 커서 번들 용량 낭비 — 128~256px 수준으로 리사이즈 권장(시각 품질 영향 없음, 급하지 않음).

## 2026-08-06

### 43. AI 조합 탐색 — "고빈도 당첨번호 상위권 포함" / "장기 미출현번호 포함" 토글 2종 추가

- **요청**: `ai-search.tsx`의 "연속번호 설정" 바로 아래, "인기번호 회피" 바로 위 자리(사용자가 스크린샷에 직접 화살표로 표시)에 토글 2개 추가.
  1. **고빈도 당첨번호 상위권 포함**: 토글 + 설명("최근 1년간 고빈도 당첨번호 1~10위가 최소 한 개 이상 포함됩니다") + 실제 생성 로직 반영.
  2. **장기 미출현번호 포함**: 토글만(설명 없음) + 실제 생성 로직 반영, 기준은 기본 12주·100만 회 부스터 탐색일 때만 8주.
  두 토글 모두 40번 항목(UP/DOWN)과 동일한 원칙 — 장식용 UI 금지, 실제 생성되는 번호가 달라져야 함.
- **구현 방향 판단**: 기존 `generatePureRandom(excludedNumbers, requiredNumbers)`는 "필수번호는 항상 전부 포함"만 지원했는데, 이번 요구는 "이 집합 중 최소 1개만 포함"이라 성격이 다르다(특정 번호 고정이 아니라 매번 그 집합 안에서 무작위로 달라져야 함). 그래서 `requiredNumbers`를 재활용하지 않고 `GenerationRequest`에 `mustIncludeOneOfSets?: number[][]`를 신설 — 두 토글이 각자 독립적인 세트를 넣고, 둘 다 켜지면 두 세트 모두 동시에 최소 1개씩 강제되도록 일반화했다(향후 비슷한 "최소 1개 포함" 조건이 추가돼도 재사용 가능).
- **구현**:
  1. `src/lib/draws/drawStats.ts`: 순수 함수 `getTopFrequentNumbers(draws, topN)`(표본 내 출현 빈도 상위 N, 동률은 번호 오름차순 안정 정렬), `getNumbersAbsentInLastDraws(draws)`(표본 안에서 한 번도 안 나온 번호) 추가. 둘 다 당첨 데이터 접근은 하지 않고 순수 계산만 담당(서버 없음 원칙 유지 — 실제 fetch는 호출부 책임).
  2. `src/lib/lottery/types.ts`: `GenerationRequest.mustIncludeOneOfSets?: number[][]` 추가.
  3. `src/lib/lottery/validators.ts`: 세트 안 번호도 1~45 범위 검증에 포함.
  4. `src/lib/lottery/generator.ts`: `generatePureRandom`이 세 번째 인자로 `mustIncludeOneOfSets`를 받아, required가 이미 만족 못 시키는 세트마다 후보(제외번호·이미 강제된 번호 제외) 중 `pickOne`로 하나를 뽑아 강제 포함시키도록 확장(세트가 전부 제외번호와 겹치면 조용히 건너뜀 — 생성 실패로 이어지지 않음). `generateUniqueBasicGames`/`generateAiSearchGames` 양쪽 호출부에 그대로 연결(기본값 `[]`라 기존 동작·기존 테스트는 전부 그대로 유지됨).
  5. `src/constants/lottery.ts`: `BOOSTER_SEARCH_COUNT = 1000000`을 명명된 상수로 분리(기존엔 `SEARCH_STRENGTH_OPTIONS`에 리터럴로만 존재) — "100만 회일 때만 8주 기준" 조건이 이 값과 정확히 일치해야 하므로, 매직 넘버 중복을 피하고 두 곳이 항상 같은 값을 참조하도록 함.
  6. `src/constants/messages.ts`: `HIGH_FREQUENCY_TOP10_NOTICE` 추가.
  7. `app/generate/ai-search.tsx`: 토글 2개를 요청 위치(연속번호 설정 아래, 인기번호 회피 위)에 배치. `handleGenerate()` 직전 `resolveMustIncludeOneOfSets()`에서 토글이 켜진 것만 골라 `getRecentDrawsSafe`로 실제 당첨 데이터를 가져오고(고빈도는 52주=1년 표본, 미출현은 12주 또는 8주), 위 두 순수 함수로 실제 번호 집합을 만들어 `request.mustIncludeOneOfSets`에 채운다. 데이터를 못 가져오면(네트워크 실패 등) 40번 항목과 동일하게 그 조건만 조용히 건너뛰고 `Alert`로 "이번 탐색에는 적용되지 않았다"고 안내(생성 자체를 막지 않음). 고빈도 토글의 설명 문구는 "인기번호 회피"와 동일하게 토글이 켜져 있을 때만 노출(꺼진 상태에서 화면이 번잡해지지 않도록); 미출현 토글은 요청대로 설명을 아예 넣지 않음.
- **UI/UX 검토**: 두 토글 모두 기본값 OFF로 뒀다 — 기존 사용자의 기본 생성 결과 분포를 조용히 바꾸지 않기 위한 선택(반대로 "인기번호 회피"/"내 저장번호 회피"는 이미 켜진 상태가 검증된 UX라 그대로 유지). "인기번호 회피"(일반적인 번호 선택 편향 회피)와 "고빈도 당첨번호 포함"(실제 과거 출현 빈도가 높은 번호 포함)은 서로 다른 개념이라 동시에 켜도 논리적으로 충돌하지 않음(각각 다른 원천의 번호 집합을 다룸).
- **검증**: `npx tsc --noEmit` 클린, 손댄 파일 전부 `npx eslint` 클린. `tests/drawStats.test.ts`에 `getTopFrequentNumbers`/`getNumbersAbsentInLastDraws` 단위 테스트 5개, `tests/generator.test.ts`에 `mustIncludeOneOfSets` 동작 테스트(단일 세트 강제 포함/세트 2개 동시 강제/required가 이미 만족하는 경우/세트 전체가 제외번호와 겹치는 극단 케이스) 4개 + `generateAiSearchGames`에 실제 탐색 결과 5게임 전부가 조건을 만족하는지 확인하는 테스트 1개 추가. `unit` 프로젝트 17개 스위트 132개 테스트 전부 회귀 없이 통과.
- **알려진 한계**: 실기기에서의 시각 확인(토글 위치·설명 문구 줄바꿈 등)은 이번 세션에서 못 함 — 다음 실기기 테스트 때 함께 확인 필요.

### 44. AI 조합 탐색 — "끝수 스프레드 최적화" 내재화 (3만 회/10만 회 탐색 전용, UI 토글 없음)

- **요청**: 로또의 "끝수"(번호 1의 자리) 개념을 활용해, 3만 회/10만 회 탐색에서만 끝수가 고르게 퍼지도록 최적화를 적용해달라는 요청. 명시적으로 "외부에서 설정하는 게 아니라 내재화"라고 강조 — 즉 화면에 새 토글을 만들지 않고 해당 탐색 강도를 고를 때 자동으로 적용돼야 함. 결과 화면의 번호별 설명 문구에도 "끝수 최적화가 포함되어 있습니다."라고 표시.
- **활성 조건 설계**: "바로 생성"(searchCount=1)은 후보가 1개뿐이라 점수 기반 선별이 무의미하고, "100만 회 부스터 탐색"(searchCount=1,000,000)은 이미 검증된 가중치·성능 특성을 유지하기 위해 제외 — 3만 회/10만 회 탐색에서만 적용하기로 했다(사용자가 "3만, 10만회 탐색 시 적용"이라고 명시한 그대로). `src/lib/lottery/scoring.ts`에 `isLastDigitSpreadOptimizationActive(request)` 단일 판단 함수를 두고, 점수 가중치 배분과 결과 화면 설명 문구 노출 여부가 모두 이 함수 하나만 기준으로 삼도록 해서 두 곳이 어긋날 여지를 없앴다.
- **구현**:
  1. `src/lib/lottery/pattern.ts`의 기존 `getSameEndingMaxCount`(GameMetadata 계산에 이미 쓰이던 "동일 끝수 최대 개수" 지표)를 그대로 재사용해 `scoring.ts`에 `lastDigitSpreadScore(numbers)` 추가 — 동일 끝수가 많이 몰릴수록 감점(끝수 6종류 전부 다르면 100점, 하나로 다 몰리면 0점).
  2. `scoreCandidate()`가 `isLastDigitSpreadOptimizationActive(context.request)`가 true일 때만 이 점수를 계산해 `CandidateScore.lastDigitSpreadScore`(신규 optional 필드)에 채우고, 총점 가중치를 conditionMatch 0.35→0.30, userUniqueness 0.25→0.20로 각 0.05씩 덜어 새 항목에 0.1을 배정(비활성 시엔 기존 가중치 그대로 — 합은 항상 1.0 유지).
  3. `app/generate/result.tsx`: 결과 설명 생성 시 `isLastDigitSpreadOptimizationActive(lastRequest)`로 판단한 값을 `buildGameFeatures()`(`src/lib/ai/explain.ts`)에 새 인자로 전달 → `GameFeatures.lastDigitSpreadOptimized`. `explainGameLocally()`가 이 값이 true면 "끝수 최적화가 포함되어 있습니다." 문장을 설명 끝부분(면책 문구 바로 앞)에 추가.
- **UI 변경 없음(의도된 설계)**: `ai-search.tsx` 화면에는 새 토글이나 텍스트를 전혀 추가하지 않았다 — 요청대로 탐색 강도 선택만으로 자동 결정되는 "내재화된" 동작이기 때문.
- **검증**: `npx tsc --noEmit`, `npx eslint .` 클린. `tests/scoring.test.ts`에 `isLastDigitSpreadOptimizationActive` 활성 조건 테스트 2개 + `scoreCandidate`가 조건별로 `lastDigitSpreadScore`를 채우는지/끝수가 고르게 퍼진 조합이 몰린 조합보다 실제로 더 높은 점수를 받는지 검증하는 테스트 2개(구간(섹션) 분포를 동일하게 맞춰 diversityScore 변수를 통제한 뒤 끝수 효과만 분리해서 확인 — 처음엔 섹션 분포가 다른 예시를 써서 실패했었고, 원인 파악 후 통제된 예시로 교체해 통과시킴) 추가. `tests/generator.test.ts`에 `generateAiSearchGames` end-to-end 테스트 2개(3만 회 결과엔 `lastDigitSpreadScore`가 있고 바로 생성 결과엔 없음) 추가. `tests/explain.test.ts` 신규 — 설명 문구 노출/비노출 3개 테스트. `unit` 프로젝트 18개 스위트 141개 테스트 전부 회귀 없이 통과.
- **알려진 한계**: 43번 항목과 동일하게 실기기 시각 확인(설명 문구 길이·줄바꿈)은 미수행.

### 45. 결과 카드 — "전문 분석 배지" 4종 추가 (몬테카를로 / EV 최적화 / 휠링 / 사카이 분석 패턴)

- **요청**: 결과 화면에 나오는 각 조합이 실제로 어떤 방식/조건으로 만들어졌는지를 배지 형태로 짧게 보여줘서 전문성·신뢰도를 높여달라는 요청. 처음엔 "커버링 설계(covering design)"까지 포함해 4개 용어가 제시됐으나, 실제 로직(게임 간 4개 이상 중복만 배제하는 소프트한 휴리스틱)이 조합론적 t-디자인 보장을 전혀 하지 않는다는 점을 짚어 사용자와 확인 후 **커버링 설계는 제외**하기로 결정. 대신 "사카이 분석"(사용자가 추가로 요청)을 웹 검색으로 조사 — 일본 로또 명인 후나츠 사카이(ふなつ さかい)가 소개한 것으로 알려진 방법으로, 최근 26주(약 6개월) 표본에서 출현 3~4회(평균권)인 번호 + 직전 회차 번호("이월수") 조합을 쓰는 실제 통계 기법임을 확인하고 반영했다.
- **정확성 판단(장식용 문구 금지 원칙 적용)**: 4개 배지 모두 "실제로 그런 조건에서 생성됐거나 실제로 그런 통계적 속성을 가진 경우"에만 뜨도록, 판정 함수 하나씩을 실제 로직/데이터에 직접 연결했다(장식용 라벨 아님).
  - **몬테카를로 탐색**: AI 조합 탐색은 무작위 후보를 대량 생성→점수 평가→상위 채택하는 방식이라(`generator.ts`), 반복 횟수가 1보다 큰 3만/10만/100만 회 탐색에서 정확한 서술. "바로 생성"(반복 1회)은 반복 표본 자체가 없어 제외.
  - **EV 최적화**: "인기번호 회피"가 켜져 있으면(scoring.ts의 userUniquenessScore) 실제로 흔한 번호를 피한다 — 당첨 확률은 그대로지만 당첨 시 상금을 나눌 가능성이 낮아져 기대값이 오르는 방향이라는 점에서 정확한 매칭.
  - **휠링 방식 분산**: AI 조합 탐색이 여러 게임을 함께 만들 때만(`generateAiSearchGames`) 서로 4개 이상 겹치는 조합을 배제하며 채택하는 기존 로직을 그대로 서술. 정식 휠링 시스템의 수학적 보장은 없다는 걸 분명히 하기 위해 문구도 "분산"까지만("휠링 시스템"이라고 단정하지 않음), 게임 1개일 땐 의미가 없어 제외.
  - **사카이 분석 패턴**: 생성된 조합에 (a) 최근 26주 평균권(3~4회 출현) 번호와 (b) 직전 회차 당첨번호가 각각 최소 1개씩 실제로 포함돼 있는지를 그대로 계산해서 판정 — 생성 방식과 무관하게 결과 번호 자체의 통계적 속성이라 모드 제한 없이 적용.
- **구현**:
  1. `src/lib/draws/drawStats.ts`: `getSakaiAverageFrequencyNumbers(draws, band=[3,4])` 추가(6/45 기준 26주 표본 이론적 평균 출현 횟수 6*26/45≈3.47회를 3~4회 구간이 감싼다는 근거를 주석에 명시).
  2. `src/lib/lottery/resultBadges.ts` 신규 — `ResultBadge` 타입과 4개 판정 함수(`getMonteCarloBadge`/`getEvOptimizationBadge`/`getWheelingBadge`/`getSakaiPatternBadge`) + 전부 모아주는 `computeResultBadges()`. 순수 함수라 draws/네트워크에 직접 접근하지 않고 이미 계산된 값만 받는다(기존 아키텍처와 동일한 패턴).
  3. `app/generate/result.tsx`: 결과 설명을 만드는 기존 `useEffect`에 `getRecentDrawsSafe(26)` 호출(`loadSakaiAnalysisInputs`)을 추가해 사카이 분석 입력값을 함께 계산하고, 게임별로 `computeResultBadges()`를 호출해 `badgesByGameId` state에 저장 후 `GeneratedGameCard`에 전달.
  4. `src/components/GeneratedGameCard.tsx`: `badges` prop 추가, 기존 메타 칩(홀짝/합계/연속번호, 슬레이트 톤)과 시각적으로 구분되도록 보라색 톤(`tints.purple`)의 별도 칩 행으로 렌더링 — 헤더 텍스트 없이 색상만으로 "일반 정보 대비 전문 분석"을 구분해 UI를 번잡하게 만들지 않았다. 배지가 없으면(빈 배열/undefined) 아무것도 렌더링하지 않는다.
- **검증**: `npx tsc --noEmit`, `npx eslint .` 클린. `tests/resultBadges.test.ts` 신규(4개 판정 함수 + `computeResultBadges` 조합 — 총 10개), `tests/drawStats.test.ts`에 `getSakaiAverageFrequencyNumbers` 테스트 3개 추가. `unit` 프로젝트 19개 스위트 155개 테스트 전부 통과. `components` 프로젝트에서 `lab.test.tsx` 타임아웃이 발생했으나, 이번에 수정한 파일을 전혀 참조하지 않는 무관한 화면이라 이 세션 환경(jest-expo 콜드스타트가 느림, 과거에도 기록된 전례) 이슈로 판단 — 회귀 아님.
- **알려진 한계**: 사카이 분석의 "26주/3~4회" 기준과 "직전 회차 이월수" 정의는 일본 로또6(6/43)용 원 기법을 한국 로또 6/45에 맞춰 재해석한 근사치이며, 원저자가 명시적으로 검증한 공식 수치는 아니다(다만 이론적 평균 계산으로 타당성은 확인함). 실기기 시각 확인(배지 줄바꿈, 4개 전부 뜰 때 카드 높이)은 미수행.

### 46. 종합 재점검 — 파일 무결성 / 최적화 / UX 편의성 점검 및 수정

- **요청**: 이번 세션(43~45번)에서 추가한 내용을 대상으로 파일이 잘린 곳은 없는지, 최적화·오류·편의성·UX에 문제가 없는지 종합 재점검.
- **파일 무결성**: 세션에서 건드린 19개 파일 전부 UTF-8 유효성·EOF 개행·라인 수를 직접 확인 — 잘리거나 깨진 파일 없음. (`git diff` 출력에서 `최`(최신순) 한 글자가 `���`로 보이는 순간이 있었으나, 실제 파일을 바이트 단위로 재확인한 결과 정상적인 UTF-8이었고 도구 출력 렌더링 과정에서만 생긴 일시적 현상으로 확인 — 오탐.)
- **이전 리뷰(19번 항목) 미해결 Critical 3건 재확인**: `generate.tsx`의 "100만 개 후보" 문구, `tickets.tsx`의 삭제 확인 다이얼로그, `result.tsx`의 재생성 로딩/중복 실행 방지 — 이번 세션 이전에 이미 전부 수정 완료된 상태였음을 확인(추가 조치 불필요).
- **실제로 발견해 수정한 문제 — `ai-search.tsx`의 "탐색 시작" 반응성**:
  - **문제 1**: "당첨숫자 총합 평균값 UP/DOWN", "고빈도 당첨번호 상위권 포함", "장기 미출현번호 포함" 세 옵션의 사전 데이터 조회(`getRecentDrawsSafe`)가 전부 끝난 뒤에야 로딩 화면(`setIsRunning(true)`)이 떴다. 네트워크가 느리면 "탐색 시작"을 눌러도 한동안 아무 반응이 없는 것처럼 보이는 구조 — 대형 앱들의 "탭하면 즉시 피드백" 기준에 못 미침.
  - **문제 2**: 위 세 옵션이 전부 각자 `Alert.alert`를 따로 띄웠다. 오프라인 등으로 셋 다 실패하면 확인 버튼을 3번 눌러야 다음으로 넘어가는 성가신 흐름.
  - **수정**: `setIsRunning(true)` + "탐색 준비 중" 라벨을 함수 맨 앞으로 옮겨 버튼을 누르는 즉시 로딩 화면이 뜨도록 했고(실제 후보 생성이 시작되면 "무작위 후보 생성 중"으로 라벨 전환), `resolveMustIncludeOneOfSets()`는 더 이상 자체적으로 Alert를 띄우지 않고 실패한 옵션 이름만 반환하도록 바꿔서, UP/DOWN 실패까지 합쳐 최대 3건을 한 번의 Alert로 모아 보여주도록 통합했다.
- **점검했지만 문제 없다고 판단해 그대로 둔 부분**:
  - `GeneratedGameCard`에 `accessibilityLabel` 등 접근성 속성이 전무한 건 새 배지만의 문제가 아니라 카드 전체(기존 메타 칩 포함)에 이미 있던 공백이라(19번 항목의 Medium 미착수 사항과 동일 원인), 배지만 부분적으로 손보기보다 전체를 다룰 별도 접근성 작업으로 남겨둠.
  - 배지 4개가 전부 뜨는 최악의 경우도 짧은 라벨+flexWrap 구조라 카드에 1~2줄 정도만 추가되는 수준으로 확인 — 정보량 대비 과도한 스크롤 부담은 아니라고 판단.
  - `GeneratedGameCard`는 `result.tsx` 한 곳에서만 쓰여서 `badges` prop 추가가 다른 화면에 영향을 줄 가능성 없음을 확인.
- **검증**: `npx tsc --noEmit`, `npx eslint .` 클린. `unit` 프로젝트 19개 스위트 155개 테스트 전부(신규 회귀 없이) 통과.

### 47. 결과 카드 접근성 — 스크린리더 스와이프 과다 문제 해소

- **배경**: 46번 항목에서 "새 배지만이 아니라 카드 전체에 접근성 라벨이 전무하다"고 지적만 하고 넘어갔는데, 사용자가 "무슨 작업인지, 지금 가능한지" 되물어서 범위를 구체화하고 바로 처리했다.
- **문제**: `GeneratedGameCard`가 로또공 6개(개별 라벨은 이미 있었음 — `LottoBall.tsx`), 추천 적합도 점수, 메타 칩 3개, 배지 최대 4개, 설명 문단을 전부 별도 View/Text로 렌더링해서, 스크린리더 사용자가 카드 하나를 파악하려면 스와이프를 15회 이상 해야 했다.
- **수정**: "읽기 전용 정보" 구간(로또공~설명 문단)만 `accessible + accessibilityLabel`로 하나의 접근성 그룹으로 묶어 한 번에 요약해서 읽어주도록 했다. 저장/구매예정/공유 등 실제 액션 버튼(`footer`)은 그룹 밖에 그대로 둬서 개별 포커스가 유지된다. 요약 문구는 시각용 표기("홀짝 3:3")를 그대로 읽지 않고 "홀수 3개, 짝수 3개" 식으로 TTS에 자연스럽게 풀어썼다(":" 기호는 음성 합성에서 어색하게 읽히기 쉽다).
- **구현**: 요약 문구 생성 로직(`buildGameAccessibilitySummary`)을 컴포넌트 파일이 아니라 `src/lib/lottery/accessibilitySummary.ts`로 분리했다 — react-native에 의존하지 않는 순수 함수라, 컴포넌트 안에 두면 `unit`(node 환경) 프로젝트에서 테스트하기 어렵고(react-native import 체인 때문에 `components`(jest-expo) 프로젝트가 필요해짐 — 이 세션에서 이미 여러 번 느리고 불안정했던 환경), 분리하면 빠른 순수 함수 테스트로 검증할 수 있다.
- **검증**: `npx tsc --noEmit`, `npx eslint .` 클린. `tests/accessibilitySummary.test.ts` 신규(번호/홀짝/합계/연속번호 조합, 점수 유무, 배지 유무, 설명 포함 여부 등 6개 테스트). `unit` 프로젝트 20개 스위트 161개 테스트 전부 통과. 실기기 VoiceOver/TalkBack 실측 확인은 미수행(코드 레벨 검증까지).

### 48. 결과 화면 정보량 재검토 — "가독성 vs 신뢰도 vs 이탈률" 균형 조정

- **배경**: 사용자가 "번호 추천을 받았을 때 불편해 보이지 않는지" 재검토를 명시적으로 "중요한 것"이라며 요청. 요지는 설명이 많아질수록 가독성은 떨어지고, 신뢰도는 올라가지만 싫증 나서 이탈률이 올라갈 수 있으니 적정선을 지켜야 한다는 것.
- **문제 진단**: 43~45번에서 추가한 배지/문구들을 합치면 카드 1장에 최대: 로또공 6개 + 적합도 점수 + 메타 칩 3개 + 배지 최대 4개(몬테카를로/EV최적화/휠링/사카이) + 설명 문단(문장 최대 5개, 그중 "끝수 최적화가 포함되어 있습니다" + "이 설명은 조합의 특징을... 의미하지 않습니다" 2문장은 매 카드 반복)이 쌓이는 구조였다. 게임을 최대 10개까지 생성하는 걸 감안하면, 사실은 **배치(탐색 1회) 단위로 딱 한 번만 사실인 정보**(몬테카를로 반복 횟수, EV 최적화 여부, 휠링 방식 분산 여부, 끝수 스프레드 최적화 여부 — 전부 `GenerationRequest`에서만 결정되고 개별 조합과 무관)를 카드마다 최대 10번 반복해서 보여주고 있었다. 반복될수록 "정보"가 아니라 "소음"이 된다.
- **수정 1 — 배지를 배치 단위/게임 단위로 분리**: `src/lib/lottery/resultBadges.ts`에 `computeBatchLevelBadges(request)`(몬테카를로/EV최적화/휠링/끝수스프레드 — 결과 화면 상단에 딱 1번)와 `computeGameLevelBadges(game, sakaiInputs)`(사카이 분석 패턴만 — 조합마다 실제로 값이 달라지므로 카드별 유지)로 분리. `app/generate/result.tsx`가 상단에 배치 배지 행을 1번 렌더링하고, `GeneratedGameCard`는 이제 사카이 배지 하나만(있을 때만) 받는다.
- **수정 2 — 카드 설명 문단에서 반복 문구 2개 제거**: "끝수 최적화가 포함되어 있습니다"는 배치 배지로 이미 표현되므로 문단에서 삭제(`src/lib/ai/explain.ts`, `src/lib/ai/types.ts`의 `lastDigitSpreadOptimized` 필드도 함께 제거). "이 설명은 조합의 특징을 나타낼 뿐 당첨 가능성을 의미하지 않습니다"는 화면 하단 `DisclaimerCard`가 이미 화면당 1번 같은 취지를 안내하고 있어 40번 항목과 같은 원칙("카드마다 반복되면 과도하게 기대감을 꺾을 수 있다")으로 삭제.
- **결과**: 카드 10장 기준으로 반복 노출되던 배지 최대 40개(4종×10장) + 반복 문장 20개(2문장×10장)가 전부 사라지고, 대신 화면 최초 1회만 나타나는 배지 행 1개로 대체됐다. 사카이 분석처럼 실제로 조합마다 값이 달라지는 정보는 그대로 카드별로 유지해서, "신뢰도를 높이는 정보"와 "매번 똑같아서 소음이 되는 정보"를 구분했다.
- **접근성 연계**: 상단 배치 배지 행도 47번과 같은 패턴으로 `accessible + accessibilityLabel`로 묶어 스크린리더가 한 번에 요약해서 읽도록 처리.
- **검증**: `npx tsc --noEmit`, `npx eslint .` 클린. `tests/resultBadges.test.ts`를 `computeBatchLevelBadges`/`computeGameLevelBadges`/`getLastDigitSpreadBadge` 기준으로 갱신, `tests/explain.test.ts`를 삭제된 문구/필드 기준으로 갱신. `unit` 프로젝트 20개 스위트 168개 테스트, `components` 프로젝트 1개 스위트 전부 통과.

### 49. 결과 화면 — "공식 사이트에서 구매하기" 외부 링크 버튼 추가 (종합 재점검 리포트 후속 조치)

- **배경**: `APP_REVIEW_2026-08-06.md`의 저비용·고효과 개선 제안 1번("경쟁 앱 대비 공식 구매 페이지 직접 연결 부재")을 사용자가 채택, "주변과 잘 어울리고 UI/UX를 해치지 않는 최적의 위치"를 신중히 판단해서 구현해달라고 요청.
- **URL 조사(추측 대신 실기기 검증)**: 사용자의 실제 로컬 Chrome(한국 네트워크, `claude-in-chrome`으로 연결)으로 직접 `dhlottery.co.kr`을 조사했다.
  - `gameInfo.do?method=buyLotto`(검색 결과에 노출되는 옛 "구매하기" 경로)는 37번 항목과 같은 이유로 이미 `ERROR 404` — 개편 이후 폐지된 경로.
  - `lt645/intro`(로또6/45 소개 페이지, 실시간 예상 당첨금·최근 추첨 결과·"바로구매" 버튼 포함)는 정상 로드됨. 페이지 안의 "바로구매" 버튼을 실제로 클릭해보니 **다른 URL로 이동하지 않고 같은 SPA 안에서 로그인 여부를 확인하는 자바스크립트 다이얼로그만 띄운다**는 걸 확인했다 — 즉 이 사이트에는 "구매 페이지"만을 가리키는 별도 URL도, 특정 번호를 미리 채워 넣는 쿼리 파라미터도 존재하지 않는다.
  - **결론**: `lt645/intro`로 연결하는 것이 이 사이트 구조상 가능한 최선이다. `src/lib/draws/drawApi.ts`에 `buildOfficialPurchasePageUrl()` 신규 추가(기존 `buildOfficialResultPageUrl`과 같은 파일·같은 스타일의 doc comment로 조사 근거를 남김). **번호가 자동으로 입력된다는 인상을 주는 문구는 절대 쓰지 않는다**(장식용/과장 문구 금지 원칙) — 대신 버튼 아래에 "번호는 자동으로 입력되지 않아 직접 선택해야 해요"라는 캡션을 달아 정직하게 기대치를 맞췄다.
- **위치 판단(다른 화면 요소들과 비교 검토)**: 후보 세 곳을 검토했다.
  1. 화면 상단(확률 카드 근처) — 번호를 보기도 전에 구매를 권유하는 모양새라 배제.
  2. 카드마다(저장/구매예정/공유 옆) — 오늘(48번 항목) 막 해소한 "배치 단위 정보를 카드마다 반복 노출"과 정확히 같은 함정이다. 게다가 이 사이트는 특정 번호를 넘겨받을 방법이 없어 카드별로 다는 것 자체가 "이 카드의 번호로 구매하러 간다"는 착각을 줄 수 있어 부적절.
  3. **채택: `DisclaimerCard`(모든 조합이 동일 확률이라는 정직한 고지) 다음, "같은 조건으로 다시 생성" 버튼 앞** — 번호 확인 → 정직한 확률 고지로 기대치를 맞춘 다음 → (그래도 사고 싶다면) 공식 사이트로 → (아니면) 다시 생성, 이라는 자연스러운 순서가 된다. 화면당 1번만 노출되므로 오늘 정리한 정보량 원칙과도 일치.
- **시각적 처리**: 카드별 버튼(인디고 채움)이나 다시 생성 버튼(브랜드 다크 채움)과 톤을 일부러 다르게 — 테두리만 있는 아웃라인 버튼(`colors.border`/`colors.surface`)에 외부 이동을 뜻하는 `Ionicons name="open-outline"` 아이콘을 붙여, "이 버튼만 앱을 벗어나 외부 웹사이트로 이동한다"는 걸 색과 아이콘 둘 다로 신호했다. 새 패키지 설치 없이 이미 쓰던 `@expo/vector-icons`만 재사용.
- **검증**: `npx tsc --noEmit`, `npx eslint .` 클린. `tests/drawApi.test.ts`에 `buildOfficialPurchasePageUrl` URL 검증 테스트 1개 추가 — `unit` 프로젝트 20개 스위트 169개 테스트 전부 통과. **실기기에서의 실제 시각적 배치(줄바꿈, 다크모드 대비 등)는 로컬 실행 시 최종 확인 필요.**
- **알려진 한계**: 이번 수정은 `GeneratedGameCard`(AI 조합 탐색 등 번호 생성 결과 화면)에 한정된다. 앱의 다른 화면(로또 연구소, 내 번호 탭 등)의 접근성 라벨 공백은 19번 항목에 이미 기록된 대로 별도 작업으로 남아있다.

### 50. `APP_REVIEW_2026-08-06.md` 중기 개선 3건 반영 — 큰 글씨 잘림 방지 / 회전·폴더블 대응 / 태블릿 여백

- **배경**: 종합 재점검 리포트의 "QA_LOG #41 미착수 항목" 중 3건(`maxFontSizeMultiplier`, `useWindowDimensions`, `NumberGrid` 셀 크기)을 사용자가 채택. 참고로 이 3건은 **Android 16(API 36)의 edge-to-edge 강제 적용 대응(#41의 별도 1번 항목)과는 무관하다** — edge-to-edge는 상태바/내비게이션바가 화면을 침범하는 문제(safe-area insets는 이미 적용돼 있음, 실기기 확인만 남음)이고, 이번 3건은 시스템 글씨 크기·화면 회전·화면 폭 대응이라는 별개의 접근성/반응형 이슈다. 사용자에게도 이 구분을 안내했다.
- **1) `maxFontSizeMultiplier={1.3}` 적용**: 원형/알약 모양처럼 넓이가 고정되거나 제한적인 요소 안의 숫자·짧은 라벨에 전부 적용 — `LottoBall.tsx`(로또공 숫자, 앱 전체에서 재사용), `Dice45.tsx`(45면체 중앙 숫자, 132px 원 안에 고정), `NumberGrid.tsx`(45개 번호 선택 셀), `GeneratedGameCard.tsx`(메타 칩 3종 + 전문 분석 배지), `result.tsx`(상단 배치 배지), `tickets.tsx`(내 번호 상태 배지: 저장함/구매예정/구매완료/확인완료). 1.3배로 상한을 둔 이유: 14px 기준으로도 약 18px까지는 늘어나 가독성 개선 효과가 있으면서, 44px 이상인 공/셀 반지름 안에서 여전히 안전하게 들어간다(직접 계산: 2자리 숫자 폭 약 22px < 44px 셀). 설명문·안내문처럼 이미 자유롭게 줄바꿈되는 문단형 텍스트는 잘릴 위험이 없어 배율 제한을 걸지 않았다(일부러 대상에서 제외).
- **2) `SettingsSheet.tsx`의 `Dimensions.get("window")` → `useWindowDimensions()` 전환**: 모듈 로드 시 1회만 읽던 화면 높이 스냅샷을, 매 렌더마다 최신 값을 반환하는 훅으로 교체. 바텀시트의 최대 높이(`maxHeight`)와 열림/닫힘 애니메이션의 시작·종료 위치가 이제 화면 크기 변화(회전, 폴더블 펼침/접힘, 멀티윈도우 크기 조절)를 따라간다. `createStyles`가 `screenHeight`를 인자로 받도록 시그니처를 바꾸고 `useMemo` 의존성 배열에도 추가.
- **3) `NumberGrid.tsx` 셀 크기를 화면 폭 기반으로 계산**: 고정 44px 대신, 화면 폭에서 좌우 패딩(32px, 이 컴포넌트를 쓰는 6개 화면 전부 `padding: 16`으로 통일돼 있음을 코드로 확인)을 뺀 뒤 기준 열 수(7열, 기존 전화기 폭에서 44px과 거의 같은 결과가 나오도록 역산한 값)로 나눠 셀 크기를 구하고, **44px(기존과 동일한 최소 터치 타겟) ~ 60px(태블릿에서도 과하게 커지지 않는 상한)** 범위로 clamp했다. 좁은 화면(전화기)에서는 계산 결과가 하한에 걸려 기존과 사실상 동일하게 동작하고(회귀 없음), 넓은 화면(태블릿)에서는 셀이 최대 60px까지 커져 빈 여백이 줄어든다. `useWindowDimensions()` 기반이라 회전 시에도 즉시 재계산된다.
- **검증**: `npx tsc --noEmit`, `npx eslint .` 클린. `unit` 프로젝트 20개 스위트 169개 테스트, `components` 프로젝트 1개 스위트 전부 회귀 없이 통과(이 3건은 시각적 조정이라 별도 신규 테스트는 추가하지 않음 — 기존 로직 테스트에 영향 없는 범위임을 tsc/jest로 재확인). **실기기에서 시스템 큰 글씨 200% 설정, 실제 화면 회전, 태블릿 실측은 이 세션에서 확인하지 못했다 — 로컬/실기기에서 최종 확인 권장.**

### 51. `app.json` — `androidNavigationBar.enforceContrast` 명시 + deprecated `splash` 키를 `expo-splash-screen` 플러그인으로 이전

- **배경**: 사용자가 "디바이스/AOS 버전별 해상도 최적화가 AOS16 대응과 같은 작업이냐"고 질문. 답은 "겹치지만 동일하지는 않다"였다 — 글자 잘림/회전 대응(50번 항목)은 별개 이슈이고, 진짜 AOS16(edge-to-edge) 관련해서 남은 건 이 2건뿐이었다. 검색이 아니라 Expo 공식 SDK 54 체인지로그와 `app.json` 설정 스키마 문서를 직접 확인해 정확한 키 이름과 기본값을 검증한 뒤 반영했다(이 프로젝트의 36번 항목 교훈 — "그럴듯해 보인다"만으로 설정을 넣지 않는다 — 을 그대로 적용).
- **1) `androidNavigationBar.enforceContrast: true` 명시 추가**: Expo SDK 54 체인지로그 원문 확인 결과, Expo SDK 54부터 Android가 API 36(Android 16)을 타깃하면서 **edge-to-edge가 항상 켜져 있고 끌 수 없다.** `androidNavigationBar`는 `android`의 하위 키가 아니라 `app.json` 최상위 키이고, `enforceContrast`의 **기본값이 이미 `true`**(내비게이션 바를 반투명하게 유지해 버튼과 콘텐츠 사이 대비를 보장)임을 공식 설정 스키마 문서(`docs.expo.dev/versions/v54.0.0/config/app`)에서 직접 확인했다. 즉 지금 당장 동작이 바뀌는 건 아니지만, 다음 사람이 "설정을 깜빡한 건지 의도적으로 안전한 기본값을 쓴 건지" 헷갈리지 않도록 명시적으로 못박아 뒀다.
- **2) `splash` → `expo-splash-screen` 플러그인 이전**: 최상위 `splash: { backgroundColor }` 키는 Expo 공식 문서에서 legacy 취급되고 있어(SDK 54 시점에는 하위호환으로 동작하지만 다음 SDK에서 제거될 예정), `plugins` 배열에 `["expo-splash-screen", { "backgroundColor": "#0F172A" }]`로 옮겼다. 이 프로젝트는 전용 스플래시 이미지 없이 브랜드 네이비 단색 배경만 쓰고 있었어서(`assets/`에 splash 이미지 파일 자체가 없음을 확인), `image` 필드는 넣지 않고 기존과 동일하게 배경색만 유지했다 — 다크모드 전용 스플래시(`dark` 옵션)도 이 앱의 헤더 바(`#0F172A` 고정, 라이트/다크 무관)와 일관되게 추가하지 않았다.
- **패키지**: `expo-splash-screen` `~31.0.13`(이 프로젝트 Expo SDK 54의 `bundledNativeModules.json` 기준 정확한 호환 버전)을 `package.json`에 추가. **21~25번 항목과 같은 이유로 이 세션 환경에서는 실제 `npm install`을 실행하지 못했다** — `node_modules/expo-splash-screen`이 아직 없는 상태이며, 이 플러그인은 `expo prebuild`/`eas build` 시점에 네이티브 스플래시를 구성하므로 **사용자가 로컬에서 `npm install` 후 다음 빌드부터 반영**된다.
- **검증**: `app.json`/`package.json` JSON 유효성 확인, `npx tsc --noEmit`·`npx eslint .` 클린(둘 다 이 변경과 무관 — JSON 설정과 네이티브 빌드 플러그인이라 타입체크/린트 대상이 아님), `unit` 프로젝트 20개 스위트 169개 테스트 회귀 없이 통과. **실제 네이티브 빌드에서 스플래시·내비게이션 바가 의도대로 나오는지는 로컬 `npm install` + 다음 `eas build`/`expo prebuild`에서 최종 확인 필요.**
- **후속(사용자 로컬에서 `npm install` 성공 확인 후)**: 스플래시가 지금은 로고 없이 배경색만 뜬다는 걸 알게 된 사용자가 "다른 주요 앱들이 처리하는 위치를 참고해서" 로고를 추가해달라고 요청.
  - **에셋**: `assets/tab-icon-home.png`(홈 탭 아이콘, 투명 배경 로고)를 원본으로 재사용하되, **색은 새로 처리했다** — 원본은 네이비 계열 선(하우스+G)이라 이 화면의 네이비 배경(`#0F172A`)과 명도 대비가 거의 없어(직접 계산: 대비비 약 1.38:1, WCAG 최소 권장치 3:1에도 크게 못 미침) 배경에 묻혀 보이지 않는다. 픽셀 단위로 "주황 포인트(G 안의 원)"와 "네이비 선"을 구분해, 네이비 선만 흰색으로 바꾸고 주황 포인트는 그대로 살린 `assets/splash-icon.png`를 새로 만들었다(파이썬 PIL로 픽셀 순회, warm-color 판정은 R−B 채널 차이로 구분). 흰 선 + 주황 포인트 조합은 원본 로고의 정체성(하우스+G, 포인트 컬러)을 유지하면서 네이비 배경 위에서 뚜렷하게 보인다(주황 대비비 약 9.86:1).
  - **위치/크기 — 주요 앱 관행 확인**: `expo-splash-screen` 플러그인 자체가 이미지를 항상 화면 정중앙(수평·수직 모두)에 배치하는 것 외에 별도 위치 옵션을 제공하지 않는다는 걸 공식 SDK 문서에서 확인했다 — 이는 토스·카카오·인스타그램 등 대다수 앱이 쓰는 "화면 정중앙에 심플한 로고 한 개"라는 관행과 정확히 일치해, 별도로 손댈 게 없었다(플랫폼 표준 자체가 이미 그렇게 되어 있음). 크기는 `imageWidth: 120`(기본값 100에서 소폭 키움)으로 설정 — 실측 목업(390pt 폭 캔버스에 로고 120px 배치)으로 과하지 않게 존재감 있는 크기인지 육안 확인 후 결정.
  - **`app.json` 수정**: `expo-splash-screen` 플러그인 설정에 `image: "./assets/splash-icon.png"`, `imageWidth: 120`, `resizeMode: "contain"` 추가.
  - **검증**: `python3 -c "import json..."`로 `app.json` 유효성 확인, `npx tsc --noEmit`·`npx eslint .` 클린. 실측 대비비 계산(흰색 1.38→해당없음, 흰 선 vs 네이비 배경은 밝기 차이가 커서 육안 확인으로 충분히 뚜렷함을 목업 이미지로 확인) 및 목업 렌더로 최종 배치를 직접 눈으로 확인했다. **실제 네이티브 빌드(로고가 다음 `npm install` 이후의 `eas build`/`expo prebuild`에 반영됨)에서의 최종 확인은 여전히 남아있다.**

## 2026-08-08

### 52. "딥 패턴 탐색" 신규 메뉴 — UI 목업 승인 후 화면·네비게이션·저장 연동 (엔진은 mock, Phase 2~4 미착수)

- **배경**: 별도 명세 문서(`Deep Pattern Engine Master Spec v2.0`, Android/Kotlin 전제로 작성)를 기준으로, Claude(Cowork)에서 먼저 목업 HTML을 만들어 화면·사용자 플로우를 승인받은 뒤, 이 저장소에 실제로 붙이는 작업을 진행했다. 명세 §42가 "바로 코딩하지 말 것"을 명시하고 있어, Phase 0(기존 구조 audit) → 이번 세션 범위 확정(화면+네비게이션+저장까지만, 엔진은 다음 단계) 순으로 진행했다.
- **Phase 0 audit 결과 요약**: 명세는 Kotlin/JNI/Room/WorkManager를 전제로 하지만 이 프로젝트는 Expo/RN/TypeScript라 해당 사항 없음 — 엔진을 TS로 재설계. `app/(tabs)/generate.tsx`의 `MENU_ITEMS` + `app/_layout.tsx`의 `Stack.Screen`만 건드리면 네비게이션 추가가 가능하고, 저장은 기존 `saveTicket()`을 그대로 재사용 가능함을 확인(`GeneratedGame.mode`는 exhaustive switch 없이 동등 비교로만 쓰여 새 리터럴 추가가 안전함을 grep으로 확인). `data/lotto-draws.json`에 전체 당첨 이력이 이미 번들돼 있어 향후 Atlas Builder가 별도 데이터 수집 없이 이 파일을 바로 쓸 수 있다.
- **신규 격리 모듈**(기존 파일은 아래 "건드린 파일" 항목 외 전혀 수정하지 않음):
  - `src/lib/deepPattern/coordinates.ts` — 실제 로또 마킹 용지 배열(7열×7행, 43~45는 마지막 줄 3칸만 사용)을 그대로 재현하는 좌표 매핑 + canonical path(번호 오름차순 연결) 계산. 순수 함수, RN 의존성 없음.
  - `src/lib/deepPattern/types.ts` — `DeepPatternRecommendation`(명세 §43 Kotlin `DeepPatternFeature` 경계를 TS로 옮김). Basin/DeepVoid 같은 내부 개념은 이 타입 밖으로 노출하지 않고, `patternIndex`("N번 패턴")처럼 이미 사용자 언어로 번역된 필드만 둔다.
  - `src/lib/deepPattern/mockEngine.ts` — **⚠️ 실제 엔진 아님.** `generatePureRandom()`(기존 CSPRNG)으로 진짜 유효한 조합은 뽑지만, 패턴 독창성/구조적 공백/공백 지속성/시간 안정성/가장 가까운 과거 당첨 지표는 전부 그럴듯한 무작위값이다. 파일 최상단 주석에 명시. 명세 §43 `recommend(count)`/`status()` 시그니처와 대응시켜, 실제 엔진(Research+Atlas Builder 완료 후)이 이 파일 하나만 교체하면 되도록 경계를 맞춰뒀다.
  - `src/state/deepPatternStore.ts` — 기존 `generationStore.ts`와 동일한 패턴(zustand, 화면 간 결과 전달 전용, 영구 저장은 여전히 `saveTicket()`).
  - `src/components/deepPattern/{DeepPatternIcon, PatternThumb, PatternBoard, DeepPatternLoadingBoard}.tsx` — 새 이미지 에셋 없이 기존 의존성(`react-native-svg`)만으로 그린 벡터 아이콘/패턴 시각화/로딩 애니메이션(점을 순서대로 이으며 선이 그려지는 연출, `Animated` + `strokeDashoffset`).
  - `app/generate/deep-pattern.tsx`(소개+생성 중), `deep-pattern-result.tsx`(5게임 결과 리스트, "1번 패턴~5번 패턴" 표기), `deep-pattern-detail.tsx`(패턴 시각화+지표+저장) — 목업 승인 화면을 그대로 구현하되, "저장 완료" 별도 화면 대신 기존 `result.tsx`의 `Alert.alert` 저장 확인 관행을 그대로 따랐다(이 앱의 다른 생성 플로우 어디에도 저장 확인 전용 화면이 없어, 새로 하나 만들기보다 기존 패턴과 일관되게 맞췄다).
- **건드린 기존 파일 (딱 3곳, 전부 additive)**:
  1. `src/lib/lottery/types.ts` — `GenerationMode`에 `"DEEP_PATTERN"` 리터럴 1개 추가.
  2. `app/(tabs)/generate.tsx` — `MENU_ITEMS`에 6번째 카드 추가(보라 테두리 + NEW 배지), 아이콘을 PNG 대신 컴포넌트로 받을 수 있게 `iconNode?` 필드 추가(기존 5개 카드의 동작·마크업은 변경 없음).
  3. `app/_layout.tsx` — `Stack.Screen` 3개(`generate/deep-pattern`, `-result`, `-detail`) 등록.
- **문구**: 명세 §39 금지 표현(당첨확률 상승, AI 예측 등) 없이 전부 권장 표현만 사용. 소개 화면 경고문구 + 상세 화면 하단 안내문 2곳에 "확률과 무관함"을 명시.
- **검증**: `npx tsc --noEmit` 클린, `npx eslint .` 클린(irregular whitespace 1건 수정 후). `npx jest --selectProjects unit` — 기존 20개 스위트 169개 테스트 전원 회귀 없이 통과 + 신규 `tests/deepPatternCoordinates.test.ts`/`tests/deepPatternMockEngine.test.ts` 2개 스위트 11개 테스트 추가, 총 22개 스위트 180개 테스트 전부 통과.
- **의도적으로 하지 않은 것**:
  - **실제 Deep Pattern Engine(Research/Atlas Builder/Void·Basin 계산)은 미구현이다.** 814만 조합 전수 분석, Null 시뮬레이션, kNN 보정 등은 명세 §41 Phase 2~5에 해당하는 별도 리서치 작업으로, 이번 세션 범위(화면+네비게이션+저장)에서 의도적으로 제외했다 — `mockEngine.ts`가 그 자리를 표시한다.
  - `components`(jest-expo) 테스트 프로젝트는 이 세션 환경에서 콜드스타트가 매우 느려(과거 세션들에서 반복 확인된 한계) 새 화면에 대한 렌더링 테스트는 추가하지 않았다 — `unit` 프로젝트의 순수 로직 테스트로만 검증했다. **사용자 로컬에서 실제 화면 렌더링(카드 탭 → 결과 → 상세 → 저장 Alert까지 실제 동작) 확인이 필요하다.**
  - 로딩 애니메이션(`DeepPatternLoadingBoard`)의 실기기 성능/발열, 다크모드에서의 최종 배색은 코드 리뷰 수준까지만 확인했고 실기기 확인은 하지 않았다.

### 53. "딥 패턴 탐색" — mock 엔진을 실제 Atlas 기반 v1 엔진으로 교체

- **배경**: 52번 항목에서 화면·네비게이션·저장까지 mock 데이터로 붙인 뒤, "정직한 v1 근사치로 우선 가고 정식 버전(kNN 보정/Null 시뮬레이션/다중검정 보정)은 하나씩 붙여나가자"는 방향을 사용자가 확정했다.
- **Atlas Builder 신규**: `scripts/build-deep-pattern-atlas.mjs` — 로또 6/45 **8,145,060개 조합을 실제로 전수 순회**(6중 for문, `a<=40,b<=41,...,f<=45` 표준 조합 생성 경계)하며 조합별 Geometry Feature(용지 좌표 기준 중심 행/열, 산포도)와 홀짝 개수를 계산한다. 경험적 tercile(§6)로 3단계씩 양자화해 **3×3×3×3 = 81개 fine basin**을 정의하고, `data/lotto-draws.json`(전체 역대 이력, 이미 리포에 있음)과 대조해 basin별 밀도비(관측/기대, "구조적 공백")를 계산한다.
  - **Multi-scale(§11)**: 81개 fine basin과 dispersion·홀짝을 뺀 9개 coarse basin(행×열만) 양쪽에서 밀도비를 계산해 두 해상도 모두 결손이면 `scalePersistenceLevel: HIGH`.
  - **Temporal(§13)**: 전체 역사 vs 최근 300회 window 양쪽에서 밀도비를 계산해 `temporalPersistenceLevel`을 정한다.
  - **정직하게 아직 안 한 것**: kNN 보정(§8), Null 시뮬레이션/Skeptic Engine(§14), 다중검정 보정(§14) — Atlas JSON의 `methodology` 필드에 그대로 문자열로 박아뒀다.
  - **전수 검증(§34)**: 처리한 조합 수(8,145,060)와 81개 basin population 합계가 정확히 일치하지 않으면 스크립트가 즉시 throw한다. 실행 결과: **2.5초**, `data/deep-pattern-atlas.json` **약 85.6KB**, 역대 1235회(최근 300회 window) 기준, 구조적 공백 HIGH basin 11개.
  - Atlas에는 basin 통계뿐 아니라 **역대 당첨 이력 번호 전체도 함께 담아**(그래봐야 수십 KB) 앱이 런타임에 네트워크 없이도 "가장 가까운 과거 당첨"을 스스로 계산할 수 있게 했다(§30 오프라인 원칙).
- **`src/lib/deepPattern/engine.ts` 신규**: `mockEngine.ts`와 정확히 같은 시그니처(`recommendDeepPatterns`/`deepPatternEngineStatus`)로, Atlas를 정적 import(`import atlasData from "../../../data/deep-pattern-atlas.json"`, Metro가 JSON을 그대로 번들)해서 쓴다. 런타임에는 814만 개를 순회하지 않는다(§18) — 구조적 공백이 큰 순서로 정렬된 81개 basin 중 상위 몇 개에서만 `generatePureRandom()`(기존 CSPRNG)으로 rejection sampling해 조건에 맞는 조합을 뽑는다. 가장 가까운 과거 당첨은 기존 `combinationSimilarity()`(이미 있는, 이미 검증된 함수)를 그대로 재사용해 계산한다 — 새 유사도 수식을 만들지 않았다.
- **화면 연동**: `app/generate/deep-pattern.tsx`/`deep-pattern-result.tsx`의 import를 `mockEngine` → `engine`으로 교체한 것 외에는 화면 코드 변경이 전혀 없다(시그니처를 맞춰둔 목적 그대로). `mockEngine.ts`는 삭제하지 않고 남겨뒀다 — 향후 Atlas 로드 실패 시 Graceful Degradation(§32 Level 1/2) fallback 후보로 재활용할 수 있다.
- **검증**: `npx tsc --noEmit`·`npx eslint .` 클린(스크립트의 `Buffer` no-undef 1건은 Buffer 대신 문자열 길이로 대체해 해결). `npx jest --selectProjects unit` — 신규 `tests/deepPatternAtlas.test.ts`(Atlas 무결성: population 합계, basin key 공식, 역사 배열 정합성 등 7개)와 `tests/deepPatternEngine.test.ts`(실제 엔진 recommend() 결과 유효성 3개) 추가, 기존 mock 엔진 테스트는 그대로 유지(파일이 남아있으므로), 총 **24개 스위트 192개 테스트 전부 통과**(회귀 없음).
- **의도적으로 안 한 것 / 다음 단계 후보**:
  - kNN 보정, Null 시뮬레이션, 다중검정 보정(§14) — 통계적 엄밀성의 핵심이지만 그 자체로 별도 세션 분량.
  - 실기기 latency 실측 및 Anytime/progressive refinement(§22, 시간 budget 기반 탐색) — `MAX_SAMPLING_ATTEMPTS_PER_BASIN=3000`은 근거 있는 실측치가 아니라 보수적으로 잡은 값이다.
  - Basin 해상도를 지금의 4차원×3단계보다 세분화하는 것(Exact→Fine→Mid→Macro, §7) — 지금은 Macro 수준 1개 해상도(coarse/fine 2단만)뿐이다.
  - Combinadic rank/unrank(§19) — v1은 basin을 population/observed 집계로만 쓰고 조합 목록을 저장하지 않아 필요 없었지만, 향후 "이 basin의 대표 후보 목록"을 미리 캐시하려면 필요해질 수 있다.

### 54. "딥 패턴 탐색" — kNN Geometric Void 보정 + Null 시뮬레이션/다중검정 보정(§8, §14) 추가

- **배경**: 53번 항목에서 정한 "정직한 v1 근사치 → 정식 항목을 하나씩 붙여나가기" 순서의 1번째 항목. 사용자가 "kNN 보정 / Null 시뮬레이션 / 다중검정 보정"을 한 묶음으로 지정해 이번 세션에서 함께 처리했다.
- **kNN Geometric Void 보정(§8)**: `src/lib/deepPattern/geometricVoid.ts` 신규.
  - `patternDistance(a, b)`: 두 조합을 각각 오름차순 정렬한 뒤, 같은 순번의 용지 좌표(행/열) 유클리드 거리 제곱을 6개 합산 — canonical path 대응 지점끼리 비교하므로 정렬 순서와 무관하게 결정적이다.
  - `kNearestVoidScore(candidate, history, k=10)`: 후보와 역대 모든 당첨 이력 사이의 `patternDistance`를 계산해 오름차순 정렬 후 상위 k개의 **중앙값**을 반환한다(평균 대신 중앙값을 쓴 이유: 이력 안에 우연히 아주 가까운 이상치 1개가 있어도 흔들리지 않게 하기 위함). 값이 클수록 "역대 당첨과 기하학적으로 더 멀리 떨어진, 더 탐색되지 않은 패턴"이라는 뜻이다.
  - **적용 지점**: `engine.ts`의 `sampleFromBasin()`을 "첫 rejection-sampling 성공을 그대로 채택"하던 기존 방식에서, **동일 basin 안에서 최대 20개 후보 풀을 모은 뒤 그중 `kNearestVoidScore`가 가장 높은 후보를 선택**하는 방식으로 교체(`CANDIDATE_POOL_SIZE=20`, `K_NEAREST_FOR_VOID=10`). 같은 basin(밀도비 기준 공백)이라도 그 안에서 실제로 역대 당첨과 기하학적으로 가장 먼 조합을 우선하게 됐다.
- **Null 시뮬레이션 + 다중검정 보정(§14 Skeptic Engine)**: `scripts/build-deep-pattern-atlas.mjs`에 `[5/5]` 단계로 추가.
  - 결정적 PRNG(`mulberry32`, 고정 시드 `20260808`)로 **실제 역사와 같은 길이(1235회)의 "가짜 무작위 역사" 500개**를 생성하고, 매 시뮬레이션마다 81개 basin 전체의 관측/기대 밀도비를 다시 계산한다.
  - basin별 p-value 대신, **81개 basin을 동시에 봤다는 사실 자체를 보정하는 family-wise(최선-대-최선) p-value**를 계산한다: 각 시뮬레이션에서 "81개 basin 중 가장 극단적인(밀도비가 가장 낮은) basin"의 값만 모아 500개 null 분포를 만들고, 실제 관측된 basin의 밀도비가 이 null 분포에서 몇 번째로 극단적인지로 `validationPercentile`(0~100)을 산출한다. 단순 Bonferroni(81로 나누기)보다 basin 간 실제 상관관계를 그대로 반영해 더 정확하다.
  - **정직한 결과 — 임의로 조정하지 않고 그대로 반영**: 53번 항목에서 "구조적 공백 HIGH"로 나온 81개 basin 중 11개 중, family-wise 보정을 거치고 나면 **`validationPercentile ≥ 90`(통계적 유의성 "높음")인 basin은 단 1개, `≥ 50`(통계적 유의성 "보통" 이상)인 basin도 3개뿐**이었다. 즉 겉으로 "공백"처럼 보이는 대부분의 basin은 81개를 동시에 검정했다는 점까지 감안하면 무작위 변동과 통계적으로 뚜렷이 구분되지 않는다 — 이는 명세 §17이 정확히 예견한 상황("무작위 범위 안이라면 그대로 보여준다")이라 임계값을 조정해 "더 그럴듯한" 결과를 만들지 않고 그대로 반영했다.
- **타입/엔진/화면 연동**:
  - `src/lib/deepPattern/types.ts`의 `DeepPatternRecommendation`에 `validationPercentile: number` 필드 추가(0~100, family-wise 보정된 p-value 기반).
  - `engine.ts`가 basin의 `validationPercentile`을 그대로 추천 결과에 실어 보낸다. `mockEngine.ts`도 동일 인터페이스를 구현해야 하므로 mock 값(`randomInt(10, 100)`)으로 채워 타입 일관성을 유지했다(주석으로 "mock — 실제 Null 시뮬레이션 아님" 명시).
  - `app/generate/deep-pattern-detail.tsx`에 **"통계적 유의성"** 지표 행 추가(`validationLevel()`로 0~100 percentile을 기존 LOW/MID/HIGH 3단계 표시 체계에 매핑, 임계값은 90/50). 바로 아래에 "낮음이면 무작위 변동과 구분되지 않는다는 뜻이며 이 역시 정상적인 결과"라는 캡션을 달아, 대부분의 basin이 여기서 LOW로 뜨더라도 사용자가 "버그"나 "실패"로 오해하지 않도록 했다.
- **Atlas 메타데이터**: `engineVersion`/`atlasVersion`을 `DPE-1.0-v2approx`/`ATLAS-1.0-v2approx`로 올리고, `nullModelVersion: "NULL-1.0-familywise"`/`numNullSimulations: 500` 필드를 추가. `methodology` 설명 문자열도 이번에 구현된 항목(Multi-scale/Temporal/kNN/Null+다중검정)과 여전히 남은 항목을 갱신했다.
- **검증**: Atlas 재빌드 총 2.7초(Null 시뮬레이션 자체는 0.2초), 산출물 약 85.6KB. `npx tsc --noEmit` 클린, `npx eslint .` 클린. `npx jest --selectProjects unit` — 신규 `tests/deepPatternGeometricVoid.test.ts`(patternDistance/kNearestVoidScore 성질 검증 5개) 추가 + 기존 `deepPatternAtlas.test.ts`/`deepPatternEngine.test.ts`/`deepPatternMockEngine.test.ts`에 `validationPercentile` 범위(0~100)·population 0인 basin은 0이어야 한다는 등의 검증 추가, **총 25개 스위트 201개 테스트 전부 통과**(회귀 없음).
- **의도적으로 안 한 것 / 다음 단계 후보**:
  - 실기기 latency 실측 및 Anytime/progressive refinement(§22) — 후보 풀을 20개로 늘리고 kNN 계산까지 추가돼 basin당 연산량이 늘었지만, 이 세션에서는 실기기 실측을 하지 못했다.
  - Basin 해상도 세분화(Exact→Fine→Mid→Macro, §7) — 여전히 fine/coarse 2단만 존재한다.
  - `components`(jest-expo) 렌더링 테스트 — 여전히 미착수(과거 세션들에서 반복 확인된 콜드스타트 제약과 동일한 이유).

### 55. "딥 패턴 탐색" — basin 해상도 세분화(§7 Mid 계층) + 추천 생성 latency 대폭 개선

- **배경**: 사용자가 다음 두 가지를 함께 요청했다 — (1) 54번 항목 이후 다음 순서였던 "basin 해상도 세분화"(§7 Exact→Fine→Mid→Macro), (2) 번호 추천이 나오기까지 체감 대기 시간이 길어 사용자 이탈이 우려된다는 지적, 파일 손상 여부를 반드시 확인해달라는 당부. 원인을 분석해보니 이 둘이 실제로 같은 근본 원인(런타임 rejection sampling)에서 나온 문제라 한 번에 같이 처리했다.
- **latency 원인 진단**: `engine.ts`의 기존 `sampleFromBasin()`은 basin 1개마다 "CSPRNG로 무작위 조합을 뽑고 → 그 조합이 목표 basin에 속하는지 좌표를 다시 계산해서 확인 → 아니면 버림"을 반복하는 rejection sampling이었다. 81개 basin 중 특정 하나에 우연히 들어맞을 확률은 약 1/81(1.2%)이라, 후보 풀 20개를 채우려면 평균 약 1,600회, 상한(`MAX_SAMPLING_ATTEMPTS_PER_BASIN`)까지 가면 최대 3,000회의 CSPRNG 호출이 필요했다. 5개 추천이면 최악의 경우 basin당 3,000 × 5 = 15,000회에 달하는 `expo-crypto` 브릿지 기반 난수 호출이 발생할 수 있는 구조였다 — 실기기에서 체감되는 지연의 핵심 원인으로 추정된다(이 세션 환경엔 실기기가 없어 정확한 ms 실측은 못 했지만, 구조적으로 명백한 병목이었다).
- **해결(§18 "Precompute globally, evaluate locally"를 한 단계 더 밀어붙임)**: `scripts/build-deep-pattern-atlas.mjs`가 어차피 814만 개 전수 순회를 하는 김에, basin마다 **결정론적 reservoir sampling(Algorithm R, 고정 seed)으로 대표 후보 최대 150개를 미리 뽑아 Atlas JSON에 `sampleCombos`로 함께 저장**하도록 바꿨다. 이제 런타임(`engine.ts`)은 이 150개짜리 목록에서 `securePartialShuffle`(CSPRNG 사용, 20개만 부분셔플)로 가볍게 고르기만 한다 — **basin당 CSPRNG 호출이 최대 3,000회에서 20회 안팎으로 감소**했다. 통계적 성질은 그대로다: reservoir sampling 자체가 그 basin 전체 인구에서의 균등 무작위 표본이므로, "basin 내부에서 무작위로 고른다"는 원래 의도와 결과 분포는 동일하다.
  - 이 리팩터로 `engine.ts`에서 `computeBasinKeyFor`/`paperRow`/`paperCol`/`zone3`/`oddZoneOf`/`fineBasinKey`(빌드 스크립트와 별도로 유지하던 좌표 계산 중복 구현)를 전부 삭제할 수 있었다 — 부수적으로, 두 구현이 미묘하게 어긋날 위험(예: 아래에서 발견한 Float32 정밀도 문제)도 함께 없앴다.
  - `generatePureRandom()` 의존성도 `engine.ts`에서 완전히 제거됐다(더 이상 무작위 조합을 새로 만들 필요가 없다).
- **basin 해상도 세분화(§7)**: `finePopulation`(81개, 행×열×산포도×홀짝)과 `coarsePopulation`(9개, 행×열)에 더해 **`midPopulation`(27개, 행×열×산포도 — 홀짝만 뺌)을 새로 추가**해 3단계 Multi-scale을 구성했다. `scalePersistenceLevel`은 이제 "fine·mid·coarse 3단계 모두 결손일 때만 HIGH, fine이 결손이면서 mid나 coarse 중 하나라도 결손이면 MID, 그 외 LOW"로 재정의했다(기존 fine/coarse 2단계보다 "우연히 fine 한 곳만 결손인" 경우를 더 잘 걸러낸다). basin 객체에 `midDensityRatio` 필드를 추가했다.
- **파일 무결성 검증(사용자가 특별히 당부한 부분)**: Atlas를 재생성한 뒤 다음을 직접 실행해 확인했다.
  1. `JSON.parse()`로 파일 전체가 깨지지 않고 정상 로드되는지 확인 (312.3KB, 기존 85.6KB에서 `sampleCombos` 추가로 커짐 — 여전히 명세 §20이 경고하는 1.3GB와는 비교가 안 되는 크기).
  2. 81개 basin 전부 `sampleCombos` 150개씩 채워짐(총 12,150개), 각 조합이 "6개 서로 다른 1~45 오름차순 정렬" 계약을 만족하는지 전수 검증 — 이상 없음.
  3. **12,150개 대표 후보 전부가 실제로 자신이 속한다고 표시된 basin에 맞는지 좌표를 재계산해 교차검증** — 첫 시도에서 1,935개 불일치가 나와 진짜 버그인 줄 알았으나, 원인을 추적해보니 빌드 스크립트가 `Float32Array`로 좌표를 저장해(메모리 절약 목적) zone 판정을 float32 정밀도로 하는데, 검증 스크립트는 float64로 재계산해서 생긴 **정밀도 차이로 인한 오탐**이었다(`Math.fround()`로 float32 반올림을 재현하니 불일치 0건으로 전부 통과). 이 과정에서 오히려 "기존 `engine.ts`의 `computeBasinKeyFor`도 float64로 계산해 빌드 스크립트(float32)와 미묘하게 어긋날 수 있었다"는, 이번 리팩터로 우연히 해소된 잠재 버그를 하나 더 찾아냈다.
  4. 위 교차검증 로직을 `tests/deepPatternAtlas.test.ts`에 정식 테스트로 남겨(basin마다 대표로 10개씩, 총 810개 표본 검사) 앞으로도 자동으로 회귀를 잡을 수 있게 했다.
- **버전**: `engineVersion`/`atlasVersion`을 `DPE-1.1-v3approx`/`ATLAS-1.1-v3approx`로 올렸다. Atlas 메타데이터에 `basinSampleSize: 150` 필드 추가.
- **검증**: Atlas 재빌드 2.9초(전수 순회 0.8s + reservoir sampling 포함 population 집계 단계 + Null 시뮬레이션 0.1s). `npx tsc --noEmit`·`npx eslint .` 클린. `npx jest --selectProjects unit` — `deepPatternAtlas.test.ts`에 basin.sampleCombos 유효성/basin 소속 교차검증/scalePersistenceLevel 3단계 로직 검증 테스트 3개 추가, `deepPatternEngine.test.ts`에 `recommend(5)`가 3초 안에 끝나는지 확인하는 latency 가드레일 테스트 1개 추가(참고: 이 세션 환경은 Jest/Node라 실기기 성능을 대변하진 않지만, v2 방식으로 되돌아가는 회귀가 생기면 이 임계값을 훨씬 넘기므로 가드레일로는 유효하다) — **총 25개 스위트 205개 테스트 전부 통과**(회귀 없음).
- **의도적으로 안 한 것 / 다음 단계 후보**:
  - §7의 "Exact"(개별 조합 단위) 해상도는 여전히 별도 basin 계층으로 만들지 않았다 — kNN Geometric Void(§8)가 basin 내부 선택 단계에서 이미 근사적으로 그 역할을 하고 있어, 우선순위가 낮다고 판단했다.
  - 실기기 latency 실측(§22) — 이번 변경으로 구조적으로는 크게 개선됐을 것으로 기대하지만, 정확한 ms 단위 체감 개선치는 실기기에서만 확인 가능하다. **사용자 로컬/실기기에서 "패턴 분석 시작하기" 버튼을 눌렀을 때 체감 대기 시간이 실제로 줄었는지 확인이 필요하다.**
  - `sampleCombos` 150개라는 값은 Atlas 크기와 다양성 사이의 근거 있는 실측치가 아니라 보수적으로 잡은 값이다 — 실기기 확인 후 늘리거나 줄일 수 있다.

### 56. "딥 패턴 탐색" — 실기기 확인 전 추가 latency 점검(§8 kNN 경로 내부 낭비 제거)

- **배경**: 55번 항목 커밋 직후 사용자가 "실기기 확인은 최적화가 다 끝난 뒤에 하고 싶다, 미리 더 손볼 수 있는 게 없는지 다시 한번 점검해달라"고 요청. 55번에서 이미 가장 큰 병목(런타임 rejection sampling)은 없앴지만, 남은 뜨거운 경로(kNN Geometric Void, `recommend(5)` 기준 최대 12만 회 이상 호출되는 `patternDistance`)를 다시 코드 레벨로 훑어 낭비를 2건 더 찾아 제거했다.
- **발견 1 — `getPaperPosition`이 호출마다 객체를 새로 할당**: `src/lib/deepPattern/coordinates.ts`의 `getPaperPosition(n)`이 매번 나눗셈·나머지 연산을 다시 하고 `{row, col}` 객체를 새로 만들고 있었다. 1~45라는 고정된 입력 공간에 대해 결과가 절대 바뀌지 않는데도(순수 함수, 부작용 없음) 매 호출마다 재계산 — kNN 경로에서만 추천 5개당 약 24~25만 회 호출된다.
  - **수정**: 모듈 로드 시 1~45 좌표를 전부 미리 계산해두는 조회 테이블(`PAPER_POSITION_TABLE`)을 추가하고, `getPaperPosition`은 유효성 검사(기존 그대로 유지) 후 테이블에서 참조만 돌려주도록 변경. 반환값은 여러 호출에서 같은 객체를 공유하게 되는데, 호출부 어디에서도 반환된 좌표 객체를 변형(mutate)하지 않는다는 걸 코드로 확인한 뒤 적용했다(읽기 전용 사용만 존재 — 참조 공유가 안전한 이유).
- **발견 2 — `kNearestVoidScore`가 candidate를 매번 다시 정렬**: 기존 `kNearestVoidScore`는 이력 1,235건을 순회하며 `patternDistance(candidate, h.numbers)`를 호출했는데, `patternDistance` 내부에서 매번 `candidate`(호출 내내 값이 전혀 바뀌지 않는 같은 배열)를 새로 정렬하고 있었다 — 즉 같은 6개짜리 배열을 최대 1,235번 반복해서 정렬하는 완전히 불필요한 작업이었다(수학적으로 정렬 결과가 항상 같으므로 제거해도 결과가 달라지지 않는다는 게 자명하다 — 별도 가정이나 위험이 없는 안전한 최적화).
  - **수정**: `geometricVoid.ts`에 정렬된 두 배열을 받는 내부 헬퍼(`sumSquaredPaperDistance`)를 분리하고, `kNearestVoidScore`는 candidate를 함수 진입 시 딱 한 번만 정렬해 재사용하도록 변경. `patternDistance`(공개 함수, 다른 곳에서도 정렬 안 된 입력을 그대로 받는 계약)는 기존 동작 그대로 유지해 하위 호환을 깨지 않았다. 이력 쪽(`h.numbers`)은 이미 Atlas가 오름차순으로 저장해두긴 하지만, 그 사실에 의존하는 최적화(정렬 생략)는 하지 않았다 — "atlas.history가 항상 정렬돼 있다"는 외부 계약에 기대는 대신 매번 다시 정렬해 안전 마진을 남겼다(candidate 쪽만 100% 안전하게 제거 가능한 중복이라 그것만 손댔다).
- **정직한 한계**: 이번 두 가지는 모두 "낭비를 없앤" 수정이지 알고리즘 자체를 바꾼 게 아니라, 개선 폭이 55번(런타임 rejection sampling 제거)만큼 극적이지는 않을 것이다. 여전히 실기기 ms 실측은 없다 — Node/Jest 환경에서 `recommend(5)` 테스트가 약 400ms 안팎(모듈 최초 로드·JSON 파싱 비용이 이미 상각된 상태 기준)으로 끝나는 것을 관찰했지만, 이는 데스크톱 V8 기준이라 실기기 Hermes 성능을 대변하지 않는다는 점을 사용자에게 명확히 안내했다.
- **검증**: `npx tsc --noEmit`·`npx eslint .` 클린. `npx jest --selectProjects unit` — 기존 25개 스위트 205개 테스트 전부 회귀 없이 통과(공개 API 시그니처·동작 변경 없음이라 새 테스트는 추가하지 않았고, 기존 `deepPatternGeometricVoid.test.ts`/`deepPatternCoordinates.test.ts`가 그대로 이 두 변경의 회귀 방지 역할을 한다).
- **다음 단계**: 이제 이 세션에서 안전하게 할 수 있는 수준의 코드 레벨 최적화는 소진했다고 판단한다. 남은 것은 실기기 실측(§22)뿐이다 — 실기기에서 체감이 여전히 느리면, 그때는 `kNearestVoidScore`의 top-k 선택 방식(현재 전체 정렬 후 자르기)을 더 정교한 선택 알고리즘으로 바꾸거나, `sampleCombos`/`CANDIDATE_POOL_SIZE` 크기를 줄이는 것도 후보가 될 수 있다.

### 57. "딥 패턴 탐색" — 화면 3개(`components`, jest-expo) 렌더링 테스트 신규 추가

- **배경**: 52번 항목 이후 계속 미뤄뒀던 "`components`(jest-expo) 렌더링 테스트 미착수" 항목을 사용자 요청으로 처리했다. 지금까지 딥 패턴 탐색은 `unit` 프로젝트(순수 함수/엔진 로직)만 검증돼 있었고, 화면이 실제로 렌더링되는지·버튼을 눌렀을 때 배선(엔진 호출 → 스토어 저장 → navigate, 저장 버튼 → saveTicket → Alert 등)이 실제로 이어지는지는 한 번도 자동으로 검증된 적이 없었다 — 정확히 2026-08-04 `lab.tsx` dead-code 버그(순수 함수는 멀쩡한데 애초에 호출이 안 되던 버그) 때와 같은 종류의 회귀를 놓칠 수 있는 사각지대였다.
- **신규 테스트 4개 파일** (`tests/components/`): `deepPatternIntro.test.tsx`(소개 화면 — 안내 문구, "패턴 분석 시작하기" → 엔진 호출 → 스토어 저장 → 결과 화면 이동), `deepPatternResult.test.tsx`(결과 리스트 — 카드별 패턴 번호/독창성 표시, 카드 클릭 → 상세 이동, "다시 생성" → 엔진 재호출, "N게임 모두 저장" → saveTicket N회 호출), `deepPatternDetail.test.tsx`(상세 — 5개 지표(구조적 공백/패턴 독창성/공백 지속성/시간 안정성/통계적 유의성)와 그 설명 캡션, 가장 가까운 과거 당첨 정보 유/무 두 경우, 저장 버튼 → saveTicket → Alert), 그리고 세 화면 모두 배치가 없을 때(empty state)도 안전하게 안내 문구로 대체되는지까지 커버했다. 엔진(`recommendDeepPatterns`)과 저장(`saveTicket`)은 실제 Atlas/AsyncStorage 경로를 타지 않도록 `jest.mock()`으로 대체했다(엔진 자체 정확성은 `deepPatternEngine.test.ts`가, 이 테스트들은 "화면이 그 결과를 제대로 배선했는지"만 확인).
- **기반 인프라를 새로 갖춰야 했다** — 이 프로젝트 최초로 `expo-router`(useRouter/Stack.Screen)와 `react-native-svg`를 실제로 렌더링하는 화면을 `components` 프로젝트에서 테스트했기 때문에, 기존 `lab.test.tsx`(둘 다 안 씀)에는 없던 새 문제 3가지를 만나서 해결했다:
  1. **`jest.mock()` 팩토리의 out-of-scope 변수 참조 금지**: `jest.mock("expo-router", () => ({ useRouter: () => ({ push, replace }) }))`처럼 팩토리 밖에서 선언한 변수(`push`/`replace`)를 참조하면 "The module factory of `jest.mock()` is not allowed to reference any out-of-scope variables" 에러가 난다(babel-jest가 `jest.mock()`을 파일 최상단으로 호이스팅하기 때문에, 그 시점엔 아직 그 변수들이 초기화되지 않았을 수 있어서 막아둔 안전장치). Jest 컨벤션대로 변수명을 `mockPush`/`mockReplace`(대소문자 무관 `mock` 접두사)로 바꾸는 것으로 해결했다.
  2. **`react-native-svg`에 목이 없으면 네이티브 뷰 의존성 때문에 위험하다**: `tests/mocks/react-native-svg.tsx` 신규 — Svg/Circle/Rect/Path/Line/Text 등을 얇은 `View` 래퍼(forwardRef, `Animated.createAnimatedComponent`와도 호환)로 치환. `jest.config.js`의 `components` 프로젝트 `moduleNameMapper`에 등록.
  3. **`react-native-safe-area-context` — `<SafeAreaProvider>` 없이 렌더링하면 예외**: `BottomActionBar.tsx`가 `useSafeAreaInsets()`를 쓰는데 Provider 없이 렌더링하면 "No safe area value available..."로 죽는다. 패키지가 공식 제공하는 jest mock(`react-native-safe-area-context/jest/mock`)을 쓰면 되는데, **처음엔 이것도 moduleNameMapper로 붙였다가 새 버그를 만들었다** — 그 공식 mock 내부가 `jest.requireActual('react-native-safe-area-context')`로 "진짜 원본" React Context 객체를 가져오는 구조인데, moduleNameMapper는 패키지 이름의 모든 참조(requireActual 포함)를 우리가 지정한 대체 파일로 리다이렉트해버려서 공식 mock이 자기 자신을 다시 가져오는 순환이 되어 `SafeAreaInsetsContext`가 `undefined`로 깨졌다("Cannot read properties of undefined (reading '$$typeof')" 에러로 실제로 재현·확인). **수정**: moduleNameMapper 대신 `setupFiles`에서 `jest.mock("react-native-safe-area-context", () => jest.requireActual(".../jest/mock").default)`를 실행하는 방식으로 교체 — `jest.mock()`의 mock registry는 `requireActual`이 정확히 우회하도록 설계돼 있어 이 순환 문제가 없다. (`tests/mocks/safe-area-context.tsx` 신규, 원인·해결 과정을 파일 상단에 상세히 남겨뒀다 — 같은 함정에 다시 안 빠지도록.)
- **실행 시간 실측(이 샌드박스 한정)**: `components` 프로젝트는 파일당 콜드스타트가 80~135초 걸릴 만큼 느리다(이 환경 특유의 제약, 과거 QA_LOG에도 반복 기록됨). 한 번에 5개 파일을 전부 돌리면 이 세션의 도구 호출 시간 제한(약 175초)을 넘겨 타임아웃되므로, **파일 하나씩 개별 실행**해서 각각 통과를 직접 확인했다: `_svgProbe.test.tsx`(1/1), `deepPatternIntro.test.tsx`(2/2), `deepPatternResult.test.tsx`(4/4), `deepPatternDetail.test.tsx`(4/4) — **신규 테스트 총 11개 전부 이 세션에서 직접 실행해 통과를 확인했다.**
- **정직하게 밝혀야 할 부분 — 기존 `tests/components/lab.test.tsx`는 이번엔 재검증하지 못했다**: 같은 방식으로 개별 실행을 3회 시도했으나 전부 175초 타임아웃으로 끝까지 못 봤다. 원인을 추정해봤다 — (1) 내가 추가한 `react-native-svg`/`react-native-safe-area-context` 목이 lab.tsx가 렌더링하는 `SumTrendChart`/`SettingsSheet` 경로에 새로운 문제를 일으켰을 가능성, (2) 이 세션에서 jest-expo를 연달아 8회 넘게 실행하면서 누적된 샌드박스 자체의 느려짐(둘 다와 무관한 `unit` 프로젝트(ts-jest, 205개 테스트)가 같은 시간대에 정상 통과했다는 사실은 (2)를 뒷받침한다). 코드를 직접 검토한 결과 (1)일 메커니즘은 찾지 못했다 — `react-native-svg` 목은 예외 없이 항상 렌더링되는 단순 View 래퍼라 실패한다면 "타임아웃"이 아니라 "빠른 에러"로 나타났을 것이고, `SettingsSheet`의 `useSafeAreaInsets()` 호출은 시트가 열려야만(기본적으로 닫혀 있음) 실행되는 코드라 이번 setupFile 추가와 직접 부딪힐 지점을 찾지 못했다. 그래도 **100% 확신할 수는 없다** — 이 부분은 사용자 로컬에서 `npm test`(전체 스위트)를 한 번 실행해 `lab.test.tsx`가 여전히 정상 통과하는지 최종 확인이 필요하다.
- **검증**: `npx tsc --noEmit`·`npx eslint .` 클린(신규 테스트 파일 4개 + mock 파일 2개 포함 전체 리포지토리 기준). `npx jest --selectProjects unit` 재확인 — 25개 스위트 205개 테스트 전부 회귀 없이 통과(이번 변경은 `components` 프로젝트 전용이라 `unit` 프로젝트에는 영향이 없다는 것도 이걸로 재확인했다).
- **의도적으로 안 한 것**: `deep-pattern.tsx`의 로딩 애니메이션(`DeepPatternLoadingBoard`, `Animated.loop`)이 실제로 무한 루프 상태에서 렌더링될 때 테스트 클린업이 깨끗한지는 별도로 파고들지 않았다(현재 테스트들은 `isGenerating` 상태가 짧게만 유지되다 결과 화면으로 넘어가는 흐름이라 이 애니메이션 자체를 직접 마운트 상태로 오래 붙잡아두지 않는다) — 화면 코드 자체는 32~37번 항목처럼 언마운트 시 `animation/loop.stop()`을 명시적으로 호출하도록 이미 작성돼 있어 실질적인 위험은 낮다고 판단했다.

### 58. 전체 앱 종합 재점검(`APP_REVIEW_2026-08-08.md`) — 딥 패턴 탐색 다크모드 대비/버전 노출 결함 발견·수정, 접근성 그룹화 추가

- **배경**: 사용자가 "실기기 테스트는 EAS 빌드 쿼터 문제로 나중에 한 번에 몰아서 할 예정"이라며, 그 전에 할 수 있는 작업을 물어 4개 옵션(전체 종합 재점검/Combinadic 사전 작업/출시 준비 문서 정리/직접 지정) 중 "전체 앱 종합 재점검(권장)"을 선택. 8/6 리포트 이후 딥 패턴 탐색 기능이 새로 추가·완성된 만큼, 이 기능이 앱 전체와 잘 통합됐는지를 개발/보안/기획/UX 4개 관점에서 다시 점검했다.
- **재점검 중 발견해 그 자리에서 수정한 결함 2건**:
  1. **다크모드 텍스트 대비 미달**: `app/generate/deep-pattern-detail.tsx`의 `vizTitle`과 `app/generate/deep-pattern-result.tsx`의 `basinTag`가 고정값 `color: "#5847D6"`을 쓰고 있었는데, 다크모드 배경(`colors.surface`, `#161F32`) 위에서 대비비를 sRGB 상대 휘도 공식으로 직접 계산해보니 약 2.6:1로 WCAG AA(4.5:1) 미달이었다. `src/theme/colors.ts`에 이미 정의돼 있던 `tints.purple`(라이트 `#5B21B6`/다크 `#DDD6FE`, 둘 다 각자 배경에서 AA 통과)로 교체했다. `styles`/`createStyles` 함수 시그니처에 `tints?: AppTints`를 옵션 인자로 추가해, `LevelRow`처럼 기존에 1개 인자로 호출하던 곳은 그대로 두면서도(`tints` undefined일 때 기존 고정값으로 안전하게 폴백) 화면 최상단 호출부만 `tints`를 넘기도록 했다.
  2. **엔진 내부 버전 문자열이 사용자 화면에 그대로 노출**: `deep-pattern-result.tsx`의 하단 안내 문구가 `engineVersion`/`atlasVersion`(예: `"DPE-1.1-v3approx"`, `"ATLAS-1.1-v3approx"`)을 그대로 보여주고 있었다. `src/lib/deepPattern/types.ts` 자체의 설계 원칙("Basin/DeepVoid 같은 엔진 내부 개념은 이 타입 밖으로 나가지 않는다 — 사용자 언어로 이미 번역된 필드만 노출한다")과 어긋나고, 앱의 다른 어떤 화면에도 이런 버전 문자열을 보여주는 곳이 없다는 것도 grep으로 확인했다. `historyThroughDrawNumber`(제N회까지 반영)만 남기고 일반 사용자 문구로 교체했다.
  - 두 수정 모두 `npx tsc --noEmit`/`npx eslint .` 클린, 해당 화면의 `components` 테스트(`deepPatternDetail.test.tsx` 4/4, `deepPatternResult.test.tsx` 4/4)를 개별 재실행해 회귀 없음을 확인했다.
- **접근성 그룹화 추가**: `deep-pattern-detail.tsx`의 지표 행(구조적 공백/패턴 독창성/공백 지속성/시간 안정성/통계적 유의성)이 라벨·값·점 개수 3개 요소로 나뉘어 있어 스크린리더가 따로따로 읽던 것을, 행 전체를 `accessible + accessibilityLabel="라벨: 값"`으로 묶어 한 번에 읽히게 했다. 8/6 리포트가 강점으로 평가했던 결과 카드의 그룹화 패턴을 새 화면에도 동일하게 적용한 것이다.
- **그 외 재점검에서 확인만 하고 문제없음으로 판단한 것들**: `package.json` diff가 8/6 이후 완전히 비어 있음(신규 npm 의존성 0개로 딥 패턴 전체 기능 완성), 하드코딩 시크릿/API 키 재스캔 결과 없음, `npm audit --omit=dev`가 15건→25건(moderate 11/high 14)으로 늘었으나 diff와 grep으로 전부 `@expo/config-plugins → xcode → uuid` 체인(EAS 빌드 툴체인 전용, 런타임 미참조)임을 재확인, 8/6 리포트의 "중기 개선" 4개 항목(글씨 배율/회전 대응/태블릿 여백/splash 플러그인 이전)이 이미 별도 세션에서 전부 반영돼 있음을 git 로그로 재확인, `deep-pattern.tsx`가 grep상 `accessibilityLabel`이 없어 보이지만 실제로는 `BottomActionBar` 공용 컴포넌트가 내부적으로 처리하고 있어 문제없음(직접 컴포넌트 코드까지 열어 확인).
- **정직하게 밝혀야 할 부분**: 이번 재검증 중 `tests/components/lab.test.tsx`가 "5000ms 테스트 타임아웃 초과"로 실패하는 것을 다시 관찰했다(딥 패턴과 무관한 기존 테스트) — 57번 항목에서 이미 유사한 현상이 기록됐고 그때 사용자 로컬 `npm test`에서는 전부 통과가 확인된 바 있다. 이번엔 원인 규명보다 "내가 수정한 두 화면이 회귀를 일으켰는지"만 개별 실행으로 확인(둘 다 정상)했고, `lab.test.tsx` 자체의 재확인은 다시 한번 사용자 로컬 실행에 맡겼다 — 100% 확신할 수 없는 부분을 리포트에도 명시했다.
- **점수**: `APP_REVIEW_2026-08-08.md`에 8/6 대비 종합 88→91로 상세 근거와 함께 기록. 상세 내용(5개 관점, 경쟁 앱 대비 포지션, 우선순위별 개선 제안)은 리포트 파일 참고.
- **검증**: `npx tsc --noEmit`·`npx eslint .` 클린. `npx jest --selectProjects unit` 25개 스위트 205개 테스트 전부 통과(회귀 없음). `components` 프로젝트는 수정한 두 화면만 개별 실행해 통과 확인(전체 5개 파일 동시 실행은 이번에도 샌드박스 시간 제한으로 하지 못함).

### 59. Combinadic rank/unrank 사전 작업(§19) 신규 구현

- **배경**: 58번 종합 재점검 리포트가 "다음 단계 후보"로 정리해둔 것 중, 실기기 테스트 전에 진행할 수 있는 항목으로 사용자가 "Combinadic rank/unrank(§19)"를 1순위로 지정했다. 지금(v3, #55)은 basin마다 빌드타임에 reservoir sampling으로 뽑아둔 최대 150개 대표 후보(`sampleCombos`)만 쓰고 있는데, 앞으로 §7의 "Exact"(개별 조합) 해상도 계층을 만들거나 basin 표본을 더 정교하게(예: 결정론적 균등 간격 표본, 특정 순위 구간 추출) 다루려면 "이 조합이 전체 8,145,060개 중 몇 번째인가"/"몇 번째 조합이 무엇인가"를 즉시 계산할 수 있어야 한다 — 그 기반을 미리 준비하는 사전 작업이다.
- **구현**: `src/lib/deepPattern/combinadic.ts` 신규.
  - `rankCombination(numbers)`: 조합(1~45, 순서 무관 6개) → `scripts/build-deep-pattern-atlas.mjs`의 6중 for문(a<=40,b<=41,...,f<=45, 표준 사전순)이 매기는 것과 정확히 같은 순위(0~8,145,059)를, 8,145,060개를 실제로 순회하지 않고 이항계수 합만으로 O(45) 시간에 계산한다. 각 자리마다 "실제보다 더 작은 값이 왔다면 나머지 자리를 채우는 방법의 수"를 더하는 표준 조합론 공식을 그대로 구현했다.
  - `unrankCombination(rank)`: 순위 → 조합(1~45 오름차순 6개), `rankCombination`의 정확한 역함수. 각 자리 후보값을 0부터 올려가며 남은 순위에서 뺄 수 있는 만큼 빼는 방식.
  - 둘 다 입력 검증(개수 6개, 범위 1~45, 중복 없음, 순위 범위)을 갖췄고, 정렬 안 된 입력도 내부에서 정렬해 처리한다.
  - **정직한 현재 상태**: 이 모듈은 아직 엔진(`engine.ts`)이나 Atlas 빌더 어디에서도 실제로 호출되지 않는다 — 지금의 reservoir sampling 방식이 이미 latency 문제를 해결했기 때문에 당장 급하게 필요한 것은 아니고, 다음 단계(basin 표본 정교화, Exact 해상도 계층)를 위한 준비 작업이라는 점을 코드 docblock에도 명시했다.
- **검증(§34 Exhaustive/Golden/Property Test 원칙)**: `tests/deepPatternCombinadic.test.ts` 신규, 18개 테스트.
  - **golden value**: 사전순 첫/마지막 조합(순위 0, 8,145,059), 자릿수 캐리(carry) 경계값을 손으로 미리 계산해 하드코딩 — 예를 들어 a=1로 시작하는 조합 개수는 C(44,5)=1,086,008개이므로 `(1,41,42,43,44,45)`는 순위 1,086,007, `(2,3,4,5,6,7)`은 1,086,008이어야 한다는 걸 직접 검증. a=1,b=2 구간(C(43,4)=123,410개)의 경계도 동일하게 확인.
  - **사전순 순차 일치**: Atlas 빌더와 정확히 같은 6중 for문을 테스트 안에서도 재현해 처음 12,000개 조합을 직접 생성하고, 전부 `rank(combo)===idx`/`unrank(idx)===combo`를 전수 확인(자릿수 캐리가 여러 번 발생하는 구간까지 커버). 전체 8,145,060개를 다 도는 것은 테스트 비용상 비현실적이라 이 방식으로 대체했다.
  - **property 기반 round-trip**: 결정론적 PRNG(mulberry32, 고정 seed)로 무작위 순위 2,000개(unrank→rank)와 무작위 조합 2,000개(rank→unrank) round-trip을 확인.
  - **실제 Atlas 데이터 교차검증**: `data/deep-pattern-atlas.json`의 실제 `sampleCombos`(처음/중간/마지막 basin에서 일부)를 가져와 rank→unrank round-trip을 재확인 — 파일 무결성까지 이 신규 유틸 관점에서 다시 짚었다.
  - 입력 검증(잘못된 개수/범위/중복/순위) 오류 처리 테스트도 포함.
- **검증**: `npx tsc --noEmit`·`npx eslint .` 클린. `npx jest --selectProjects unit` — 신규 스위트 포함 **26개 스위트 223개 테스트 전부 통과**(회귀 없음, 신규 18개 테스트 전부 통과).
- **다음 단계**: 아직 실제로 쓰이는 곳이 없다 — basin 표본을 결정론적 균등 간격으로 뽑거나 §7 Exact 해상도 계층을 만들 때 이 유틸을 가져다 쓰면 된다.

### 60. `npm audit` 취약점 체인 실제 조사 — 안전하게 고칠 수 있는 부분만 반영

- **배경**: 58번 종합 재점검이 "8/6 15건 → 8/8 25건으로 늘어난 `npm audit` 건수를 다음 사이클에 한 번 확인"이라고 남긴 제안 항목을, 사용자가 Combinadic 작업(59번) 다음 순서로 지정해 실제로 조사했다.
- **조사 방법**: `npm audit --omit=dev --json`으로 전체 취약점 목록과 각 항목의 `fixAvailable` 정보를 직접 파싱했다. 결과: 대부분(`@expo/cli`, `@expo/config`, `@expo/config-plugins`, `expo`, `expo-router`, `expo-notifications`, `expo-constants`, `expo-linking`, `expo-splash-screen`, `react-native`, `metro` 계열, `postcss`, `uuid`, `xcode`, `image-size` 등)의 `fixAvailable`이 `{"name":"expo","version":"57.0.11","isSemVerMajor":true}` 또는 이에 준하는 **메이저 버전 상승**으로만 표시됐다 — 즉 지금 앱이 쓰는 Expo SDK 54(`expo: ~54.0.36`)를 SDK 57로 올려야만 해소되는 취약점들이고, 이는 8/6 리포트가 지적한 New Architecture 전환 이슈와 맞물린 훨씬 큰 작업이라 이번 세션에서 다룰 범위가 아니라고 판단했다. `npm audit fix --dry-run`으로도 재확인 — 이 항목들은 전부 `--force`(브레이킹 체인지 감수) 없이는 고칠 수 없음을 명시하고 있었다.
- **안전하게 고칠 수 있는 부분은 실제로 있었다**: `brace-expansion`(고, 취약 범위 `4.0.0-5.0.8`)이 `@expo/cli`/`@expo/config` 내부의 `glob`→`minimatch` 체인에 **패치 버전(5.0.9)으로 이미 게시돼 있었고**, `package.json`의 top-level 버전 제약(`expo: ~54.0.36` 등)을 전혀 건드리지 않고도 npm 리졸버가 그 안에서 고를 수 있는 범위였다. `npm audit fix`(force 아님)를 실행해 `package-lock.json`만 갱신했다(`package.json`은 diff 없음 — 커밋 전 `git diff package.json`으로 직접 확인).
- **결과**: `npm audit --omit=dev` 기준 **25건 → 23건(moderate 11/high 12, 기존 high 14)**으로 감소. brace-expansion 관련 high 취약점 2건이 해소됐다.
- **검증(회귀 없음 확인)**: `npx tsc --noEmit`·`npx eslint .` 클린. `npx jest --selectProjects unit` **26개 스위트 223개 테스트 전부 통과**. `components` 프로젝트도 딥 패턴 소개 화면(`deepPatternIntro.test.tsx`, 2/2)을 재실행해 jest-expo 프리셋이 lockfile 갱신 후에도 정상 동작함을 확인했다.
- **정직한 한계**: 남은 23건은 전부 Expo SDK 메이저 업그레이드(54→57)가 필요한 항목들이라 이번 세션에서는 손대지 않았다 — 8/6 리포트가 이미 지적한 New Architecture 전환 계획과 함께 묶어서 별도 세션으로 계획하는 게 맞다고 판단했다. 이 취약점들은 기존 리포트들이 반복 확인해온 대로 EAS 빌드/prebuild 툴체인 전용이며 `app/`·`src/` 런타임 코드에서 직접 import하는 곳이 없어(재확인 완료), 지금 당장 앱 런타임 보안에 영향을 주지 않는다는 결론은 이번에도 유효하다.

## 2026-08-12

### 61. 실기기 QA — 앱 실행 시 스플래시(로고) 노출 시간이 너무 짧음
- **증상**: 앱 최초 실행 시 로고가 나오긴 하지만 인지하기 어려울 정도로 순식간에 사라짐. 타사 앱들과 비슷한 수준으로 로고를 잠깐 더 보여줄 필요가 있음.
- **원인**: `app/_layout.tsx`에 `expo-splash-screen`의 `preventAutoHideAsync`/`hideAsync` 호출이 전혀 없었음(grep으로 프로젝트 전체 재확인, `SplashScreen` 참조가 이 파일 추가 전엔 0건). 이 프로젝트는 폰트 로딩(`useFonts`) 등 별도의 비동기 초기화 단계도 없어서, 네이티브 스플래시가 JS 번들 초기화가 끝나자마자(거의 즉시) 자동으로 사라지는 expo-splash-screen 기본 동작을 그대로 타고 있었던 것.
- **수정**: `app/_layout.tsx` 모듈 최상단에서 `SplashScreen.preventAutoHideAsync()`로 자동 숨김을 막고, `RootLayout`의 `useEffect`에서 `setTimeout(1500ms)` 후 `SplashScreen.hideAsync()`를 호출하도록 변경 — 최소 1.5초는 로고가 화면에 유지되게 함(값은 `MIN_SPLASH_DURATION_MS` 상수로 분리해 조정 쉽게 해둠). 스플래시 이미지/배경색 자체(`app.json`의 `expo-splash-screen` 플러그인 설정)는 기존 그대로 유지.
- **검증**: `npx tsc --noEmit`·`npx eslint app/_layout.tsx` 클린. (실기기 체감 시간은 EAS 빌드 후 재확인 필요 — 이 세션 환경엔 실기기가 없음.)

### 62. 홈 화면 — 전체 간격이 조밀함, 상단 "홈" 헤더 글자 크기·영역 축소
- **피드백**: 홈 화면 전반적으로 요소 간 간격이 좁아 답답해 보임. 최상단 네비게이션 헤더의 "홈" 타이틀 글자 크기를 줄이고 헤더 영역 자체도 축소해서 더 시원시원하고 가독성 좋게 만들어달라는 요청(중요도 높음으로 표시).
- **수정 1 — 상단 헤더**: `app/(tabs)/_layout.tsx`의 "index"(홈) 탭 화면에 한해 `headerTitleStyle`(fontSize 15, fontWeight 600 — 기존 라이브러리 기본값보다 작게)과 `headerStyle`(height 40 — 기존 기본 높이보다 낮게)을 개별 지정. 다른 3개 탭(번호 만들기/로또 연구소/내 번호)의 헤더는 요청 범위 밖이라 기존 그대로 유지(탭 전환 시 헤더 높이가 달라 보일 수 있는 점은 알아둘 것 — 다른 탭도 동일하게 줄이고 싶다면 후속 요청 필요).
- **수정 2 — 전체 여백**: `app/(tabs)/index.tsx` — 스크롤 컨테이너 패딩(16→20), 히어로 카드 padding/marginBottom(20→22 / 16→20), 퀵메뉴 행 gap/marginBottom(8→10 / 16→22), 퀵메뉴 버튼 세로 패딩(10→14), 카드(내가 자주 선택한 번호/최근 오래 나오지 않은 번호) padding/marginBottom(16→18 / 16→20)·제목 여백(10→12)·번호 공 gap(8→10), 하단 안내 문구 여백(marginTop 8→16, marginBottom 24→28) 등 화면 전반의 여백을 소폭씩 늘려 답답한 느낌을 완화.
- **검증**: `npx tsc --noEmit`·`npx eslint` 두 파일 클린. 레이아웃 수치 변경뿐이라 로직 회귀 위험은 낮다고 판단했지만, 실기기(또는 Expo Go)에서 실제 여백 체감과 헤더 높이 축소가 노치/상태바와 자연스럽게 어우러지는지는 이 세션에서 시각적으로 확인하지 못했으므로 실기기 재확인 필요.

### 63. 62번 후속 — 헤더 축소를 홈 탭 한정에서 4개 탭 전체로 확장(통일성)
- **피드백**: 62번에서 홈 탭에만 적용했던 헤더 글자 크기·높이 축소를, 나머지 3개 탭(번호 만들기/로또 연구소/내 번호)에도 동일하게 적용해 탭 전환 시 UI가 통일되게 해달라는 요청.
- **수정**: `app/(tabs)/_layout.tsx` — 홈 탭 `Tabs.Screen`에 개별로 넣어뒀던 `headerTitleStyle`(fontSize 15, fontWeight 600)·`headerStyle`(height 40, backgroundColor #0F172A)를 상위 `Tabs`의 공통 `screenOptions`로 옮겨 4개 탭 전부에 일괄 적용. 홈 탭의 개별 override는 이제 중복이라 제거(공통값과 동일).
- **검증**: `npx tsc --noEmit`·`npx eslint` 클린.

### 64. 홈 화면 — "최근 오래 나오지 않은 번호" 카드에 안내문구 + 바로가기 버튼 추가
- **피드백**: "내가 자주 선택한 번호" 카드처럼, "최근 오래 나오지 않은 번호" 카드도 번호만 보여주고 끝나면 의미가 없다 — "이번엔 나올지 모르니 선택할까요?" 같은 안내문구와 [바로가기] 버튼을 추가해 실제로 쓸 수 있게 해달라는 요청.
- **연결 화면 선정**: "자주 선택한 번호" 카드는 그 번호들을 **제외**하는 쪽(`/generate/exclusion`)으로 연결돼 있는 것과 대칭되게, "오래 나오지 않은 번호"는 그 번호들을 **포함(선호)** 하는 쪽이 자연스럽다고 판단. `/generate/ai-search`(AI 조합 탐색) 화면에 이미 "선호번호" 선택 UI(`NumberGrid`)가 있어서 이걸 그대로 활용.
- **수정 1 — 홈 화면**: `app/(tabs)/index.tsx` — "최근 오래 나오지 않은 번호" 카드 하단에 "이번엔 나올지도 모르니 포함해서 만들어볼까요?" 캡션 + "바로가기" 버튼 추가, 누르면 `/generate/ai-search`로 `preferred=1,7,23...` 파라미터와 함께 이동. "자주 선택한 번호" 카드가 쓰던 `frequentFooterRow` 스타일을 두 카드가 공용으로 쓰도록 `cardFooterRow`로 이름 정리(이름만 변경, 스타일 값은 그대로).
- **수정 2 — AI 조합 탐색 화면**: `app/generate/ai-search.tsx` — `exclusion.tsx`의 `parseExcludeParam`과 동일한 패턴으로 `parsePreferredParam` 신규 추가, `useLocalSearchParams<{ preferred?: string }>()`로 받은 값을 `preferred` state 초기값으로 반영(선호번호 그리드에 미리 체크된 상태로 진입). 홈 화면 바로가기로 들어온 경우(`cameFromShortcut`)에만 `exclusion.tsx`와 동일한 스타일의 안내 배너("홈 화면에서 오래 나오지 않은 번호가 자동으로 선호번호에 추가됐어요. 아래에서 직접 조정할 수 있어요.")를 화면 상단에 표시.
- **검증**: `npx tsc --noEmit`·`npx eslint` (수정한 두 파일) 클린. 순수 로직(`src/lib`) 변경은 없고 화면 배선만 추가한 거라 기존 자동 테스트에 영향 없음(해당 화면들은 원래도 `components` 렌더링 테스트가 없었음). 실기기에서 카드 → 바로가기 → AI 조합 탐색 화면 진입 시 선호번호가 실제로 체크돼 보이는지 최종 확인 필요.

### 65. 62번 후속 — "내가 자주 선택한 번호"/"최근 오래 나오지 않은 번호" 카드가 너무 커진 느낌
- **피드백**: 62번에서 화면 전체 여백을 넓힌 이후, 스크린샷으로 확인해보니 이 두 카드(공용 `card` 스타일)는 오히려 과하게 커진 느낌이라는 지적. 실기기 스크린샷 첨부로 확인됨.
- **수정**: `app/(tabs)/index.tsx`의 `card`/`cardTitle`/`ballRow`/`cardFooterRow` 스타일만 다시 촘촘하게 조정 — padding 18→14, marginBottom 20→16, 제목 하단 여백 12→8, 번호 공 gap 10→8, 하단 캡션+버튼 행 상단 여백 14→10. 62번에서 함께 넓혔던 히어로 카드·퀵메뉴·화면 전체 패딩 등 다른 영역은 이번 피드백 대상이 아니라 그대로 유지.
- **검증**: `npx tsc --noEmit`·`npx eslint` 클린. 레이아웃 수치만 조정.

### 66. "번호 만들기" 화면 — 최하단 "딥 패턴 탐색" 카드가 스크롤 없이는 존재를 모를 수 있음
- **피드백**: 화면 스크린샷 확인 결과, 6번째 카드 "딥 패턴 탐색"이 화면 맨 아래(탭바 바로 위)에 거의 붙어 있어 이게 스크롤로 더 볼 수 있는 항목인지 애매하게 보임 — 유저가 아예 존재를 모르고 지나칠 수 있음. 텍스트·간격·크기를 조정해서 "스크롤하면 하나 더 있다"는 걸 느끼게 해달라는 요청.
- **원인 분석**: 화면 로드 직후 스크롤 없이 보이는 영역만으로는 "지금 보이는 5개가 전부"인지 "더 있는데 살짝 잘린 건지" 판단할 단서가 전혀 없었음(카운트 안내, 스크롤 힌트 등 전무). 실기기 화면 크기에 따라 6번째 카드가 거의 다 보이거나(스크린샷 사례) 아예 안 보일 수도 있어, 특정 기기 크기에 의존하지 않는 안내가 필요하다고 판단.
- **수정**: `app/(tabs)/generate.tsx`
  - **텍스트**: subHeader 바로 아래(스크롤 없이 항상 보이는 위치)에 아래방향 화살표 아이콘 + "아래로 스크롤하면 총 {N}가지 방법을 모두 볼 수 있어요" 문구 신규 추가. 개수(N)는 `MENU_ITEMS.length`를 그대로 참조해서, 나중에 방법이 추가/제거돼도 문구가 자동으로 맞음(하드코딩 안 함).
  - **간격**: 카드 사이 여백 14→10, 카드 내부 패딩 14→12, subHeader 하단 여백 16→6(대신 새 스크롤 힌트 문구가 그 자리에서 14 여백을 가짐)으로 소폭 촘촘하게 조정 — 같은 화면 안에 더 많은 카드가 들어오게 해서 6번째 카드가 스크롤 없이도 일부 보일 가능성을 높임.
  - **크기**: 카드 아이콘 56→48(딥 패턴 탐색의 SVG 아이콘 `DeepPatternIcon`도 `size={48}`로 맞춰서 다른 5개 PNG 아이콘과 크기 통일 유지).
- **검증**: `npx tsc --noEmit`·`npx eslint` 클린. 실제로 6번째 카드가 어느 정도까지 보이는지는 기기 화면 크기마다 다를 수 있어 실기기에서 최종 확인 필요 — 다만 이번에 추가한 "총 N가지" 텍스트 힌트는 화면 크기와 무관하게 항상 스크롤 없이 보이는 위치에 있어서, 실기기에서도 이 부분만은 확실히 효과가 있을 것으로 판단.

### 67. 66번 후속 — 안내 문구 대신 자연스러운 하단 페이드(그러데이션)로 교체
- **피드백**: "아래로 스크롤하면 총 6가지 방법을 모두 볼 수 있어요" 같은 안내 문구는 본 적 없는 방식이라 어색하다 — 문구로 알려주지 말고 스크롤할 게 더 있다는 것만 자연스럽게(시각적으로) 느껴지게 해달라는 요청.
- **수정**: `app/(tabs)/generate.tsx`
  - 텍스트 힌트(아이콘+문구) 완전히 제거, `subHeader` 하단 여백도 원래 톤으로 복원(14).
  - 대신 `expo-linear-gradient`로 리스트 하단에 36px 높이의 페이드(투명 → 배경색) 오버레이를 얹어서, 마지막 카드가 화면 아래로 자연스럽게 흐려지며 "아직 안 끝났다"는 걸 암시하도록 함(`pointerEvents="none"`이라 터치는 그대로 카드에 전달됨).
  - 이 페이드는 **항상 떠 있는 장식이 아니라 실제 스크롤 상태를 반영**하도록 배선함 — `onLayout`으로 화면에 보이는 높이(viewport), `onContentSizeChange`로 전체 콘텐츠 높이, `onScroll`로 현재 스크롤 위치를 추적해서 "아직 스크롤할 내용이 16px 넘게 남아있을 때만" 보여주고, 맨 아래까지 스크롤하면 자동으로 사라짐(끝까지 스크롤했는데도 페이드가 계속 떠 있으면 오히려 버그처럼 보일 수 있어서 신경 씀).
  - 카드 패딩/간격/아이콘 크기를 줄인 66번 변경은 유지(더 많은 카드가 화면에 들어오는 건 여전히 유효한 개선이라 그대로 둠).
- **검증**: `npx tsc --noEmit`·`npx eslint` 클린. 페이드가 실기기에서 자연스러운 두께·색상으로 보이는지, 스크롤 끝에서 정확히 사라지는지는 이 세션에서 시각적으로 확인 못 해 실기기 확인 필요.

### 68. AI 조합 탐색 — "100만 회 부스터 탐색" 로딩 화면에 소요시간 안내 없음
- **피드백**: 100만 회 부스터 탐색을 선택하면 다른 옵션보다 훨씬 오래 걸리는데, 로딩 화면(스피너+퍼센트) 어디에도 "시간이 걸릴 수 있다"는 사전 안내가 없어서 로딩 화면이 뜨자마자(맨 처음에) 미리 알려줘야 할 것 같다는 요청. 스크린샷으로 "100만 회 부스터 탐색" 선택 화면과 6% 진행 중인 로딩 화면을 첨부해 확인됨.
- **수정**: `app/generate/ai-search.tsx` — 로딩 화면에서 `searchCount === BOOSTER_SEARCH_COUNT`(100만)일 때만 `LottoBallLoader` 스피너보다 먼저(화면 위쪽) "100만 회 부스터 탐색은 계산에 시간이 다소 걸릴 수 있어요." 문구를 추가. 로딩 화면이 뜨는 즉시(0%부터) 보이고, 초반에만 반짝 보이고 사라지면 의미가 없어서 탐색이 끝날 때까지 계속 노출. 색상은 이 화면이 이미 쓰고 있던 하드코딩 다크 팔레트에 맞춰 `theme/colors.ts`의 다크모드 orange 틴트와 동일한 `#FDBA74`를 그대로 사용(테마 토큰이 아니라 직접 값 — 이 진행 화면 전체가 라이트/다크 무관하게 항상 고정 다크 톤이라 기존 코드 관례를 따름).
- **검증**: `npx tsc --noEmit`·`npx eslint` 클린. 문구가 로딩 화면에서 시각적으로 눈에 잘 띄는지, 다른 3개 탐색 강도(바로 생성/3만/10만)에서는 안 뜨는 게 맞는지 실기기 확인 필요.

### 69. 45면체 주사위 — 구슬 아래 "탭해서 굴려보세요" 문구가 오해를 유발
- **피드백**: 화면 상단에서 계속 자전하는 45면체 주사위 구슬 아래에 "탭해서 굴려보세요"라고 적혀 있는데, 실제로 그 구슬을 탭해도 아무 반응이 없다(진짜 굴리기는 화면 하단의 "한 번 굴리기"/"자동 6회 굴리기" 버튼으로만 동작) — 문구 삭제 요청.
- **원인**: `src/components/Dice45.tsx`의 구슬 자체는 애초에 `Pressable`이 아니라 순수 장식용 `Animated.View`라 탭 핸들러가 없는데도, 캡션 텍스트와 접근성 라벨(`statusLabel`) 둘 다 "탭해서 굴려보세요"라고 안내하고 있었음 — 시각적으로도, 스크린리더로도 똑같이 잘못된 안내였음.
- **수정**: `src/components/Dice45.tsx` — 초기 상태(아직 한 번도 안 굴렸을 때)의 캡션 텍스트를 아예 렌더링하지 않도록 변경(`isSpinning || number !== null`일 때만 캡션 표시). 접근성 라벨도 동일하게 "탭해서 굴려보세요" 대신 그냥 "45면체 주사위"로 정리해 시각/스크린리더 양쪽 다 오해 소지를 없앰. 굴리는 중/방금 확정 상태의 문구는 그대로 유지(이건 실제로 일어나는 일을 정확히 설명하므로 문제없음). `dice.tsx`에는 이미 "가상의 45면체 주사위를 굴려보세요"라는 별도 안내 문구가 있어서, 이 캡션을 완전히 빼도 안내가 아예 없어지는 건 아님.
- **검증**: `npx tsc --noEmit`·`npx eslint` 클린.

### 70. 45면체 주사위 — "한 번 굴리기"/"자동 6회 굴리기" 버튼이 미리 선택된 것처럼 정적으로 보임
- **피드백**: 두 버튼(과 "초기화")을 눌러도 스타일이 전혀 안 바뀌어서, 뭔가를 "눌렀다"는 느낌이 없고 오히려 원래부터 고정된 선택 상태처럼 보인다는 지적. 다른 앱들이 일반적으로 쓰는 방식대로 눌렀을 때 체감되게 해달라는 요청.
- **원인**: `app/generate/dice.tsx`의 버튼 3개(`Pressable`)가 `style` prop을 고정 배열로만 넘기고 있어서 눌림(pressed) 상태에 따른 스타일 변화가 전혀 없었고, `android_ripple`도 설정돼 있지 않았음. 반면 이 앱의 다른 화면들(홈 화면 CTA 버튼, 번호 만들기 카드, 퀵메뉴 등)은 전부 `({pressed}) => [...]` 패턴 + 눌림 시 배경 어둡게/살짝 축소(`scale: 0.97~0.98`) + 안드로이드 리플을 공통으로 쓰고 있어서, 이 화면만 그 관례에서 빠져 있었던 것.
- **수정**: `app/generate/dice.tsx` — 세 버튼(한 번 굴리기/자동 6회 굴리기/초기화) 전부 `pressed` 상태를 받아 각 버튼 톤에 맞는 눌림 스타일(`buttonPrimaryPressed`/`buttonOutlinePressed`/`buttonSecondaryPressed` — 배경을 한 단계 진하게+`scale:0.97`)을 적용하고, `android_ripple` 색상도 각 버튼 톤에 맞게 추가. 앱 다른 화면과 동일한 "누르는 순간 살짝 어두워지고 축소" 패턴이라 통일성도 유지됨. 이전(13번 항목) 도입한 Primary/Secondary/Tertiary 색상 위계 자체는 그대로 유지(원인이 색상 구분이 아니라 프레스 피드백 부재였음).
- **검증**: `npx tsc --noEmit`·`npx eslint` 클린.

### 71. 딥 패턴 탐색 인트로 화면 — 긴 설명 대신 시각 효과 우선 배치 + 중복 경고 문구 삭제
- **피드백 1**: 처음 진입 화면의 설명 문단이 길어서 안 읽고 넘어가게 된다 — 설명보다 시각적 효과(점을 선으로 잇는 연출)를 먼저 체감할 수 있도록 상단에 배치하고 문구는 간소화해달라는 요청.
- **피드백 2**: 그 아래 경고 박스("이 분석은 각 번호 조합의 실제 당첨확률을 높이지 않습니다...")가 결과 화면 쪽에서도 이미 안내되고 있고 바로 위 설명과도 내용이 겹쳐서 중복으로 느껴진다 — 삭제 요청.
- **확인**: 실제로 `app/generate/deep-pattern-detail.tsx`(패턴 카드를 탭해 들어가는 상세 화면)에 "당첨확률과는 무관합니다. 모든 조합은 추첨에서 동일한 확률을 가집니다"라는 동일 취지의 안내가 이미 있음을 코드로 재확인 — 삭제해도 정직한 확률 안내 자체가 앱에서 완전히 사라지는 건 아니고, 오히려 결과를 실제로 해석하는 시점(상세 화면)에 더 가깝게 남아있는 구조.
- **수정**: `app/generate/deep-pattern.tsx`
  - 로딩 화면에서 이미 쓰고 있던 점-선 연결 애니메이션 컴포넌트(`DeepPatternLoadingBoard` — "점을 순서대로 이으며 선이 그려지는" 연출)를 인트로 화면 최상단에도 그대로 재사용해 배치.
  - 설명 문단을 "로또 용지의 1~45 번호를 좌표로 보고, 당첨번호 6개를 선으로 이으면...(2문장)" → "814만 개 조합과 역대 당첨 기록을 비교해, 상대적으로 덜 관측된 패턴 영역을 찾아드려요."(1문장)로 축약 — 좌표/선잇기 설명은 이제 위 애니메이션이 시각적으로 보여주므로 텍스트에서 뺐고, "이 기능이 뭘 해주는지"만 남김. 시각 요소 아래 캡션처럼 보이도록 가운데 정렬로 변경.
  - 경고 박스(`notice`/`noticeText` 스타일 포함) 완전히 제거. 더 이상 안 쓰는 `tints`(AppTints) 관련 import·변수도 함께 정리.
- **검증**: `npx tsc --noEmit`·`npx eslint` 클린. 애니메이션이 인트로 화면에서도 로딩 화면과 동일하게 자연스럽게 반복 재생되는지, 레이아웃이 실기기에서 어색하지 않은지 최종 확인 필요.

### 72. 딥 패턴 탐색 인트로 화면 — "덜 관측된 패턴 ↔ 다빈도 패턴" 혼합 슬라이더 추가
- **피드백**: 인트로 화면 애니메이션 아래 빈 공간에, 결과가 "덜 관측된 패턴"만 나오면 이미 자주 나온 패턴도 섞고 싶은 유저 니즈를 못 채운다 — 음량 조절 바처럼 가로로 긴 막대를 손으로 드래그해서 "다빈도 패턴 0%~100%"를 고를 수 있게 해달라는 요청. 단, 몇 %인지는 화면에 보여주지 말고, 내부 계산에서는 사용자가 놓은 지점을 0/10/15/25/50/75/100 중 가장 가까운 값으로 스냅해서 처리할 것. "패턴 분석 시작하기" 버튼이 기기 내비게이션 바와 겹치지 않는 상태는 계속 유지되어야 함.
- **수정**:
  - `src/components/deepPattern/PatternMixSlider.tsx`(신규): RN 코어 `PanResponder` 기반 커스텀 가로 슬라이더. 별도 슬라이더 라이브러리를 추가하면 네이티브 모듈이 생겨 EAS 재빌드가 필요해지므로, 기존 의존성만으로 구현. 트랙을 손으로 누르거나 드래그하면 채움 길이와 손잡이(thumb) 위치만 바뀌고 숫자(%)는 어디에도 표시하지 않음 — 양 끝에 "덜 관측된 패턴"/"다빈도 패턴" 라벨만 작게 표기. `accessibilityRole="adjustable"` + `accessibilityValue`로 스크린리더 접근성 확보.
  - `src/components/deepPattern/index.ts`: `PatternMixSlider` export 추가.
  - `app/generate/deep-pattern.tsx`: `DeepPatternLoadingBoard` 애니메이션 바로 아래에 슬라이더 배치. 슬라이더는 연속값(0~100) `frequentMixRatio` 상태를 그대로 들고 있다가(부드러운 드래그 체감을 위해), "패턴 분석 시작하기"를 누르는 순간(`handleStart`)에만 `snapFrequentPatternRatio()`로 스냅한 값을 `recommendDeepPatterns(count, snappedRatio)`에 넘김 — 화면에는 끝까지 % 노출 없음. 슬라이더는 스크롤 영역 안에 있고 `BottomActionBar`(하단 고정, `useSafeAreaInsets()`로 기기 내비게이션 바 높이만큼 자동 여백 확보)는 기존 그대로라 버튼 위치·겹침 방지 로직은 변경 없음.
  - `src/lib/deepPattern/engine.ts`: `recommendDeepPatterns(count, frequentPatternRatio = 0)`에 두 번째 파라미터 추가. 기존 `rankedBasinsByDeficit()`(밀도비 낮은 순 = 덜 관측된 basin부터)는 그대로 두고, 새 `buildBasinTraversalOrder(frequentPatternRatio)`가 그 결과를 감싸서: ratio=0이면 기존 순서를 100% 그대로 반환(슬라이더를 안 건드리면 이전과 완전히 동일한 동작 보장), ratio=100이면 반대 순서(밀도비 높은 순 = 다빈도 basin부터), 그 사이 값이면 두 순서를 ratio 비율로 인터리빙해서 섞은 순서를 반환 — basin 하나가 중복으로 뽑히지 않도록 dedupe. `FREQUENT_PATTERN_RATIO_STEPS`(0/10/15/25/50/75/100)와 `snapFrequentPatternRatio()`를 새로 export.
  - `DeepPatternRecommendation` 타입(`types.ts`)에는 손대지 않음 — "Basin 같은 엔진 내부 개념을 이 타입 밖으로 노출하지 않는다"는 기존 설계 원칙을 그대로 지킴(슬라이더 비율은 요청 파라미터일 뿐, 결과 데이터에 새 필드로 남기지 않음).
- **검증**: `npx tsc --noEmit` 클린(2회, 커밋 전/후 모두 확인). `npx eslint`는 커밋 직후 세션 안에서는 기기 쪽 디스크 I/O가 유독 느려서(파일 하나만 린트해도 40초 안팎 소요) 시간 내 확인을 못 했었는데, 이후 사용자가 실기기 터미널에서 직접 `npm run lint` 실행 — 에러/경고 없이 클린 확인됨. `npx jest tests/deepPatternEngine.test.ts`도 실기기 터미널에서 실행 — 5개 테스트 전부 통과(특히 "structuralVoidLevel이 HIGH면 0번 인덱스" 순서 테스트 포함, `frequentPatternRatio` 기본값 0이 이전과 동일한 코드 경로를 타는 것도 실증됨). 남은 것은 슬라이더 드래그 체감·양 끝 라벨 배치·결과 조합이 실제로 다빈도 쪽으로도 섞이는지에 대한 육안 확인뿐.

### 73. 딥 패턴 슬라이더 — 부담스럽지 않게 얇고 좁게 조정
- **피드백**: 72번에서 추가한 혼합 슬라이더가 양쪽으로 너무 넓고(화면 폭 꽉 채움) 두께도 두꺼워서 부담스럽다 — 유저가 "내가 선택했다"는 느낌은 적당히 주되, UI 자체는 가볍고 부담 없는 수준이어야 한다는 요청.
- **수정**: `src/components/deepPattern/PatternMixSlider.tsx`
  - 트랙에 좌우 인셋(`TRACK_HORIZONTAL_INSET = 22`)을 줘서 화면 폭 끝까지 안 닿고 살짝 안쪽으로 모이게 배치.
  - 두께 축소: 트랙 높이 8→4, 손잡이(thumb) 크기 22→15, 트랙을 감싸는 영역 높이 32→24.
  - 손잡이 테두리 2→1.5, 그림자 옅게(shadowOpacity 0.2→0.12, elevation 2→1)로 시각적 무게 감소. 손잡이 자체(흰 배경+보라 테두리)는 그대로 남겨서 "지금 여기를 선택했다"는 느낌은 유지.
  - 양 끝 라벨도 살짝 축소(11.5→10.5, 굵기 600→500)해서 슬라이더 전체가 더 가벼워 보이게 함.
  - 터치 판정 영역(`hitSlop`)은 그대로 top/bottom 16 유지 — 시각적으로는 얇아졌지만 실제로 누르기 어려워지진 않음.
- **검증**: 사용자가 실기기 터미널에서 `npm run lint` 실행 — 에러/경고 없이 클린. `npx jest tests/deepPatternEngine.test.ts`도 5개 전부 통과. `npx tsc --noEmit`는 별도로 재실행하진 않았으나, 이번 변경이 `PatternMixSlider.tsx`의 스타일 숫자 상수(트랙 높이·손잡이 크기·인셋 등)만 바꾼 것이라 타입 오류 여지가 사실상 없어 위험 낮음으로 판단. 실제 화면에서 두께/폭이 원하는 만큼 가벼워졌는지는 육안 확인 필요.

### 74. 딥 패턴 탐색 로딩 화면 — 점-선 애니메이션이 다 그려지기 전에 결과로 넘어가던 문제
- **피드백**: [스크린샷 2장] "패턴을 분석하고 있어요" 로딩 화면에서 점을 선으로 잇는 애니메이션이 끝까지 다 그려지는 걸 못 보고 결과 화면으로 넘어가버려서 어색하다 — 선이 다 이어지는 걸 보여준 뒤에 결과가 나오게 해달라는 요청.
- **원인**: `app/generate/deep-pattern.tsx`의 `MOCK_LOADING_MS`(로딩 화면을 최소 이만큼은 보여주는 인위적 지연)가 900ms였는데, `DeepPatternLoadingBoard`의 애니메이션 주기(`CYCLE_MS` 1800ms) 기준으로 선 자체는 progress 0.65(=1170ms)에 다 이어지고, 마지막(5번째) 점이 완전히 나타나는 시점은 0.8(=1440ms)로 그보다 더 늦음 — 즉 애니메이션이 눈에 "다 그려졌다"고 보이려면 최소 1440ms가 필요한데, 로딩 화면이 900ms 만에 끝나버려서 매번 애니메이션이 끊긴 채로 결과 화면으로 넘어갔던 것.
- **수정**: `app/generate/deep-pattern.tsx`의 `MOCK_LOADING_MS`를 900 → 1600으로 늘려서, 실제 계산이 그보다 먼저 끝나더라도(`Promise.all`로 최소 지연과 함께 대기) 애니메이션이 마지막 점까지 완전히 나타난 뒤(1440ms) 여유 있게 결과로 넘어가도록 함. `DeepPatternLoadingBoard.tsx` 자체(애니메이션 로직)는 변경하지 않음 — 인트로 화면 상단에서도 같은 컴포넌트를 계속 반복 재생 중이라 그쪽 연출과의 통일성을 그대로 유지.
- **검증**: `npx tsc --noEmit` 클린(기기에서 직접 확인). 애니메이션이 실제로 끝까지 이어진 뒤 넘어가는지, 1600ms 정도의 대기가 답답하게 느껴지지 않는지는 실기기 육안 확인 필요.

### 75. 딥 패턴 상세 화면 — "Pattern Map"을 예시용 고정 그림 대신 실제 위치의 근사치로 교체
- **피드백**: [스크린샷 2장, 동일] 패턴 상세 화면 하단 "Pattern Map"이 어떤 패턴을 봐도 항상 똑같은 고정된 원 몇 개(라벨도 "예시")였다 — 예시가 아니라 실제 위치의 근사치를, 유저가 더 인식하기 쉬운 그래프/맵 형태로 보여달라는 요청.
- **원인**: `app/generate/deep-pattern-detail.tsx`에 하드코딩된 `<Circle cx={60} cy={40} .../>` 등 좌표가 고정값이라 어떤 패턴(patternIndex)을 열어도 항상 같은 그림이 떴음. 실제 basin 좌표(rowZone/colZone 등)는 `types.ts`의 설계 원칙("Basin 같은 엔진 내부 개념은 이 타입 밖으로 나가지 않는다")상 화면에 그대로 노출하지 않기로 되어 있어서, 대신 이미 사용자에게 노출 중인 값들로 좌표를 근사해야 했음.
- **수정**:
  - `src/components/deepPattern/PatternPositionMap.tsx`(신규): 상세 화면 위쪽 카드에서 이미 보여주고 있는 값들 — 구조적 공백/공백 지속성/시간 안정성(LOW·MID·HIGH 3개를 0/50/100으로 환산해 평균낸 값, `structuralIntensityScore()`)을 가로축, `validationPercentile`(통계적 유의성, 0~100)을 세로축으로 써서 이 패턴의 실제 위치에 점 하나를 찍는다. 패턴마다(같은 basin이 아닌 이상) 실제로 다른 좌표가 나옴 — 더 이상 고정된 그림이 아님. 배경의 흐릿한 원 3개(고정 "밀집 영역" 예시)는 없애고, 대신 가운데 점선 십자선으로 사분면 경계만 표시해 "그래프"로서 더 인식하기 쉽게 단순화. 축 의미는 SVG 안 작은 글자 대신(모바일에서 잘 안 보임) 차트 아래 캡션으로 명확히 설명(`→ 오른쪽일수록 구조적 공백이 강한 패턴`, `↑ 위쪽일수록 통계적으로 뚜렷한 패턴`).
  - `src/components/deepPattern/index.ts`: `PatternPositionMap` export 추가.
  - `app/generate/deep-pattern-detail.tsx`: 하드코딩 SVG 블록을 `<PatternPositionMap recommendation={rec} />` 호출로 교체하고, 더 이상 안 쓰는 `Svg`/`Circle`/`Rect` import와 `mapLegend`/`mapLegendText` 스타일 정리. 부제 "전체 조합 중 상대 위치(예시)" → "전체 조합 중 상대 위치(근사치)"로 변경(더 이상 가짜 예시가 아니라 실제 값 기반 근사치이므로).
  - `DeepPatternRecommendation` 타입에는 손대지 않음 — 새 좌표는 기존에 이미 노출된 필드들을 조합해서 화면단에서만 계산.
- **검증**: 사용자가 실기기 터미널에서 최종 상태로 `npx tsc --noEmit`·`npm run lint` 재실행 — 둘 다 에러/경고 없이 클린. 패턴마다(1~5번) 점 위치가 실제로 다르게 찍히는지, 차트가 그래프로서 이전보다 더 잘 읽히는지는 육안 확인 필요.

### 76. [중요] 딥 패턴 상세 화면 — "이 번호 저장하기" 버튼이 기기 내비게이션 바와 겹치던 문제
- **피드백**: [스크린샷 2장, 동일] 패턴 상세 화면 하단 "이 번호 저장하기" 버튼이 기기 시스템 내비게이션 바(하단 제스처/버튼 바)와 겹쳐서 잘림. 반드시 고쳐야 하는 중요한 문제로 표시됨.
- **원인**: `app/generate/deep-pattern-detail.tsx`가 자체 `bottomBar`를 직접 구현하면서 `paddingBottom: 20` 고정값만 쓰고 있었음 — `useSafeAreaInsets()`를 전혀 안 써서 기기별 내비게이션 바 높이를 반영하지 못했음. 반면 앱의 다른 화면들(AI 조합 탐색/딥 패턴 인트로/운세 조합/45면체 주사위/제외 조합/행운 조합)은 전부 안전영역을 이미 올바르게 처리하는 공용 컴포넌트 `src/components/BottomActionBar.tsx`(`insets.bottom + 12`)를 쓰고 있어서, 이 화면만 그 관례에서 벗어나 있었던 것.
- **재발 방지 확인**: 같은 문제가 다른 화면에도 있는지 전체를 점검 — `app/generate/` 안에서 `bottomBar`라는 자체 스타일을 쓰는 곳은 이 화면이 유일했고, `BottomActionBar`를 이미 쓰고 있는 화면은 6개(ai-search/deep-pattern/destiny/dice/exclusion/lucky). 고정 버튼이 없는 나머지 화면(`deep-pattern-result.tsx`, `qr-check.tsx`)은 버튼들이 전부 `ScrollView` 안에 있어서(스크롤 콘텐츠의 일부) 같은 종류의 겹침 위험이 없음을 코드로 확인.
- **수정**: `app/generate/deep-pattern-detail.tsx` — 자체 구현한 `<View style={s.bottomBar}><Pressable .../></View>` 블록을 제거하고, 다른 화면들과 동일하게 `<BottomActionBar label={...} onPress={handleSave} disabled={isSaving} color="#6C5CE7" disabledColor="#C9C2FF" />`로 교체. 더 이상 안 쓰는 `bottomBar`/`saveButton`/`saveButtonDisabled`/`saveButtonText` 스타일 정리.
- **검증**: `npx tsc --noEmit` 클린(기기에서 직접, 최종 커밋 상태 기준 재확인). 실기기에서 버튼이 내비게이션 바와 안 겹치는지 최종 확인 필요. 참고: 이번 피드백 스크린샷의 Pattern Map이 75번 수정 전 모습(고정 원 3개, "(예시)")으로 보였는데, 코드는 이미 75번에서 반영·검증됐으므로 앱을 다시 로드(리로드/재시작)하면 최신 화면이 보일 것으로 예상됨 — 계속 예전 모습이면 알려주세요.

### 77. [조사] 딥 패턴 탐색 결과의 "제N회까지 반영" — 매주 자동 갱신되는지 확인 요청
- **질문**: 결과 화면 하단 "제1235회까지의 당첨 이력을 반영한 결과예요" 문구가 실제 당첨 이력처럼 매주 자동으로 갱신되는지 확인해달라는 요청.
- **조사 결과**: 자동 갱신되지 않음. 이 문구가 쓰는 값(`rec.historyThroughDrawNumber`)은 `data/deep-pattern-atlas.json`(딥 패턴용 81개 basin 통계 + 대표 조합 샘플)에서 오는데, 이 파일은 `scripts/build-deep-pattern-atlas.mjs`를 수동으로 실행해야 만들어지는 **빌드타임 산출물**이고 앱에 정적 import로 번들된다. 반면 `data/lotto-draws.json`(당첨번호 원본 이력)은 `.github/workflows/update-lotto-data.yml`이 매주 토요일 21:30(KST) 자동으로 갱신하고 있음 — 즉 "원본 이력"은 매주 자동으로 최신화되는데, 그걸 반영한 "딥 패턴용 재계산 결과"는 별도로 재빌드하지 않으면 그대로 멈춰 있는 구조였다. 실제로 확인 시점(8/13) 기준 앱 자체 회차 추정 공식(`estimateLatestDrawNumber()`)으로는 1236회가 나와야 하는데, atlas는 8/8 빌드 시점의 1235회에 멈춰 있어 이미 1회차 격차가 있었음.
- **처리**: 사용자가 "자동 재생성 워크플로 추가"를 선택 — `.github/workflows/update-deep-pattern-atlas.yml`을 새로 작성했다. `update-lotto-data.yml`(당첨 이력 자동 갱신)이 끝나면 이어서(`workflow_run` 트리거) `node scripts/build-deep-pattern-atlas.mjs`를 실행해 atlas를 다시 계산하고, 변경이 있으면(회차가 늘었으면 거의 항상 있음) `data/deep-pattern-atlas.json`을 자동 커밋한다. `package.json`에 `build:atlas` 스크립트도 추가해서 필요시 수동 재생성도 쉽게 함.
- **⚠️ 알아두어야 할 한계(중요)**: 이 워크플로는 저장소 안의 atlas "재료 파일"만 최신으로 유지해준다 — `data/deep-pattern-atlas.json`은 런타임에 다시 읽어오는 게 아니라 정적 import로 앱에 번들되는 빌드타임 데이터이기 때문에, 실제 사용자 화면의 "제N회까지 반영" 문구가 올라가려면 이 워크플로가 커밋한 최신 atlas를 포함해서 **앱을 다시 빌드하고 배포(EAS build 등)하는 과정이 반드시 별도로 필요**하다. 이 워크플로만으로는 이미 설치된 앱이 자동으로 최신화되지 않는다.
- **커밋 관련 참고**: `.github/workflows/*.yml` 파일은 원격 기기 쓰기 도구로 직접 쓸 수 없게 보호되어 있어서(보안상 CI 워크플로 파일은 원격에서 못 바꾸게 막아둔 것으로 보임) `update-deep-pattern-atlas.yml`은 커밋하지 못했다 — 사용자에게 파일을 전달했으니 `.github/workflows/` 폴더에 직접 저장해야 함. `package.json`(build:atlas 스크립트 추가)은 정상 반영·커밋됨.
- **검증**: `package.json`은 JSON 유효성 확인됨. 워크플로 yaml은 기존 `update-lotto-data.yml`과 동일한 구조/스타일로 작성(문법 오류 시 GitHub Actions 탭에서 바로 확인 가능). 실제로 다음 주 토요일 실행 후 커밋이 발생하는지, 그리고 다음 앱 빌드 때 새 atlas가 반영되는지는 확인 필요.

### 78. [중요] 딥 패턴 Atlas — 앱 재빌드 없이 자동·서버리스로 최신화되게 아키텍처 변경
- **배경**: 77번에서 "atlas 재생성은 자동화했지만, 실제 사용자 화면에 반영되려면 앱을 다시 빌드·배포해야 한다"고 안내하자, 사용자가 "앱 업데이트를 매주 해야 하는 건 유저에게 곤란하다 — 자동화·서버리스 형태를 유지할 방법을 고안해달라"고 요청. 중요한 문제로 표시됨.
- **해결 방향**: `data/deep-pattern-atlas.json`을 앱에 **정적 번들**하는 대신, 이미 이 앱이 당첨 이력에 쓰고 있는 것과 동일한 패턴(`src/lib/draws/githubDataSource.ts`+`drawCache.ts` — "GitHub Actions가 정적 파일을 주기적으로 갱신·커밋해두고, 기기가 그 파일을 raw.githubusercontent.com에서 직접 받아온다", 서버 비용 없음)을 딥 패턴 Atlas에도 그대로 적용했다. 이러면 77번 워크플로가 매주 커밋해두는 최신 atlas를 **앱 재배포 없이** 기기가 스스로 받아와 쓸 수 있다 — 완전히 자동·서버리스.
- **설계(신규 파일)**:
  - `src/lib/deepPattern/atlasTypes.ts`: 기존 `engine.ts`에만 있던 `AtlasBasin`/`AtlasHistoryEntry`/`Atlas` 타입을 공용으로 분리(순환 참조 방지). 응답이 실제 Atlas 형태인지 구조적으로만 검증하는 `isPlausibleAtlas()`도 여기 둠(당첨 이력 쪽 `isPlausibleWinningDraw`와 같은 원칙 — "받아왔다고 그대로 안 믿는다").
  - `src/lib/deepPattern/atlasGithubSource.ts`: `githubDataSource.ts`와 동일한 구조로 GitHub raw JSON을 받아온다. 절대 throw하지 않고 실패하면 항상 null(오프라인/타임아웃/형식 오류 전부 조용히 폴백).
  - `src/lib/deepPattern/atlasCache.ts`: `drawCache.ts`와 동일한 원칙의 로컬 캐시 + 동기화 주기(6시간, 당첨 이력과 동일) 관리. 받아온 atlas가 지금 쓰는 atlas보다 회차가 더 최신일 때만 채택.
  - `src/lib/deepPattern/engine.ts`: 번들된 atlas(`bundledAtlas`, §30 "오프라인에서도 핵심 추천은 계속 동작" 원칙 유지 — 항상 쓸 수 있는 바닥)를 기본값으로 하는 `activeAtlas`(mutable)를 도입. 모듈 로드 시 로컬 캐시에 더 최신 atlas가 있으면 즉시(네트워크 없이) 교체하고, 새로 export한 `refreshAtlasIfStale()`을 호출하면 GitHub에서 최신 atlas를 받아 더 최신이면 교체한다. 기존 `atlas.xxx` 참조는 전부 `activeAtlas.xxx`로 바뀌어서, 교체된 즉시 다음 추천부터 반영됨.
  - `app/generate/deep-pattern.tsx`: 화면 마운트 시 `refreshAtlasIfStale()`을 한 번 호출(useEffect, fire-and-forget) — "패턴 분석 시작하기"를 누르는 흐름 자체는 이 네트워크 요청을 기다리지 않는다.
- **테스트 안전성(신경 쓴 부분)**: `tests/deepPatternEngine.test.ts`가 `engine.ts`를 직접 import하는데, `atlasCache.ts`가 쓰는 `AsyncStorage`는 네이티브 모듈이라 `jest.config.js`의 "unit" 프로젝트(ts-jest+node, RN 목 없음)에서 실제로 호출하면 에러가 난다는 걸 미리 확인했다(`node -e "require('@react-native-async-storage/async-storage').default.getItem('x')"`로 재현 — "window is not defined"). 그래서 (a) 모듈 로드 시 자동으로 도는 부분은 로컬 캐시 읽기(`readJson`)뿐이고 `readJson`은 실패 시 항상 조용히 fallback을 반환하도록 이미 짜여 있어 이 환경에서도 안전하게 no-op된다, (b) 실제 네트워크 요청이 필요한 `refreshAtlasIfStale()`은 `engine.ts` 내부(모듈 최상단이나 `recommendDeepPatterns()` 안)에서 자동 호출하지 않고 화면(`deep-pattern.tsx`)에서만 명시적으로 호출하게 분리했다 — `tests/deepPatternEngine.test.ts`는 화면 코드를 안 건드리므로 항상 네트워크 없이 결정론적으로 돈다. `frequentPatternRatio` 기본값 0과 같은 원칙: 손 안 댄 경로는 기존과 완전히 동일하게 동작.
- **검증**: `npx tsc --noEmit` 클린(기기에서 직접, 최종 커밋 상태 기준). `npx jest --selectProjects unit tests/deepPatternEngine.test.ts`는 이번엔 기기 응답이 계속 느려서(여러 번 시도해도 45초 내 안 끝남 — 반면 사용자가 직접 터미널에서 돌렸을 때는 5초 안팎이었음, 원인은 기기 자체가 아니라 이 세션이 쓰는 원격 실행 경로의 오버헤드로 추정) 이번 세션에서 직접 재확인은 못 했다. 위 "테스트 안전성" 분석과 로직상 근거는 확실하지만, **사용자가 실기기 터미널에서 `npx tsc --noEmit`·`npm run lint`·`npx jest tests/deepPatternEngine.test.ts` 한 번 더 돌려서 최종 확인 필요** — 특히 5개 테스트 전부(개수·유효성·중복 없음·구조적 공백 순서·3초 이내 완료) 그대로 통과하는지가 중요.
- **남은 참고**: 새 Atlas 최초 배포(다음 EAS 빌드)까지는 GitHub의 최신 atlas가 여전히 저장소에만 있고 기존 설치 앱은 번들된 이전 atlas를 쓴다 — 그 최초 배포 이후부터는 이 세 파일이 있으므로 이후로는 앱 재배포 없이도 계속 최신화된다.

### 79. 78번 후속 — expo-secure-store ESM import 때문에 unit 테스트가 깨지던 문제 수정
- **발견**: 사용자가 78번 검증을 위해 `npx jest tests/deepPatternEngine.test.ts`를 실기기 터미널에서 재실행 — "Cannot use import statement outside a module" 에러로 테스트 스위트 자체가 실행되지 못하고 실패함.
- **원인**: `atlasCache.ts`가 `src/lib/storage/storage.ts`의 `readJson`/`writeJson`을 그대로 가져다 썼는데, `storage.ts`는 같은 파일 안에서 `secureStorage.ts`(생년월일 등 민감정보용, `expo-secure-store` 사용)도 함께 import한다. `expo-secure-store`는 ESM 전용 패키지라, `tests/deepPatternEngine.test.ts`가 도는 jest "unit" 프로젝트(`jest.config.js` — ts-jest+node 환경, node_modules는 변환하지 않음)에서 `require`로 그대로 로드하려다 문법 오류로 실패함. 이 체인은 `tests/deepPatternEngine.test.ts` → `engine.ts` → `atlasCache.ts` → `storage.ts` → `secureStorage.ts` → `expo-secure-store` 순으로 연결됨 — engine.ts가 이번에 처음으로 storage.ts를 간접적으로 물게 되면서 드러난 문제.
- **수정**: `src/lib/deepPattern/atlasCache.ts`가 `storage.ts`를 아예 거치지 않고 `AsyncStorage`(`@react-native-async-storage/async-storage`)를 직접 쓰도록 변경 — `readJson`/`writeJson`과 동일한 동작(읽기 실패 시 조용히 fallback, 쓰기 실패 시 throw)을 이 파일 안에 축소판으로 재구현했다. `storage.ts`와 같은 네임스페이스(`"@ai-lotto/"`)를 그대로 맞춰서 다른 모듈이 저장한 값과 안 섞이게 함. `engine.ts`/`atlasGithubSource.ts`/`atlasTypes.ts`는 변경 없음.
- **검증**: `npx tsc --noEmit` 클린(기기 직접). 사용자가 실기기 터미널에서 `npx jest tests/deepPatternEngine.test.ts` 재실행 — import 에러 없이 5개 테스트 전부 통과 확인됨(status/메타데이터/유효성·중복없음/구조적 공백 순서/3초 이내 완료). 78/79번(딥 패턴 Atlas GitHub 자동 동기화 아키텍처)이 최종적으로 정상 동작 확인됨.

### 80. 72~79번 커밋 후 GitHub Actions CI(`ci.yml`)가 실패하던 문제 수정
- **발견**: 72~79번 변경사항과 77번 워크플로(`update-deep-pattern-atlas.yml`)를 커밋·푸시한 뒤, 기존 CI(`ci.yml`)의 `verify` 잡이 실패함(exit code 1). 새로 추가한 워크플로 자체는 문제가 아니었고, 기존 테스트 스위트 안에서 발견됨.
- **원인 1**: `tests/components/deepPatternIntro.test.tsx`가 `jest.mock("../../src/lib/deepPattern/engine", ...)`으로 엔진 모듈 전체를 모킹하면서 `recommendDeepPatterns`만 mock으로 넣어뒀는데, 72번(`snapFrequentPatternRatio`)과 78번(`refreshAtlasIfStale`)에서 `app/generate/deep-pattern.tsx`가 실제로 호출하게 된 함수 두 개가 mock에 없어서 `TypeError: ... is not a function`으로 렌더링 자체가 실패함 — 로컬에서 `npx jest tests/deepPatternEngine.test.ts`(엔진 순수 로직 테스트)만 확인하고 화면 렌더링 테스트(`tests/components/`)는 이번 세션 중 재확인을 안 한 게 원인.
- **원인 2**: 같은 테스트 파일에 `실제 당첨확률을 높이지 않습니다` 문구가 화면에 있는지 확인하는 assertion이 남아 있었는데, 이 문구는 이번 세션이 아니라 **71번(이전 세션) 때 이미 의도적으로 삭제된** 문구였음(결과 상세 화면과 중복된다는 피드백으로 제거) — 71번 당시 화면 코드는 고쳤지만 테스트는 안 고쳐서 몰래 깨져 있던(하지만 아무도 그 사이에 이 특정 테스트 파일만 따로 돌려보지 않아 발견 못한) 상태였음.
- **수정**: `tests/components/deepPatternIntro.test.tsx`
  - engine 모듈 mock에 `refreshAtlasIfStale: jest.fn(() => Promise.resolve())`, `snapFrequentPatternRatio: jest.fn((value) => value)` 추가.
  - `실제 당첨확률을 높이지 않습니다` assertion 제거, 테스트 이름도 "소개 문구와 확률 무관 경고 문구가 화면에 나타난다" → "소개 문구가 화면에 나타난다"로 수정하고 왜 그 assertion이 없어졌는지(71번 참고) 주석으로 남김.
- **검증**: 사용자가 실기기 터미널에서 `npx jest tests/components/deepPatternIntro.test.tsx` 재실행 — 2개 테스트 모두 통과. 이어서 `npx jest`(전체 스위트) 실행 — 31개 스위트·235개 테스트 전부 통과 확인. 커밋(`23edb13`) 후 푸시 완료, GitHub Actions CI 재통과 여부는 사용자가 Actions 탭에서 최종 확인 예정.
- **교훈**: 화면(UI) 배선을 바꾸는 변경(새 함수 호출 추가 등)을 할 때는 해당 화면을 렌더링하는 컴포넌트 테스트(`tests/components/`)가 그 함수를 모킹하고 있는지도 함께 확인해야 함 — 엔진 단위 테스트만 통과했다고 안심하면 안 됨. 이후 QA 세션에서는 `app/generate/*.tsx` 변경 시 대응하는 `tests/components/*.test.tsx`도 습관적으로 같이 확인할 것.

### 81. 로또 연구소 — "제N회 당첨결과" 카드가 통계 카드들과 구분이 안 됨
- **피드백**: [스크린샷 2장, 동일] 로또 연구소 화면의 "제 1236회 당첨결과" 카드(실제 정부 발표 결과)가 그 아래 "번호별 출현 빈도 Top 6"·"장기 미출현 번호" 같은 통계/분석 카드들과 똑같은 흰색 카드 스타일이라, 이게 실제 당첨 결과라는 걸 바로 인지하기 어렵다 — 영역 색깔을 다르게 해서 실제 당첨 결과임을 알아볼 수 있게 해달라는 요청.
- **원인**: `app/(tabs)/lab.tsx`에서 "제N회 당첨결과" 카드가 아래 통계 카드들과 동일한 공용 `styles.card`(흰 배경 + 연한 회색 테두리)를 그대로 쓰고 있었음 — "이번 주 리포트" 카드만 고정 다크 톤(`weeklyCard`, `#0F172A`)으로 이미 구분돼 있었는데, 정작 가장 먼저 구분돼야 할 "실제 공식 결과" 카드는 구분이 안 되어 있었던 것.
- **수정**: `app/(tabs)/lab.tsx`
  - 새 스타일 `officialCard`: `src/theme/colors.ts`에 이미 있는 상태 배지용 색 토큰 `tints.green`(라이트: 옅은 초록 배경 `#ECFDF5`+진한 초록 테두리 `#047857`, 다크: 어두운 초록 배경 `#064E3B`+밝은 초록 테두리 `#6EE7B7` — 라이트/다크 모두 자동 대응)을 카드 배경·테두리(1.5px)로 사용. 새 하드코딩 색을 추가하지 않고 기존 디자인 시스템 토큰만 재사용.
  - 카드 안에 `officialBadge`(둥근 알약 모양, `colors.surface` 배경 + `tints.green.fg` 텍스트) — "실제 당첨결과" 텍스트 배지를 제목 위에 추가. 색상 차이만으로 구분하면 접근성 문제(색맹 등)가 있을 수 있어, 텍스트로도 명확히 구분되도록 함.
  - 당첨번호를 못 불러온 에러 상태(현재는 `latestDraw`가 없는 폴백 카드)는 그대로 기존 `styles.card` 유지 — 실제 결과가 없는 상태라 강조할 대상이 아님.
- **검증**: `npx tsc --noEmit`·`npx eslint .` 클린. `npx jest tests/components/lab.test.tsx` 통과(1개 테스트, 텍스트 쿼리 기반이라 스타일 변경에 영향 안 받음). 실제 색감이 라이트/다크 양쪽에서 잘 구분되는지는 실기기 육안 확인 필요.

### 82. 81번 후속 — "장기 미출현 번호"가 본번호로 나오면 즉시 빠지는지 확인 + 보너스 번호도 출현으로 인정
- **질문 1**: 81번 스크린샷을 본 사용자가 "장기 미출현 번호는 표시된 번호에서 당첨번호로 나오면 바로 빠지게끔 설정되어 있는지 체크해봐"라고 요청.
- **조사 결과**: 이미 정상 동작 중이었음. `computeNumberFrequencies()`가 최신 회차를 포함한 최근 52회 표본을 매번 다시 계산하면서 번호별 `lastDrawNumber`(마지막 출현 회차)를 갱신하고, `getLongestAbsentNumbers()`는 `latestDrawNumber - lastDrawNumber`(미출현 회차 수)가 큰 순으로 정렬해 상위 6개만 보여준다. 이번 회차(1236회) 본번호 6개는 `lastDrawNumber`가 즉시 1236으로 갱신되어 미출현 회차 수가 0이 되므로, 자동으로 최하위권으로 밀려나 목록에 절대 안 들어감 — 별도 수정 불필요.
- **질문 2**: 조사 과정에서 스크린샷 속 이번 회차 보너스 번호(10)가 여전히 "장기 미출현 번호"(19회째)에 남아있는 걸 발견해 사용자에게 알림 — 앱이 "출현" 판정을 본번호 6개 기준으로만 계산하고(`totalCount`/Top6/사카이 분석과 동일한 관례) 보너스는 별도 집계(`bonusCount`)만 하기 때문. 의도된 설계인지 확인 요청 → 사용자가 "보너스 번호까지 출현으로 쳐서 미출현 목록에서 빼자"고 결정.
- **수정**: `src/lib/draws/drawStats.ts`의 `computeNumberFrequencies()` — 본번호 순회 후 `bonuses` 집계와 별개로, 보너스 번호에 대해서도 `lastSeen`(→ `lastDrawNumber`)을 갱신하는 로직을 추가(`markSeen()` 헬퍼로 본번호·보너스 공용화). `totalCount`(출현 빈도, Top6·사카이 분석 등에서 쓰는 "몇 번 나왔는지"의 의미)는 그대로 본번호만 세도록 유지 — "미출현 판정"에 쓰이는 `lastDrawNumber`만 보너스를 포함하도록 범위를 좁혀서, 다른 화면(출현 빈도 Top 6 등)에는 영향이 없게 함.
- **검증**: `tests/drawStats.test.ts`에 신규 케이스 추가 — 본번호로는 한 번도 안 나오고 최신 회차에 보너스로만 나온 번호가 `totalCount=0`(빈도는 그대로 0)이면서도 `lastDrawNumber`는 그 회차로 갱신되고, `getLongestAbsentNumbers()` 결과에도 빠지는지 확인. `npx tsc --noEmit`·`npx eslint .`·`npx jest tests/drawStats.test.ts`(18개 전부, 신규 케이스 포함) 모두 클린/통과 확인(사용자 실기기 터미널). 로또 연구소/홈 화면에서 이번 회차 보너스 번호가 실제로 미출현 목록에서 빠지는지는 실기기 육안 확인 필요.

### 83. "당첨번호 합계 추세" 그래프 — 스크롤 가능한 걸 알아채기 어렵고, 기본으로 오래된 회차부터 보임
- **피드백**: [스크린샷 2장, 동일] 로또 연구소의 "당첨번호 합계 추세 (최근 52회)" 그래프에 대한 두 가지 요청. (1) 그래프가 가로로 스크롤된다는 걸 유저가 인지할 수 있게 그래프 영역의 색상을 다르게 달라는 요청. (2) 화면에 처음 들어왔을 때 디폴트로 가장 최신 시점의 값이 보이게 해달라는 요청(스크린샷 기준 처음엔 가장 오래된 회차인 1185회부터 보이고 있었음).
- **원인**: `src/components/SumTrendChart.tsx` — 52개 회차 전체를 그리다 보니 그래프 실제 폭(`chartWidth`)이 화면보다 훨씬 넓어서 원래도 가로 스크롤이 가능한 구조였는데, (1) `<ScrollView>`가 카드와 똑같은 흰 배경이고 `showsHorizontalScrollIndicator={false}`로 스크롤바까지 꺼놔서 스크롤 가능한 영역이라는 시각적 단서가 전혀 없었음. (2) `<ScrollView>`에 별도 스크롤 위치 제어가 없어 기본값(맨 왼쪽 = 가장 오래된 회차)에서 시작했음.
- **수정**: `src/components/SumTrendChart.tsx`
  - `<ScrollView>`를 새 `chartPanel` 스타일(`colors.surfaceAlt` 배경, 둥근 모서리)로 감싸서 카드 흰 배경과 명확히 구분되는 별도 패널처럼 보이게 함. `showsHorizontalScrollIndicator`도 다시 켜서 네이티브 스크롤바 힌트까지 함께 제공(색상 구분 + 스크롤바 두 가지 신호).
  - `useRef<ScrollView>`로 참조를 잡고, `onContentSizeChange`(그래프 폭이 실제로 확정되는 시점 — 표본이 바뀌어 폭이 달라질 때도 다시 호출됨)에서 `scrollToEnd({ animated: false })`를 호출해 항상 맨 오른쪽(최신 회차)이 기본으로 보이게 함.
- **검증**: `npx tsc --noEmit`·`npx eslint .` 클린. `npx jest tests/components/lab.test.tsx` 통과(이 화면이 `SumTrendChart`를 렌더링하는 유일한 컴포넌트 테스트 — jest 테스트 렌더러에는 실제 레이아웃 엔진이 없어 `onContentSizeChange`가 테스트 중에는 호출되지 않으므로 `scrollToEnd` 관련 회귀 위험 없음을 확인). 실기기에서 그래프 영역이 시각적으로 구분되는지, 진입 시 최신 회차(1236회)가 바로 보이는지는 육안 확인 필요.

### 84. "내 번호" 화면 — 저장한 카드들이 너무 촘촘해서 가독성 저하
- **피드백**: [스크린샷 2장, 동일] 내 번호 화면에서 저장한 조합 카드들의 영역이 다 똑같이 나열돼 있어 눈에 잘 안 들어오고 피곤하다 — 각 카드 영역을 좀 줄이고, 카드 사이 간격을 늘려서 가독성을 개선해달라는 요청.
- **수정**: `app/(tabs)/tickets.tsx`
  - `card`: 안쪽 여백 `padding` 16→14로 살짝 축소, 카드 사이 간격 `marginBottom` 12→20으로 확대(카드 자체는 컴팩트하게, 카드 간 구분은 뚜렷하게).
  - 카드 내부 요소 간격도 같이 좁혀서 카드 자체의 세로 길이를 줄임: `cardHeader.marginBottom` 10→8, `ballRow.marginBottom` 10→8, `bottomRow.marginTop` 8→6.
  - 로또볼 크기·카드 테두리·상태 배지 등 다른 요소는 변경하지 않음 — 요청 범위(영역 크기·간격)에만 한정.
- **검증**: `npx tsc --noEmit`·`npx eslint .` 클린(이 화면은 별도 컴포넌트 테스트가 없어 스타일 숫자만 바뀐 이번 변경은 타입/린트 확인만으로 충분하다고 판단). 실기기에서 카드들이 실제로 더 편하게 구분되는지는 육안 확인 필요.

### 85. "내 번호" — 당첨/낙첨 확인 알림 문구가 기계적임
- **피드백**: [스크린샷 2장, 동일] "당첨 확인"을 눌렀을 때 뜨는 팝업이 "결과: 낙첨"처럼 너무 기계적이다 — "안타깝게도 낙첨되었습니다." 같은 인간미 있는 문구로 바꿔달라는 요청. 이어서 당첨됐을 때는 현재 어떻게 뜨는지 질문 → 그것도 "축하합니다. OO등에 당첨되셨습니다." 식으로 바꿔달라는 요청.
- **조사**: 수정 전엔 낙첨·당첨 구분 없이 `Alert.alert(`결과: ${RANK_LABELS[rank]}`)` 한 줄로만 처리하고 있어서, 당첨이든 낙첨이든 "결과: 1등"/"결과: 낙첨"처럼 동일하게 기계적으로 표시되고 있었음.
- **수정**: `app/(tabs)/tickets.tsx`
  - 새 헬퍼 `buildResultAlert(rank)` 추가 — 낙첨(rank 0)이면 제목 "낙첨" + "안타깝게도 낙첨되었습니다.", 당첨(rank 1~5)이면 제목 "당첨을 축하드려요!" + "N등에 당첨되셨습니다!"를 반환. `handleCheckResult`(수동 "당첨 확인" 버튼)의 알림을 이걸로 교체.
  - 화면 진입 시 배경에서 여러 조합을 한꺼번에 자동 확인해주는 `autoCheckPendingTickets`의 요약 알림도 같은 톤으로 통일 — 당첨된 회차가 있으면 "제 N회 조합이 O등에 당첨됐어요!" 식 문장으로, 없으면 기존 "아쉽게도 당첨은 없었습니다." 유지. 팝업 제목도 당첨이 있으면 "당첨을 축하드려요!"로 바꿈.
- **검증**: `npx tsc --noEmit`·`npx eslint .` 클린(사용자 실기기 터미널, 이 화면은 별도 컴포넌트 테스트 없음). 실기기에서 낙첨/당첨 문구가 원하는 톤으로 뜨는지는 육안 확인 필요.

### 86. [중요] 홈 화면 "바로가기" → "번호 만들기" 진입 화면들 — 스위칭이 매끄럽지 않고, 돌아올 방법이 없음
- **피드백**: [스크린샷 2장, 동일, 화살표로 "바로가기" 버튼 표시] (1) 홈에서 "바로가기"(제외해보기/AI 조합탐색 등)로 들어가는 전환이 정상 동작은 하지만 매끄럽지 않다 — 타사 앱들이 쓰는 형태를 참고해서 개선해달라는 요청. (2) 반대로 그 화면에서 홈으로는 스위칭이 안 된다는 요청.
- **원인 조사**: `app/generate/*.tsx`(제외해보기/AI 조합탐색/행운번호/45면체 주사위/운명의 신/딥 패턴 탐색/QR당첨확인/각종 결과 화면)는 `app/_layout.tsx`의 루트 Stack에 `(tabs)`와 나란히 개별 등록된 화면들이었다 — 즉 탭바(홈/번호 만들기/로또 연구소/내 번호) "밖"의 완전히 별도인 풀스크린 화면들. 홈 화면 "바로가기"를 누르면 이 화면들이 일반 `push`(오른쪽에서 슬라이드 인)로 열리면서 탭바가 통째로 사라지고, 상단의 작은 '‹' 뒤로가기 버튼만 남는다 — 탭 전환에 익숙한 유저 입장에선 "홈으로 돌아갈 방법이 아예 없다"로 느껴짐. `AskUserQuestion`으로 세 가지 개선 방향(모달 전환/탭 안으로 편입/현재 구조 유지+버튼만 보강)을 제시했고, 사용자가 "모달(아래→위)로 전환"을 선택.
- **수정**:
  - `app/generate/_layout.tsx`(신규): `app/generate/` 폴더 전체(exclusion/ai-search/lucky/dice/destiny/deep-pattern/deep-pattern-result/deep-pattern-detail/result/qr-check)를 하나의 중첩 `<Stack>`으로 묶음. 모든 화면 공통으로 헤더 왼쪽에 명확한 "닫기" 텍스트 버튼(`router.back()`)을 둠 — 진입 화면에서 누르면 그룹 전체가 닫히며 홈으로 돌아가고, 그룹 내부 화면(예: ai-search → result)에서 누르면 한 단계만 뒤로 간다(기존 뒤로가기와 동일한 동작, 다만 훨씬 눈에 띄는 라벨).
  - `app/_layout.tsx`: 루트 Stack에서 `generate/exclusion`·`generate/ai-search`… 9개 개별 등록을 지우고, `(tabs)`와 동일한 방식으로 `generate` 그룹 전체를 `<Stack.Screen name="generate" options={{ headerShown: false, presentation: "modal" }} />` 한 줄로 등록 — 그룹 진입 시 아래→위로 슬라이드해 올라오는 모달이 되어 "홈 위에 작업을 잠깐 얹는다"는 게 시각적으로 분명해짐(iOS는 위→아래 스와이프로 닫는 것도 그대로 가능).
  - 파일 경로/라우트 문자열은 전혀 안 바꿔서(`/generate/exclusion` 등 그대로) 홈 화면·번호 만들기 탭 등 기존 `router.push("/generate/...")` 호출부는 단 한 곳도 수정할 필요가 없었음 — 순수하게 네비게이션 프레젠테이션 구조만 바꾼 변경.
  - 겸사겸사 그동안 루트 Stack에 등록이 안 돼 있어 제목이 기본값(파일명)으로 뜨던 `qr-check` 화면에도 "QR 당첨 확인" 타이틀을 정식으로 부여함.
- **검증**: `npx tsc --noEmit`·`npx eslint .`·`npx jest`(전체 31개 스위트·236개 테스트) 모두 클린/통과(사용자 실기기 터미널) — 레이아웃 파일을 직접 렌더링하는 테스트는 없어 회귀 위험은 낮다고 판단했지만, 네비게이션 프레젠테이션(모달 슬라이드, 닫기 버튼, 다단계 이동, 안 건드린 화면들)은 자동 테스트로 검증 불가능한 영역이라 실기기 육안 확인이 반드시 필요함 — 사용자에게 4가지 체크리스트(바로가기 모달 진입/닫기, 빠른 메뉴, AI 조합탐색·딥 패턴 탐색 다단계 이동, 선호번호 세트·개인정보처리방침 등 안 건드린 화면) 전달함.

### 87. 86번 후속 — 모달(아래→위) 전환이 정말 일반적인 패턴인지 재검토 요청
- **질문**: 86번에서 적용한 모달 전환을 실기기에서 써본 뒤 "버튼을 눌렀는데 밑에서 위로 뭐가 올라오는 게 가장 많이 쓰는 사용자 입장에서 편한 UI/UX가 맞는지 검토해서, 아니면 가장 일반적인 방법으로 수정하자"는 요청.
- **검토 결과**: 모달(아래→위 슬라이드)은 대개 '작성/설정/필터/공유'처럼 짧고 일회성인 작업에 쓰는 패턴이다. 반면 `app/generate/*`(제외해보기/AI 조합탐색/행운번호/45면체 주사위/운명의 신/딥 패턴 탐색/QR당첨확인)는 "번호 만들기" 탭의 핵심 기능 그 자체라 다단계로 오래 머무를 수 있는 화면들 — 토스·카카오뱅크 등 대부분의 앱이 "다른 섹션의 기능으로 이동"에는 오른쪽에서 들어오는 표준 push + 뒤로가기 버튼을 쓰지 모달을 쓰지 않는다. 86번에서 모달을 고른 건 과한 선택이었다고 판단.
- **수정**: `app/_layout.tsx`의 `generate` 그룹 등록에서 `presentation: "modal"`을 제거(기본값인 표준 push로 복귀). `app/generate/_layout.tsx`의 커스텀 `headerLeft`("닫기" 텍스트 버튼)도 제거하고, React Navigation이 기본 제공하는 표준 '‹' 뒤로가기 버튼에 맡김 — 중첩 스택이어도 그 안의 첫 화면(홈에서 막 들어온 화면)에서 뒤로가기를 누르면 react-navigation 표준 동작대로 그룹 전체가 pop되어 정확히 홈으로 돌아간다(86번에서 해결한 "홈으로 돌아갈 방법이 없다"는 문제 자체는 유지하면서, 프레젠테이션 방식만 표준으로 되돌림). 라우트 구조(`app/generate/_layout.tsx`로 묶은 중첩 스택 자체)는 유지 — 화면 옵션을 한 곳에서 관리할 수 있어 유지할 가치가 있고, 모달 여부와는 무관한 이점.
- **검증**: `npx tsc --noEmit`·`npx eslint .`·`npx jest`(31개 스위트·236개 테스트) 모두 클린/통과(사용자 실기기 터미널). 실기기에서 오른쪽 슬라이드 인 전환, 표준 뒤로가기로 홈 복귀, 다단계 이동(AI 조합탐색→결과, 딥 패턴 탐색 플로우)이 정상인지는 육안 확인 필요.

### 88. 전체 앱 종합 재점검(`APP_REVIEW_2026-08-13.md`) — `APP_REVIEW_2026-08-08.md` 이후 QA_LOG #58~#87(30개 항목) 재검증
- **배경**: 사용자가 "다시 전문가 입장으로 평가하는 시간을 갖자"고 요청 — #19/#21~22/#46/#50/#58과 동일한 형식(시니어 개발자·보안책임자·시니어 기획자·시니어 UI/UX 디자이너 4개 관점 + 경쟁 앱 대비 포지션)으로, 8/8 리포트 이후 5일간 쌓인 항목(Combinadic 사전 작업 #59, `npm audit` 실제 조사 #60, 홈/딥패턴/45면체 UX 폴리시 대량 반영 #61~#76, 딥 패턴 Atlas GitHub 자동 동기화 아키텍처 전환 #78~#79, CI 수정 #80, 이번 세션 #81~#87)를 코드 레벨로 재검증했다.
- **방법**: 원격 기기 브릿지로 프로젝트 전체 디렉토리 구조를 실제로 재조회(이전 세션에서 스테이징된 파일 목록에만 의존하지 않고 `device_list_dir`로 리포지토리 실제 상태를 재확인)한 뒤, `package.json`/`app.json`/`README.md`/`SECURITY_NOTES.md`/`APP_REVIEW_2026-08-08.md`와 핵심 소스 일부(`ErrorBoundary.tsx`/`DisclaimerCard.tsx`/`resultBadges.ts`/`accessibilitySummary.ts`/`drawReminder.ts`/`secureStorage.ts`/`legal/privacy-policy.html`/`explain.ts`/`SettingsSheet.tsx`)를 직접 열람하고, QA_LOG #58~#87 전체 원문을 재검토했다.
- **이번 재점검에서 새로 발견한 사항**: `SECURITY_NOTES.md`(2026-07-31)가 이미 지적해뒀던 "README.md는 AI 설명 BYOK(사용자 API 키 입력) 옵션이 있다고 서술하지만 실제 코드는 이를 제거했다"는 문서-코드 불일치를, `src/lib/ai/explain.ts`(docblock에 "이전에는 BYOK 옵션이 있었으나 사용성 관점에서 제거했다"고 명시)와 `src/components/SettingsSheet.tsx`(AI/API 관련 코드 전무)를 직접 열어 재확인 — 코드 쪽은 완전히 정리됐지만 `README.md`는 여전히 존재하지 않는 기능을 설명 중임을 확인했다(2주 가까이 미해결). 새로운 버그나 보안 취약점은 발견되지 않았다.
- **종합 판단**: 8/8(91점) 대비 종합 점수는 사실상 제자리(~91점)다. 딥 패턴 Atlas 아키텍처 전환(테스트 격리·실기기 버그 추적·CI 자기 회귀 수정)과 홈→번호 만들기 내비게이션 패턴을 사용자 재검토 요청에 방어적이지 않게 응해 표준 push로 되돌린 자기 교정 사이클(#86→#87)은 판단의 질이 오히려 성숙해졌다고 평가했지만, 이 사이클의 UI 변경 대부분(#61~#87)이 이 리포트 작성 시점까지 실기기에서 단 한 번도 시각적으로 확인되지 않았다(사용자가 EAS 빌드 쿼터 문제로 실기기 테스트를 한 번에 몰아서 진행하기로 했고, 리포트 작성 시점 기준 `eas build --platform android --profile preview`가 여전히 진행 중이었음)는 점을 가장 큰 유보 사유로 명시했다.
- **우선순위별 제안**: (즉시) EAS 빌드 완료 후 #61~#87 전체 실기기 육안 확인, 특히 딥 패턴 탐색 체감 속도. (저비용) README.md의 AI BYOK 서술 정정. (중기) Combinadic 유틸 실사용처 연결, 딥 패턴 latency 실측 후 필요 시 튜닝. (장기) Expo SDK 54→57 업그레이드(New Architecture 전환 겸 `npm audit` 잔여 23건의 유일한 해소 경로 — 8/6 리포트부터 세 번째 리포트째 이월 중).
- **한계**: 이 리포트는 코드 정적 분석과 QA_LOG 원문 재검토 위주로 작성했고, 이번 리포트 작성 과정에서 `tsc`/`eslint`/`jest`를 이 세션이 직접 재실행하지는 않았다(각 QA_LOG 항목에 이미 기록된 사용자 실기기 터미널 실행 결과를 근거로 삼음). 경쟁 앱 재조사, 실기기 사용성 테스트는 이번 사이클에서도 다루지 않았다.
- **검증**: 해당 없음(코드 재검토·문서 작성 성격의 항목). 상세 내용은 `APP_REVIEW_2026-08-13.md` 참고.

### 89. 61번 후속 — 스플래시 최소 노출 시간이 미묘하게 김
- **피드백**: 실기기 테스트 결과, 61번에서 1.5초로 늘려둔 스플래시(로고) 노출 시간이 미묘하게 길게 느껴짐 — 1.3초 정도가 적당할 것 같다는 요청.
- **수정**: `app/_layout.tsx`의 `MIN_SPLASH_DURATION_MS` 상수를 1500 → 1300으로 변경. 로직(모듈 최상단 `preventAutoHideAsync` + `RootLayout`의 `useEffect`에서 `setTimeout` 후 `hideAsync`)은 그대로, 값 하나만 조정.
- **검증**: 수치 상수 하나만 바꾼 변경이라 타입/로직 오류 여지가 없음. 실기기에서 1.3초 체감이 적당한지 최종 확인 필요.

### 90. 88번 후속 — README.md의 AI 설명 BYOK 서술 정정
- **배경**: 88번 종합 재점검 리포트가 "저비용 개선" 1순위로 남긴 항목 — `SECURITY_NOTES.md`(2026-07-31)가 이미 지적해뒀듯 `README.md`가 "설정에서 'AI 설명 사용'을 켜고 본인의 Anthropic API 키를 입력하면(BYOK) `explainGameWithAi`가 호출된다"고 서술하지만, 실제 코드(`src/lib/ai/explain.ts` docblock, `SettingsSheet.tsx`)는 이 기능을 이미 제거하고 로컬 규칙 기반 템플릿(`explainGameLocally`)만 항상 무료로 제공하고 있어 문서-코드 불일치였음.
- **사용자 확인 사항**: 이 로컬 템플릿 로직(`explainGameLocally`) 자체는 개발 과정에서 AI(LLM)의 도움을 받아 설계·구현되었다는 점을 사용자가 알려줬다 — 다만 이는 "개발 시점에 AI를 도구로 활용했다"는 이야기이고, "앱이 런타임에 사용자 요청마다 AI를 호출한다"는 것과는 다른 사실이라 README 정정의 필요성 자체는 그대로 유효하다고 판단, 이 구분을 README에도 명시했다.
- **수정**: `README.md` 4곳 정정 — (1) "기획서 대비 변경된 점" 표의 AI 사용 행, (2) 폴더 구조의 `src/lib/ai/` 한 줄 설명, (3) "구현된 기능" 3차 목록의 "AI 자연어 설명" 항목, (4) "AI 비용에 대하여" 섹션 전체. 공통 방향: "런타임에는 AI를 전혀 호출하지 않는다"를 분명히 하고, BYOK 옵션은 "과거에 있었으나 사용성 문제로 제거됨"으로 과거형 서술로 바꿈. "AI 비용에 대하여" 섹션에는 사용자가 알려준 사실(로컬 템플릿 로직이 개발 과정에서 AI 도움을 받아 설계됨)도 별도 항목으로 정확히 구분해 추가.
- **검증**: 문서 전용 변경(코드 변경 없음)이라 `tsc`/`eslint`/`jest` 대상 아님.

### 91. 81번 후속 — "실제 당첨결과" 카드 색상이 촌스러움
- **피드백**: [스크린샷 2장, 동일, 실제 당첨결과 카드 영역에 빨간 박스] 로또 연구소 > "실제 당첨결과" 카드의 배경색·테두리색이 촌스럽다 — 다른 통계 카드와 구분은 눈에 띄어야 하지만, 색상 자체는 촌스럽지 않게 바꿔달라는 요청.
- **원인**: 81번에서 이 카드를 아래 통계 카드들과 구분하려고 `tints.green`(옅은 민트 배경 + 진한 초록 1.5px 테두리)으로 카드 전체를 칠했는데, 이 앱의 나머지 화면은 대부분 흰색/서피스 카드 + 로또공의 원색들로 구성돼 있어서 카드 하나를 통째로 채도 높은 초록 박스로 감싸니 "세일 스티커"처럼 튀고 이질적으로 보였던 것 — 실기기에서 실제로 보니 코드 리뷰만으로는 판단하기 어려웠던 부분.
- **수정**: `app/(tabs)/lab.tsx` — `officialCard`의 배경/테두리를 다른 카드와 동일한 `colors.surface`/`colors.border`로 되돌리고, 대신 카드 상단에 3px 두께의 브랜드 블루(`#2563EB`, 이 앱의 CTA·다시 시도 버튼 등에 이미 쓰이는 고정 브랜드 컬러) 강조선만 추가. `officialBadge`도 흰 배경+초록 글자 아웃라인 배지에서 브랜드 블루 배경+흰 글자의 솔리드(채워진) 배지로 바꿔 더 "공식 태그"처럼 보이게 함. "실제 당첨결과" 배지 텍스트 자체는 그대로 유지되므로 색이 아니어도 구분 가능하다는 접근성 원칙은 그대로 지켜짐.
- **검증**: `officialCard`/`officialBadge` 스타일 값만 바꾼 변경이라 로직 회귀 위험 없음. `tints.green` 참조가 이 파일에서 완전히 제거됐고(`tints.indigo`는 다른 곳에서 계속 쓰임) 타입 오류 여지 없음. 실기기에서 상단 강조선+배지가 다른 카드들과 잘 어우러지는지는 육안 확인 필요.

### 92. 91번 후속 — 다른 카드와 배경이 완전히 같아지니 이번엔 안 도드라짐
- **피드백**: 91번에서 카드 배경을 다른 통계 카드와 동일한 흰색으로 바꿨더니, 눈에는 띄어야 하는데 다 똑같은 배경색이라 오히려 안 보인다 — 음영(그림자) 등을 줘서 도드라지게 다시 조정해달라는 요청.
- **수정**: `app/(tabs)/lab.tsx`의 `officialCard` — 배경을 다른 카드와 완전히 같은 `colors.surface`에서, 앱 곳곳에 이미 쓰이는 `tints.indigo.bg`(옅은 브랜드 블루 톤, 채도는 낮지만 순백은 아님)로 변경. 여기에 `shadowColor: "#2563EB"`/`shadowOffset`/`shadowOpacity: 0.18`/`shadowRadius`(iOS)와 `elevation: 4`(Android)를 추가해 카드가 화면에서 살짝 떠 보이는 그림자 효과를 줌. 기존에 남겨뒀던 상단 3px 브랜드 블루 강조선과 솔리드 배지는 그대로 유지 — "채도 높은 초록 박스(촌스러움, 91번 이전) ↔ 완전히 같은 흰 배경(안 띔, 91번)"의 중간 지점으로, 톤은 낮추고 입체감(그림자)으로 구분감을 준 절충안.
- **검증**: 스타일 값만 추가한 변경(그림자/배경색)이라 로직 회귀 위험 없음. iOS는 `shadow*` 계열, Android는 `elevation`으로 각각 렌더링되므로 두 플랫폼 모두에서 그림자가 자연스럽게 보이는지, 그리고 옅은 블루 톤 배경이 다른 카드 대비 충분히 구분되면서도 튀지 않는지는 실기기 육안 확인 필요.

### 93. [중요] QR 당첨 확인 — 실제 정품 로또 용지 QR을 인식하지 못함
- **피드백**: [스크린샷 6장 — 앱 스캔 화면에 "로또 당첨 확인 QR이 아니에요" 오류, 실제 로또 용지(제1237회, 2026-08-15 추첨) 사진, 그 QR을 브라우저로 직접 열었을 때 동행복권 공식 "구매복권 당첨결과" 페이지가 정상적으로 뜨는 화면] 신뢰도 문제이므로 정확히 체크해서 수정 요청.
- **원인**: `src/lib/qr/parseLottoQr.ts`의 `KNOWN_WIN_QR_URL_PATTERN`이 `dhlottery.co.kr/qr.do?`라는 경로까지 정확히 일치해야 인식하고, 추가로 `method=winQr` 파라미터 존재까지 요구하고 있었다(과거 관찰된 샘플 URL `m.dhlottery.co.kr/qr.do?method=winQr&v=...` 기준으로 작성된 조건). 그런데 사용자가 스캔한 실제 정품 용지의 QR은 브라우저 주소창으로 확인한 결과 `qr.dhlottery.co.kr/?v=...` 형태였다 — 경로가 `/qr.do`가 아니라 그냥 `/`이고, `method=winQr` 파라미터 자체가 없다. 즉 동행복권이 QR 발급 URL 형식을 예고 없이 바꿔둔 상태였고, 앱의 검증 조건이 그 변화를 못 따라가 정품 QR을 "인식 안 됨"으로 오판했다. 브라우저로 그 URL을 직접 열어 동행복권 공식 결과 페이지(제1237회, 낙첨)가 정상적으로 뜨는 것까지 확인해 진짜 정품 QR임을 재확인했다.
- **수정**: `src/lib/qr/parseLottoQr.ts` — 신뢰 조건을 "도메인이 `dhlottery.co.kr` 밑이고 `v=` 파라미터가 존재한다"는 두 가지로만 좁혀서(경로 `/qr.do` 유무, `method=winQr` 파라미터 유무는 더 이상 강제하지 않음) `qr.dhlottery.co.kr/?v=...`와 기존 `m.dhlottery.co.kr/qr.do?method=winQr&v=...` 형태를 둘 다 인식하게 함. 도메인 자체는 여전히 `dhlottery.co.kr`만 신뢰(35/36번 항목에서 정부가 차단한 가짜 도메인 `donghanglottery.com`을 실수로 허용했던 전례가 있어, 도메인 검증까지 느슨하게 풀지는 않음).
- **검증**: `tests/parseLottoQr.test.ts`에 새 형태(`qr.dhlottery.co.kr/?v=1237m...`, 3게임)에 대한 테스트 추가 — 기존 케이스(`m.dhlottery.co.kr/qr.do?method=winQr&v=...`, `www` 도메인, 도메인 불일치 시 `not_lotto_qr` 등)는 전부 그대로 유지되며 회귀 없음. 실기기에서 이번에 실패했던 그 용지로 재스캔해 정상 인식되는지 최종 확인 필요.

### 94. 62/63번 후속 — 탭 상단 헤더 글씨가 어색하고 깨져 보임, 아예 없애자
- **피드백**: [스크린샷 3장, 홈/번호 만들기/내 번호 화면 각각 최상단에 빨간 박스] 62/63번에서 줄여둔 탭 상단 헤더("홈"/"번호 만들기"/"내 번호" 등) 글씨가 실기기에서 보니 어색하고 깨진 것처럼 보인다 — 그 영역 자체를 아예 없애고 화면을 깨끗하게 쓰자는 요청.
- **수정 1 — 헤더 제거**: `app/(tabs)/_layout.tsx`의 `Tabs` `screenOptions`에 `headerShown: false`를 추가하고, 더 이상 쓰이지 않는 `headerStyle`/`headerTintColor`/`headerTitleStyle`를 제거. 하단 탭바 라벨("홈", "번호 만들기" 등, `Tabs.Screen`의 `title`)은 네비게이션 헤더와 별개라 그대로 유지됨.
- **수정 2 — 안전영역 여백 보정(회귀 방지)**: 4개 탭 화면(`index.tsx`/`generate.tsx`/`lab.tsx`/`tickets.tsx`) 전부 그동안 네비게이션 헤더가 상태표시줄 아래로 콘텐츠를 밀어주는 역할을 대신 해줬는데, 헤더를 완전히 숨기면 콘텐츠가 상태표시줄/카메라 펀치홀과 겹칠 위험이 있었다(4개 화면 모두 `SafeAreaView`/`useSafeAreaInsets` 등 자체 안전영역 처리가 전혀 없었음을 확인). 그래서 4개 화면 모두 `useSafeAreaInsets()`를 추가하고, 기존 `contentContainerStyle={{ padding: N }}`을 `{ paddingHorizontal: N, paddingTop: insets.top + N, paddingBottom: N }`으로 바꿔 상단만 안전영역만큼 더 띄웠다(`BottomActionBar.tsx`가 하단에 이미 쓰던 것과 동일한 패턴). `tickets.tsx`의 빈 상태(`emptyContainer`, 저장한 번호가 없을 때)는 `flex:1` 중앙 정렬이라 상단에 붙지 않으므로 그대로 둠.
- **검증**: 헤더 제거 자체는 설정값 변경, 안전영역 보정은 4개 파일 모두 동일한 패턴 적용이라 로직 회귀 위험은 낮음. `useSafeAreaInsets`는 이미 `BottomActionBar.tsx`에서 검증된 패턴을 그대로 재사용. 실기기에서 상태표시줄/펀치홀과 겹치지 않는지, 헤더가 사라진 자리가 부자연스럽지 않은지는 육안 확인 필요.

### 95. 45면체 주사위 화면 — 버튼 3개가 이미 눌려 선택된 것처럼 보임
- **피드백**: [스크린샷 2장, 45면체 주사위 화면, 버튼 3개 영역에 빨간 박스] "한 번 굴리기"/"자동 6회 굴리기"/"초기화" 버튼이 디폴트 상태부터 마치 이미 버튼이 눌린 것처럼 보인다 — 유저가 직접 선택하는 느낌이 나도록, 편하게 쓸 수 있게 개선해달라는 요청.
- **원인**: `app/generate/dice.tsx`의 `buttonOutline`("한 번 굴리기")이 브랜드 블루(`#2563EB`) 테두리+글자를 쓰고 있었고, 바로 옆 `buttonPrimary`("자동 6회 굴리기")는 같은 브랜드 블루를 채운 배경을 쓰고 있었다. 두 버튼이 나란히 같은 색상 계열을 공유하니, 세 번째 버튼("초기화", 중립 회색)과 대비되어 마치 세그먼트 토글에서 앞의 두 개가 이미 "선택"돼 있고 "초기화"만 선택 안 된 상태처럼 읽혔다 — 실제로는 셋 다 독립된 액션 버튼인데도.
- **수정**: `app/generate/dice.tsx`의 `createStyles()` — `buttonOutline`을 브랜드 블루 아웃라인에서 중립 회색 채움(`colors.surfaceAlt` 배경 + `colors.border` 테두리 + `colors.textPrimary` 글자)으로 변경. 이제 브랜드 블루는 실제 핵심 액션인 "자동 6회 굴리기"(`buttonPrimary`) 하나에만 남아, 세 버튼이 토글 그룹이 아니라 위계가 다른 개별 버튼 3개(핵심 액션 1개 + 보조 액션 2개)로 읽히도록 정리했다. `buttonSecondary`("초기화")는 기존 중립 테두리 스타일 그대로 유지.
- **검증**: 스타일 값만 바꾼 변경(로직 없음)이라 회귀 위험 낮음. `npx tsc --noEmit`·`npx eslint .` 대상(사용자 실기기 터미널에서 확인 예정). 실기기에서 세 버튼의 위계가 명확하게 구분되어 보이는지 육안 확인 필요.

### 96. 95번과 같은 화면 후속 — "자동 6회 굴리기"를 연타하면 화면이 뻗는 것처럼 보임
- **피드백**: "그리고 자동 6회 굴리기를 연속으로 여러번 누르믄 좀 뻗는 경향이 있어. 이부분도 체크해줘."
- **원인**: `src/components/Dice45.tsx`의 굴리기 애니메이션(`Animated.timing(spinRotate, ...).start(callback)`)이 `callback`에 전달되는 `{finished: boolean}` 결과를 확인하지 않고 있었다. React Native의 `Animated` API는 진행 중인 애니메이션이 같은 `Animated.Value`에 대한 새 애니메이션 시작으로 도중에 끊기면, 끊긴 콜백도 `finished: false`로 즉시 호출한다 — 그런데 이 콜백 안에서 "착지" 연출(확정 숫자 표시, `isSpinning` 해제, 스케일/글로우 이펙트 시작)을 무조건 실행하고 있었기 때문에, "자동 6회 굴리기"를 연타(각 탭이 `spinTrigger`를 갱신해 새 애니메이션을 즉시 재시작)하면 옛 굴리기의 착지 연출이 방금 시작된 새 굴리기 위에 뒤늦게 덮어써지면서 숫자가 뒤섞이고 이펙트가 겹쳐 화면이 버벅이거나 멈춘 것처럼 보였다. `src/lib/lottery/dice.ts`(`rollDice45`)와 `src/lib/lottery/random.ts`(CSPRNG 바이트 풀)는 직접 읽어 확인한 결과 가볍고 정상 동작해 병목이나 버그가 없었음 — 문제는 순수하게 `Dice45.tsx`의 애니메이션 인터럽션 처리 누락이었다.
- **수정**:
  - `src/components/Dice45.tsx`: `.start((result) => {...})`로 바꾸고 콜백 최상단에 `if (!result.finished) return;` 가드를 추가 — 끝까지 완주한 애니메이션의 콜백만 착지 연출(숫자 확정, 스케일/글로우)을 실행하고, 중간에 끊긴 콜백은 아무것도 하지 않고 조용히 반환한다.
  - 근본 원인 수정과 별개로, 애초에 연타로 애니메이션이 겹쳐 시작되는 상황 자체를 막기 위해 `onSpinningChange?: (spinning: boolean) => void` prop을 새로 추가 — 굴리기 애니메이션 시작/종료 시점에 호출해 부모(`dice.tsx`)가 진행 상태를 알 수 있게 함.
  - `app/generate/dice.tsx`: `isDiceSpinning` 상태를 추가해 `<Dice45 onSpinningChange={setIsDiceSpinning} .../>`로 연결. "한 번 굴리기"/"자동 6회 굴리기"(기존엔 `disabled` prop이 아예 없었음) 버튼에 `disabled={rolled.length >= 6 || isDiceSpinning}`, "초기화" 버튼에 `disabled={isDiceSpinning}`을 추가해 애니메이션 진행 중엔 세 버튼 모두 눌리지 않도록 막았다. 각 버튼의 `accessibilityState`도 동일하게 갱신. Pressable의 `disabled`는 시각적으로 아무것도 바꾸지 않아 "눌러도 반응 없는 멀쩡해 보이는 버튼"이 되는 걸 막기 위해 `buttonDisabled`(`opacity: 0.45`) 스타일을 새로 추가해 비활성 상태를 눈으로도 바로 알 수 있게 했다.
- **검증**: `npx tsc --noEmit`·`npx eslint .`(사용자 실기기 터미널에서 확인 예정). `finished` 가드와 버튼 비활성화는 두 겹의 독립된 방어(하나가 놓쳐도 다른 하나가 막음)라 회귀 위험은 낮다고 판단했지만, 애니메이션 타이밍 관련 버그라 자동 테스트로는 재현·검증이 어려운 영역 — 실기기에서 "자동 6회 굴리기"를 빠르게 연타해도 더 이상 화면이 뻗거나 숫자가 뒤섞이지 않는지 육안 확인 필요.

### 97. 96번 후속 — "자동 6회 굴리기" 연타 시, 초기화 없이도 계속 새로 굴려지길 원함
- **피드백**: "그리고 자동 6회 굴리기 연타도 반영했음 해. 연타 했을 때 초기화 안눌러도 계속 새롭게 바뀌게 말야. 사용자는 초기화 다시 누르고 이렇게 바꾸는걸 선호하지 않으니까."
- **원인**: 96번에서 애니메이션 겹침(뻗는 현상)을 막으려고 "자동 6회 굴리기" 버튼에 `disabled={rolled.length >= 6 || isDiceSpinning}`을 걸었는데, 이 중 `rolled.length >= 6` 조건 때문에 이미 6개가 다 채워진 뒤로는 이 버튼이 아예 눌리지 않게 막혀버렸다 — 유저가 새로 굴리려면 반드시 "초기화"를 먼저 눌러 `rolled`를 비워야만 다시 누를 수 있었음. 게다가 `rollAllSix()` 로직 자체도 기존 `rolled` 배열을 이어받아(`[...rolled]`) 6개가 될 때까지만 채우는 방식이라, 설령 버튼이 안 막혀 있었어도 이미 6개가 찬 상태에서는 while 루프가 한 번도 안 돌아 아무 변화가 없었을 것.
- **수정**: `app/generate/dice.tsx` — `rollAllSix()`가 기존 `rolled`를 이어받지 않고 매번 빈 배열(`[]`)에서부터 새로 6개를 굴리도록 변경. "자동 6회 굴리기" 버튼의 `disabled`/`accessibilityState`/비활성 스타일 조건에서 `rolled.length >= 6` 게이트를 제거하고 `isDiceSpinning`만 남김 — 애니메이션이 진행 중일 때만(96번에서 막은 겹침 방지) 잠깐 비활성화되고, 그 외엔 몇 개가 차 있든 상관없이 언제든 다시 눌러 완전히 새로운 6개 조합을 즉시 받을 수 있다. "한 번 굴리기"는 한 번에 하나씩 채우는 별개의 동작이라 이번 변경 대상에서 제외(기존처럼 6개가 차면 비활성 유지).
- **검증**: 로직 변경(빈 배열에서 시작)과 조건식 단순화(`&&` 조건 하나 제거)만 있는 변경이라 `npx tsc --noEmit`·`npx eslint .` 대상이며 타입 오류 여지 없음(사용자 실기기 터미널에서 확인 예정). 96번에서 추가한 `isDiceSpinning` 기반 애니메이션 겹침 방지는 그대로 유지되므로 "연타 시 뻗는 현상"이 다시 생기지는 않음 — 실기기에서 6개가 찬 상태에서도 "자동 6회 굴리기"를 연타하면 초기화 없이 계속 새 조합으로 바뀌는지, 그리고 여전히 버벅이지 않는지 육안 확인 필요.

### 98. 번호 만들기 탭 — 메뉴 카드 눌렀을 때 "선택했다"는 느낌이 약함
- **피드백**: [스크린샷 2장, 번호 만들기 탭 목록, "딥 패턴 탐색" 카드에 빨간 박스] 토스처럼 눌렀을 때 바탕색이 흰색→약간 회색으로 확실히 바뀌면서 "유저가 선택한 게 이거다"라는 게 명확히 보였으면 좋겠다는 요청 — 좀 더 기술적인 완성도를 원함.
- **원인**: `app/(tabs)/generate.tsx`의 각 메뉴 카드에 눌림 스타일(`cardPressed`) 자체는 이미 있었지만, 배경색을 `colors.surfaceAlt`(라이트 모드 기준 `#F1F5F9`)로만 바꾸고 있었다 — 기본 배경 `colors.surface`(`#FFFFFF`)와 거의 구분이 안 될 만큼 옅은 색이라, 실제로 눌러도 "눌렸다"는 확신이 들 만큼 눈에 띄지 않았다. 그림자도 살짝만 옅어지고(`shadowOpacity 0.06→0.03`) 완전히 사라지지는 않아 "카드가 눌려 들어간다"는 입체적 느낌도 약했다.
- **수정**: `app/(tabs)/generate.tsx`의 `cardPressed` — 배경색을 한 단계 더 진한 `colors.border`(라이트 `#E2E8F0`, 다크 모드에서도 `surfaceAlt`보다 한 톤 밝은 값이라 같은 방향의 "한 단계 더 눈에 띄는" 대비를 만듦)로 변경, 눌리는 순간 그림자를 아예 0으로 없애(`shadowOpacity: 0, elevation: 0`) 카드가 화면 속으로 눌려 들어가는 듯한 느낌을 강화, 축소 비율도 0.98→0.97로 살짝 키움(45면체 주사위 화면 버튼들과 동일한 수치로 앱 전체 프레스 피드백 강도를 통일). 추가로, 기존엔 `cardPressed`가 `borderColor: colors.border`도 함께 덮어써서 "딥 패턴 탐색" 카드(NEW 배지, 보라색 `#6C5CE7` 테두리)를 누를 때마다 테두리색이 잠깐 회색으로 바뀌었다 떼면 다시 보라색으로 돌아오는 미세한 깜빡임이 있었는데, 이 줄을 제거해 누르는 동안에도 원래 테두리색이 그대로 유지되도록 정리했다(다른 5개 카드는 어차피 기본 테두리색이 `colors.border`라 시각적으로 달라지지 않음).
- **검증**: 스타일 값만 조정한 변경(로직 없음)이라 회귀 위험 낮음. `npx tsc --noEmit`·`npx eslint .` 대상(사용자 실기기 터미널에서 확인 예정). 실기기에서 카드를 눌렀을 때 배경색 변화가 명확히 체감되는지, "딥 패턴 탐색" 카드의 보라 테두리가 누르는 동안에도 안 깨지는지 육안 확인 필요.

### 99. [중요] 내 번호 탭 — 나열식 목록이라 스크롤 위치를 놓치기 쉽고 피곤함
- **피드백**: [스크린샷 2장, 동일, 내 번호 탭 목록] 카드가 계속 나열되는 방식이라 스크롤하면 어디까지 봤는지 헷갈리고, 유저 입장에서 피곤하다 — 토스나 다른 주요 앱이 이런 부분을 어떻게 개선했는지 참고해서 자연스럽게 반영해달라는 요청.
- **원인**: `app/(tabs)/tickets.tsx`가 `FlatList`로 모든 저장 티켓을 하나의 평평한 목록에 순서대로만 나열하고 있었다. 같은 회차(예: 제1237회)로 여러 세트를 저장한 경우가 흔한데, 카드마다 "제 1237회 (8/15 추첨)" 같은 회차 문구가 매번 똑같이 반복돼 정보 밀도가 낮고 눈이 피로했다. 또 목록에 지금 몇 회차를 보고 있는지 알려주는 고정된 기준점이 없어서, 스크롤을 내리다 보면 방향 감각을 잃기 쉬웠다.
- **참고**: 토스의 거래내역, 은행 앱들의 명세서 목록, 캘린더/연락처 앱들이 공통으로 쓰는 패턴 — 같은 기준(날짜·카테고리 등)으로 항목을 그룹화하고, 그 기준을 보여주는 헤더를 스크롤 중에도 화면 상단에 고정(sticky)해서 "지금 이 그룹을 보고 있다"는 걸 항상 알 수 있게 한다. 이 앱에서는 "회차"가 가장 자연스러운 그룹 기준이라 판단해 그대로 적용했다.
- **수정**: `app/(tabs)/tickets.tsx` — `FlatList`를 `SectionList`로 교체하고 `stickySectionHeadersEnabled`를 켰다. 저장된 티켓을 `drawNumber` 기준으로 그룹핑해(회차가 큰/최신 순으로 정렬) 섹션을 구성하고, 회차가 아직 지정되지 않은 티켓은 "회차 미지정" 섹션으로 따로 모아 맨 위에 둔다(처리가 필요한 항목이라 우선 노출). 각 섹션 헤더는 화면 배경색과 동일한 배경 + 아래쪽 얇은 구분선으로 "떠서 고정돼 있다"는 느낌을 은은하게 주고, 회차 설명("이번 주 추첨 (8/16)" 등)과 카드 개수("n개")를 함께 보여준다. 헤더가 회차 정보를 대신 보여주게 되면서, 개별 카드 안에서 반복되던 회차 칩(`drawChip`)은 제거했다 — "당첨 확인"/"회차 변경" 버튼 등 카드별로 달라야 하는 조작 UI는 그대로 유지. 카드 사이 간격(`marginBottom`)도 20→12로 살짝 줄였는데, 이제 섹션 헤더 자체가 그룹 구분 역할을 해주기 때문에 카드 간격을 그만큼 넓게 벌리지 않아도 각 항목이 잘 구분돼 보인다.
- **검증**: `npx tsc --noEmit`·`npx eslint .`(사용자 실기기 터미널에서 확인 예정) — 회차별 그룹핑은 `useMemo`로 계산되는 순수 파생값이라 로직 회귀 위험은 낮지만, `SectionList`로의 교체는 이 화면의 렌더링 방식 자체를 바꾼 변경이라 실기기 육안 확인이 특히 중요하다: 스크롤 중 섹션 헤더가 실제로 상단에 고정되는지, 회차 변경(회차 변경 → 새 회차 지정) 시 해당 티켓이 올바른 새 섹션으로 옮겨가는지, "회차 미지정" 섹션이 맨 위에 잘 뜨는지, 상태 배지/공유/삭제 등 기존 카드 기능이 모두 그대로 동작하는지 확인 필요.

### 100. 99번 후속 — 섹션 헤더가 지금 방식(회차별 그룹핑) 자체는 좋은데 더 눈에 잘 들어왔으면 함
- **배경**: 99번에서 "내 번호" 탭을 회차별 섹션 + 고정 헤더로 개편한 뒤, 회차를 바꿨을 때 카드가 새 섹션으로 "훅 이동"하는 동작(부드러운 전환 애니메이션 없음)에 대해 개선이 필요한지 물었던 데 대한 사용자 답변 — 그 이동 방식(변경 시 애니메이션 추가)보다는 지금의 회차별 그룹핑 방식 자체가 낫다고 판단, 그 대신 지금 방식에서 섹션 헤더가 사용자 눈에 더 잘 들어오도록 개선해달라는 요청.
- **원인**: 99번에서 헤더 배경을 화면 배경색과 완전히 동일하게 줘서 "카드 위에 떠서 고정된 판"처럼 자연스럽게 보이게 했는데, 그 결과 색 대비가 거의 없어 스크롤하며 훑어볼 때 헤더 존재 자체가 눈에 잘 띄지 않았다(구분선 하나만으로는 시선을 끌기엔 약함).
- **수정**: `app/(tabs)/tickets.tsx`의 섹션 헤더 —
  - 왼쪽에 짧은 색 강조 바(4×16, 둥근 모서리)를 추가해 시선이 먼저 걸리는 지점을 만듦.
  - "회차 미지정" 섹션(아직 회차 지정이 안 돼 처리가 필요한 항목)은 레드 계열(`tints.red.fg`), 나머지 회차 섹션은 인디고 계열(`tints.indigo.fg`)로 강조 바 색을 구분해 "이건 처리가 필요하다"는 신호도 색으로 함께 줌.
  - 오른쪽 개수 표시("n개")를 그냥 텍스트에서 옅은 배경의 작은 배지(pill)로 바꿔 눈에 더 잘 들어오게 함.
  - 헤더 배경은 여전히 화면 배경색과 동일하게 유지(카드가 그 밑으로 지나가는 자연스러운 느낌은 유지)하되, 옅은 그림자를 항상 얹어 "떠 있는 판"이라는 존재감을 은은하게 더했다.
  - 헤더 제목 글자 크기도 15→16으로 살짝 키움.
- **검증**: 스타일/레이아웃 변경 위주(렌더 로직에 `isUnassigned` 분기 하나 추가)라 회귀 위험은 낮음. `npx tsc --noEmit`·`npx eslint .`(사용자 실기기 터미널에서 확인 예정). 실기기에서 강조 바 색상 대비, 배지 가독성, 그림자가 라이트/다크 모드 둘 다에서 과하지도 약하지도 않은지 육안 확인 필요.

### 101. [중요][조사] 99/100번 후속 — "정말 편해졌는지 다시 검토해봐" 요청에 따른 재검토
- **질문**: "사용자가 느끼기에 편해진거 같아? 다시 한번 잘 검토해봐."
- **재검토 결과**: 다시 짚어보니 회차별 그룹핑이 항상 이득은 아니었다. 이 앱은 매주 새 회차가 도는 구조라, 몇 달 지나면 "제1230회 1장, 제1231회 1장, 제1232회 1장…"처럼 회차마다 딱 1장씩만 남는 상황이 흔해진다(특히 이미 확인 완료된 과거 티켓들). 이 경우 99/100번 방식은 카드 1장마다 헤더가 하나씩(강조 바 + 굵은 글씨 + 그림자 + 배지까지 포함한, 100번에서 오히려 더 무거워진 헤더가) 붙어버려서 — 처음 사용자가 지적했던 "나열식이라 피곤하다"는 문제를 형태만 바꿔 그대로 재현하거나, 오히려 세로 공간을 더 잡아먹어 악화시키는 역효과가 있었다. 반대로 사용자가 보여준 스크린샷처럼 "같은 회차로 여러 세트를 비교하려고 저장한" 경우(회차 하나에 여러 장)나, 아직 확인 전인 이번 주/다음 주 회차는 그룹핑의 이득(반복 제거, 스크롤 중 위치 인지)이 그대로 유효했다.
- **수정**: `app/(tabs)/tickets.tsx` — "이미 지나간 회차(이번 주/다음 주가 아님)"이면서 "그 회차에 티켓이 1장뿐"인 것들만 예외적으로 "지난 기록"이라는 하나의 공용 섹션으로 다시 묶는다(회차 헤더 대신 슬레이트 색 강조 바로 구분). 여러 장을 함께 저장한 회차, 그리고 아직 확인 전인 이번 주/다음 주 회차는 지금처럼 각자 고유한 회차 헤더를 유지한다. "지난 기록" 섹션은 서로 다른 회차가 섞여 있어 헤더 하나로는 각 카드의 정확한 회차를 알 수 없으므로, 이 섹션에 속한 카드에 한해서만 회차 문구(예: "제 1230회 (7/25 추첨)")를 카드 안에 다시 작게 표시하도록 되돌렸다 — 나머지 섹션은 99번에서 없앤 그대로 유지(헤더가 이미 알려주므로 반복 안 함).
- **검증**: `SectionList`의 `renderItem`이 `section`도 함께 받도록 시그니처를 바꿨고, 그룹핑 로직에 분기(`isPast && data.length === 1`)가 추가된 변경이라 `npx tsc --noEmit`·`npx eslint .` 확인이 특히 필요함(사용자 실기기 터미널에서 확인 예정). 실기기에서 다양한 회차 조합(같은 회차 여러 장/서로 다른 과거 회차 1장씩/이번 주 1장)을 실제로 저장해보며 "지난 기록" 묶음이 의도대로 분리되는지, 그 안의 카드에 회차 문구가 정확히 다시 나오는지 확인 필요 — 지금까지는 스크린샷상 항상 "같은 회차 여러 장"만 확인됐고, "회차별 1장씩 흩어진" 실사용 시나리오는 아직 실기기로 검증되지 않았다는 점을 명시해둔다.

### 102. [중요][조사] 101번 후속 — "이게 최선인지 다시 고민해봐" 요청에 따른 재재검토
- **질문**: "이거보다 더 좋은 방법은 없어? 이게 최선인지 다시한번 고민해봐."
- **재검토 결과**: 101번의 "회차에 티켓이 1장뿐인 과거 건만 '지난 기록'이라는 공용 섹션에 몰아넣는다"는 방식을 다시 보니, 두 가지 근본적인 약점이 있었다. (1) 예측 불가능성 — 어떤 카드가 "지난 기록"에 들어가고 어떤 카드가 자기 헤더를 갖는지가 "우연히 같은 회차로 2장을 저장했는가"라는, 사용자가 알 수도 예상할 수도 없는 기준에 좌우된다. (2) 근본 문제 재발 — 앱을 오래 쓴 사용자일수록 "지난 기록" 하나에 수십 장이 몰리게 되는데, 그 안에서는 처음 사용자가 지적했던 문제("긴 목록을 스크롤하며 지금 어디쯤 보고 있는지 헷갈림")가 정확히 되풀이된다. 그룹 하나로 뭉뚱그렸을 뿐 근본적으로 해결한 게 아니었다.
- **더 나은 방법 조사**: 토스·은행 앱들이 실제로 "긴 내역"을 다루는 방식을 다시 살펴보니, 핵심은 "회차/거래 하나하나를 그룹 기준으로 쓰는 것"이 아니라 "시간 축을 최근엔 촘촘하게, 오래될수록 성기게 압축하는 것"이었다(예: 최근 며칠은 하루 단위, 오래된 내역은 월 단위로 자동으로 넘어감). 이게 훨씬 원칙적이고 어떤 데이터양에서도 스스로 적당한 크기로 나뉘는 방식이라 판단해 이 앱에 그대로 적용했다.
- **수정**: `app/(tabs)/tickets.tsx`의 그룹핑 기준을 다시 설계 — 아직 추첨 전이라 확인이 필요한 회차(이번 주/다음 주 등, `drawNumber >= thisWeekDrawNumber`)는 지금처럼 회차 단위로 각자 헤더를 갖는다(한 번에 1~2개뿐이라 카드가 쌓여 헤더가 남발될 일이 없음). 이미 추첨이 끝난 과거 회차는 정확한 회차 대신 **추첨 월** 단위로 묶는다(예: "8월", 연도가 다르면 "2025년 12월"). 한 달엔 보통 4~5회차가 있어 매달 자연스럽게 여러 회차가 한 헤더 아래 모이므로 101번의 "1장짜리 회차마다 헤더 남발" 문제가 해결되고, 오래된 기록도 "지난 기록" 하나로 뭉개지 않고 달마다 계속 갈라지니 "수십 장이 한 섹션에 몰리는" 문제도 함께 해결된다. 규칙이 "확인 전 회차는 회차별, 확인 끝난 과거는 월별" 한 줄로 명확해져 예측 가능성 문제도 해소됐다. 한 달(월 버킷) 안엔 서로 다른 회차가 섞일 수 있으므로, 그 안의 카드에는 회차 문구(예: "제 1230회 (7/25 추첨)")를 다시 짧게 보여준다(101번에서 만든 표시 로직을 재사용, 조건만 "지난 기록" 단일 섹션 → "월 버킷 전체"로 일반화). 섹션 헤더 강조 바 색도 회차 미지정(레드)/확인 전 회차(인디고)/월 버킷(슬레이트)로 세 갈래 유지.
- **검증**: 그룹핑 로직이 이번에도 바뀐 변경이라 `npx tsc --noEmit`·`npx eslint .` 확인 필요(사용자 실기기 터미널에서 확인 예정). 특히 연도가 바뀌는 경계(12월→1월)에서 "연도 다르면 '2025년 12월'처럼 연도를 붙인다"는 분기가 실제로 잘 동작하는지, 그리고 여러 달에 걸쳐 티켓을 쌓아본 뒤(현재는 실기기로 검증된 적 없는 시나리오) 월 버킷들이 스크롤 중 기대한 대로 나뉘어 보이는지 확인 필요.

### 103. 89번 후속 — 스플래시 노출 시간을 1.0초로 더 줄임
- **피드백**: "1.0초로 조정하자." — 89번에서 1.5초 → 1.3초로 줄인 뒤 실기기로 다시 테스트해보니 1.3초도 여전히 길게 느껴져 추가로 더 줄여달라는 요청.
- **수정**: `app/_layout.tsx`의 `MIN_SPLASH_DURATION_MS` 상수를 1300 → 1000으로 변경. 로직은 그대로, 값만 조정.
- **검증**: 수치 상수 하나만 바꾼 변경이라 타입/로직 오류 여지 없음. 실기기에서 1.0초 체감이 적당한지 최종 확인 필요.

### 104. [중요] 94번 후속 — 4개 탭 화면에서 상태표시줄(시계·배터리)이 겹치거나 안 보임
- **피드백**: [스크린샷 7장 — 홈/번호 만들기/로또 연구소/내 번호 탭 상단에 빨간 박스, 45면체 주사위 화면(정상)도 비교로 첨부] 상단 영역이 제대로 안 잡혀 있어서 디바이스의 시계·배터리 정보를 알려주는 최상단(상태표시줄) 영역이 앱 콘텐츠와 겹치거나 안 보이는 이슈. "이건 중요한거야"라고 강조.
- **원인**: `app/_layout.tsx`에 전역으로 `<StatusBar style="light" />`(상태표시줄 시계·배터리 아이콘을 항상 흰색으로 그림)가 고정돼 있다. 이 값은 "번호 만들기"의 각 기능 화면(45면체 주사위 등 `app/generate/*`)이 항상 쓰는 짙은 남색(`#0F172A`) 헤더와 짝을 맞춘 값이라 그 화면들에서는 흰 아이콘이 잘 보인다(사용자가 비교로 첨부한 45면체 주사위 스크린샷이 정상으로 보인 이유). 그런데 94번에서 홈/번호 만들기/로또 연구소/내 번호 4개 탭 화면의 네비게이션 헤더를 완전히 없애면서, 이 화면들은 더 이상 그 짙은 헤더 배경 없이 화면 자체 배경(`colors.background`)이 상태표시줄 바로 아래까지 올라오게 됐다 — 라이트 모드에서 `colors.background`는 거의 흰색(`#F8FAFC`)인데, 그 위에 흰색 상태표시줄 아이콘이 그대로 겹쳐지니 사실상 안 보이게 된 것. "영역을 안 잡아서 겹친다"기보다는, 상태표시줄 자체는 정상 위치에 있는데 배경과 아이콘 색이 같아서 "안 보이는 것처럼" 보이는 문제였다.
- **수정**: `app/(tabs)/_layout.tsx` — `expo-status-bar`는 화면(레이아웃)마다 자기만의 `<StatusBar>`를 따로 선언할 수 있고, 가장 안쪽(현재 포커스된) 것이 우선 적용되는 특성을 활용해, 이 4개 탭을 감싸는 레이아웃에만 `<StatusBar style={scheme === "dark" ? "light" : "dark"} />`를 새로 추가했다 — 라이트 모드에서는 어두운 아이콘, 다크 모드에서는 밝은 아이콘으로 시스템 테마를 따라간다. `app/generate/*`처럼 항상 짙은 헤더를 쓰는 화면들은 이 레이아웃 밖(루트 Stack)에 있어 영향을 받지 않고, 루트의 기본값(`style="light"`, 항상 밝은 아이콘)을 그대로 물려받아 원래대로 잘 보인다.
- **검증**: `npx tsc --noEmit`·`npx eslint .`(사용자 실기기 터미널에서 확인 예정) — JSX를 Fragment로 감싸고 `<StatusBar>` 한 줄을 추가한 변경이라 로직 회귀 위험은 낮음. 다만 상태표시줄 색상은 자동 테스트로 검증 불가능한 순수 시각적 영역이라 실기기 확인이 특히 중요함: 라이트 모드에서 4개 탭 화면의 상태표시줄 시계·배터리가 어두운 색으로 선명하게 보이는지, 다크 모드에서는 여전히 밝은 색으로 잘 보이는지, `generate/*` 화면들(45면체 주사위 등)로 이동했다가 다시 탭으로 돌아왔을 때 상태표시줄 색이 올바르게 다시 전환되는지 확인 필요.

### 105. [중요] 104번 후속 — 스크롤하면 카드가 다시 상태표시줄과 겹쳐 보임
- **피드백**: [스크린샷 2장, 동일, 로또 연구소 탭 스크롤 중 화면] "이번 주 리포트"(짙은 남색 카드)의 텍스트("최근 7일 동안 5게임을 저장했어요...")가 상단 상태표시줄(시계·배터리·와이파이 아이콘)과 뒤섞여 보임. "이건 영역을 침범한거 같이 보이는데? 이 부분도 수정반영된거야???"
- **원인**: 104번에서 고친 건 상태표시줄 "아이콘 색"이 배경과 겹쳐 안 보이는 문제였는데, 이건 별개로 더 근본적인 문제였다 — 94번에서 4개 탭 화면에 준 `paddingTop: insets.top + N`은 화면에 "처음 진입했을 때"(스크롤이 맨 위일 때)만 콘텐츠를 상태표시줄 아래로 밀어준다. 그런데 최신 Android의 에지투에지(edge-to-edge) 상태표시줄은 화면 위에 반투명하게 "얹혀" 있을 뿐 그 아래 콘텐츠를 물리적으로 차단해주지 않는다 — 그래서 유저가 스크롤을 해서 카드가 위로 올라가면, 그 카드가 상태표시줄 영역 "밑을 그대로 통과"하면서 시계·배터리 아이콘과 뒤섞여 보인다. 특히 "이번 주 리포트" 카드는 배경이 라이트/다크 테마와 무관하게 항상 짙은 남색(`#0F172A`)으로 고정돼 있어서, 104번에서 라이트 모드용으로 정해둔 어두운 상태표시줄 아이콘과도, 다크 모드용 밝은 아이콘과도 상황에 따라 부딪힐 수 있는 카드였다 — 이번에 실제로 걸린 사례.
- **수정**: 새 공용 컴포넌트 `src/components/StatusBarSafeMask.tsx`를 만들었다. 상태표시줄 높이(`insets.top`)만큼을 화면 배경색으로 칠한 판을 만들어 스크롤 콘텐츠 위에 고정(`position: absolute`, `pointerEvents: none`)해두는 방식 — 이러면 스크롤 중 무엇이 그 아래로 지나가든, 상태표시줄이 걸쳐 있는 영역만큼은 항상 일정한 배경색으로 보이고(그 위에 104번에서 맞춰둔 아이콘 색이 항상 대비되어 보임), 터치는 그대로 통과해 스크롤·탭 동작에 영향 없다. `app/(tabs)/index.tsx`·`generate.tsx`·`lab.tsx`(로딩 스켈레톤 상태 포함)·`tickets.tsx` 4개 화면 모두, 스크롤 컴포넌트를 감싸는 최상위 `View` 안에 이 마스크를 스크롤 컴포넌트 다음(= 화면상 그 위)에 추가했다. `lab.tsx`·`tickets.tsx`는 기존에 스크롤 컴포넌트(`ScrollView`/`SectionList`) 자체가 최상위로 반환되고 있어서, 마스크를 얹을 감싸는 `View`가 아예 없었다 — 이번에 새로 감싸주면서 스크롤 컴포넌트의 `flex:1` 스타일을 감싸는 `View` 쪽으로 옮겼다(`tickets.tsx`는 `SectionList`에 별도 `list: {flex:1}` 스타일을 새로 추가).
- **검증**: `npx tsc --noEmit`·`npx eslint .`(사용자 실기기 터미널에서 확인 예정) — 4개 파일 모두 레이아웃 구조(감싸는 View 추가)가 바뀐 변경이라 특히 주의 필요. 코드 리뷰로는 검증 불가능한 순수 실기기 이슈이므로, 각 탭에서 스크롤을 끝까지 내려봤을 때 어떤 카드가 지나가도 상태표시줄 영역이 항상 화면 배경색으로 깨끗하게 보이는지(특히 로또 연구소의 "이번 주 리포트" 짙은 카드, 내 번호 탭의 회차 헤더들), 그리고 마스크가 스크롤·탭 조작을 방해하지 않는지(터치 통과 확인) 실기기 확인이 반드시 필요함.

### 106. 105번 후속 — "확실하게 수정된거지?" 재확인 요청에 따른 전 파일 재검증
- **질문**: "확실하게 수정된거지 ?? 다시 체크해봐."
- **재검증 방법**: 105번에서 손댄 6개 파일(`app/(tabs)/index.tsx`, `generate.tsx`, `lab.tsx`, `tickets.tsx`, 신규 `src/components/StatusBarSafeMask.tsx`, `src/components/index.ts`)을 전부 처음부터 끝까지 다시 정독하며 다음을 하나씩 확인: (1) JSX 태그가 정확히 짝이 맞는지, (2) `StatusBarSafeMask`가 각 화면에서 스크롤 컴포넌트와 형제로, JSX상 그 뒤(화면상 그 위)에 위치하는지, (3) 마스크가 절대위치로 제대로 뜨려면 필요한 `flex:1` 앵커(감싸는 `View`)가 실제로 존재하는지, (4) import 경로가 올바른지, (5) 스타일 키 중복/누락이 없는지.
- **재검증 결과**: 4개 화면 전부 정상 확인됨.
  - `index.tsx`: `<View style={styles.swipeArea}>`(`flex:1` 확인) 안에 `ScrollView` + `StatusBarSafeMask` 형제 구조, 정상.
  - `generate.tsx`: `<View style={styles.flexFill}>`(`flex:1` 확인) 안에 `ScrollView` + (조건부 하단 페이드) + `StatusBarSafeMask`, 정상.
  - `tickets.tsx`: `<View style={styles.container}>` 안에 `SectionList`(신규 추가한 `list: {flex:1}` 스타일 적용 확인) + `StatusBarSafeMask`, 정상. 705줄 전체 재독으로 태그 불일치·중복 스타일 키 없음 확인.
  - `lab.tsx`: 로딩(스켈레톤) 분기·본문 분기 둘 다 `<View style={styles.container}>`(`flex:1` 확인) 안에 `ScrollView` + `StatusBarSafeMask` 구조로 동일하게 적용되어 있음을 확인. 이 파일의 `ScrollView`는 `tickets.tsx`의 `SectionList`와 달리 별도 `flex:1` 스타일을 명시하지 않았는데, 확인해보니 문제 없음 — React Native의 `ScrollView`는 `style` prop과 무관하게 컴포넌트 자체 기본 스타일(`flexGrow:1, flexShrink:1`)이 항상 내부적으로 함께 적용되므로, 감싸는 `View`가 `flex:1`이면 별도 스타일 없이도 남은 공간을 정상적으로 채운다.
  - `StatusBarSafeMask.tsx`: `from "../theme"` import가 이미 앱 내 다른 4개 기존 컴포넌트(`BottomActionBar.tsx`, `SettingsSheet.tsx`, `DisclaimerCard.tsx`, `SumTrendChart.tsx`)에서 동일하게 쓰이고 있는, 이미 검증된 패턴과 정확히 일치함을 확인.
  - `src/components/index.ts`: `export * from "./StatusBarSafeMask";` 한 줄이 알파벳 순서(Skeleton과 SumTrendChart 사이)에 맞게 정상 추가돼 있음을 확인.
- **결론**: 이번 재검증에서 코드 리뷰로 발견 가능한 범위 내에서는 문제를 찾지 못했다(추가 수정 없음). 다만 105번에서도 밝혔듯 상태표시줄 겹침 여부는 코드만으로 100% 보장할 수 없는 순수 실기기 렌더링 이슈이므로, 최종 확신은 실기기에서 4개 탭을 끝까지 스크롤해보는 눈으로 확인하는 것이 가장 정확하다.
- **검증**: 코드 정독 기반 재검증(빌드 도구/시뮬레이터 없이 진행) — `npx tsc --noEmit`·`npx eslint .`는 여전히 사용자 실기기 터미널에서 별도 확인 권장.

### 107. [중요] 45면체 주사위 화면 — 15회 이상 연타 시 앱이 느려지다 뻗음
- **피드백**: [스크린샷 2장, "자동 6회 굴리기" 버튼과 "번호를 탭하면 그 번호만 다시 굴립니다" 안내 문구에 빨간 박스] "네모친 것들을 15회 이상 연속으로 누를 경우 앱이 느려지고, 뻗는 경향이 있어서 뻗으믄 앱을 닫고 새로 열어야 하는 번거로움이 있어."
- **원인**: 96번에서 넣은 `isDiceSpinning` 가드는 굴리기 애니메이션 중 "회전 자체"(480ms)가 겹쳐 시작되는 것만 막아준다. 그런데 회전이 끝난 뒤 이어지는 "착지" 연출(숫자가 확정되며 살짝 커졌다 튕기는 scale 애니메이션 + 파란 글로우가 반짝이는 glow 애니메이션, 총 ~700ms)은 회전이 끝나는 즉시 `isDiceSpinning`이 `false`로 풀리면서 그 진행 중에도 버튼이 다시 눌릴 수 있었다. 이때 새 굴리기 사이클이 시작되며 `scale.setValue(1)` / `glow.setValue(0)`으로 값을 되돌리기만 했는데, RN의 `Animated.Value`는 `setValue()`를 호출해도 그 위에서 이미 진행 중이던 애니메이션(scale 튕김, glow 반짝임)을 자동으로 멈춰주지 않는다 — 즉 예전 애니메이션이 정리되지 않은 채 계속 native 쪽에 남아 새 애니메이션과 함께 돌아갔다. 15회 이상 빠르게 연타하면 이런 "정리 안 된 애니메이션"이 계속 쌓여 동시에 수십 개가 실행되며 기기 자원을 잡아먹어 앱이 점점 느려지다 완전히 멈추는(ANR) 원인이 됐다. 추가로, 개별 번호 공(재굴리기)을 누르는 `Pressable`에는 애초에 `isDiceSpinning` 가드 자체가 빠져 있어서, 굴리는 도중에도 계속 눌러 같은 문제를 더 쉽게 재현할 수 있었다.
- **수정**:
  - `src/components/Dice45.tsx` — 새 굴리기 사이클을 시작하기 전에 `spinRotate.stopAnimation()` / `scale.stopAnimation()` / `glow.stopAnimation()`을 호출해, 이전 사이클에서 아직 진행 중이던 애니메이션을 명시적으로 멈춘 뒤에 값을 초기화하도록 변경. 이러면 몇 번을 연타하든 항상 "현재 진행 중인 애니메이션 세트는 최대 1벌"만 유지되어 애니메이션이 누적되지 않는다.
  - `app/generate/dice.tsx` — 개별 번호 공 재굴리기 `Pressable`에도 하단 3개 버튼과 동일하게 `disabled={isDiceSpinning}`을 추가하고, 굴리는 동안 흐리게 표시되도록 `ballDisabled`(opacity 0.45) 스타일을 새로 추가.
- **검증**: `npx tsc --noEmit`·`npx eslint .`(사용자 실기기 터미널에서 확인 예정) — 애니메이션 시작 직전에 정지 호출 3줄을 추가하고, 기존에 가드가 빠져 있던 Pressable 하나에 가드를 추가한 변경이라 로직 회귀 위험은 낮음. 실기기에서 "자동 6회 굴리기"와 개별 번호 공을 각각 15회 이상 빠르게 연타해봤을 때 더 이상 버벅임·멈춤 없이 매끄럽게 반응하는지, 연타를 멈춘 뒤 최종적으로 화면에 표시되는 숫자/애니메이션 상태가 어색하지 않은지 확인 필요.

### 108. [중요] 105번 후속 — "내 번호" 탭에서 여전히 스크롤 중 헤더가 상태표시줄과 겹침 + 과거 회차 카드 구분 요청
- **피드백**: [스크린샷 2장, 동일, "내 번호" 탭] 화살표 1: 스크롤 중 월 버킷 섹션 헤더("8월" 등)가 위로 스크롤될 때 상태표시줄 시계·배터리와 겹쳐서 제대로 안 보임, 위치 조정 필요. 화살표 2: 과거 회차(월 버킷) 카드들의 배경색을 아주 옅은 회색 계열로 줘서 "이건 과거 회차다"라는 구분이 필요.
- **원인(화살표 1)**: 105번에서 만든 `StatusBarSafeMask`는 스크롤 콘텐츠 위에 배경색 판을 고정해두는 방식인데, "내 번호" 탭의 `SectionList`는 섹션 헤더를 화면 상단에 붙이는 `stickySectionHeadersEnabled`를 쓴다. 이 sticky 헤더(`sectionHeader` 스타일)에는 100번에서 "떠 있는 판" 느낌을 주려고 준 안드로이드 `elevation: 1`이 있는데, 안드로이드에서 elevation이 있는 뷰는 형제 컴포넌트 중 나중에 그려지는(JSX상 뒤에 오는) 뷰보다도 그림자 레이어 때문에 위로 떠 보이는 경우가 있다 — 그래서 마스크가 JSX상 SectionList 뒤에 있어 원래는 그 위에 그려져야 함에도, sticky 헤더가 스크롤로 맨 위에 고정된 순간 헤더가 마스크보다 위로 보이면서 상태표시줄과 다시 겹쳐 보였다. 105번 당시엔 sticky 헤더가 없는 화면들(홈/번호 만들기/로또 연구소)만으로 검증이 끝나서 이 케이스를 놓쳤다.
- **수정(화살표 1)**: `src/components/StatusBarSafeMask.tsx`에 `zIndex: 999`(iOS/신아키텍처)와 `elevation: 999`(안드로이드)를 명시적으로 추가 — 화면 안 어떤 요소가 얼마의 elevation을 갖고 있든 이 마스크가 항상 최상단에 그려지도록 고정했다.
- **원인(화살표 2)**: 102번에서 "추첨 월" 버킷 카드에 회차 문구(`pastRoundLabel`)는 다시 넣었지만, 카드 배경색 자체는 이번 주/다음 주 카드와 동일한 `colors.surface`(흰색)를 그대로 썼다 — 텍스트를 읽지 않으면 과거 회차인지 시각적으로 구분이 안 됐다.
- **수정(화살표 2)**: `app/(tabs)/tickets.tsx` — 새 스타일 `cardPast`(배경색 `colors.surfaceAlt`, 라이트 모드 `#F1F5F9`의 아주 옅은 회색, 다크 모드는 카드보다 한 톤 밝은 슬레이트)를 추가하고, `renderItem`에서 `section.key`가 `"month-"`로 시작하는(=과거 회차 월 버킷) 카드에만 `styles.card`에 이 스타일을 덧씌운다. 새 색을 만들지 않고 기존 디자인 토큰(보조 서피스)을 재사용해 시스템 일관성을 유지했다.
- **검증**: `npx tsc --noEmit`·`npx eslint .`(사용자 실기기 터미널에서 확인 예정). 실기기에서 "내 번호" 탭을 끝까지 스크롤하며 (1) 월 버킷 헤더가 상단에 고정될 때 상태표시줄 영역이 항상 깨끗한 배경색으로 보이는지(더 이상 시계·배터리와 겹치지 않는지), (2) 과거 회차(월 버킷) 카드들이 라이트/다크 모드 각각에서 이번 주/다음 주 카드와 옅게나마 구분되는 회색 톤으로 보이는지, 색 차이가 너무 옅어서 안 보이거나 반대로 튀어 보이지 않는지 확인 필요.

### 109. [중요] "회차 변경"으로 미래 회차로 바꿔도 "확인 완료"·낙첨 표시가 그대로 남음
- **피드백**: [스크린샷 2장, 동일, "내 번호" 탭 "다음 주 추첨 (9/5)" 섹션] "다음 주 추첨인데 확인완료 표시와 낙첨이 뜨면 말이 안됨. 확인 전 / 발표 전 이렇게 추첨 시점에 맞춰서 변경 필요. 이는 회차 변경으로 미래시점으로 보낼 때 항상 적용되어야 함."
- **원인**: "회차 변경"(`finishAssigningDraw` → `updateTicketDrawNumber`)은 티켓의 `drawNumber`만 바꿔 저장하고, 그 이전 회차를 기준으로 이미 채워져 있던 `matchedRank`(당첨 확인 결과)와 그 결과 때문에 `"CHECKED"`로 켜져 있던 `status`는 그대로 남겨뒀다. 예를 들어 제 1235회로 확인해서 "낙첨"이 찍힌 티켓을 나중에 "회차 변경"으로 아직 추첨 전인 "다음 주(9/5, 제 N+1회)"로 다시 지정해도, 화면엔 옛 회차의 확인 결과("확인 완료" 배지 + "낙첨")가 그대로 남아 "아직 추첨도 안 했는데 왜 낙첨이라고 나오지?"처럼 앞뒤가 안 맞는 상태가 됐다. 이는 미래 회차뿐 아니라 다른 과거 회차로 바꾼 경우에도 마찬가지로 발생하는 문제였다(예전 회차의 결과가 새 회차엔 안 맞는 건 매한가지).
- **수정**: `src/lib/storage/tickets.ts`의 `updateTicketDrawNumber` — 회차가 실제로 바뀌는 경우(같은 회차로 재지정한 경우는 제외)엔 `matchedRank`를 지우고, 그 값 때문에만 `"CHECKED"`로 켜져 있던 `status`도 `"SAVED"`로 되돌리도록 변경. 이러면 회차를 바꾼 직후엔 "당첨 확인" 버튼이 다시 노출되고(매 확인/재확인 구분과 동일한 로직 재사용, 별도 UI 변경 불필요), 미래 회차로 보낸 경우엔 기존 자동 확인 로직(`autoCheckPendingTickets`, `matchedRank === undefined`인 티켓만 대상)이 발표 전까지는 조용히 건너뛰다가 실제 발표되면 자동으로 다시 채워준다.
- **검증**: `npx tsc --noEmit`·`npx eslint .`(사용자 실기기 터미널에서 확인 예정) — 저장 레이어의 분기 하나 추가라 회귀 위험은 낮으나, 데이터 상태를 다루는 로직이라 실기기에서 직접 시나리오 확인이 특히 필요: (1) 이미 확인 완료(낙첨/당첨)된 티켓을 "회차 변경"으로 미래 회차(이번 주/다음 주)로 보냈을 때 "확인 완료"·등수 표시가 즉시 사라지고 "당첨 확인" 버튼으로 돌아오는지, (2) 다른 과거 회차로 바꿨을 때도 동일하게 초기화되는지, (3) 같은 회차로 재지정(사실상 변경 없음)했을 때는 기존 확인 결과가 그대로 유지되는지, (4) 미래 회차로 보낸 티켓이 실제 그 회차가 발표된 뒤 앱을 다시 열면 자동으로 결과가 채워지는지.

### 110. [중요] 108번 재확인 요청 + 추가 피드백 2건 — sticky 헤더 겹침 근본 원인 재수정 / 편집 중 카드 표시
- **요청**: "이것도 체크해줘. 위에꺼는 수정되었는지 한번 더 체크해봐주고." — [스크린샷 2장, "내 번호" 탭, "다음 주 추첨 (9/5)" 섹션] 화살표 1: 108번에서 "8월"(월 버킷) 헤더로 신고했던 것과 같은 증상이 "다음 주 추첨" 헤더(월 버킷이 아닌 현재 회차 섹션)에서도 스크롤 시 상태표시줄과 겹침 — 108번 수정이 헤더 종류를 가리지 않고 모든 sticky 헤더에 공통 적용되는 수정이었는지 재확인 필요. 화살표 2: "회차 변경"을 눌러 이번 주/다음 주/직접 입력 선택지가 펼쳐진 카드는 테두리 색을 다르게 줘서 "지금 변경 중인 카드"라는 걸 명확히 표현해달라는 요청.
- **108번 재확인 결과**: 108번에서 준 `zIndex: 999`/`elevation: 999`는 섹션 종류와 무관하게 `StatusBarSafeMask` 하나에 공통으로 적용되므로 "8월" 헤더든 "다음 주 추첨" 헤더든 똑같이 걸리는 수정이 맞다. 다만 다시 원리를 짚어보니, 이 마스크는 "화면 위에 무엇이 지나가든 그 위를 덮는" 방식이라 elevation 경쟁에서 이기기만 하면 되는 임시방편에 가까웠다 — 더 근본적으로 짚어보니 sticky 헤더는 애초에 "고정될 때" `contentContainerStyle`의 여백이 아니라 `SectionList` 자기 자신의 레이아웃 박스 맨 위(y=0, 즉 상태표시줄이 있는 화면 맨 위)를 기준점으로 달라붙는다는 걸 확인했다 — 마스크의 z-순서를 아무리 높여도, 헤더가 "고정되는 순간의 미세한 프레임"이나 애니메이션 중간 상태에서 완전히 안정적으로 가려진다는 보장이 약한 임시방편이었다는 뜻. 그래서 이번엔 그 기준점 자체를 상태표시줄 아래로 옮기는 구조적 수정으로 보강했다(아래).
- **수정(화살표 1)**: `app/(tabs)/tickets.tsx` — `SectionList`의 `style`에 `paddingTop: insets.top`을 직접 줘서, 리스트 자신의 레이아웃 박스가 상태표시줄 높이만큼 아래에서 시작하게 했다(그만큼을 `contentContainerStyle`의 `paddingTop`에서 빼서 첫 카드 위치는 기존과 동일하게 유지: `insets.top + 16` → `16`). 이러면 sticky 헤더가 고정될 때 붙는 기준점 자체가 상태표시줄 아래이므로, z-순서 경쟁에 기대지 않고 애초에 겹칠 공간이 없어진다. 108번의 마스크 zIndex/elevation 수정은 혹시 모를 잔여 케이스에 대한 안전장치로 그대로 남겨둔다.
- **수정(화살표 2)**: `app/(tabs)/tickets.tsx` — 새 스타일 `cardEditing`(테두리 색 브랜드 블루 `#2563EB`, 두께 2)을 추가하고, `editingDraw[item.id]`가 true인(= "회차 변경" 선택지가 펼쳐진) 카드에만 `styles.card` 위에 덧씌운다.
- **검증**: `npx tsc --noEmit`·`npx eslint .`(사용자 실기기 터미널에서 확인 예정). **중요**: 이번 항목의 화살표 1 수정은 108번보다 더 근본적인 접근이지만, sticky 헤더의 정확한 네이티브 동작은 코드 리뷰만으로 100% 장담하기 어려운 영역이라 반드시 실기기 재확인이 필요하다 — "내 번호" 탭에서 여러 섹션(회차 미지정/이번 주·다음 주/월 버킷)을 각각 화면 맨 위까지 스크롤해 헤더가 고정된 상태에서 상태표시줄이 항상 깨끗하게 보이는지 확인해달라. 화살표 2는 "회차 변경"을 눌렀을 때 그 카드만 파란 테두리로 바뀌고, 취소·지정 후 원래 테두리로 돌아오는지 확인 필요.

### 111. "번호 만들기" 탭 — "딥 패턴 탐색" 카드만 테두리 색이 다름
- **피드백**: "번호만들기>딥 패턴 탐색만 테두리 색상 다름. 다른것과 동일하게 변경 필요."
- **원인**: "딥 패턴 탐색" 카드는 신규 기능이라는 걸 알리기 위해 오른쪽 위 "NEW" 배지 외에도 카드 테두리 자체를 보라색(`#6C5CE7`)으로, 두께도 다른 카드(1)보다 굵게(1.5) 줘서 시각적으로 눈에 띄게 했었다(89번 이전부터 있던 `cardNew` 스타일). "NEW" 배지 하나로도 이미 신규 표시는 충분한데, 테두리까지 달라서 다른 5개 카드와 톤이 안 맞고 이질적으로 보인다는 피드백.
- **수정**: `app/(tabs)/generate.tsx` — 카드 `Pressable`의 스타일 배열에서 `item.isNew && styles.cardNew` 조건을 제거하고, 이제 쓰이지 않는 `cardNew` 스타일 정의도 함께 삭제. 이제 "딥 패턴 탐색" 카드도 다른 5개와 완전히 동일한 테두리(`colors.border`, 두께 1)를 쓰고, "NEW" 배지만으로 신규 기능임을 알린다.
- **검증**: `npx tsc --noEmit`·`npx eslint .`(사용자 실기기 터미널에서 확인 예정) — 스타일 조건 하나와 미사용 스타일 정의를 제거한 변경이라 회귀 위험은 없음. 실기기에서 "딥 패턴 탐색" 카드 테두리가 다른 카드들과 동일한 색·두께로 보이는지, NEW 배지는 그대로 잘 보이는지 확인 필요.

### 112. [중요] 107번 후속 — 20회 연타 시 여전히 느려지다 뻗고, 뒤로가기도 안 먹힘
- **피드백**: "번호만들기> 45면체 주사위 20회 굴리면 느려지고 뻗는거 같음. 뒤로가기도 안먹히는거 한번 체크필요."
- **원인**: 107번에서 애니메이션 잔여물이 쌓이는 문제(stopAnimation 누락)는 고쳤지만, 그 가드(`isDiceSpinning`)가 React state라는 근본적인 한계가 남아있었다. 흐름을 보면: 버튼을 누르면 → `spinTrigger` state 변경 → 리렌더 → 커밋 후 `Dice45`의 `useEffect`가 실행되며 `onSpinningChange(true)` 호출 → 그게 다시 부모의 `setIsDiceSpinning(true)` → 또 한 번의 리렌더를 거쳐야 버튼에 `disabled`가 실제로 적용된다. 즉 "누른 시점"과 "버튼이 실제로 잠기는 시점" 사이에 최소 두 번의 리렌더 사이클만큼 시차가 있다. 20회처럼 아주 빠르게 연타하면 이 짧은 틈 사이로 탭 몇 개가 새어 들어가 가드를 그대로 통과해버렸고, 그렇게 새어나간 탭들이 애니메이션 사이클을 다시 겹쳐 시작시켰다(107번에서 고친 stopAnimation은 "겹치더라도 잔여물이 안 쌓이게" 막아줄 뿐, 애초에 겹쳐 시작되는 것 자체는 막지 못한다). 이게 반복되면 JS 스레드가 계속 밀리면서 화면 전체(뒤로가기 포함, 뒤로가기도 결국 JS 스레드가 이벤트를 처리해야 동작함)가 한동안 응답하지 않는 것처럼 보였다.
- **수정**: `app/generate/dice.tsx` — React state와는 별개로 `isSpinningRef`(참조값)를 추가해, "한 번 굴리기"/"자동 6회 굴리기"/개별 번호 재굴리기 세 진입점 모두에서 실제 로직을 실행하기 전에 이 ref를 동기적으로(리렌더를 기다리지 않고 즉시) 확인·잠근다. state 기반 가드(`isDiceSpinning`)는 버튼을 흐리게 표시하는 시각적 피드백용으로 그대로 유지하되, "지금 굴리는 중이면 무조건 막는다"는 실제 방어선은 이제 리렌더 지연의 영향을 받지 않는 ref가 담당한다.
- **검증**: `npx tsc --noEmit`·`npx eslint .`(사용자 실기기 터미널에서 확인 예정). 실기기에서 "자동 6회 굴리기"·개별 번호 공을 20회 이상 최대한 빠르게 연타해봤을 때 더 이상 버벅임·멈춤이 없는지, 연타 도중에도 뒤로가기가 즉시 반응하는지, 연타를 멈춘 뒤 최종 화면 상태(표시된 숫자·버튼 활성화 여부)가 정상인지 확인 필요.

### 113. [조사 반영] 로또 연구소 "기대 대비 실제 1등 당첨자 수" 카드 신규 추가
- **배경**: 사용자가 로또 판매액 역산·Winner Ratio/Z-score·자동/수동 데이터 기반 인기도 모델·전이 예측 점수를 추천 점수에 섞는 방안을 제안하는 ChatGPT 논의를 공유하며 "반영해볼만한 부분이 있는지" 검토를 요청. 코드 조사 결과, 제안의 전제("판매액을 이 앱이 더는 못 가져온다")와 달리 `src/lib/draws/drawApi.ts`가 API 응답에서 회차별 1등 당첨자수(`rnk1WnNope`)·1등 1인당 당첨금(`rnk1WnAmt`)·총판매금액(`rlvtEpsdSumNtslAmt`)을 이미 `WinningDraw.firstPrizeWinnerCount`/`firstPrizeAmount`/`totalSalesAmount`로 매핑해 받아오고 있었음을 확인했고, 이를 근거로 "① 스크래퍼 보강 → ② 기대 대비 실제 1등 수 사실 서술 카드 추가"만 채택하고, 자동/수동 분석·인기도 모델(③)은 별도 조사 과제로 보류, 전이 점수를 추천 점수에 섞는 설계(④)는 기존 §23 예측성 표현 금지 원칙과 정면으로 충돌해 폐기하기로 사용자가 결정. 착수 후 `scripts/update-lotto-data.mjs`와 `data/lotto-draws.json`(전체 1238개 회차)을 직접 확인한 결과, ①(스크래퍼가 세 필드를 히스토리 파일에 저장하도록 보강)은 **이미 완전히 구현되어 있었고 과거 데이터도 전부 채워져 있어 추가 작업이 불필요**했다 — 이 세션에서 그 사실을 재확인하고 곧바로 ②만 구현했다.
- **수정**:
  - `src/lib/draws/drawStats.ts` — `computeFirstPrizeExpectation(draw)`를 추가. 회차의 `totalSalesAmount`를 1게임 가격(1,000원)으로 나눠 추정 구매 게임 수를 역산하고, 이를 `TOTAL_COMBINATIONS`(8,145,060, `src/lib/lottery/probability.ts`에서 가져옴)로 나눠 "모든 게임이 서로 다른 조합을 골랐다고 가정했을 때"의 이론적 1등 기대 인원을 포아송 근사로 계산한다. 실제 1등 당첨자 수와 비교해 비율(ratio)과 표준화 편차(zScore = (실제−기대)/√기대)를 함께 반환하며, 필요한 데이터가 없으면 `null`을 반환해 카드 자체를 숨기게 했다. 이 값을 사람이 바로 읽을 수 있는 한 문장으로 요약하는 `describeFirstPrizeExpectation(exp)`도 함께 추가 — 당첨자 0명(이월)/기대치와 비슷/다소 이례적/꽤 이례적 네 갈래로 자연스러운 문장을 생성한다.
  - `src/constants/messages.ts` — `FIRST_PRIZE_EXPECTATION_NOTICE` 추가. 이 통계가 판매액 기반 역산치와 실제 인원을 비교하는 서술적 통계일 뿐, 로또 추첨은 매회 독립적이라 다음 회차 확률과는 무관함을 명시(§23 원칙 적용).
  - `app/(tabs)/lab.tsx` — 최신 회차(`latestDraw`)에 대해 `computeFirstPrizeExpectation`을 계산하고, 사용자가 지정한 위치(**"조합 패턴 통계 (최근 N회 평균)" 카드 바로 아래, "내 번호 분석" 카드 바로 위**)에 새 카드를 삽입. 카드 상단에 `describeFirstPrizeExpectation`가 만든 서술 문장을 배치하고, 그 아래 총 판매액/추정 구매 게임 수/이론적 기대 1등 당첨자 수/실제 1등 당첨자 수/기대 대비 실제 비율을 `Row`로 나열해 "유저가 한눈에 보기 쉽게" 정리했다. 카드 바로 아래에 `FIRST_PRIZE_EXPECTATION_NOTICE`를 담은 `DisclaimerCard`를 배치. 데이터가 없는(과거 극초기 등) 경우 카드째 렌더링하지 않는다.
  - 사용자의 명시적 결정에 따라 자동/수동 당첨자 분석, 특성 기반 인기도(Winner Ratio) 모델, "전이 예측 점수를 추천 점수에 섞는" 설계는 이번 작업 범위에 포함하지 않았다.
- **검증**: `npx tsc --noEmit`·`npx eslint .`(사용자 실기기 터미널에서 확인 예정) — 세 파일 모두 기존 컨벤션(안내 문구 상수, `Row` 헬퍼, 카드 스타일)을 그대로 재사용한 순수 추가 변경이라 회귀 위험은 낮음. 실기기에서 로또 연구소 탭을 열어 새 카드가 정확히 "조합 패턴 통계"와 "내 번호 분석" 사이에 나타나는지, 서술 문장과 수치가 최신 회차(현재 1238회) 기준으로 자연스럽게 표시되는지, 안내 문구 카드가 함께 뜨는지 확인 필요.

### 114. [중요] 109번 후속 — "다음 주 추첨"인데 확인완료·낙첨 표시가 여전히 남아있음
- **피드백**: 스크린샷 3장. "다음 주 추첨 (9/5)" 섹션의 티켓 3장 모두 "확인 완료" 배지와 "낙첨" 텍스트가 그대로 떠 있는 상태 — "아직 미래 시점 결과가 안나오는데 저렇게 표시되어있어. 수정한게 반영안된거 같아." 첨부 메모: "다음 주 추첨인데 확인완료 표시와 낙첨이 뜨면 말이 안됨. 확인 전/발표 전 이렇게 추첨 시점에 맞춰서 변경 필요. 이는 회차 변경으로 미래시점으로 보낼 때 항상 적용되어야 함."
- **원인**: 109번에서 고친 `updateTicketDrawNumber`의 가드("회차가 실제로 바뀔 때 matchedRank·CHECKED 상태를 지운다")는 **그 수정이 기기에 배포된 시점 이후에 일어나는 회차 변경에만** 적용되는 코드였다. 그 전에 이미 `AsyncStorage`에 저장돼 있던 티켓 — 예: 이미 확인이 끝난 과거 회차의 결과(matchedRank=0=낙첨, status="CHECKED")를 그대로 지닌 채 회차 번호만 "다음 주"(미래)로 이미 바뀌어 있던 낡은 데이터 — 에는 코드 수정이 소급 적용되지 않는다. 즉 코드는 정상적으로 고쳐졌지만, 그 코드가 배포되기 전에 이미 만들어진 "낡고 무효한 상태"가 기기에 그대로 남아있어서 화면엔 계속 같은 증상이 보였던 것 — 사용자가 "수정한게 반영안된거 같아"라고 느낀 게 정확했다(정확히는 "새 버그"가 아니라 "예전 버그가 남긴 낡은 데이터"였다). tickets.tsx의 섹션 분류(`drawNumber >= thisWeekDrawNumber`)와 상태 배지 렌더링은 둘 다 저장된 `matchedRank`/`status` 값을 그대로 신뢰할 뿐, "이 회차가 실제로 추첨 전인지"를 렌더링 시점에 다시 검증하지 않는 구조였다.
- **수정**:
  - `src/lib/storage/tickets.ts` — `clearTicketCheckResult(id)`를 새로 추가. `updateTicketDrawNumber`처럼 회차 번호는 그대로 두고, `matchedRank`만 지우고 그 값 때문에 켜져 있던 "CHECKED" 상태만 "SAVED"로 되돌린다.
  - `app/(tabs)/tickets.tsx` — `healFutureTickets(list)`를 추가해, 화면에 진입(포커스)할 때마다 "지정된 회차가 `thisWeekDrawNumber` 이상(=아직 추첨 전)인데 `matchedRank`가 남아있는" 티켓을 찾아 `clearTicketCheckResult`로 정리한다. 기존 `load() → autoCheckPendingTickets()` 흐름 사이에 `load() → healFutureTickets() → autoCheckPendingTickets()`로 끼워 넣었다 — 정리 후 곧바로 자동 확인 로직이 이어지므로, 실제로 발표된 회차라면 바로 정상적으로 다시 확인되고, 아직 발표 전이면 조용히 "미확인" 상태로만 남는다. 낡은 데이터든 앞으로 생길 수 있는 다른 경로의 오류든, 이 정리 로직이 화면 진입 때마다 계속 안전망 역할을 한다 — 한 번 정리되면 그 뒤로는 다시 나타나지 않는다.
- **검증**: `npx tsc --noEmit`·`npx eslint .`(사용자 실기기 터미널에서 확인 예정). 실기기에서 앱을 열자마자(탭 진입 시) "다음 주 추첨 (9/5)" 섹션의 기존 3장이 "확인 완료"/"낙첨" 없이 "당첨 확인" 버튼이 있는 정상(미확인) 상태로 바뀌는지, 다른 정상 티켓(과거 회차의 실제 확인 결과)은 그대로 유지되는지 확인 필요. 추가로 이미 확인된 과거 회차 티켓을 "회차 변경"으로 미래 회차로 옮겨봤을 때도(109번 케이스) 즉시 미확인 상태로 보이는지 재확인 부탁.

### 115. 로또 연구소 맨 하단의 "많이 선택되는 번호" 안내 문구 삭제
- **피드백**: "로또연구소 맨 하단 텍스트는 다른 곳에 존재(ai조합탐색)하므로 삭제해도 될 것 같아. 로또연구소 내 연관성 있는 내용이 없으니까말야."
- **원인**: `POPULARITY_HEURISTIC_NOTICE`(‘많이 선택되는 번호’ 정보는 실제 타 사용자 데이터가 아니라 일반적인 선택 편향 근사치라는 안내)는 원래 `app/generate/ai-search.tsx`(AI 조합 탐색)의 "인기번호 회피" 토글 옆에 붙어야 할 안내문인데, 로또 연구소(`lab.tsx`) 화면 맨 아래에도 같은 문구가 붙어 있었다. 로또 연구소 화면 안에는 이 문구가 설명하는 "많이 선택되는 번호(인기도 근사치)" 관련 카드나 수치가 하나도 없어서, 사용자 입장에선 화면 어디와도 연결되지 않는 문구가 맥락 없이 맨 아래에 붙어 있는 것으로 보였다.
- **수정**: `app/(tabs)/lab.tsx` — 맨 아래 `<DisclaimerCard text={POPULARITY_HEURISTIC_NOTICE} />`와 이제 쓰이지 않는 `POPULARITY_HEURISTIC_NOTICE` import를 제거했다. `app/generate/ai-search.tsx`의 안내는 그대로 유지되며, `src/constants/messages.ts`의 상수 자체도 그대로 남겨뒀다(다른 곳에서 계속 쓰이므로 삭제 대상이 아님).
- **검증**: `npx tsc --noEmit`·`npx eslint .`(사용자 실기기 터미널에서 확인 예정) — 카드 하나와 미사용 import를 제거한 변경이라 회귀 위험 없음. 실기기에서 로또 연구소 화면을 맨 아래까지 스크롤했을 때 "당첨번호 합계 추세" 안내 문구 다음에 더 이상 아무 문구도 뜨지 않고 화면이 자연스럽게 끝나는지, AI 조합 탐색 화면의 "인기번호 회피" 관련 안내는 그대로 잘 보이는지 확인 필요.

### 116. [중요] CI 연속 3회 실패(#113~#115) — `TRANSITION_FREQUENCY_NOTICE` 미정의 타입 에러
- **피드백**: GitHub Actions에서 온 메일 스크린샷 5장. `CI: All jobs have failed`, `verify` 잡이 22~33초 만에 실패. 커밋 3개(#113 "기대 대비 실제 1등 당첨자 수 카드 추가", #114 "미래 회차 티켓 자동 정리", #115 "로또 연구소 하단 무관한 안내 문구 제거")가 전부 `Failure` 상태였고, Annotations에 `verify: app/(tabs)/lab.tsx#L24 — Module '"../../src/constants/messages"' has no exported member 'TRANSITION_FREQUENCY_NOTICE'.`
- **원인**: 직접 코드를 확인해보니 `app/(tabs)/lab.tsx`는 처음부터(이번 세션 이전, "다음 회차 통계 탐색" 기능이 추가됐을 때부터) `TRANSITION_FREQUENCY_NOTICE`를 `src/constants/messages.ts`에서 import해 쓰고 있었는데, **정작 그 상수가 `messages.ts`에 정의된 적이 없었다** — `drawStats.ts`의 `computeTransitionFrequencies` 주석에서도 "반드시 TRANSITION_FREQUENCY_NOTICE와 함께 노출해야 한다"고 언급만 하고 실제 export는 빠져 있었다. 즉 로컬 개발 환경(Metro/Expo)에서는 이 타입 에러가 런타임을 막지 않아 겉으론 정상 동작하는 것처럼 보였지만(JS는 존재하지 않는 named import를 참조해도 `undefined`가 될 뿐 즉시 죽지 않음 — `DisclaimerCard`가 `undefined` 텍스트를 받아도 화면이 깨지진 않았을 가능성이 높다), CI의 `tsc --noEmit`(또는 동급 타입 체크)은 이를 정확히 잡아내 계속 실패했다. 이번 세션에서 새로 만든 코드가 이 버그를 일으킨 게 아니라, 그보다 먼저 있던 결손을 미처 못 잡고 그 위에 계속 커밋을 쌓아온 것 — CI 실패 메일을 사용자가 이번에 처음 확인하면서 드러났다.
- **수정**: `src/constants/messages.ts`에 `TRANSITION_FREQUENCY_NOTICE`를 새로 정의해 추가했다. "이번 회차 번호 이후 통계" 카드가 서술하는 내용(특정 번호가 나온 뒤 다음 회차에 어떤 번호가 자주 나왔는지는 표본 크기가 유한해서 생기는 무작위 변동일 뿐, 실제 인과관계나 확률적 편향이 아니라는 점)을 다른 안내 문구들과 같은 톤으로 작성했다. `TRANSITION_FREQUENCY_NOTICE`를 참조하는 다른 모든 파일(`app/(tabs)/lab.tsx`, `src/lib/draws/drawStats.ts` 주석)은 코드 수정 없이 그대로 연결됐다. 재발 방지를 위해 `messages.ts`에서 export하는 모든 `*_NOTICE` 상수와, `app`/`src` 전체에서 `constants/messages`를 import하는 4개 파일(`app/(tabs)/lab.tsx`, `app/(tabs)/index.tsx`, `app/generate/ai-search.tsx`, `app/generate/exclusion.tsx`)이 요구하는 이름을 서로 대조해, 이번에 고친 것 외에 또 다른 미정의 참조가 없는지 전수 확인했다(추가 결손 없음).
- **검증**: `node_modules`가 없는 이 세션에서는 `npx tsc --noEmit`을 직접 돌릴 수 없어, grep 기반으로 "messages.ts가 export하는 이름"과 "레포 전체가 import하는 `*_NOTICE` 이름"을 서로 대조하는 방식으로 대신 검증했다(정확히 일치, 누락 없음). 최종 확인은 사용자 실기기 터미널의 `npx tsc --noEmit`·`npx eslint .`, 그리고 이 커밋을 푸시한 뒤 GitHub Actions CI가 실제로 초록(성공)으로 바뀌는지로 완료된다.

### 117. 로또 연구소 카드 간 간격 불일치 — 연관된 카드-안내 문구 그룹핑 개선
- **피드백**: "로또 연구소 내 간격이 일정하지 않음. 또한 연관성 있는 설명은 좀 더 가깝게 하는게 나을 것 같음. 다만 가독성을 좀 개선해야함. 지금은 가독성이 저하되는 기분임. 개선해줘." 스크린샷에 빨간 박스로 표시된 지점들: "이번 회차 번호 이후 통계" 카드 끝~"조합 패턴 통계" 카드 시작 사이, "조합 패턴 통계" 카드 끝~"기대 대비 실제 1등 당첨자 수" 카드 시작 사이, 그 카드 끝~바로 아래 안내 문구 사이.
- **원인**: 카드는 `marginBottom: 12`, `DisclaimerCard`(안내 문구)는 `marginVertical: 8`(위아래 동일)을 쓰고 있었다. 그런데 "카드 바로 아래 그 카드 전용 안내 문구가 붙는" 구조에서 이 둘을 그대로 합치면: 카드→안내 문구 사이는 12+8=20px로 벌어지는 반면, 안내 문구→다음(전혀 무관한) 카드 사이는 8px밖에 안 된다. 즉 서로 연관된 "카드+그 설명"보다 안내 문구와 무관한 다음 섹션이 시각적으로 더 가까워 보이는 역전 현상이 있었다 — 사용자가 지적한 "간격이 일정하지 않다"·"연관성 있는 설명이 멀어 보인다"·"가독성이 저하되는 느낌"이 정확히 이 역전에서 비롯됐다(글자 대비 자체는 라이트 테마 기준 `textSecondary(#475569)` on `surfaceAlt(#F1F5F9)`로 이미 충분해, 색상 대비 문제는 아니었다).
- **수정**:
  - `src/components/DisclaimerCard.tsx` — 기본 여백은 그대로 두되, 필요할 때만 덮어쓸 수 있는 선택적 `style` prop을 추가했다(생략 시 기존 동작 그대로라 이 컴포넌트를 쓰는 다른 6개 화면에는 영향 없음).
  - `app/(tabs)/lab.tsx` — "이번 회차 번호 이후 통계", "기대 대비 실제 1등 당첨자 수", "당첨번호 합계 추세" 세 카드(모두 바로 아래 자기 전용 안내 문구가 붙는 카드)에 `cardTight`(marginBottom 6)를 추가하고, 그 세 곳의 `DisclaimerCard`에 `attachedNotice`(marginTop 0, marginBottom 12) 스타일을 넘겼다. 결과: 카드↔그 카드의 안내 문구 사이는 6px로 바짝 붙어 "하나의 덩어리"로 읽히고, 안내 문구↔다음 카드 사이는 화면 전체와 동일한 표준 간격(12px)으로 돌아와 다른 카드-카드 경계와 완전히 일정해졌다.
- **검증**: `npx tsc --noEmit`·`npx eslint .`(사용자 실기기 터미널에서 확인 예정). 실기기에서 로또 연구소를 처음부터 끝까지 스크롤하며 (1) 모든 카드-카드 경계 간격이 눈에 일정하게 느껴지는지, (2) "이번 회차 번호 이후 통계"/"기대 대비 실제 1등"/"당첨번호 합계 추세" 세 카드가 각자의 안내 문구와 시각적으로 붙어 한 그룹처럼 보이는지, (3) 다른 안내 문구를 쓰는 화면(제외하고 만들기, AI 조합탐색, 주사위, QR 확인, 행운번호, 운세번호 등)의 여백은 이번 변경으로 달라지지 않았는지 확인 필요.

### 118. [조사 반영] `APP_REVIEW_2026-08-26.md`가 지적한 저비용 항목 3건 정리
- **배경**: 8/13 리포트 이후 재점검(`APP_REVIEW_2026-08-26.md`)을 작성하며 원격 기기 브릿지로 `git status`/`git diff`/`npm audit`/`npx tsc --noEmit`/`npx eslint .`를 직접 재실행해 확인한 결과, 기능 버그는 아니지만 방치하면 커질 수 있는 위생 문제 3건을 발견했다. 리포트 전달 후 사용자가 "이어서 처리해줘"로 3건 모두 진행을 요청했다.
- **원인 1 — git 작업 트리 CRLF/LF 혼재**: `QA_LOG.md`, `data/lotto-draws.json`, `src/lib/deepPattern/combinadic.ts`, `tests/deepPatternCombinadic.test.ts` 4개 파일이 (아마 Windows 에디터가 저장하며) CRLF로 재저장돼 커밋되지 않은 변경으로 잡혀 있었다. `git diff --ignore-all-space`로 확인한 결과 실제 내용 변경은 0줄 — 순수히 줄바꿈 문자 차이였다. 저장소에 `.gitattributes`가 없어 이런 재발을 막을 장치가 없었다.
- **원인 2 — README.md 문서 드리프트(재발)**: "당첨번호 데이터 파이프라인" 절이 "설정 필요"·"data/lotto-draws.json을 채우는 것뿐"이라고 서술하고 있었는데, 실제로는 GitHub Actions가 이미 여러 주째 정상적으로 매주 자동 갱신 중이었다(`data/lotto-draws.json`을 직접 열어 확인: 1,238회차, 2026-08-22 추첨분까지 반영). 8/13 리포트가 지적했던 AI BYOK 서술 드리프트와 같은 유형(문서가 과거 시점에 멈춰 있음)이 파이프라인 절에서도 재발한 것.
- **원인 3 — eslint 경고 1건**: `app/generate/dice.tsx:130`의 `Pressable style={({ pressed }) => ...}`에서 `pressed`를 받아놓고 실제로는 `isDiceSpinning`만 참조해 쓰지 않고 있었다(70번/95번 항목에서 프레스 피드백을 앱 공통 관례로 통일하며 남은 흔적으로 추정).
- **수정**:
  - 저장소 루트에 `.gitattributes`(`* text=auto eol=lf`, 이미지/폰트류는 `binary` 명시) 신규 추가.
  - 위 4개 파일을 `git show HEAD:<파일>`로 다시 써서 커밋된 LF 버전과 완전히 동일하게(SHA-256 해시로 대조 확인) 되돌렸다 — 실제 내용 변경은 없다.
  - `README.md`의 파이프라인 절 제목을 "(설정 필요)"→"(운영 중)"으로 바꾸고, 현재 실제로 자동 동기화가 정상 동작 중이라는 사실과 최신 반영 회차를 명시. "문제가 생겼을 때 확인할 곳"으로 성격을 바꿔, 수동 개입이 필요한 경우만 남겼다.
  - `dice.tsx`의 `style={({ pressed }) => [...]}`에서 쓰지 않는 `pressed`를 파라미터에서 제거(`style={() => [...]}`) — 동작 변경 없음, 경고만 해소.
- **검증**: `npx tsc --noEmit` 클린(재실행 확인). `npx eslint .`는 이 세션 환경에서 두 차례 모두 45초 내에 끝나지 않아 이번엔 재확인하지 못했다 — 8/13 리포트부터 이월된 "이 원격 브릿지 환경 자체의 지연" 패턴과 일치하는 것으로 보이며, 변경 내용 자체가 미사용 구조분해 변수 하나를 제거한 것뿐이라 새 오류 유입 가능성은 낮다고 판단했다. 사용자 로컬 터미널에서의 `npx eslint .` 재실행 확인을 권장한다. 4개 파일 정규화는 `git show HEAD:<파일>` 출력과 작업 트리 파일의 SHA-256 해시가 완전히 일치함을 확인해 검증을 대체했다.
- **주의(사용자 조치 필요)**: 이 작업 중 실패한 `git checkout --` 시도가 `.git/index.lock`을 남겨뒀다(원격 브릿지 도구가 파일 삭제 권한이 없어 자동 정리 불가). 위 커밋들을 진행하기 전에 터미널에서 `Remove-Item .git\index.lock` (PowerShell) 또는 `del .git\index.lock`으로 먼저 지워야 `git add`/`git commit`이 정상 동작한다.

### 119. [실기기 검증 완료] 8/6~8/26 리포트에 이월되던 실기기 미확인 항목 전체 확인
- **배경**: `APP_REVIEW_2026-08-06.md`부터 `APP_REVIEW_2026-08-26.md`까지 네 차례 리포트에 걸쳐 "딥 패턴 탐색 화면군(인트로/로딩/슬라이더/상세 Pattern Map), 45면체 프레스 피드백, 홈→번호 만들기 내비게이션, 로또 연구소 카드 간격, 딥 패턴 탐색 체감 속도" 등 다수의 UI·UX 변경이 실기기에서 한 번도 육안 확인되지 않았다는 점이 반복해서 가장 큰 미해결 리스크로 지적돼 있었다.
- **확인**: 사용자가 실기기에서 전체 화면을 직접 확인해 정상 동작함을 보고했다. 특히 딥 패턴 탐색(체감 속도 포함)이 정상 동작한다는 점을 별도로 재확인했다 — 8/8 리포트부터 세 차례 리포트째 "다음 실기기 세션에서 최우선 확인" 대상으로 이월되던 항목이다.
- **의미**: 이로써 8/13·8/26 리포트가 각 관점(안정성·UX 디자이너·경쟁 앱 대비)의 점수에 유보 사유로 반영했던 "대량 UI 변경 미검증" 리스크가 해소됐다. 다음 종합 리포트를 작성할 때는 이 항목을 더 이상 유보 요인으로 반영하지 않는다.
- **한계**: 이 확인은 사용자의 실기기 테스트 결과 보고에 근거한 것이며, 이 세션이 화면을 직접 보고 검증한 것은 아니다. 화면별 세부 체크리스트(예: 슬라이더 두께, Pattern Map 좌표 배치 등 개별 항목)까지 하나하나 짚어 확인한 것인지, 전반적인 사용성만 확인한 것인지는 구분되지 않는다 — 추후 개별 항목에서 문제가 재발하면 그때 별도로 다룬다.
