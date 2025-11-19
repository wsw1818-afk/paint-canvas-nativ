# EAS Build 체크리스트

## 로컬 모듈 추가 시 필수 확인 사항

### 1. `.easignore` 파일 검증
로컬 모듈의 네이티브 코드가 제외되지 않았는지 확인:

```bash
# 잘못된 패턴 (모든 android 폴더 제외)
android/
ios/

# 올바른 패턴 (루트 레벨만 제외)
/android/
/ios/
```

### 2. 업로드 파일 확인
```bash
# EAS Build에 업로드될 파일 목록 확인
npx eas-cli build --platform android --profile development --non-interactive --local

# modules 폴더 확인
# ✅ modules/your-module/android/ 포함되어야 함
```

### 3. Autolinking 검증
```bash
# 로컬에서 Autolinking 확인
npx expo-modules-autolinking resolve --platform android

# 출력에서 로컬 모듈 확인:
# ✅ packageName: 'your-module'
# ✅ modules: ['com.yourpackage.YourModule']
```

### 4. 빌드 후 검증
- APK 설치 후 런타임 에러 확인
- 로그에서 `Exported view managers: []` 확인
  - `[]`이면 ❌ 모듈 미등록
  - 모듈 이름이 있으면 ✅ 정상

## 이 프로젝트의 경우

### 문제 발생 이유
`.easignore`의 `android/` 패턴이 `modules/paint-canvas/android/`까지 제외

### 해결 방법
`/android/`로 수정 → 루트 레벨만 제외

### 검증 명령
```bash
npx expo-modules-autolinking resolve --platform android | grep paint-canvas
```

예상 출력:
```
packageName: 'paint-canvas-native',
modules: [ 'com.paintcanvas.PaintCanvasModule' ]
```
