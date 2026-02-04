# PROGRESS.md

## Dashboard
- Progress: 🟡 테스트 중
- Risk: 중간
- Last Update: 2026-02-04

---

## 🚨 현재 이슈: 100% 완성 퍼즐 썸네일에 격자선 표시

### 증상
- 갤러리에서 100% 완료된 WEAVE 모드 퍼즐 썸네일에 **격자선(흰색 선)**이 보임
- 여러 번 수정 시도 후 **v6에서 근본 원인 발견 및 수정**

### 원인 분석
1. `reusableBitmapPaint`에 `ANTI_ALIAS_FLAG`와 `isFilterBitmap=true`가 설정됨
2. 안티앨리어싱으로 인해 셀 경계가 부드럽게 블렌딩 → **1px 흰색 선 발생**
3. GalleryScreen에서 WEAVE 100% 퍼즐의 이미지를 **무조건 삭제하는 무한 루프** 존재

### 시도한 수정

| 시도 | 방법 | 결과 |
|-----|------|------|
| v1 | `drawCapturedCell`에 0.5f 오버랩 추가 | ❌ 격자선 여전히 보임 |
| v2 | WEAVE 100% 완료 시 BitmapShader로 Path 타일링 | ❌ 격자선 여전히 보임 |
| v3 | gridSize 배수 크기 + 정수 좌표(Rect) 렌더링 | ❌ 격자선 여전히 보임 |
| v4 | 원본 코드 복원 후 다시 적용 | ❌ 격자선 여전히 보임 |
| v5 | GalleryScreen에서 WEAVE 이미지 강제 삭제 | ❌ 무한 삭제 루프 발생 |
| **v6** | **`captureBitmapPaint` 추가 (안티앨리어싱 비활성화)** | 🧪 테스트 중 |

### v6 수정 내용 (2026-02-04)

**1. PaintCanvasView.kt - 캡처 전용 Paint 객체 추가**
```kotlin
// 🐛 캡처 전용 Paint (안티앨리어싱/필터 비활성화 → 격자선 방지)
private val captureBitmapPaint = Paint().apply {
    isFilterBitmap = false
    isAntiAlias = false
    isDither = false
}
```

**2. WEAVE 100% 캡처에서 `captureBitmapPaint` 사용**
```kotlin
captureCanvas.drawBitmap(texturedBitmap, srcRect, dstRect, captureBitmapPaint)
```

**3. GalleryScreen.js - 무조건 삭제 로직 제거**
- WEAVE 100% 퍼즐의 `completedImageUri`를 무조건 삭제하는 코드 제거
- 파일이 실제로 없을 때만 복구 대상으로 추가하도록 변경

### 테스트 방법
1. 새 APK 설치 (`D:\OneDrive\코드작업\결과물\ColorPlay\ColorPlayExpo-debug.apk`)
2. 앱 실행 → 갤러리 화면 로드
3. WEAVE 100% 퍼즐 클릭 → PlayScreen 진입 → 자동 캡처
4. 로그에서 `🟢 WEAVE 100% 분기 진입!` 확인
5. 갤러리 복귀 → **격자선 없는 썸네일** 확인

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
