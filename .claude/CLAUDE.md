# ColorPlayExpo 개발 가이드라인

## Git 저장소 정보

**전용 저장소**: https://github.com/wsw1818-afk/paint-canvas-nativ

- 이 저장소는 **ColorPlayExpo (색칠앱) 전용**입니다
- 다른 프로젝트와 공유하지 않음
- 커밋/푸시 시 항상 이 저장소로 진행

```bash
# 원격 저장소 확인
git remote -v
# origin  https://github.com/wsw1818-afk/paint-canvas-nativ.git (fetch)
# origin  https://github.com/wsw1818-afk/paint-canvas-nativ.git (push)

# 만약 다른 저장소로 설정되어 있다면 변경
git remote set-url origin https://github.com/wsw1818-afk/paint-canvas-nativ.git
```

---

## 패키지 설치 워크플로우 (중요)

### Expo 패키지 추가 시 필수 절차

**문제 상황**: `expo-linear-gradient` 같은 네이티브 코드가 포함된 Expo 패키지를 추가할 때, 단순히 `npm install`만 하면 다음 에러가 발생:
- Metro bundler: "Unable to resolve [package]" 에러
- Native crash: `IllegalViewOperationException` 에러
- CMake 빌드: "codegen directory not found" 에러

**올바른 절차**:
```bash
# 1. 패키지 설치
npm install expo-linear-gradient

# 2. 네이티브 프로젝트 재생성 (필수!)
npx expo prebuild --clean

# 3. APK 빌드
cd android && ./gradlew.bat assembleDebug && cd ..

# 4. 결과물 복사
copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "D:\OneDrive\코드작업\결과물\ColorPlayExpo-fixed-debug.apk"
```

### 왜 `expo prebuild --clean`이 필요한가?

Expo 패키지 중 네이티브 코드(Java/Kotlin/Swift/Obj-C)가 포함된 것들은:
- Android의 CMake codegen 디렉토리 생성 필요
- `build.gradle`에 autolinking 설정 추가 필요
- React Native의 New Architecture (Fabric/TurboModules) 코드 생성 필요

`prebuild`를 하지 않으면:
- ❌ `@react-native-async-storage/async-storage/android/build/generated/source/codegen/jni/` 같은 디렉토리가 없어서 CMake 에러
- ❌ Native 모듈이 제대로 링크되지 않아서 런타임 크래시
- ❌ Metro bundler가 패키지를 찾지 못함

## 빌드가 필요한 경우 vs 불필요한 경우

### ❌ APK 빌드 불필요 (Hot Reload로 충분)
- JavaScript 코드 변경 (App.js, screens/, utils/ 등)
- React 컴포넌트 수정
- 스타일 변경
- 비즈니스 로직 수정

**방법**: Metro 서버만 실행 (`npx expo start`), 앱에서 Reload

### ✅ APK 빌드 필수
1. **네이티브 코드 변경**:
   - Kotlin/Java 파일 수정 (PaintCanvasView.kt 등)
   - AndroidManifest.xml 수정
   - gradle 설정 변경 (gradle.properties, build.gradle)

2. **Expo 패키지 추가/제거**:
   - `npm install expo-*` 후 반드시 prebuild + 빌드
   - 특히 네이티브 코드가 있는 패키지 (linear-gradient, camera, location 등)

3. **설정 파일 변경**:
   - app.json/app.config.js 의 plugins, android 설정 변경
   - 권한(permissions) 추가/제거

## 빌드 검증 체크리스트

### 1. 코드 반영 확인
네이티브 코드를 수정했다면, 빌드 로그에서 재컴파일 확인:
```bash
> Task :paint-canvas-native:compileDebugKotlin
> Task :paint-canvas-native:compileDebugJavaWithJavac
```

반영 안 됐다면 clean 빌드:
```bash
cd android && ./gradlew.bat clean assembleDebug
```

### 2. 빌드 성공 확인
```
BUILD SUCCESSFUL in [시간]
```

### 3. APK 생성 확인
```
android\app\build\outputs\apk\debug\app-debug.apk
```

## 일반적인 에러와 해결법

### Error: "Unable to resolve [package]"
**원인**: npm 패키지는 설치했지만 네이티브 프로젝트에 반영 안 됨
**해결**: `npx expo prebuild --clean` 실행 후 빌드

### Error: "IllegalViewOperationException"
**원인**: Native 코드가 변경됐는데 APK를 재빌드하지 않음
**해결**: APK 빌드 후 재설치

### Error: "CMake Error: codegen directory not found"
**원인**: React Native New Architecture의 codegen 디렉토리가 생성 안 됨
**해결**: `npx expo prebuild --clean` 실행 후 빌드

### Error: "Duplicate class found"
**원인**: gradle 캐시 문제
**해결**: `cd android && ./gradlew.bat clean` 후 빌드

## 빌드 자동화 스크립트

### Development Client APK (기본)
```bash
# build-and-copy.bat
@echo off
echo ======================================
echo ColorPlayExpo - Development Client Build
echo ======================================

echo.
echo [1/3] Cleaning previous build...
cd android
call gradlew.bat clean

echo.
echo [2/3] Building Debug APK...
call gradlew.bat assembleDebug

echo.
echo [3/3] Copying to output directory...
cd ..
copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "D:\OneDrive\코드작업\결과물\ColorPlayExpo-debug.apk"

echo.
echo ======================================
echo Build Complete!
echo Output: D:\OneDrive\코드작업\결과물\ColorPlayExpo-debug.apk
echo ======================================
pause
```

### Expo 패키지 추가 후 빌드
```bash
# rebuild-after-package.bat
@echo off
echo ======================================
echo Rebuilding after package installation
echo ======================================

echo.
echo [1/4] Running expo prebuild...
call npx expo prebuild --clean

echo.
echo [2/4] Cleaning previous build...
cd android
call gradlew.bat clean

echo.
echo [3/4] Building Debug APK...
call gradlew.bat assembleDebug

echo.
echo [4/4] Copying to output directory...
cd ..
copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "D:\OneDrive\코드작업\결과물\ColorPlayExpo-fixed-debug.apk"

echo.
echo ======================================
echo Build Complete!
echo ======================================
pause
```

## 체크리스트: 새 Expo 패키지 추가 시

- [ ] `npm install <package>` 실행
- [ ] `npx expo prebuild --clean` 실행 (네이티브 프로젝트 재생성)
- [ ] `cd android && ./gradlew.bat clean assembleDebug` 실행
- [ ] 빌드 로그에서 `BUILD SUCCESSFUL` 확인
- [ ] APK를 결과물 폴더에 복사
- [ ] 디바이스에 설치 후 테스트

## 참고: 네이티브 코드가 있는 주요 Expo 패키지

다음 패키지들은 설치 후 반드시 `prebuild` 필요:
- `expo-linear-gradient` (그라디언트 배경)
- `expo-camera` (카메라)
- `expo-location` (GPS)
- `expo-image-picker` (갤러리/사진)
- `expo-file-system` (파일 저장)
- `expo-sqlite` (데이터베이스)
- `expo-notifications` (푸시 알림)
- `expo-av` (오디오/비디오)
- `@react-native-async-storage/async-storage` (저장소)

## 코드 수정 후 사용자에게 빌드 필요 여부 안내 (필수)

**Claude는 코드 수정 후 반드시 사용자에게 빌드가 필요한지 알려줘야 합니다:**

### JavaScript 코드만 수정한 경우:
```
✅ 빌드 불필요 - Hot Reload로 자동 반영됩니다.
앱에서 Reload만 하면 변경사항이 적용됩니다.
```

### Native 코드(Kotlin/Java) 수정한 경우:
```
⚠️ APK 빌드 필요 - Native 코드가 변경되었습니다.
빌드 후 APK를 재설치해야 변경사항이 적용됩니다.
```

### 수정 완료 시 안내 예시:
- "JS 코드만 수정했으므로 빌드 없이 Reload하면 됩니다."
- "Native 코드(PaintCanvasView.kt)를 수정했으므로 APK 빌드가 필요합니다. 빌드할까요?"

## 마지막 업데이트
2025-11-27: expo-linear-gradient 추가 시 CMake codegen 에러 해결법 추가
2025-11-29: 코드 수정 후 빌드 필요 여부 안내 지침 추가
2025-11-30: Git 전용 저장소 정보 추가 (paint-canvas-nativ)
