# PROGRESS.md

## Dashboard
- Progress: 🔴 긴급
- Risk: 높음
- Last Update: 2026-02-04

---

## 🚨 현재 이슈: 100% 완성 퍼즐 썸네일에 격자선 표시

### 증상
- 갤러리에서 100% 완료된 WEAVE 모드 퍼즐 썸네일에 **격자선(흰색 선)**이 보임
- 여러 번 수정 시도했으나 **모두 실패**

### 원인 분석
- `captureCanvas()` 함수에서 셀을 float 좌표로 렌더링할 때 **반올림 오차**로 셀 사이에 1px 갭 발생
- 수정 코드가 적용되지 않는 것처럼 보임 → **디버깅 필요**

### 시도한 수정 (모두 실패)

| 시도 | 방법 | 결과 |
|-----|------|------|
| v1 | `drawCapturedCell`에 0.5f 오버랩 추가 | ❌ 격자선 여전히 보임 |
| v2 | WEAVE 100% 완료 시 BitmapShader로 Path 타일링 | ❌ 격자선 여전히 보임 |
| v3 | gridSize 배수 크기 + 정수 좌표(Rect) 렌더링 | ❌ 격자선 여전히 보임 |
| v4 | 원본 코드 복원 후 다시 적용 | ❌ 격자선 여전히 보임 |

### 의심되는 문제점
1. **`completionMode`가 "WEAVE"로 설정되지 않음** → ORIGINAL 분기로 진입?
2. **캡처 자체가 실행되지 않음** → 기존 이미지 파일 사용?
3. **Gradle 캐시 문제** → Kotlin 코드 변경이 반영 안 됨?

### 디버깅 로그 추가됨 (현재 APK)
```
📸📸📸 captureCanvas 호출됨! painted=X, total=Y, complete=true/false, mode='WEAVE/ORIGINAL'
🟢 WEAVE 100% 분기 진입!
🎨 setCompletionMode: 'WEAVE' (현재: 'ORIGINAL')
```

### 다음 단계
1. **adb logcat으로 로그 확인** - `completionMode`가 "WEAVE"인지 확인
2. 로그 결과에 따라:
   - mode가 ORIGINAL이면 → JS에서 Native로 전달 과정 확인
   - mode가 WEAVE인데 격자선이면 → 렌더링 로직 재검토
   - 로그 자체가 안 나오면 → captureCanvas 호출 자체가 안 됨

---

## 관련 파일

| 파일 | 역할 |
|-----|------|
| [PaintCanvasView.kt](modules/paint-canvas/android/src/main/java/com/paintcanvas/PaintCanvasView.kt) | Native 캔버스 렌더링 + `captureCanvas()` |
| [PlayScreenNativeModule.js](src/screens/PlayScreenNativeModule.js) | Play 화면 + 100% 완료 시 자동 캡처 |
| [GalleryScreen.js](src/screens/GalleryScreen.js) | 갤러리 화면 + 썸네일 표시 |

---

## 아카이브
- [ARCHIVE_2026_02.md](ARCHIVE_2026_02.md) - 2026-02-02~03 작업 내역

---

## Archive Rule
완료 항목 20개 초과 또는 5KB 초과 시 `ARCHIVE_YYYY_MM.md`로 이동
