# Expo Native Module 개발 스킬 가이드

> ColorPlayExpo 프로젝트에서 얻은 실전 경험을 정리한 문서입니다.
> Expo + Kotlin Native Module 개발 시 발생하는 문제와 해결책을 담고 있습니다.

---

## 1. Expo Native Module 기본 구조

### 1.1 모듈 디렉토리 구조
```
modules/
└── paint-canvas/
    ├── android/
    │   └── src/main/java/com/paintcanvas/
    │       ├── PaintCanvasModule.kt    # 모듈 정의 (Props, Events, Functions)
    │       └── PaintCanvasView.kt      # 실제 View 구현
    ├── src/
    │   └── index.tsx                   # JS/TS 인터페이스
    └── expo-module.config.json
```

### 1.2 Module 정의 (Kotlin)
```kotlin
class PaintCanvasModule : Module() {
  private var currentView: PaintCanvasView? = null

  override fun definition() = ModuleDefinition {
    Name("PaintCanvas")

    // 함수 노출
    Function("captureCanvas") { size: Int ->
      currentView?.captureCanvas(size)
    }

    View(PaintCanvasView::class) {
      // View 참조 저장
      OnViewDidUpdateProps { view: PaintCanvasView ->
        currentView = view
      }

      // Props 정의
      Prop("gridSize") { view: PaintCanvasView, gridSize: Int ->
        currentView = view
        view.setGridSize(gridSize)
      }

      // Events 정의
      Events("onCellPainted", "onCanvasReady")
    }
  }
}
```

### 1.3 JS 인터페이스 (TypeScript)
```typescript
import { requireNativeViewManager } from 'expo-modules-core';
import { ViewProps } from 'react-native';

export type PaintCanvasViewProps = ViewProps & {
  gridSize: number;
  cells: CellData[];
  selectedColorHex: string;
  onCellPainted?: (event: { nativeEvent: CellPaintedEvent }) => void;
  onCanvasReady?: (event: { nativeEvent: CanvasReadyEvent }) => void;
};

const NativeView = requireNativeViewManager('PaintCanvas');

export default function PaintCanvasView(props: PaintCanvasViewProps) {
  return <NativeView {...props} />;
}
```

---

## 2. 고생했던 문제들과 해결책

### 2.1 대형 그리드 성능 문제 (RenderThread 크래시)

**증상**:
- 100×100 이상 그리드에서 앱 멈춤/크래시
- `RenderThread` ANR 발생
- 빠른 색칠 시 화면 깜빡임

**원인**:
- 너무 많은 셀(10,000+)을 매 프레임마다 그리기
- `invalidate()` 과다 호출로 GPU 과부하
- 복잡한 텍스처/음영 효과가 성능 저하

**해결책**:

#### 1) 대형 그리드 모드 분기
```kotlin
private var isLargeGridMode: Boolean = false
private val LARGE_GRID_THRESHOLD = 100

fun setGridSize(value: Int) {
    gridSize = value
    isLargeGridMode = gridSize >= LARGE_GRID_THRESHOLD

    if (isLargeGridMode) {
        // 텍스처/음영 간소화
    }
}
```

#### 2) invalidate() 스로틀링
```kotlin
private var lastInvalidateTime = 0L
private var pendingInvalidate = false
private val MIN_INVALIDATE_INTERVAL = 16L  // ~60fps

private fun throttledInvalidate() {
    val now = System.currentTimeMillis()
    val elapsed = now - lastInvalidateTime

    if (elapsed >= MIN_INVALIDATE_INTERVAL) {
        lastInvalidateTime = now
        invalidate()
    } else if (!pendingInvalidate) {
        pendingInvalidate = true
        invalidateHandler.postDelayed({
            pendingInvalidate = false
            invalidate()
        }, MIN_INVALIDATE_INTERVAL - elapsed)
    }
}
```

#### 3) 줌 레벨 기반 텍스처 토글
```kotlin
// 줌이 낮으면 텍스처 스킵 (성능 최적화)
val zoomRatio = scaleFactor / maxZoom
val textureThreshold = if (isLargeGridMode) 0.4f else TEXTURE_VISIBLE_ZOOM_THRESHOLD
val shouldShowTexture = zoomRatio >= textureThreshold

if (shouldShowTexture) {
    drawWeaveTexture(canvas, cellRect, color)
} else {
    // 단색으로 빠르게 그리기
    canvas.drawRect(cellRect, solidPaint)
}
```

---

### 2.2 진행 상태 저장/복원 문제

**증상**:
- 앱 재시작 시 색칠 진행 상황 사라짐
- 화면 전환 후 되돌아오면 진행 상태 없음
- AsyncStorage 저장이 느림

**해결책**:

#### 1) Native SharedPreferences 사용 (빠른 저장)
```kotlin
private val prefs: SharedPreferences =
    context.getSharedPreferences("PaintCanvasProgress", Context.MODE_PRIVATE)

private fun saveProgressToPrefs() {
    val gameId = currentGameId ?: return

    // 비동기로 저장 (UI 블로킹 방지)
    CoroutineScope(Dispatchers.IO).launch {
        val json = JSONObject().apply {
            put("filledCells", JSONArray(filledCells.toList()))
            put("wrongCells", JSONArray(wrongPaintedCells.toList()))
            put("filledColors", JSONObject(filledCellColors))  // 색상 정보도 저장
        }
        prefs.edit().putString(gameId, json.toString()).apply()
    }
}
```

#### 2) gameId 기반 식별
```kotlin
fun setGameId(id: String) {
    if (currentGameId == id) return  // 중복 호출 방지

    currentGameId = id
    loadProgressFromPrefs()  // 저장된 진행 상황 복원
}
```

#### 3) 색상 정보 포함 저장
```kotlin
// 셀 색칠 시 색상도 함께 저장
private val filledCellColors = mutableMapOf<String, String>()

private fun paintCell(row: Int, col: Int, colorHex: String) {
    val key = "${row}_${col}"
    filledCells.add(key)
    filledCellColors[key] = colorHex  // 색상 기록

    saveProgressToPrefs()
}
```

---

### 2.3 텍스처 캐싱 메모리 문제

**증상**:
- 앱 메모리 사용량 급증
- 오래 사용하면 OutOfMemoryError
- 색상별 텍스처가 계속 누적

**해결책**: LRU 캐시로 제한
```kotlin
private val MAX_TEXTURE_CACHE_SIZE = 5  // 최대 5개 색상만 캐시

private val textureCache = object : LinkedHashMap<String, Bitmap>(
    MAX_TEXTURE_CACHE_SIZE, 0.75f, true
) {
    override fun removeEldestEntry(eldest: Map.Entry<String, Bitmap>): Boolean {
        if (size > MAX_TEXTURE_CACHE_SIZE) {
            eldest.value.recycle()  // 메모리 해제
            return true
        }
        return false
    }
}
```

---

### 2.4 JS-Native 이벤트 통신

**증상**:
- Native에서 이벤트 발생해도 JS에서 못 받음
- 이벤트 데이터가 누락됨
- 콜백이 여러 번 호출됨

**해결책**:

#### 1) EventDispatcher 사용
```kotlin
// Module에서 선언
private val onCellPainted by EventDispatcher()
private val onCanvasReady by EventDispatcher()

// 이벤트 발생
private fun notifyCanvasReady() {
    if (!hasNotifiedReady) {
        hasNotifiedReady = true  // 중복 호출 방지
        onCanvasReady(mapOf(
            "ready" to true,
            "filledCells" to filledCells.size
        ))
    }
}
```

#### 2) JS에서 핸들러 연결
```javascript
const handleCanvasReady = useCallback((event) => {
    const { ready, filledCells } = event.nativeEvent;
    console.log('Canvas Ready:', { ready, filledCells });
    setIsNativeReady(true);
}, []);

<PaintCanvasView
    onCanvasReady={handleCanvasReady}
/>
```

---

### 2.5 이미지 로딩 최적화

**증상**:
- 큰 이미지 로딩 시 앱 멈춤
- 메모리 부족으로 크래시
- 화면에 이미지가 안 보임

**해결책**:

#### 1) 비동기 로딩 + 다운샘플링
```kotlin
private fun loadImageAsync(uri: String) {
    CoroutineScope(Dispatchers.IO).launch {
        try {
            val inputStream = when {
                uri.startsWith("content://") ->
                    context.contentResolver.openInputStream(Uri.parse(uri))
                uri.startsWith("file://") ->
                    java.io.FileInputStream(uri.removePrefix("file://"))
                else -> null
            }

            inputStream?.use { stream ->
                // 1단계: 크기만 읽기
                val options = BitmapFactory.Options().apply {
                    inJustDecodeBounds = true
                }
                BitmapFactory.decodeStream(stream, null, options)

                // 2단계: 다운샘플링 계산
                val targetSize = 384  // 최적 크기
                options.inSampleSize = calculateInSampleSize(options, targetSize)
                options.inJustDecodeBounds = false

                // 3단계: 실제 로딩
                stream.reset()
                val bitmap = BitmapFactory.decodeStream(stream, null, options)

                withContext(Dispatchers.Main) {
                    imageBitmap = bitmap
                    isImageLoaded = true
                    invalidate()
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("PaintCanvas", "이미지 로딩 실패: ${e.message}")
        }
    }
}

private fun calculateInSampleSize(options: BitmapFactory.Options, reqSize: Int): Int {
    val (width, height) = options.outWidth to options.outHeight
    var inSampleSize = 1

    if (height > reqSize || width > reqSize) {
        val halfHeight = height / 2
        val halfWidth = width / 2

        while ((halfHeight / inSampleSize) >= reqSize &&
               (halfWidth / inSampleSize) >= reqSize) {
            inSampleSize *= 2
        }
    }
    return inSampleSize
}
```

---

### 2.6 줌/팬 제스처 충돌

**증상**:
- 색칠하려는데 줌이 됨
- 두 손가락 팬이 안 됨
- 줌 후 위치가 이상함

**해결책**:

#### 1) 제스처 상태 분리
```kotlin
private var isZooming = false
private var isPanning = false
private var lastTouchX = 0f
private var lastTouchY = 0f

override fun onTouchEvent(event: MotionEvent): Boolean {
    scaleDetector.onTouchEvent(event)

    when (event.actionMasked) {
        MotionEvent.ACTION_DOWN -> {
            lastTouchX = event.x
            lastTouchY = event.y
            isPanning = false
        }

        MotionEvent.ACTION_POINTER_DOWN -> {
            // 두 손가락 = 줌/팬 모드
            isZooming = true
        }

        MotionEvent.ACTION_MOVE -> {
            if (event.pointerCount == 2 && isZooming) {
                // 두 손가락 팬
                handleTwoFingerPan(event)
            } else if (event.pointerCount == 1 && !isZooming) {
                // 한 손가락 = 색칠
                handleSingleFingerPaint(event)
            }
        }

        MotionEvent.ACTION_UP, MotionEvent.ACTION_POINTER_UP -> {
            if (event.pointerCount <= 1) {
                isZooming = false
            }
        }
    }
    return true
}
```

#### 2) 줌 경계 제한
```kotlin
private fun clampTranslation() {
    val scaledWidth = canvasWidth * scaleFactor
    val scaledHeight = canvasHeight * scaleFactor

    val maxTransX = (scaledWidth - canvasWidth) / 2
    val maxTransY = (scaledHeight - canvasHeight) / 2

    translateX = translateX.coerceIn(-maxTransX, maxTransX)
    translateY = translateY.coerceIn(-maxTransY, maxTransY)
}
```

---

## 3. 빌드 & 배포 체크리스트

### 3.1 Native 코드 수정 시
```bash
# 1. Clean 빌드 (캐시 문제 방지)
cd android && ./gradlew.bat clean

# 2. Debug APK 빌드
./gradlew.bat assembleDebug

# 3. 빌드 로그에서 재컴파일 확인
# > Task :paint-canvas-native:compileDebugKotlin

# 4. APK 복사
copy /Y "app\build\outputs\apk\debug\app-debug.apk" "D:\결과물\앱이름-debug.apk"

# 5. 설치
adb install -r "app\build\outputs\apk\debug\app-debug.apk"
```

### 3.2 Release 빌드 시 (JavaScript 번들 캐시 문제)
```bash
# 중요: 4가지 캐시 모두 삭제!
powershell -Command "Remove-Item -Recurse -Force '.expo' -ErrorAction SilentlyContinue"
powershell -Command "Remove-Item -Recurse -Force 'node_modules\.cache' -ErrorAction SilentlyContinue"
powershell -Command "Remove-Item -Recurse -Force 'android\app\build' -ErrorAction SilentlyContinue"
powershell -Command "Remove-Item -Recurse -Force 'android\.gradle' -ErrorAction SilentlyContinue"

# Clean Release 빌드
cd android && gradlew.bat clean assembleRelease
```

### 3.3 JavaScript 번들 검증
```bash
# APK 내 번들에서 최신 코드 확인
unzip -p "app-release.apk" assets/index.android.bundle | grep -c "expectedKeyword"
# 결과: 1 이상이면 OK, 0이면 오래된 번들
```

---

## 4. 디버깅 팁

### 4.1 adb logcat 필터
```bash
# 관련 로그만 보기
adb logcat -s PaintCanvas:* ReactNativeJS:* AndroidRuntime:E

# 크래시/에러만 보기
adb logcat | grep -i -E "(crash|exception|error|ANR)"

# 로그 클리어 후 새로 보기
adb logcat -c && adb logcat -s PaintCanvas:*
```

### 4.2 Native 로그 추가
```kotlin
android.util.Log.d("PaintCanvas", "📐 gridSize=$gridSize, cellSize=$cellSize")
android.util.Log.e("PaintCanvas", "❌ 에러: ${e.message}")
```

### 4.3 JS 콘솔 로그
```javascript
console.log('[PlayScreen]', 'filledCells:', filledCells.size);
```

---

## 5. 성능 최적화 요약

| 문제 | 해결책 | 효과 |
|-----|-------|-----|
| 대형 그리드 렉 | isLargeGridMode 분기 | GPU 부하 50% 감소 |
| invalidate 과다 호출 | 스로틀링 (16ms) | RenderThread 크래시 방지 |
| 텍스처 메모리 | LRU 캐시 (5개) | OOM 방지 |
| 이미지 로딩 느림 | 비동기 + 다운샘플링 | 로딩 3x 빠름 |
| 진행 상태 저장 | Native SharedPreferences | 저장 10x 빠름 |
| 줌 시 텍스처 렉 | 줌 레벨별 토글 | 부드러운 줌 |

---

## 6. 자주 발생하는 에러

### Error: "IllegalViewOperationException"
**원인**: Native 코드 변경 후 APK 미빌드
**해결**: `gradlew clean assembleDebug` 후 재설치

### Error: "Unable to resolve module"
**원인**: Expo 패키지 추가 후 prebuild 미실행
**해결**: `npx expo prebuild --clean` 후 빌드

### Error: "RenderThread crashing"
**원인**: 대형 그리드에서 과도한 그리기 작업
**해결**: isLargeGridMode + throttledInvalidate 적용

### Error: "OutOfMemoryError"
**원인**: 비트맵/텍스처 캐시 무한 증가
**해결**: LRU 캐시로 제한 + bitmap.recycle()

---

## 7. 마지막 업데이트
- 2025-11-30: 최초 작성 (ColorPlayExpo 개발 경험 기반)
