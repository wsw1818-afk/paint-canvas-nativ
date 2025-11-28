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

## 마지막 업데이트
2025-11-28: 초기 작성 - 색칠/지우기 딜레이, 깜빡임, 색상 표시 문제 해결 과정 정리
