# data/lotto-draws.json

로또 6/45 당첨번호 이력 캐시. 이 저장소의 GitHub Actions(`.github/workflows/update-lotto-data.yml`)가
매주 토요일 추첨 후 자동으로 `scripts/update-lotto-data.mjs`를 실행해 새 회차를 추가·커밋한다.

앱은 이 파일을 직접 읽지 않고, GitHub에 푸시된 뒤 `raw.githubusercontent.com`을 통해 받아온다
(`src/lib/draws/githubDataSource.ts`). 즉 앱이 매번 동행복권을 직접 스크래핑하는 대신, 이미 검증된
정적 JSON 한 파일만 받아오면 되므로 훨씬 안정적이고 빠르다 — 서버 비용은 여전히 0원이다
(GitHub Pages/raw content, GitHub Actions 모두 이 정도 사용량에서 완전히 무료).

## 왜 이런 구조인가

기기에서 직접 dhlottery.co.kr을 호출하던 기존 방식은 여러 세션에 걸쳐 "당첨번호를 불러오지
못했다"는 문제가 반복됐다(`QA_LOG.md` 참고). 2026-08 조사 결과 동행복권이 `donghanglottery.com`으로
사이트를 개편하면서 기존 `dhlottery.co.kr` 엔드포인트가 더 이상 정상 응답하지 않는 것으로 보인다.
매번 사용자 기기가 개별적으로 이 불안정한 소스에 직접 의존하는 대신, 이 저장소가 **주 1회만**
스크래핑을 시도하고 그 결과를 정적 파일로 커밋해두면:

- 실패해도 사람이 GitHub Actions 로그로 즉시 확인하고 고칠 수 있다(사용자 기기에서는 이런 진단이
  거의 불가능하다).
- 앱은 안정적인 정적 파일 하나만 받으면 되므로, 매 요청마다 스크래핑 성공/실패에 좌우되지 않는다.
- 여러 사용자가 각자 동행복권에 요청을 보내는 대신 한 곳에서만 요청하므로 차단당할 위험도 줄어든다.

## 초기 백필(backfill) 안내

이 파일은 처음엔 빈 배열(`[]`)로 시작한다. **이 프로젝트를 작업하는 개발 샌드박스에는 실제
인터넷이 없어서, 실존 당첨번호를 직접 확인하고 채워 넣을 방법이 없었다** — 정확성이 생명인
데이터라 추측으로 채워 넣지 않았다. 아래 둘 중 하나로 실제 데이터를 채워야 한다.

1. **로컬 PC에서 직접 실행** (권장, 가장 빠름):
   ```bash
   node scripts/update-lotto-data.mjs
   ```
   실행 후 `git diff`로 결과를 확인하고 커밋 후 푸시한다.

2. **GitHub Actions를 수동으로 한 번 실행**: 저장소를 GitHub에 푸시한 뒤 Actions 탭에서
   "Update Lotto Data" 워크플로를 `workflow_dispatch`로 수동 실행한다. 최초 1회는 1회차부터
   전부 받아오므로(현재 기준 1200회 이상) 몇 분 정도 걸릴 수 있다.

## LEGACY_ENDPOINT가 이미 죽었을 가능성

`scripts/update-lotto-data.mjs`는 기존에 앱이 쓰던 `dhlottery.co.kr` JSON 엔드포인트를 그대로
재사용한다. 이 엔드포인트 자체가 이미 완전히 죽었을 가능성을 배제할 수 없다(위 "왜 이런 구조인가"
참고 — 개발 샌드박스에서 이 도메인 전체가 응답하지 않는 것을 확인했지만, 실인터넷 환경에서 최종
검증은 못 했다). 1번 방법(로컬 실행)으로 스크립트를 돌렸을 때도 계속 실패한다면, 스크립트 상단
주석에 적힌 대응 순서(새 사이트 `donghanglottery.com`의 실제 API를 브라우저 개발자도구로 찾아
교체)를 따라야 한다.
