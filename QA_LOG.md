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
- **알려진 한계**: 이번 수정은 `GeneratedGameCard`(AI 조합 탐색 등 번호 생성 결과 화면)에 한정된다. 앱의 다른 화면(로또 연구소, 내 번호 탭 등)의 접근성 라벨 공백은 19번 항목에 이미 기록된 대로 별도 작업으로 남아있다.
