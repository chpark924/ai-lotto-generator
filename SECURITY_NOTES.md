# 보안 점검 노트 (2026-07-31)

지속 원칙: 서버/유료 API 비용 최소화(0원 지향), 최대한 온디바이스 처리. QA 수정 시에도 이 원칙 유지.

## 발견 사항

1. **의존성 취약점 (중간)** — `npm audit`: 30건(moderate 11, high 19). `expo-config-plugins → xcode → uuid` 체인, EAS 빌드/네이티브 툴체인 전용이라 런타임 번들 영향 없음. Expo SDK 업그레이드 시 함께 해소 권장.
2. **외부 API 응답 미검증 (낮음)** — `src/lib/draws/drawApi.ts`가 동행복권 비공식 엔드포인트 응답을 스키마 검증 없이 파싱. 형식 변경 시 크래시 가능. 타입/범위 가드 추가 권장.
3. **번들 ID 플레이스홀더** — `app.json`의 `com.yourcompany.ailotto` 미교체. 실배포 전 필수 변경.
4. **개인정보 처리** — 양호. 생년월일은 `saveBirthProfile` 옵트인 시에만 로컬 저장, 서버 전송 없음.
5. **핵심 난수 생성** — 양호. 실제 번호 추첨은 `expo-crypto` CSPRNG 경유 (`src/lib/lottery/random.ts`). `Math.random()`은 비보안 용도(주사위 애니메이션, 버튼 문구, 티켓 로컬 ID 접미사)에만 사용.
6. **하드코딩 시크릿/API 키** — 없음.

치명적 취약점 없음. 실배포 전 처리 권장 항목만 존재.

## 참고 (문서-코드 불일치, QA 후보)

README.md는 "AI 설명 BYOK 옵션(사용자 API 키 입력 시 AI 호출)"이 있다고 서술하지만, 실제 코드(`src/lib/ai/explain.ts`)는 이 기능을 제거하고 로컬 템플릿 설명만 제공함. README 업데이트 필요.
