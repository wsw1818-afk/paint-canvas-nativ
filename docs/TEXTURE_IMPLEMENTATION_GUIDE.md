# 텍스처 구현 가이드

## 개요

ColorPlayExpo 앱에서 텍스처는 색칠 완료 시 셀에 적용되는 패턴 이미지입니다.
이 문서는 텍스처 추가/수정 시 실수를 방지하기 위한 가이드입니다.

---

## 핵심 개념: 텍스처 vs 기본 퍼즐

### 텍스처 (Texture)
- **용도**: 색칠 완료된 셀에 오버레이되는 패턴 이미지
- **위치**: `assets/textures/` 폴더
- **설정 파일**: `src/utils/textureStorage.js`
- **선택 UI**: TexturePickerModal (갤러리 리셋 시 표시)

### 기본 퍼즐 (Default Puzzle)
- **용도**: 갤러리에 미리 제공되는 색칠할 이미지
- **위치**: `assets/textures/` (텍스처와 같은 폴더 사용 가능)
- **설정 파일**: `src/utils/defaultPuzzles.js`
- **생성 시점**: 앱 최초 실행 시 자동 생성

---

## 텍스처 추가 절차

### 1단계: 이미지 파일 복사

```bash
# 이미지를 assets/textures/ 폴더에 복사
cp 새이미지.png assets/textures/
```

**파일명 규칙**:
- 동물: `animal_01_cat.png`, `animal_02_dog.png` ...
- 꽃: `flower_01_rose.png`, `flower_02_tulip.png` ...
- 기타: `01_apple.png`, `02_bee.png` ...

### 2단계: textureStorage.js 수정

`src/utils/textureStorage.js` 파일의 `TEXTURES` 배열에 추가:

```javascript
export const TEXTURES = [
  { id: 'none', name: '없음', image: null },
  // 기존 텍스처...

  // 새 텍스처 추가
  { id: 'cat', name: '고양이', image: require('../../assets/textures/animal_01_cat.png') },
];
```

**필수 필드**:
- `id`: 고유 식별자 (영문, 중복 불가)
- `name`: 화면에 표시될 한글 이름
- `image`: require()로 이미지 참조 (정적 import 필수!)

### 3단계: APK 빌드 및 테스트

```bash
cd android && ./gradlew.bat assembleDebug && cd ..
```

---

## 기본 퍼즐 추가 절차

### 1단계: 이미지 파일 준비

기본 퍼즐용 이미지는 `assets/textures/` 폴더의 기존 이미지를 재사용하거나 새로 추가합니다.

### 2단계: defaultPuzzles.js 수정

`src/utils/defaultPuzzles.js` 파일 수정:

```javascript
// 버전 키 업데이트 (중요! 새 퍼즐 생성을 위해 필수)
const DEFAULT_PUZZLES_KEY = '@defaultPuzzlesCreated_v7'; // 버전 올리기

// 정적 import 추가
const ASSET_MODULES = {
  'animal_01_cat.png': require('../../assets/textures/animal_01_cat.png'),
  'flower_01_rose.png': require('../../assets/textures/flower_01_rose.png'),
  // 새 이미지 추가
};

// 퍼즐 정의
const DEFAULT_PUZZLES = [
  { assetName: 'animal_01_cat.png', title: '고양이', difficulty: 'EASY', colorCount: 16, gridSize: 120 },
  { assetName: 'flower_01_rose.png', title: '장미', difficulty: 'HARD', colorCount: 64, gridSize: 200 },
];
```

### 3단계: 앱 삭제 후 재설치

기본 퍼즐은 AsyncStorage 플래그로 관리되므로, **앱을 삭제 후 재설치**해야 새 퍼즐이 생성됩니다.

---

## 자주 하는 실수와 해결법

### 실수 1: 텍스처와 기본 퍼즐 혼동

**증상**: 이미지가 갤러리에 색칠할 퍼즐로 들어감 (텍스처로 들어가야 하는데)

**원인**: 이미지를 `defaultPuzzles.js`에 추가함

**해결**:
- 텍스처로 사용할 이미지 → `textureStorage.js`에만 추가
- 기본 퍼즐로 사용할 이미지 → `defaultPuzzles.js`에만 추가

### 실수 2: 동적 require 사용

**증상**: Release 빌드에서 이미지 로드 실패

**잘못된 코드**:
```javascript
// ❌ 동적 require - Release 빌드에서 에러!
const image = require(`../../assets/textures/${fileName}`);
```

**올바른 코드**:
```javascript
// ✅ 정적 require - 파일 경로를 하드코딩
const ASSET_MODULES = {
  'animal_01_cat.png': require('../../assets/textures/animal_01_cat.png'),
};
const image = ASSET_MODULES[fileName];
```

### 실수 3: 삭제한 이미지 참조

**증상**: Metro bundler 에러 - "Unable to resolve"

**원인**: 파일은 삭제했지만 코드에서 여전히 참조

**해결**:
1. `assets/textures/` 폴더의 실제 파일 확인
2. `textureStorage.js`에서 없는 파일 참조 제거
3. `defaultPuzzles.js`에서 없는 파일 참조 제거

### 실수 4: 기본 퍼즐이 생성 안 됨

**증상**: 앱 설치 후에도 갤러리가 비어있음

**원인**: AsyncStorage에 이전 버전 플래그가 남아있음

**해결**:
1. `DEFAULT_PUZZLES_KEY` 버전 올리기 (v5 → v6)
2. 앱 삭제 후 재설치

### 실수 5: expo-file-system deprecated 에러

**증상**: "Method copyAsync imported from 'expo-file-system' is deprecated"

**해결**:
```javascript
// ❌ 기존
import * as FileSystem from 'expo-file-system';

// ✅ 수정
import * as FileSystem from 'expo-file-system/legacy';
```

---

## 파일 구조

```
ColorPlayExpo/
├── assets/
│   └── textures/           # 텍스처 이미지 폴더
│       ├── animal_01_cat.png
│       ├── animal_02_dog.png
│       ├── ...
│       ├── flower_01_rose.png
│       ├── flower_02_tulip.png
│       └── ...
├── src/
│   ├── utils/
│   │   ├── textureStorage.js    # 텍스처 목록 및 저장/불러오기
│   │   └── defaultPuzzles.js    # 기본 퍼즐 정의
│   └── components/
│       └── TexturePickerModal.js # 텍스처 선택 UI
```

---

## 체크리스트

### 텍스처 추가 시
- [ ] 이미지 파일을 `assets/textures/`에 복사했는가?
- [ ] `textureStorage.js`의 TEXTURES 배열에 추가했는가?
- [ ] id가 기존과 중복되지 않는가?
- [ ] require() 경로가 정확한가?
- [ ] APK 빌드 후 텍스처 선택 모달에서 확인했는가?

### 기본 퍼즐 추가 시
- [ ] 이미지 파일이 존재하는가?
- [ ] `defaultPuzzles.js`의 ASSET_MODULES에 정적 import 추가했는가?
- [ ] DEFAULT_PUZZLES 배열에 퍼즐 정보 추가했는가?
- [ ] DEFAULT_PUZZLES_KEY 버전을 올렸는가?
- [ ] 앱 삭제 후 재설치했는가?

### 이미지 삭제 시
- [ ] `textureStorage.js`에서 해당 이미지 참조 제거했는가?
- [ ] `defaultPuzzles.js`에서 해당 이미지 참조 제거했는가?
- [ ] Metro bundler 재시작 후 에러 없는가?

---

## 현재 텍스처 목록 (2024-12-24 기준)

### 동물 텍스처 (15개)
| ID | 이름 | 파일명 |
|----|------|--------|
| cat | 고양이 | animal_01_cat.png |
| dog | 강아지 | animal_02_dog.png |
| bunny | 토끼 | animal_03_bunny.png |
| bear | 곰 | animal_04_bear.png |
| fox | 여우 | animal_05_fox.png |
| panda | 판다 | animal_06_panda.png |
| tiger | 호랑이 | animal_07_tiger.png |
| lion | 사자 | animal_08_lion.png |
| elephant | 코끼리 | animal_09_elephant.png |
| giraffe | 기린 | animal_10_giraffe.png |
| penguin | 펭귄 | animal_11_penguin.png |
| frog | 개구리 | animal_12_frog.png |
| koala | 코알라 | animal_13_koala.png |
| dolphin | 돌고래 | animal_14_dolphin.png |
| chick | 병아리 | animal_15_chick.png |

### 꽃 텍스처 (15개)
| ID | 이름 | 파일명 |
|----|------|--------|
| rose | 장미 | flower_01_rose.png |
| tulip | 튤립 | flower_02_tulip.png |
| sunflower | 해바라기 | flower_03_sunflower.png |
| daisy | 데이지 | flower_04_daisy.png |
| lavender | 라벤더 | flower_05_lavender.png |
| lily | 백합 | flower_06_lily.png |
| orchid | 난초 | flower_07_orchid.png |
| hibiscus | 히비스커스 | flower_08_hibiscus.png |
| cherryBlossom | 벚꽃 | flower_09_cherry_blossom.png |
| peony | 모란 | flower_10_peony.png |
| lotus | 연꽃 | flower_11_lotus.png |
| camellia | 동백 | flower_12_camellia.png |
| poppy | 양귀비 | flower_13_poppy.png |
| marigold | 금잔화 | flower_14_marigold.png |
| hydrangea | 수국 | flower_15_hydrangea.png |

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2024-12-24 | 기존 텍스처 20개 삭제, 동물+꽃 30개로 교체 |
| 2024-12-24 | 문서 최초 작성 |
