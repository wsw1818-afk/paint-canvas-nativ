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

### 11. undefined 에러 가능성 (assets 접근)
**위치**: `src/screens/GenerateScreen.js` (line 151)

**문제**: `result.assets[0]` 접근 시 `assets` 배열이 비어있거나 undefined일 수 있음

**현재 코드**:
```javascript
if (!result.canceled && result.assets[0]) {
  setSelectedImage({ uri: result.assets[0].uri });
}
```

**해결안**:
```javascript
if (!result.canceled && result.assets && result.assets.length > 0 && result.assets[0]) {
  setSelectedImage({ uri: result.assets[0].uri });
}
```

---

### 12. 다국어 폰백 로직 버그
**위치**: `src/locales/index.js` (line 96-126)

**문제**: `t()` 함수에서 한국어(ko)로 폰백할 때 value를 덮어쓰지만, 이후 keys 순회를 다시 시작하지 않음

**현재 코드**:
```javascript
// 키를 찾지 못하면 기본 언어(한국어)에서 시도
value = translations.ko;
for (const fallbackKey of keys) {
  if (value && typeof value === 'object' && fallbackKey in value) {
    value = value[fallbackKey];
  } else {
    return key; // 기본 언어에서도 못 찾으면 키 반환
  }
}
break;  // 🚨 문제: break 후 value는 마지막 키의 값
```

**결과**: 일부 중첩된 키에서 올바른 폰백이 작동하지 않을 수 있음

---

### 13. 마이그레이션 Race Condition
**위치**: `src/utils/puzzleStorage.js` (line 99-178)

**문제**: `migratePuzzles`에서 퍼즐 배열을 수정하고 저장하는 동안 다른 코드가 `AsyncStorage`에 접근하면 데이터가 손실될 수 있음

**현재 코드**:
```javascript
const puzzles = await loadPuzzles();
// ... 퍼즐 수정 로직 ...
await AsyncStorage.setItem(PUZZLES_KEY, JSON.stringify(puzzles));
```

**개선**: 락(lock) 메커니즘이나 순차 실행 보장 필요

---

### 14. isMounted 체크 누락
**위치**: `src/screens/GenerateScreen.js` (line 199-226)

**문제**: `handleGenerate` 함수 낸 여러 비동기 작업 중 `isMounted` 체크가 누락됨

**현재 코드**:
```javascript
const thumbnailImage = await manipulateAsync(...);  // line 216
// 🚨 isMounted 체크 없음
setPreviewImage(thumbnailImage.uri);
```

**위험**: 컴포넌트 언마운트 후 상태 업데이트 시 메모리 누수 경고 발생

---

### 15. ThumbnailImage 컴포넌트 메모리 누수
**위치**: `src/screens/GalleryScreen.js` (line 10-72)

**문제**: `checkAndSetUri` async 함수가 컴포넌트 언마운트 후에도 상태 업데이트 가능

**현재 코드**:
```javascript
useEffect(() => {
  const checkAndSetUri = async () => {
    // ... 파일 체크 로직 ...
    setCurrentUri(uri);  // 🚨 언마운트 후 호출 가능
    setHasError(false);
  };
  checkAndSetUri();
}, [uri, puzzleId, progress, fallbackUri]);
```

**해결안**: 클린업 함수로 플래그 설정 필요

---

### 16. K-Means++ 무한 루프 가능성
**위치**: `src/utils/imageProcessor.js` (line 315-351)

**문제**: `kMeansPlusPlusInit`에서 pixels 배열이 비어있으면 centroids가 비어있는 채로 반환됨

**현재 코드**:
```javascript
function kMeansPlusPlusInit(pixels, k) {
  const centroids = [];
  centroids.push({ ...pixels[0] });  // 🚨 pixels가 비어있으면 undefined
  while (centroids.length < k) {
    // ...
  }
}
```

**위험**: 빈 이미지 처리 시 런타임 에러

---

### 17. 색상 팔레트 ID 중복 가능성
**위치**: `src/screens/PlayScreenNativeModule.js` (line 122-190)

**문제**: 64색 팔레트에서 `generateLabel` 함수가 COLOR_PALETTE[idx]?.id를 먼저 확인하지만, idx가 36 이상일 때는 2자리 라벨 생성 로직으로 넘어감

**현재 코드**:
```javascript
const generateLabel = (idx) => {
  if (idx < 36) {
    return COLOR_PALETTE[idx]?.id || String.fromCharCode(65 + idx);
  }
  // 36-63: 2자리 라벨
  const group = Math.floor((idx - 36) / 8);
  const num = (idx - 36) % 8 + 1;
  return `${String.fromCharCode(97 + group)}${num}`;
};
```

**위험**: 색상 ID 충돌로 인한 잘못된 색상 매핑 가능성

---

### 18. 배너 광고 ID 하드코딩
**위치**: `src/screens/PlayScreenNativeModule.js` (line 19)

**문제**: 광고 ID가 `null`로 하드코딩되어 있어 배포 시 변경 필요

**현재 코드**:
```javascript
const adUnitId = null;  // 개발자 테스트용 - 광고 비활성화
```

**참고**: 프로덕션 배포 전 반드시 실제 광고 ID로 변경 필요

---

### 19. puzzleId 없는 경우 처리 미흡
**위치**: `src/screens/PlayScreenNativeModule.js` (line 470-561)

**문제**: `captureAndSaveCompletion` 함수에서 puzzleId가 없으면 완성 이미지가 저장되지 않음

**현재 코드**:
```javascript
const captureAndSaveCompletion = useCallback(async () => {
  if (hasCompletedRef.current || !puzzleId) return;  // 🚨 puzzleId 없으면 리턴
  // ...
}, [puzzleId, isAutoRecapture, navigation]);
```

**위험**: 특정 경로로 Play 화면 진입 시 완성 이미지가 저장되지 않음

---

### 20. AsyncStorage 키 충돌 가능성
**위치**: `src/screens/PlayScreenNativeModule.js` (line 288-296)

**문제**: gameId 생성 시 `imageUri` 기반 폰백에서 파일명 충돌 가능성

**현재 코드**:
```javascript
const gameId = useMemo(() => {
  if (puzzleId) {
    return `puzzle_progress_${puzzleId}`;
  }
  if (!imageUri) return null;
  const fileName = imageUri.split('/').pop()?.split('.')[0] || '';
  return `native_${fileName}_${gridSize}`;  // 🚨 파일명 중복 가능
}, [puzzleId, imageUri, gridSize]);
```

**위험**: 동일한 이미지 파일명을 가진 다른 이미지의 진행상황이 섞일 수 있음

---

## 📊 요약

| 심각도 | 개수 | 주요 항목 |
|--------|------|----------|
| 🔴 Critical | 2 | 포인트 손실, Missing Import |
| 🟡 Medium | 6 | 의존성 누락, 자동 복구 비활성화, 메모리 누수, 마이그레이션 Race Condition, i18n 폰백 버그 |
| 🟢 Low | 6 | 오타, 광고 카운터, 계산 오류, assets 접근, 하드코딩 등 |
| ⚠️ Risk | 3 | 메모리, Race Condition, ID 충돌 |

**총 버그/개선사항: 20개**

---

## 우선순위 수정 권장

1. **즉시 수정**: 포인트 손실 문제 (Critical)
2. **빠른 수정**: `Image` import 추가 (Critical)
3. **권장**: 자동 복구 기능 활성화 (Medium)
