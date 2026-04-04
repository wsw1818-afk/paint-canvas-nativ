# PROGRESS.md

> 업데이트: 2026-03-20
> 세션 목적: 빌드/번들/로그 최적화 + Expo 의존성 정합화

---

## What changed (이번 세션: 2026-03-20)

### OPT-001 [P0] ✅ 완료 — Android 릴리즈 빌드 최적화 플래그 활성화
- `android/gradle.properties`:
  - `android.enableMinifyInReleaseBuilds=true`
  - `android.enableShrinkResourcesInReleaseBuilds=true`
  - `android.enableBundleCompression=true`
- 효과: 릴리즈 난독화/리소스 축소/번들 압축 경로 활성화

### OPT-002 [P0] ✅ 완료 — EAS production Android 빌드 타입 AAB 전환
- `eas.json`: `production.android.buildType`을 `apk` → `app-bundle`로 변경
- 효과: 스토어 배포 기준 빌드 형태 정합화

### OPT-003 [P1] ✅ 완료 — production JS 로그 제거 경로 추가
- `babel.config.js`: production에서 `transform-remove-console` 활성화 (`error`, `warn` 제외)
- `package.json`: `babel-plugin-transform-remove-console` 추가
- 효과: 프로덕션 JS 로그 오버헤드/노이즈 감소

### OPT-004 [P1] ✅ 완료 — Native 로그 브리지 dev 전용화
- `src/screens/PlayScreenNativeModule.js`:
  - `handleNativeLog` 내부 `if (!__DEV__) return;`
  - `onNativeLog` prop을 `__DEV__`에서만 전달
- 효과: 프로덕션 JS<->Native 로그 브리지 비용 감소

### OPT-005 [P2] ✅ 완료 — Gallery 렌더 루프 디버그 로그 제한
- `src/screens/GalleryScreen.js`:
  - 미사용 `useFocusEffect` import 제거
  - 리스트 렌더 루프 내 상세 로그를 `__DEV__` 조건으로 제한
- 효과: 리스트 렌더 시 불필요한 로그 실행 최소화

### OPT-006 [P1] ✅ 완료 — Expo SDK 54 patch 정합화 + 의존성 정리
- `package.json`:
  - `expo`/`expo-dev-client`/`expo-file-system`/`expo-image-manipulator`/`expo-image-picker`/`expo-linear-gradient`/`expo-status-bar` patch 정렬
  - `@expo/config-plugins` 직접 의존성 제거
  - `babel-preset-expo`를 devDependencies 단일 항목으로 정리
- 검증: `npx expo-doctor` 17/17 통과

### OPT-007 [P2] ✅ 완료 — 로컬 산출물 ignore 규칙 보강
- `.gitignore`:
  - `dist-export/`
  - `dist-export*/`
- 효과: export 산출물의 실수 커밋 방지

### 검증 결과
- `npx tsc --noEmit` 통과
- `npx expo-doctor` 17/17 통과
- `npx expo export --platform android` 기준 HBC 번들 크기 개선
  - 기존 점검치: 약 4.12MB
  - 변경 후 점검치: 약 3.87MB

### 남은 이슈
- iOS AdMob `iosAppId` 미설정 경고 지속
  - 영향: iOS에서 Google Mobile Ads SDK 크래시 가능
  - 후속: `app.json` plugin 설정에 `iosAppId` 추가 필요

---

## What changed (이번 세션)

### CPX-001 [P0] ✅ 완료 — 포인트 강제 리셋 제거
- `App.js`: `setPoints(1000000)` 호출 및 import 제거
- `pointsStorage.js`: `INITIAL_POINTS` 1000000 → 50000 (신규 설치용)
- 결과: 앱 재시작 시 기존 포인트 유지, 신규 설치만 50000P 적용

### CPX-002 [P0] ✅ 완료 — 퍼즐 생성 실패 시 포인트 롤백 + NaN 방어
- `GenerateScreen.js`: `setPoints` import 추가
- 차감 전 `previousPoints` 스냅샷 저장
- catch 블록에서 `setPoints(previousPoints)` 롤백
- `pointsCheck.currentPoints` NaN 방어: `typeof/isNaN` 체크 → `safeCurrentPoints`

### CPX-003 [P1] ✅ 완료 — Generate 더블탭 중복 차감 방지
- `GenerateScreen.js`: `isGeneratingRef` (useRef) 도입
- 함수 진입 즉시 `true`, early return/성공/실패 모든 경로에서 `false`로 해제

### CPX-004 [P1] ✅ 완료 — 뒤로가기/언마운트 시 진행 저장 즉시 flush
- `PlayScreenNativeModule.js` `handleBackPress`:
  - 디바운스 취소 후 `AsyncStorage.setItem(gameId, ...)` 즉시 실행
  - `updatePuzzle(puzzleId, { progress, lastPlayed })` 즉시 실행
- cleanup에서도 동일 flush 로직 추가

### CPX-005 [P1] ✅ 완료 — puzzleStorage 쓰기 경쟁 조건 해소
- `puzzleStorage.js`: `writeQueue` (Promise 체인) 도입
- `savePuzzle`, `updatePuzzle`, `deletePuzzle`을 `writeQueue.then()`으로 직렬화
- 동시 호출 시 순차 실행 보장

### CPX-006 [P1] ✅ 완료 — 갤러리 자동 복구 재활성화
- `GalleryScreen.js`: 주석 제거 후 `useEffect` 기반으로 재구현
- `failedRepairIdsRef` (Set) 도입: 실패 퍼즐 무한 재시도 방지
- `try/catch/finally`로 크래시 안전성 확보

### CPX-007 [P2] ✅ 완료 — gameId 폴백 키 충돌 방지
- `PlayScreenNativeModule.js`: 파일명 기반 → URI 전체 해시 기반으로 변경
- `hash = ((hash << 5) - hash + charCode) | 0` djb2 해시

### CPX-008 [P2] ✅ 완료 — 광고 카운터 영속화 + close listener 정리
- `adManager.js`: `loadAdCounters`/`saveAdCounters` 추가 (AsyncStorage)
- 초기화 시 카운터 복원, 증가 시 저장
- `show()` 실패 시 per-show closeListener 즉시 해제

### CPX-009 [P2] ✅ 완료 — route.params 안전 접근
- `GenerateScreen.js`: `route.params` 구조분해 → `route?.params?.sourceType ?? 'gallery'`

### CPX-010 [P3] ✅ 완료 — 미사용 import 정리
- `PlayScreenNativeModule.js`: `getPuzzleById`, `getTextureById` import 제거

---

## 수정된 파일 목록
| 파일 | 변경 내용 |
|------|----------|
| `App.js` | CPX-001: setPoints(1000000) 제거 |
| `src/utils/pointsStorage.js` | CPX-001: INITIAL_POINTS 50000 |
| `src/screens/GenerateScreen.js` | CPX-002: 롤백/NaN방어, CPX-003: 재진입 방지, CPX-009: route 안전접근 |
| `src/screens/PlayScreenNativeModule.js` | CPX-004: flush, CPX-007: gameId해시, CPX-010: import정리 |
| `src/utils/puzzleStorage.js` | CPX-005: 쓰기 직렬화 |
| `src/screens/GalleryScreen.js` | CPX-006: 자동복구 재활성화 |
| `src/utils/adManager.js` | CPX-008: 카운터 영속화, listener 안전정리 |

---

## Open issues (남은 사항)
- 없음. CPX-001~010 모두 완료.

## Next
1. 실기기 테스트 (포인트 정상 유지, 뒤로가기 저장, 갤러리 자동복구)
2. 릴리즈 빌드 시 AdMob ID 정식으로 변경 (현재 null)
3. JS 번들 검증 후 플레이스토어 업로드
