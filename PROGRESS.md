# PROGRESS.md (현재 진행: 얇게 유지)

## Dashboard (선택, 권장)
- Progress: 0%
- Token/Cost 추정: 낮음
- Risk: 중간 (버그 수정 필요)

## Today Goal
- 코드 분석을 통해 발견된 버그들 정리 및 추후 수정 계획 수립

## What changed
- 전체 코드베이스 분석 완료 (src/screens, src/utils, src/locales, src/theme)
- 10개 버그/잠재적 문제점 발견 및 문서화

## Commands & Results
- 파일 분석 완료: App.js, HomeScreen.js, GenerateScreen.js, PlayScreenNativeModule.js, GalleryScreen.js, SettingsScreen.js, HelpScreen.js
- 유틸리티 분석 완료: puzzleStorage.js, imageProcessor.js, pointsStorage.js, adManager.js, textureStorage.js, weavePreviewGenerator.js
- 컴포넌트 분석 완료: TexturePickerModal.js

## Open issues

### 🔴 심각 (즉시 수정 권장)

**1. adManager.js - 이벤트 리스너 누수 (Memory Leak)**
- 위치: `src/utils/adManager.js:193-198`
- 문제: `closeListener()`가 실제로 리스너를 제거하지 않음 (변수에 저장하지 않고 호출)
- 영향: 광고가 여러 번 표시될수록 리스너가 계속 쌓여 메모리 누수 발생
- 재현: 전면 광고를 여러 번 표시/닫기 반복

---

### 🟠 중간 (수정 필요)

**2. PlayScreenNativeModule.js - Race Condition in undoMode**
- 위치: `src/screens/PlayScreenNativeModule.js:766-838`
- 문제: `handleCellPainted` 콜백이 생성 시점의 `undoMode` 값을 참조할 수 있음
- 영향: 빠른 연속 터치 시 undoMode 상태가 최신 값이 아닐 수 있음
- 재현: undoMode 변경 직후 빠르게 셀 터치

**3. GenerateScreen.js - 재귀 호출 시 상태 꼬임**
- 위치: `src/screens/GenerateScreen.js:101-163`
- 문제: `setTimeout` 내 재귀 호출 시 `isMounted` ref 체크 누락
- 영향: 컴포넌트 언마운트 후 `setLoading`이 unmounted 컴포넌트에서 실행됨
- 재현: 권한 요청 중 화면 빠르게 나가기

---

### 🟡 경고 (개선 권장)

**4. GalleryScreen.js - 불필요한 리렌더링**
- 위치: `App.js:53`
- 문제: `key={Date.now()}`로 인해 매번 새 인스턴스 생성
- 영향: 갤러리 진입 시마다 전체 마운트/언마운트 반복, 성능 저하

**5. PlayScreenNativeModule.js - 타이머 정리 누락**
- 위치: `src/screens/PlayScreenNativeModule.js:570-617`
- 문제: `saveProgressRef`, `pointsFlushTimerRef` 타이머가 컴포넌트 언마운트 시 정리되지 않음
- 영향: 메모리 누수 및 언마운트 후 상태 업데이트 시도

**6. imageProcessor.js - 전역 캐시 메모리 누수**
- 위치: `src/utils/imageProcessor.js:24`
- 문제: 모듈 레벨 전역 `hslCache`가 앱 실행 동안 계속 존재
- 영향: 여러 이미지 처리 시 메모리 사용량 증가

**7. HomeScreen.js - 병렬 비동기 작업**
- 위치: `src/screens/HomeScreen.js:45-46`
- 문제: `runMigration()`과 `createDefaults()`가 병렬 실행됨
- 영향: AsyncStorage 동시 접근 시 충돌 가능성

**8. TexturePickerModal.js - 언마운트 후 setState**
- 위치: `src/components/TexturePickerModal.js:32-35`
- 문제: 모달 닫힌 후 `AsyncStorage` 작업 완료 시 `setSelectedId` 호출 가능
- 영향: React 경고 메시지 발생

**9. PlayScreenNativeModule.js - 미니맵 타이머**
- 위치: `src/screens/PlayScreenNativeModule.js:663-684`
- 문제: `showMinimap`이 false로 변경되어도 대기 중인 타이머가 실행될 수 있음
- 영향: 불필요한 연산 및 메모리 사용

**10. locales/index.js - 리스너 누수**
- 위치: `src/locales/index.js:131-136`
- 문제: cleanup 함수가 호출되지 않으면 리스너가 계속 쌓임
- 영향: 메모리 누수 (장기적)

---

## Next
1. 🔴 심각 버그: adManager.js 이벤트 리스너 누수 수정
2. 🟠 중간 버그: PlayScreenNativeModule.js 타이머 정리 및 Race Condition 수정
3. 🟠 중간 버그: GenerateScreen.js 재귀 호출 안전성 개선
4. 🟡 경고: GalleryScreen.js 불필요한 key prop 제거

---
## Archive Rule (요약)
- 완료 항목이 20개를 넘거나 파일이 5KB를 넘으면,
  완료된 내용을 `ARCHIVE_YYYY_MM.md`로 옮기고 PROGRESS는 "현재 이슈"만 남긴다.
