# 버그 리포트

> 생성일: 2026-02-05  
> 프로젝트: ColorPlayExpo

---

## 🔴 심각한 버그 (Critical)

### 1. 포인트 손실 문제
**위치**: `src/screens/PlayScreenNativeModule.js` (line 651-658)

**문제**: 컴포넌트 언마운트 시 `pendingPoints`가 저장되지 않고 손실됨

**현재 코드**:
```javascript
useEffect(() => {
  if (isCanvasReady && filledCells.size > 0) {
    saveProgress();
  }
  return () => {
    if (saveProgressRef.current) {
      clearTimeout(saveProgressRef.current);
      saveProgressRef.current = null;
    }
  };
}, [filledCells.size, isCanvasReady, saveProgress]);
```

**해결안**:
```javascript
return () => {
  if (saveProgressRef.current) {
    clearTimeout(saveProgressRef.current);
    saveProgressRef.current = null;
  }
  // 포인트 즉시 저장
  if (pendingPointsRef.current > 0) {
    const points = pendingPointsRef.current;
    pendingPointsRef.current = 0;
    addPoints(points).catch(() => {});
  }
};
```

---

### 2. Missing Import - Image
**위치**: `src/screens/GalleryScreen.js` (line 317)

**문제**: `Image.resolveAssetSource`를 사용하지만 `Image`가 import되지 않음

**현재 코드**:
```javascript
const resolved = Image.resolveAssetSource(texture.image);
```

**해결안**:
```javascript
import { Image } from 'react-native'; // 파일 상단에 추가
```

---

## 🟡 중간 심각도 버그 (Medium)

### 3. useCallback 의존성 누락
**위치**: `src/screens/PlayScreenNativeModule.js` (line 821-894)

**문제**: `handleCellPainted` 콜백의 의존성 배열에 `filledCells`, `wrongCells` 등 누락

**현재 코드**:
```javascript
const handleCellPainted = useCallback((event) => {
  // ... filledCellsRef, wrongCellsRef 사용
}, [undoMode]); // 🚨 의존성 누락
```

**참고**: Ref를 사용하여 해결하려 했지만, 일부 케이스에서는 여전히 stale closure 문제 가능

---

### 4. 자동 복구 기능 비활성화
**위치**: `src/screens/GalleryScreen.js` (line 177-219)

**문제**: 100% 완료되었지만 `completedImageUri`가 없는 퍼즐의 자동 복구 기능이 주석 처리됨

**코드**:
```javascript
// ⚠️ 임시 비활성화 - 크래시 원인 파악 중
// useFocusEffect(...)
```

**결과**: 사용자가 완료된 퍼즐을 볼 때 완성 이미지가 표시되지 않을 수 있음

---

### 5. 메모리 누수 가능성
**위치**: `src/screens/GenerateScreen.js` (line 41, 154-167)

**문제**: `isMounted` 패턴을 사용하지만 일부 비동기 함수에서 체크가 누락

---

## 🟢 경미한 버그/개선점 (Low)

### 6. 오타
**위치**: `src/utils/imageProcessor.js` (line 497)

```javascript
function mergeSimigarColors(colors, threshold = 15) {
  //        ^^^^^^^^ "Similar"의 오타
}
```

---

### 7. 광고 카운터 초기화 문제
**위치**: `src/utils/adManager.js` (line 54-57)

**문제**: 앱 재시작 시 카운터가 0으로 초기화되어 광고 빈도가 예상과 다를 수 있음

**개선**: AsyncStorage에 카운터 영구 저장 권장

---

### 8. scoreMultiplier 계산 오류 가능성
**위치**: `src/screens/PlayScreenNativeModule.js` (line 508-510)

```javascript
const scorePercent = Math.floor((currentScore / maxScore) * 10) * 10;
const scoreMultiplier = Math.max(0, Math.min(100, scorePercent)) / 100;
```

**문제**: `scoreMultiplier`가 0이 될 수 있음 (예: 5% 완료 시)

---

## ⚠️ 잠재적 위험 (Potential Risks)

### 9. 메모리 관리 - 큰 배열 처리
**위치**: `src/screens/PlayScreenNativeModule.js` (line 343-344)

**문제**: `cells` 배열이 `gridSize * gridSize` 크기로 생성됨
- 250x250 = 62,500개 객체
- 각 객체는 `{row, col, targetColorHex, label}`

**위험**: 큰 퍼즐에서 메모리 사용량 증가

---

### 10. Race Condition - saveProgress
**위치**: `src/screens/PlayScreenNativeModule.js` (line 595-642)

**문제**: 사용자가 빠르게 여러 셀을 채우고 앱을 종료하면 저장이 누락될 수 있음

---

## 📊 요약

| 심각도 | 개수 | 주요 항목 |
|--------|------|----------|
| 🔴 Critical | 2 | 포인트 손실, Missing Import |
| 🟡 Medium | 3 | 의존성 누락, 자동 복구 비활성화, 메모리 누수 |
| 🟢 Low | 4 | 오타, 광고 카운터, 계산 오류 등 |
| ⚠️ Risk | 2 | 메모리, Race Condition |

---

## 우선순위 수정 권장

1. **즉시 수정**: 포인트 손실 문제 (Critical)
2. **빠른 수정**: `Image` import 추가 (Critical)
3. **권장**: 자동 복구 기능 활성화 (Medium)
