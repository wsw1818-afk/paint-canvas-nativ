# CLAUDE.md (Router)

이 파일은 **라우터(진입점)** 입니다. 실제 규칙/진행은 아래 파일이 단일 진실(SSOT)입니다.

- 규칙(헌법): `MEMORY.md` (+ 필요 시 MEMORY_* 분할 파일)
- 현재 진행/이슈/다음 할 일: `PROGRESS.md`
- 과거 로그(아카이브): `ARCHIVE_YYYY_MM.md`

작업 시작 순서:
1) CLAUDE.md → 2) MEMORY.md → 3) PROGRESS.md

작업 종료 시:
- PROGRESS.md 업데이트
- `.commit_message.txt` 업데이트
- (환경/제약 변경 시) MEMORY.md의 Constraints 갱신
- PROGRESS가 두꺼워지면 ARCHIVE로 이동(가이드 참고)

가이드(선택):
- 평소에는 MEMORY/PROGRESS만 따른다.
- 운영 이슈(모델 스위칭/충돌/아카이브/캐싱)가 생기면 `AI_HYBRID_GUIDE_v2.2.md`의 **해당 섹션만** 참조한다.

보안:
- 토큰/비밀번호/키스토어/인증서 등 **비밀값은 문서/코드/예시에 절대 쓰지 말 것**

---

## 최근 변경 (2026-03-20)

- 릴리즈 최적화 설정 반영
  - `android/gradle.properties`: `android.enableMinifyInReleaseBuilds=true`, `android.enableShrinkResourcesInReleaseBuilds=true`, `android.enableBundleCompression=true`
  - `eas.json`: production Android `buildType`을 `apk` → `app-bundle`로 변경
- 번들/로그 최적화 반영
  - `babel.config.js`: production에서 `console` 로그 제거(`error`, `warn` 제외)
  - `src/screens/PlayScreenNativeModule.js`: Native 로그 브리지 `__DEV__`에서만 전달
  - `src/screens/GalleryScreen.js`: 렌더 루프의 상세 디버그 로그 `__DEV__` 조건으로 제한
- 의존성 정리 및 SDK 패치 버전 정합화
  - `@expo/config-plugins` 직접 의존성 제거
  - Expo SDK 54 권장 patch 버전으로 업데이트 (`expo-doctor` 17/17 통과)
- 산출물 무시 규칙 추가
  - `.gitignore`: `dist-export/`, `dist-export*/` 추가

참고:
- 현재 iOS AdMob `iosAppId` 미설정 경고는 남아 있음(필요 시 `app.json`에 추가).
