# ColorPlayExpo 버그 수정 기록

## 날짜: 2025-11-25

---

## 1. 화면 축소 버그 (색칠 중 화면이 줄어듦)

### 증상
- 한 손가락으로 색칠하는 중에 화면이 갑자기 축소됨
- 줌 레벨이 의도치 않게 변경됨

### 원인
- `ScaleGestureDetector`가 단일 손가락 터치 이벤트도 처리하고 있었음
- 미세한 scale 변화(노이즈)도 줌으로 인식됨

### 해결책
**파일**: `PaintCanvasView.kt`

```kotlin
// 1. ScaleGestureDetector는 2개 이상 손가락일 때만 처리
if (event.pointerCount >= 2) {
    scaleGestureDetector.onTouchEvent(event)
}

// 2. 미세한 scale 변화 무시 (노이즈 필터링)
override fun onScale(detector: ScaleGestureDetector): Boolean {
    val scale = detector.scaleFactor
    // 1% 미만 변화는 무시
    if (Math.abs(scale - 1f) < 0.01f) {
        return true
    }
    // ... 줌 처리
}
```

---

## 2. 두 손가락 터치 시 색칠되는 버그

### 증상
- 두 손가락으로 줌/팬 하려고 할 때 첫 번째 손가락이 색칠로 인식됨
- 10번 중 1~2번 발생

### 원인
- 두 번째 손가락이 닿기 전에 첫 번째 손가락의 터치가 색칠로 처리됨

### 해결책
**파일**: `PaintCanvasView.kt`

```kotlin
// Grace period 추가 - 두 번째 손가락을 기다림
private val MULTI_TOUCH_GRACE_PERIOD = 100L  // 100ms

// ACTION_MOVE에서 체크
val timeSinceDown = System.currentTimeMillis() - touchDownTime
if (timeSinceDown < MULTI_TOUCH_GRACE_PERIOD) {
    // 두 번째 손가락 대기 중 - 색칠 안 함
} else {
    handlePainting(event.x, event.y)
}
```

---

## 3. X 표시가 안 보이는 버그

### 증상
- 틀린 색칠 시 X 표시가 너무 얇거나 안 보임
- 특히 확대 시 X가 작게 보임

### 원인
- `strokeWidth`가 고정값(4f)으로 설정되어 있어서 셀 크기에 비해 너무 얇음

### 해결책
**파일**: `PaintCanvasView.kt`

```kotlin
// X 표시 굵기를 셀 크기에 비례하게 설정
wrongMarkPaint.strokeWidth = max(2f, cellSize * 0.3f)
```

---

## 4. 확대 후 색칠이 안 되는 버그

### 증상
- 두 손가락으로 확대/축소 후 한동안 색칠이 안 됨
- 손가락을 완전히 떼고 다시 터치해야 색칠 가능

### 원인
- `ACTION_POINTER_UP`에서 `preventPaintOnce=true`가 `ACTION_UP`까지 유지됨

### 해결책
**파일**: `PaintCanvasView.kt`

```kotlin
MotionEvent.ACTION_POINTER_UP -> {
    if (event.pointerCount == 2) {
        touchMode = TouchMode.NONE
        // 새로운 제스처를 위해 리셋
        touchDownTime = System.currentTimeMillis()
        preventPaintOnce = false  // Grace period 후 색칠 허용
    }
}
```

---

## 5. 고치기 모드(X 지우기)에서 색칠되는 버그

### 증상
- 고치기 모드(녹색 버튼) 활성화 상태에서 다른 알파벳 선택 후 색칠하면 색칠됨
- X 지우기만 되어야 하는데 색칠도 됨

### 원인
- React Native에서 색상 선택 시 컴포넌트가 리렌더링되면서 Native View가 재생성됨
- 새 View는 `isEraseMode=false`로 초기화됨
- Native의 `isEraseMode`와 JS의 `undoMode` 상태가 동기화 안 됨

### 해결책
**파일**: `PlayScreenNativeModule.js`

```javascript
// JS에서 undoMode 상태를 직접 체크하여 이중 방어
const handleCellPainted = useCallback((event) => {
    const { row, col, correct } = event.nativeEvent;
    const cellKey = `${row}-${col}`;

    // 고치기 모드일 때는 X 제거만 허용
    if (undoMode) {
        if (correct && wrongCells.has(cellKey)) {
            // X 마크 제거
            setWrongCells(prev => {
                const newSet = new Set(prev);
                newSet.delete(cellKey);
                return newSet;
            });
        }
        return;  // 색칠 차단
    }
    // ... 일반 색칠 처리
}, [undoMode, wrongCells]);
```

추가로 View 재생성 방지:
```jsx
<PaintCanvasView
    key="paint-canvas-view"  // 고정 key로 재생성 방지
    ...
/>
```

---

## 6. 줌 상태에서 갑자기 1x로 리셋되는 버그

### 증상
- 색칠하거나 X 지우는 중에 화면이 갑자기 전체 화면(1x)으로 축소됨
- 확대 상태가 유지되지 않음

### 원인
- `onSizeChanged()`가 리렌더링 시 불필요하게 호출됨
- 매번 `scaleFactor = 1f`로 리셋됨

### 해결책
**파일**: `PaintCanvasView.kt`

```kotlin
override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    // ... 크기 설정 ...

    // 첫 초기화일 때만 줌 리셋
    if (oldw == 0 && oldh == 0) {
        // 첫 초기화 - 줌 리셋
        scaleFactor = 1f
        currentZoomIndex = 0
        translateX = (canvasViewWidth - canvasWidth) / 2f
        translateY = (canvasViewHeight - canvasWidth) / 2f
    } else if (sizeActuallyChanged) {
        // 크기 변경됨 - 줌 유지하되 경계만 재조정
        applyBoundaries()
    }
    // 그 외에는 줌 상태 유지
}
```

---

## 7. setSelectedLabel에서 isEraseMode 리셋 버그

### 증상
- 색상/알파벳 선택 시 고치기 모드가 해제됨

### 원인
- `setSelectedLabel()` 함수에서 `isEraseMode = false` 설정하고 있었음

### 해결책
**파일**: `PaintCanvasView.kt`

```kotlin
fun setSelectedLabel(label: String) {
    selectedLabel = label
    // isEraseMode 유지 - 삭제하지 않음!
    invalidate()
}
```

---

## 핵심 교훈

1. **터치 이벤트 처리**:
   - 멀티터치 제스처는 grace period로 구분
   - ScaleGestureDetector는 2+ 손가락일 때만 호출

2. **Native-JS 상태 동기화**:
   - Native View가 재생성될 수 있으므로 JS에서도 상태 체크 필요
   - 고정 `key` prop으로 불필요한 재생성 방지

3. **onSizeChanged 주의**:
   - 리렌더링 시 여러 번 호출될 수 있음
   - 첫 초기화와 실제 크기 변경을 구분해야 함

4. **디버깅 팁**:
   - `android.util.Log.d()` 로그로 Native 상태 확인
   - `Toast.makeText()` 로 원격 디버깅 시 화면에서 값 확인 가능
   - JS `console.log()`는 Metro 서버 또는 Chrome DevTools에서 확인
