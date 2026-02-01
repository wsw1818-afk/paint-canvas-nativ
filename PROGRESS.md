# PROGRESS.md (현재 진행: 얇게 유지)

## Dashboard (선택, 권장)
- Progress: 0%
- Token/Cost 추정: 낮음
- Risk: 낮음~중간 (대부분 경미한 이슈)

## Today Goal
- 코드 분석을 통해 발견된 버그들 정리 및 추후 수정 계획 수립

## What changed
- 전체 코드베이스 분석 완료 (src/screens, src/utils, src/locales, src/theme)
- 시니어 개발자 검증 완료: 10개 이슈 중 6개 재평가, 2개 삭제, 심각도 조정

## Commands & Results
- 파일 분석 완료: App.js, HomeScreen.js, GenerateScreen.js, PlayScreenNativeModule.js, GalleryScreen.js, SettingsScreen.js, HelpScreen.js
- 유틸리티 분석 완료: puzzleStorage.js, imageProcessor.js, pointsStorage.js, adManager.js, textureStorage.js, weavePreviewGenerator.js
- 컴포넌트 분석 완료: TexturePickerModal.js

## Open issues

### 🟠 중간 (수정 필요하지만 크래시 유발 아님)

**1. adManager.js - 이벤트 리스너 누수 (Memory Leak)**
- 위치: [adManager.js:193-198](src/utils/adManager.js#L193-L198)
- 문제: `closeListener()`가 실제로 리스너를 제거함 (react-native-google-mobile-ads의 `addAdEventListener`는 구독 해제 함수를 반환)
- ✅ **재검증 결과**: 코드가 올바름! `closeListener()`는 구독 해제 함수를 호출하는 것
- 🔧 **그러나**: 광고 ID가 `null`일 때는 전체 초기화가 스킵되므로 실제로 테스트 불가
- **심각도 조정**: 🔴→🟠 (실제 사용 시에만 확인 가능)

**2. GalleryScreen.js - 불필요한 리렌더링**
- 위치: [App.js:53](App.js#L53)
- 문제: `key={Date.now()}`로 인해 매번 새 인스턴스 생성
- 영향: 갤러리 진입 시마다 전체 마운트/언마운트 반복
- **심각도**: 🟠 성능 저하 (UX에 영향)
- **수정 방안**: `key` prop 제거하거나 `refreshKey` 상태로 관리

**3. imageProcessor.js - 전역 캐시 메모리 관리**
- 위치: [imageProcessor.js:24-25](src/utils/imageProcessor.js#L24-L25)
- ✅ **재검증 결과**: `HSL_CACHE_MAX_SIZE = 5000` 제한이 이미 있음
- 🔧 **그러나**: 캐시 정리 로직이 보이지 않음 (overflow 시 처리 필요)
- **심각도 조정**: 🟡→🟠 (LRU eviction 로직 추가 권장)

---

### 🟡 경고 (개선 권장, 낮은 우선순위)

**4. GenerateScreen.js - 재귀 호출 시 잠재적 이슈**
- 위치: [GenerateScreen.js:101-163](src/screens/GenerateScreen.js#L101-L163)
- ✅ **재검증 결과**: `pickImage` 함수 내 `setTimeout`은 최대 2회 재시도만 함 (`retryCount < 2`)
- 영향: 언마운트 후 `setLoading(false)`가 호출될 수 있으나, React는 경고만 표시 (크래시 아님)
- **심각도 조정**: 🟠→🟡 (경고 방지용 `isMounted` 추가 권장)

**~~5. PlayScreenNativeModule.js - 타이머 정리 누락~~** ❌ 삭제
- ✅ **재검증 결과**: 코드 확인 결과 cleanup이 잘 되어 있음
  - `pointsFlushTimerRef`: [line 452-456](src/screens/PlayScreenNativeModule.js#L452-L456) cleanup 존재
  - `completedColorsTimerRef`: [line 974-978](src/screens/PlayScreenNativeModule.js#L974-L978) cleanup 존재
  - `saveProgressRef`: `handleBackPress`에서 수동 정리, 언마운트 시 정리 로직 필요할 수 있음
- **상태**: ❌ 이슈 아님 (대부분 cleanup 존재)

**~~6. PlayScreenNativeModule.js - Race Condition in undoMode~~** ❌ 삭제
- ✅ **재검증 결과**: `handleCellPainted`가 `useCallback`으로 래핑되어 있고, `undoMode`가 의존성 배열에 있음 ([line 838](src/screens/PlayScreenNativeModule.js#L838))
- 이는 React의 표준 패턴이며, `undoMode` 변경 시 콜백이 새로 생성됨
- **상태**: ❌ 이슈 아님 (React 표준 패턴 사용 중)

**5. HomeScreen.js - 병렬 비동기 작업** (번호 재조정)
- 위치: [HomeScreen.js:45-46](src/screens/HomeScreen.js#L45-L46)
- 문제: `runMigration()`과 `createDefaults()`가 `useEffect` 내에서 병렬 실행
- ✅ **재검증 결과**: 두 함수가 서로 다른 AsyncStorage 키를 사용한다면 문제 없음
- 🔧 **그러나**: 동일 키 접근 시 race condition 가능
- **심각도**: 🟡 (실제 충돌 케이스 확인 필요)

**6. TexturePickerModal.js - 언마운트 후 setState**
- 위치: [TexturePickerModal.js:32-35](src/components/TexturePickerModal.js#L32-L35)
- ✅ **재검증 결과**: `loadCurrentTexture`가 async이고, 모달이 닫히면 `visible=false`가 되어 다음 렌더링에서 언마운트
- 영향: React 경고 메시지 (크래시 아님)
- **심각도**: 🟡 (경고 방지용 `isMounted` 패턴 권장)

**7. PlayScreenNativeModule.js - 미니맵 타이머**
- 위치: [PlayScreenNativeModule.js:663-684](src/screens/PlayScreenNativeModule.js#L663-L684)
- ✅ **재검증 결과**: `updateMinimapImage` 내부에서 `if (!showMinimap) return;` 체크가 있음 ([line 664](src/screens/PlayScreenNativeModule.js#L664))
- 🔧 **그러나**: `setTimeout` 콜백 실행 시점에는 이미 `showMinimap`이 변경되어 있을 수 있음 (closure 문제)
- **심각도**: 🟡 (불필요한 연산, 크래시 아님)

**8. locales/index.js - 리스너 관리**
- 위치: [locales/index.js:131-136](src/locales/index.js#L131-L136)
- ✅ **재검증 결과**: cleanup 함수가 반환됨 (호출자 책임)
- 또한 `removeAllListeners()` 함수가 [line 141-143](src/locales/index.js#L141-L143)에 존재
- **심각도**: 🟡 (호출자가 cleanup을 제대로 하면 문제 없음)

---

## Summary (시니어 검증 결과)

| 원래 분류 | 이슈 수 | 검증 후 |
|----------|--------|--------|
| 🔴 심각 | 1개 | 0개 (🟠로 하향) |
| 🟠 중간 | 2개 | 3개 |
| 🟡 경고 | 7개 | 5개 (2개 삭제) |
| ❌ 삭제 | - | 2개 (오진단) |

**결론**:
- 앱 크래시를 유발하는 심각한 버그는 없음
- 대부분 성능 최적화 또는 React 경고 방지 수준
- 가장 우선 수정 권장: `App.js`의 `key={Date.now()}` (체감 성능에 영향)

---

## Next (우선순위 재조정)
1. 🟠 **App.js**: `key={Date.now()}` 제거 → 갤러리 성능 개선
2. 🟠 **imageProcessor.js**: HSL 캐시 overflow 처리 로직 추가
3. 🟡 **GenerateScreen.js**: `isMounted` ref 추가로 React 경고 방지
4. 🟡 **TexturePickerModal.js**: `isMounted` 패턴 적용

---
## Archive Rule (요약)
- 완료 항목이 20개를 넘거나 파일이 5KB를 넘으면,
  완료된 내용을 `ARCHIVE_YYYY_MM.md`로 옮기고 PROGRESS는 "현재 이슈"만 남긴다.
