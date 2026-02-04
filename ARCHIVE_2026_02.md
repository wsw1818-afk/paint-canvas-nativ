# ARCHIVE_2026_02.md

## 2026-02-02 작업 내역

### 완료된 수정 (10개)

| 파일 | 수정 내용 |
|------|----------|
| App.js | `key={Date.now()}` → `galleryRefreshKey` 상태로 변경 (갤러리 성능 개선) |
| GenerateScreen.js | `pickImage` 함수 내 `setTimeout` 콜백에 `isMounted` 체크 추가 |
| TexturePickerModal.js | `isMounted` ref 추가, async 함수에서 setState 전 체크 |
| HomeScreen.js | `runMigration`/`createDefaults` 순차 실행으로 변경 (race condition 방지) |
| adManager.js | 🔧 리스너 구독 해제 함수 저장 + `cleanupAdListeners()` 함수 추가 (메모리 누수 수정) |
| PlayScreenNativeModule.js | 🔧 useEffect cleanup에 `saveProgressRef` 타이머 정리 추가 |
| GalleryScreen.js | 🐛 썸네일 우선순위에 `completedImageUri` 1순위 추가 (100% 완성 퍼즐 흐릿함 버그 수정) |
| GalleryScreen.js | 🐛 완성 이미지 재생성 기능 추가 (📷 버튼 + `handleRecaptureCompletion`) - 이후 제거됨 |
| PlayScreenNativeModule.js | 🐛 100% 완료 퍼즐 자동 캡처 로직 추가 (`handleCanvasReady`에 완성 이미지 체크) |
| PlayScreenNativeModule.js | 🐛 기존 `completedImageUri` 존재 시 중복 캡처 방지 (`getPuzzleById`로 확인) |

### 검증 완료 - 이슈 아님 (2개)

| 파일 | 검증 결과 |
|------|----------|
| imageProcessor.js | 캐시 eviction 로직 존재, 5000개 초과 시 절반 삭제 |
| locales/index.js | 모든 Screen에서 cleanup 정상 |

### 🟡 보류: 미니맵 타이머 closure
- **위치**: PlayScreenNativeModule.js
- **문제**: `showMinimap` false 변경 시에도 대기 중인 타이머가 실행될 수 있음
- **판단**: 불필요한 연산만 발생, 복잡도 대비 이득 적음
