# ColorPlayExpo 트러블슈팅 가이드

이 문서는 개발 과정에서 겪은 문제들과 해결 방법을 기록합니다.

---

## 1. Native 코드 변경이 반영되지 않는 문제

### 증상
- Kotlin/Java 코드를 수정했는데 앱에서 변경사항이 적용되지 않음
- 이전 동작이 그대로 유지됨

### 원인
- Gradle 캐시로 인해 변경된 파일이 재컴파일되지 않음
- 특히 `paint-canvas-native` 모듈 같은 로컬 모듈에서 자주 발생

### 해결 방법
```bash
# clean 빌드 수행
cd android && ./gradlew.bat clean assembleDebug

# 빌드 로그에서 재컴파일 확인
> Task :paint-canvas-native:compileDebugKotlin
> Task :paint-canvas-native:compileDebugJavaWithJavac
```

### 확인 방법
- 빌드 로그에서 해당 모듈의 `compileDebugKotlin` 태스크가 `UP-TO-DATE`가 아닌지 확인
- `UP-TO-DATE`로 표시되면 코드가 재컴파일되지 않은 것

---

## 2. 리소스 파일(이미지)이 로드되지 않는 문제

### 증상
- drawable에 이미지를 추가했는데 `BitmapFactory.decodeResource()`가 null 반환
- 로그에서 "loaded: null" 또는 크기가 0으로 표시

### 원인
1. 이미지 파일이 `drawable` 폴더가 아닌 다른 위치에 있음
2. 파일명에 대문자나 특수문자가 포함됨 (Android는 소문자+언더스코어만 허용)
3. clean 빌드를 하지 않아 리소스가 패키징되지 않음

### 해결 방법
```bash
# 올바른 위치 확인
modules/paint-canvas/android/src/main/res/drawable/이미지파일.png

# 파일명 규칙: 소문자 + 언더스코어만 사용
weave_pattern2.png  # OK
WeavePattern2.png   # NG

# clean 빌드
cd android && ./gradlew.bat clean assembleDebug
```

### 코드에서 리소스 로드
```kotlin
val resourceId = context.resources.getIdentifier(
    "weave_pattern2",  // 확장자 제외
    "drawable",
    context.packageName
)
val bitmap = BitmapFactory.decodeResource(context.resources, resourceId)
```

---

## 3. 색칠된 셀 색상이 잘못 표시되는 문제

### 증상
- 색칠한 색상과 화면에 표시되는 색상이 다름
- 팔레트에서 알파벳을 변경해도 이미 칠한 셀의 색상이 안 바뀜

### 원인
- `paintedColorMap` (사용자가 실제로 칠한 색상)을 사용하면 팔레트 변경 시 색상이 안 바뀜
- 의도: 팔레트에서 알파벳 선택 시, 해당 알파벳의 모든 셀이 선택된 색상으로 보여야 함

### 해결 방법
```kotlin
// ❌ 잘못된 방법: 사용자가 칠한 색상 사용
val colorHex = paintedColorMap[cellKey] ?: "#CCCCCC"

// ✅ 올바른 방법: 해당 셀의 정답 색상(알파벳에 매핑된 색상) 사용
val colorHex = targetColorMap[cellKey] ?: "#CCCCCC"
```

### 핵심 개념
- `targetColorMap`: 각 셀의 알파벳에 해당하는 정답 색상 (팔레트에서 선택한 색상)
- `paintedColorMap`: 사용자가 실제로 칠한 색상 기록 (히스토리용)
- 화면 표시에는 `targetColorMap`을 사용해야 팔레트 변경 시 색상이 연동됨

---

## 4. 잘못 칠한 셀(X 표시)의 배경색 문제

### 증상
- 틀린 셀의 배경이 항상 녹색(또는 특정 색)으로 표시됨
- 의도: 해당 셀의 정답 색상 배경에 경고 표시가 나와야 함

### 원인
- 경고 이미지(warning_mark.png)에 녹색 배경이 포함되어 있었음
- 또는 잘못된 색상 맵을 참조

### 해결 방법
```kotlin
// 잘못 칠한 셀도 targetColorMap 사용
val correctColorHex = targetColorMap[cellKey] ?: "#CCCCCC"
val baseColor = Color.parseColor(correctColorHex)

// 배경에 정답 색상 적용
drawFilledCellWithTexture(canvas, left, top, cellSize, baseColor)

// 경고 표시는 코드로 직접 그리기 (이미지 배경색 문제 회피)
drawWarningTriangle(canvas, left, top, cellSize)
```

### 경고 삼각형 코드로 그리기
```kotlin
private fun drawWarningTriangle(canvas: Canvas, left: Float, top: Float, size: Float) {
    val padding = size * 0.15f
    val centerX = left + size / 2f

    // Path로 삼각형 그리기
    reusableTrianglePath.reset()
    reusableTrianglePath.moveTo(centerX, top + padding)  // 상단 꼭지점
    reusableTrianglePath.lineTo(left + size - padding, top + size - padding)  // 우하단
    reusableTrianglePath.lineTo(left + padding, top + size - padding)  // 좌하단
    reusableTrianglePath.close()

    canvas.drawPath(reusableTrianglePath, warningTriangleFillPaint)  // 노란색 채우기
    canvas.drawPath(reusableTrianglePath, warningTriangleStrokePaint)  // 검은색 테두리
}
```

---

## 5. 화면 깜빡임 문제

### 증상
- 색칠하거나 X를 지울 때 화면이 한번 깜빡임
- 틀린 셀을 고칠 때 X 표시가 잠깐 나타났다 사라짐

### 원인
1. `setFilledCells()` / `setWrongCells()`에서 `clear()` 후 `invalidate()` 호출
   - 일시적으로 빈 상태가 렌더링됨
2. JS와 Native 간 상태 동기화 타이밍 불일치
3. 불필요한 `invalidate()` 호출

### 해결 방법

#### 5-1. 변경 없으면 스킵
```kotlin
fun setFilledCells(cells: List<String>) {
    val newSet = cells.toSet()
    if (filledCells == newSet) return  // ⚡ 변경 없으면 스킵

    filledCells.clear()
    filledCells.addAll(newSet)
    invalidate()
}

fun setWrongCells(cells: List<String>) {
    val newWrongCells = mutableSetOf<String>()
    for (cell in cells) {
        if (!recentlyRemovedWrongCells.contains(cell)) {
            newWrongCells.add(cell)
        }
    }

    if (wrongPaintedCells == newWrongCells) {  // ⚡ 변경 없으면 스킵
        recentlyRemovedWrongCells.clear()
        return
    }

    wrongPaintedCells.clear()
    wrongPaintedCells.addAll(newWrongCells)
    recentlyRemovedWrongCells.clear()
    invalidate()
}
```

#### 5-2. 최근 제거된 셀 보호
```kotlin
// X를 지울 때 JS 동기화 전까지 다시 추가되지 않도록 보호
private val recentlyRemovedWrongCells = mutableSetOf<String>()

// 지우기 시
wrongPaintedCells.remove(cellKey)
recentlyRemovedWrongCells.add(cellKey)  // 보호 목록에 추가
invalidate()
sendCellPaintedEvent(row, col, true)

// setWrongCells에서 보호된 셀 필터링
for (cell in cells) {
    if (!recentlyRemovedWrongCells.contains(cell)) {
        newWrongCells.add(cell)
    }
}
```

---

## 6. 색칠/지우기 딜레이 문제

### 증상
- 터치 후 색칠이 늦게 반영됨
- 반응이 느린 느낌

### 원인
1. 터치 이벤트마다 로그 출력 (매 프레임 로그 = 성능 저하)
2. `post { }` 사용으로 JS 이벤트 전송 지연
3. `MULTI_TOUCH_GRACE_PERIOD`가 너무 김 (50ms)

### 해결 방법

#### 6-1. 터치 로그 제거
```kotlin
override fun onTouchEvent(event: MotionEvent): Boolean {
    // ❌ 제거: 매 프레임마다 로그 출력하면 딜레이 발생
    // android.util.Log.d("PaintCanvas", "🖐️ onTouchEvent: ...")

    // ✅ 성능 최적화: 터치 로그 제거
    ...
}
```

#### 6-2. Grace Period 단축
```kotlin
// ❌ 50ms는 너무 김
private val MULTI_TOUCH_GRACE_PERIOD = 50L

// ✅ 20ms로 단축
private val MULTI_TOUCH_GRACE_PERIOD = 20L
```

#### 6-3. post 제거, 즉시 이벤트 전송
```kotlin
// ❌ post 사용하면 다음 프레임까지 지연
post { sendCellPaintedEvent(row, col, true) }

// ✅ 즉시 전송
sendCellPaintedEvent(row, col, true)
```

---

## 7. 로그 확인 시 주의사항

### 증상
- 로그를 확인했는데 이전 세션의 로그가 보임
- 변경사항이 반영됐는지 확신할 수 없음

### 해결 방법
```bash
# 1. logcat 버퍼 클리어
adb logcat -c

# 2. 앱 실행 후 새 로그만 확인
adb logcat -d | grep "PaintCanvas"

# 3. 타임스탬프로 최신 로그인지 확인
# 예: 11-27 23:01:58 ← 현재 시간과 비교
```

### 백그라운드 로그 모니터 정리
```bash
# 여러 백그라운드 셸이 로그를 가져갈 수 있음
# Claude Code에서 KillShell로 정리 후 새로 시작
```

---

## 8. APK 빌드 체크리스트

Native 코드 변경 후 빌드할 때:

- [ ] `clean` 빌드 수행 (캐시로 인한 문제 방지)
- [ ] 빌드 로그에서 모듈 재컴파일 확인 (`compileDebugKotlin`이 `UP-TO-DATE`가 아닌지)
- [ ] `BUILD SUCCESSFUL` 확인
- [ ] APK 결과물 폴더에 복사
- [ ] 디바이스에 설치 (`adb install -r`)
- [ ] logcat 클리어 후 새 로그 확인

```bash
# 전체 명령어
cd android && ./gradlew.bat clean assembleDebug && cd ..
cp android/app/build/outputs/apk/debug/app-debug.apk "D:/OneDrive/코드작업/결과물/ColorPlayExpo-debug.apk"
adb install -r "D:/OneDrive/코드작업/결과물/ColorPlayExpo-debug.apk"
adb logcat -c && adb logcat -d | grep "PaintCanvas"
```

---

## 9. 핵심 파일 위치

```
modules/paint-canvas/
├── android/src/main/java/com/paintcanvas/
│   ├── PaintCanvasView.kt      # 메인 캔버스 뷰 (터치, 렌더링)
│   └── PaintCanvasModule.kt    # Expo 모듈 정의
├── android/src/main/res/drawable/
│   ├── weave_pattern.png       # 빈 셀용 텍스처
│   └── weave_pattern2.png      # 색칠된 셀용 텍스처
└── src/
    └── PaintCanvasView.tsx     # React Native 컴포넌트
```

---

## 10. 자주 사용하는 디버그 로그

```kotlin
// 초기화 확인
android.util.Log.d("PaintCanvas", "🔥 PaintCanvasView initialized")

// 리소스 로드 확인
android.util.Log.d("PaintCanvas", "✅ Pattern loaded: ${bitmap?.width}x${bitmap?.height}")

// 셀 색칠 확인 (성능 문제로 평소엔 비활성화)
// android.util.Log.d("PaintCanvas", "🎨 Cell painted: $cellKey, color=$colorHex")
```

---

## 11. 텍스처 렌더링 완전 해결 (Pre-baking 방식)

### 증상
- 색칠한 셀이 단색으로만 표시됨 (텍스처 패턴 안 보임)
- 밝은 색(노란색)은 텍스처가 보이지만, 어두운 색(갈색, 보라색)은 텍스처가 안 보임
- 팔레트 색상과 실제 칠해진 색상이 다름

### 근본 원인
**접근법 1 (실패): 실시간 블렌딩**
- 색칠할 때마다 `createColoredTexture()` 함수로 텍스처 생성
- MULTIPLY 블렌드 모드 사용: 어두운 색 × 텍스처 = 너무 어두워서 패턴 안 보임
- 여러 시도했지만 근본적 한계:
  - 밝기 조정 (50%-100%, 80%-100%) → 어두운 색에 효과 없음
  - 적응형 블렌드 모드 (SCREEN/MULTIPLY) → 복잡하고 색상 부정확
  - 엣지 감지 → 텍스처 디테일 손실

**접근법 2 (성공): Pre-baking**
- 퍼즐 로드 시 원본 이미지에 텍스처를 한 번만 적용
- 색칠할 때는 텍스처가 적용된 이미지에서 해당 영역을 복사
- 장점:
  1. 텍스처가 모든 색상에 동일하게 보임 (밝기 무관)
  2. 팔레트 색상과 정확히 일치
  3. 실시간 블렌딩 불필요 → 성능 향상

### 해결 방법

#### 1. 원본 이미지에 텍스처 적용 (`setImageUri()`)

```kotlin
fun setImageUri(uri: String) {
    imageUri = uri
    val originalBitmap = loadBitmap(uri)

    // ✨ 원본 이미지에 텍스처 타일링 적용 (퍼즐 생성 시 한 번만)
    backgroundBitmap = if (originalBitmap != null && filledCellPatternBitmap != null) {
        applyTextureToOriginalImage(originalBitmap, filledCellPatternBitmap!!)
    } else {
        originalBitmap
    }

    // ✨ parsedColorMap 업데이트 (이미 cells가 설정된 경우)
    if (backgroundBitmap != null && cells.isNotEmpty()) {
        for (cell in cells) {
            val cellIndex = cell.row * gridSize + cell.col
            parsedColorMap[cellIndex] = getOriginalPixelColor(cell.row, cell.col)
        }
        android.util.Log.d("PaintCanvas", "✨ parsedColorMap 업데이트 완료: ${cells.size}개 셀")
    }

    invalidate()
}

private fun applyTextureToOriginalImage(original: Bitmap, pattern: Bitmap): Bitmap {
    val result = Bitmap.createBitmap(original.width, original.height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(result)

    // 1. 원본 이미지 그리기
    canvas.drawBitmap(original, 0f, 0f, null)

    // 2. 텍스처를 타일링하여 MULTIPLY 오버레이
    val texturePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        shader = BitmapShader(pattern, Shader.TileMode.REPEAT, Shader.TileMode.REPEAT)
        xfermode = PorterDuffXfermode(PorterDuff.Mode.MULTIPLY)
        alpha = 255  // 텍스처 강도 100%
    }
    canvas.drawRect(0f, 0f, original.width.toFloat(), original.height.toFloat(), texturePaint)

    android.util.Log.d("PaintCanvas", "✨ 텍스처 적용 완료: ${original.width}x${original.height}")
    return result
}
```

#### 2. 색칠할 때 텍스처 영역 복사 (`drawFilledCellWithTexture()`)

**잘못된 방법 (이전 코드):**
```kotlin
// ❌ parsedColorMap에서 단색만 추출해서 칠함 → 텍스처 안 보임
private fun drawFilledCellWithTexture(canvas: Canvas, left: Float, top: Float, size: Float, color: Int) {
    reusableBgPaint.color = color
    canvas.drawRect(left, top, left + size + 0.5f, top + size + 0.5f, reusableBgPaint)
}
```

**올바른 방법 (수정 후):**
```kotlin
// ✅ backgroundBitmap에서 해당 셀의 텍스처 영역을 복사
private fun drawFilledCellWithTexture(canvas: Canvas, left: Float, top: Float, size: Float, color: Int) {
    val bitmap = backgroundBitmap
    if (bitmap == null) {
        // Fallback: 단색으로 그리기
        reusableBgPaint.color = color
        canvas.drawRect(left, top, left + size + 0.5f, top + size + 0.5f, reusableBgPaint)
        return
    }

    // 캔버스 좌표에서 row/col 역계산
    val row = (top / cellSize).toInt()
    val col = (left / cellSize).toInt()

    // 원본 이미지에서 해당 셀의 영역 계산
    val srcCellWidth = bitmap.width.toFloat() / gridSize
    val srcCellHeight = bitmap.height.toFloat() / gridSize

    val srcLeft = col * srcCellWidth
    val srcTop = row * srcCellHeight
    val srcRight = srcLeft + srcCellWidth
    val srcBottom = srcTop + srcCellHeight

    // 소스 영역과 대상 영역 설정
    reusableSrcRect.set(srcLeft.toInt(), srcTop.toInt(), srcRight.toInt(), srcBottom.toInt())
    reusableDstRect.set(left, top, left + size, top + size)

    // 텍스처가 적용된 원본 이미지의 해당 영역을 그대로 복사
    canvas.drawBitmap(bitmap, reusableSrcRect, reusableDstRect, reusableBitmapPaint)
}
```

### 핵심 개념 정리

**데이터 흐름:**
1. `setImageUri()`: 원본 이미지 + 텍스처 → `backgroundBitmap` (텍스처 적용된 이미지)
2. `setCells()`: `backgroundBitmap`에서 각 셀의 중심 픽셀 색상 추출 → `parsedColorMap`
3. `drawFilledCellWithTexture()`: `backgroundBitmap`에서 해당 셀 영역 복사 → 캔버스에 그리기

**왜 이전 방법이 실패했나?**
- `parsedColorMap[cellIndex]`는 단일 픽셀 색상 (Int)
- 이것을 `canvas.drawRect(color)`로 그리면 단색 사각형만 그려짐
- 텍스처 패턴 정보는 손실됨

**올바른 방법:**
- `parsedColorMap`은 색상 확인용으로만 사용
- 실제 그릴 때는 `backgroundBitmap`의 해당 영역을 `canvas.drawBitmap()`으로 복사
- 텍스처 패턴이 그대로 유지됨

### 빌드 체크리스트
- [ ] Native 코드 변경 후 `expo prebuild --clean` 실행
- [ ] `cd android && ./gradlew.bat assembleDebug` 빌드
- [ ] 빌드 로그에서 `BUILD SUCCESSFUL` 확인
- [ ] APK 복사: `ColorPlayExpo-texture-final.apk`
- [ ] 디바이스 설치 후 테스트

### 검증 로그
```kotlin
// setImageUri()에서 텍스처 적용 확인
✨ 텍스처 적용 완료: 1024x1024

// drawFilledCellWithTexture()에서 영역 복사 확인
✨ 텍스처 영역 복사: bitmap=1024x1024, src=Rect(0, 0, 6, 6) → dst=RectF(0.0, 0.0, 5.5, 5.5)
```

---

## 마지막 업데이트
2025-11-28: 초기 작성 - 색칠/지우기 딜레이, 깜빡임, 색상 표시 문제 해결 과정 정리
2025-11-28: 텍스처 렌더링 완전 해결 (Pre-baking 방식) 추가

---

## 12. Dev Client "Android internal error" 문제 (Expo 54+)

### 증상
- 앱 실행 후 QR 코드 스캔 또는 URL 입력 시 "Error loading app - Android internal error" 에러
- Metro 서버는 정상 실행 중
- 같은 기기에서 다른 Expo 프로젝트(예: Expo 52)는 잘 됨

### 원인
**Expo 터널 URL에 언더스코어(`_`)가 포함되면 Android dev-client에서 에러 발생**

예시:
- ❌ `https://5luh_l8-anonymous-8081.exp.direct` (언더스코어 포함)
- ✅ `https://colorplay-anonymous-8081.exp.direct` (언더스코어 없음)

GitHub Issue: [#30225](https://github.com/expo/expo/issues/30225)

### 해결 방법

#### 1. 환경변수로 터널 서브도메인 지정
```cmd
# CMD
set EXPO_TUNNEL_SUBDOMAIN=colorplay
npx expo start --tunnel --dev-client

# PowerShell
$env:EXPO_TUNNEL_SUBDOMAIN="colorplay"
npx expo start --tunnel --dev-client
```

#### 2. app.json에 scheme 추가 (권장)
```json
{
  "expo": {
    "name": "Photo Color",
    "slug": "ColorPlayExpo",
    "scheme": "colorplayexpo",
    ...
  }
}
```

#### 3. plugins에 expo-dev-client 추가 (권장)
```json
{
  "expo": {
    ...
    "plugins": [
      "expo-dev-client"
    ],
    ...
  }
}
```

### 설정 후 필수 작업
```bash
# 1. 네이티브 프로젝트 재생성
npx expo prebuild --clean

# 2. APK 빌드
cd android && ./gradlew.bat assembleDebug && cd ..

# 3. APK 설치 (USB 연결 시)
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# 4. Metro 서버 시작 (언더스코어 없는 URL)
set EXPO_TUNNEL_SUBDOMAIN=colorplay
npx expo start --tunnel --dev-client --clear
```

### 체크리스트
- [ ] `app.json`에 `scheme` 설정 확인
- [ ] `app.json`에 `plugins: ["expo-dev-client"]` 확인
- [ ] `EXPO_TUNNEL_SUBDOMAIN` 환경변수 설정
- [ ] 터널 URL에 언더스코어(`_`) 없는지 확인
- [ ] 앱 삭제 후 새 APK 설치

### 버전 정보
- 이 문제는 **Expo SDK 54 + expo-dev-client 6.x**에서 발생
- Expo SDK 52 + expo-dev-client 5.x에서는 발생하지 않음

---

## 마지막 업데이트
2025-11-28: 초기 작성 - 색칠/지우기 딜레이, 깜빡임, 색상 표시 문제 해결 과정 정리
2025-11-28: 텍스처 렌더링 완전 해결 (Pre-baking 방식) 추가
2025-12-02: Dev Client "Android internal error" 문제 해결 (터널 URL 언더스코어 이슈)
