# 버그 리포트

> 생성일: 2026-02-05  
> 최근 업데이트: 2026-02-07  
> 프로젝트: ColorPlayExpo

---

## 🔴 심각한 버그 (Critical)

### 1. 포인트 경제 무력화 (강제 초기화 + 과도한 기본값)
**위치**: `App.js` (line 27), `src/utils/pointsStorage.js` (line 9, 17-20)

**문제**: 앱 시작 시 `setPoints(1000000)`로 매번 덮어쓰기 + 기본 포인트가 100만으로 고정.
- 실제 게임 진행/보상 시스템이 무력화됨
- 사용자 포인트가 항상 리셋됨

**개선안**:
- `__DEV__`에서만 강제 설정하거나 초기화 루틴에서만 1회 적용
- `INITIAL_POINTS`를 실제 정책값으로 조정 (예: 0~5000)

---

## 🟡 중간 심각도 버그 (Medium)

### 2. GenerateScreen 라우트 파라미터 미검증으로 크래시
**위치**: `src/screens/GenerateScreen.js` (line 31)

**문제**: `route.params`가 undefined면 구조분해 시 즉시 크래시.  
`sourceType`이 없으면 `sample` 경로로 흐르는데, `selectedImage`가 null인 상태에서 `selectedImage.uri` 접근으로 추가 크래시 가능.

**개선안**:
- `const sourceType = route?.params?.sourceType ?? 'gallery'`로 안전 처리
- `sample` 모드 사용 시 기본 이미지 세팅 또는 경로 제거

---

### 3. 퍼즐 생성 실패 시 포인트 차감 롤백 없음
**위치**: `src/screens/GenerateScreen.js` (line 184 이후)

**문제**: `deductPoints` 성공 후 이미지 처리 중 오류가 나면 포인트가 복구되지 않음.

**개선안**:
- 성공 이후에 포인트 차감하거나
- 실패 시 `setPoints(pointsCheck.currentPoints)` 등으로 롤백

---

### 4. 자동 복구 기능 비활성화
**위치**: `src/screens/GalleryScreen.js` (useFocusEffect 주석 처리)

**문제**: 100% 완료 퍼즐인데 `completedImageUri`가 없는 경우 자동 복구가 동작하지 않음.

**개선안**:
- 크래시 원인 수정 후 `useFocusEffect` 재활성화
- 복구 큐 처리 시 null guard 강화

---

### 5. 마이그레이션 Race Condition
**위치**: `src/utils/puzzleStorage.js` (migratePuzzles)

**문제**: 마이그레이션 중 `AsyncStorage`를 다른 로직이 동시에 갱신하면 데이터 손실 위험.

**개선안**:
- 락(lock) 또는 단일 실행 보장
- 마이그레이션 중에는 다른 쓰기 작업 지연

---

## 🟢 경미한 버그/개선점 (Low)

### 6. 비동기 로딩 후 언마운트 상태 업데이트 위험
**위치**:
- `src/screens/GenerateScreen.js` (loadPoints, handleGenerate catch)
- `src/screens/GalleryScreen.js` (loadSavedPuzzles)
- `src/screens/PlayScreenNativeModule.js` (loadProgress)

**문제**: 컴포넌트 언마운트 후 `setState`가 호출될 수 있음.

**개선안**:
- `cancelled` 플래그나 `AbortController` 도입
- 언마운트 시 상태 업데이트 방지

---

### 7. 광고 카운터 초기화 문제
**위치**: `src/utils/adManager.js` (interactionCounts)

**문제**: 앱 재시작 시 광고 카운터가 0으로 초기화되어 빈도가 불안정.

**개선안**:
- `AsyncStorage`에 카운터 영구 저장

---

### 8. 포인트 부족 처리 시 NaN 가능성
**위치**: `src/screens/GenerateScreen.js` (line 186-191)

**문제**: `deductPoints`가 에러 반환 시 `pointsCheck.currentPoints`가 undefined → `shortfall` 계산이 NaN.

**개선안**:
- 실패 케이스에서 `currentPoints` 유효성 검사
- 에러 메시지 분기 처리

---

### 9. 배너 광고 ID 하드코딩
**위치**: `src/screens/PlayScreenNativeModule.js` (line 19)

**문제**: `adUnitId = null`로 고정되어 배포 전 변경 필요.

**개선안**:
- 환경 변수/빌드 설정으로 분리

---

## ⚠️ 잠재적 위험 (Potential Risks)

### 10. 메모리 관리 - 큰 배열 처리
**위치**: `src/screens/PlayScreenNativeModule.js` (cells 생성)

**문제**: `gridSize * gridSize` 크기의 객체 배열 생성.
- 250x250 = 62,500개 객체

**위험**: 저사양 기기에서 메모리 사용 급증

---

### 11. Race Condition - saveProgress
**위치**: `src/screens/PlayScreenNativeModule.js` (saveProgress 디바운스)

**문제**: 디바운스 타이머 전에 앱이 종료되면 저장 누락 가능.

---

### 12. puzzleId 없는 경우 완성 이미지 미저장
**위치**: `src/screens/PlayScreenNativeModule.js` (captureAndSaveCompletion)

**문제**: `puzzleId`가 없으면 완성 이미지 저장이 스킵됨.

---

### 13. AsyncStorage 키 충돌 가능성
**위치**: `src/screens/PlayScreenNativeModule.js` (gameId 폴백)

**문제**: `imageUri` 파일명 기반 키가 중복될 수 있음.

**개선안**:
- 해시 기반 키 또는 UUID 사용

---

## ✅ 해결됨 (2026-02-07 확인)

1. 포인트 손실 문제 (언마운트 시 pendingPoints 즉시 저장 추가)  
2. Missing Import - Image (GalleryScreen에 Image import 존재)  
3. useCallback 의존성 누락 이슈 (Ref + 함수형 업데이트로 해소)  
4. mergeSimigarColors 오타 수정  
5. scoreMultiplier 0 문제 (최소 10% 보장)  
6. assets 접근 undefined 가드 추가  
7. i18n 폰백 로직 오류 수정  
8. GenerateScreen isMounted 체크 추가  
9. ThumbnailImage 언마운트 업데이트 방지 처리  
10. K-Means++ 빈 배열 처리 추가

---

## 📊 요약

| 심각도 | 개수 | 주요 항목 |
|--------|------|----------|
| 🔴 Critical | 1 | 포인트 강제 초기화 |
| 🟡 Medium | 4 | 라우트 파라미터 크래시, 포인트 롤백, 자동 복구 비활성화, 마이그레이션 Race |
| 🟢 Low | 4 | 언마운트 업데이트, 광고 카운터, NaN 처리, 배너 광고 ID |
| ⚠️ Risk | 4 | 메모리, 저장 레이스, puzzleId 미저장, 키 충돌 |

**총 버그/개선사항: 13개**

---

## 우선순위 수정 권장

1. **즉시 수정**: 포인트 강제 초기화 제거  
2. **빠른 수정**: GenerateScreen 라우트 파라미터/샘플 경로 안정화  
3. **권장**: 포인트 차감 롤백 + 자동 복구 재활성화  
