# EAS Build 실패 해결 가이드

## 문제 상황
EAS 빌드가 Prebuild 단계에서 반복적으로 실패하는 문제가 발생했습니다.

## 근본 원인
**Config Plugin 방식의 한계**:
- Config Plugin이 TypeScript로 컴파일되면서 상대 경로 계산이 EAS 서버 환경에서 달라짐
- `modules/paint-canvas/android` 디렉토리를 찾지 못함
- 로컬 prebuild는 성공하지만 EAS에서는 실패

## 해결 방법: Expo Autolinking 사용

### 1. 필요한 파일 구조
```
modules/paint-canvas/
├── expo-module.config.json    # Expo 모듈 설정
├── package.json                # 모듈 메타데이터
├── src/
│   └── index.tsx              # TypeScript 인터페이스
└── android/
    ├── build.gradle           # Android 빌드 설정
    ├── src/main/
    │   ├── AndroidManifest.xml
    │   └── java/com/paintcanvas/
    │       ├── PaintCanvasPackage.kt
    │       ├── PaintCanvasView.kt
    │       └── PaintCanvasViewManager.kt
```

### 2. expo-module.config.json
```json
{
  "platforms": ["android"],
  "android": {
    "modules": ["com.paintcanvas.PaintCanvasPackage"]
  }
}
```

### 3. android/build.gradle
```gradle
apply plugin: 'com.android.library'
apply plugin: 'org.jetbrains.kotlin.android'

group = 'com.paintcanvas'
version = '1.0.0'

def safeExtGet(prop, fallback) {
    rootProject.ext.has(prop) ? rootProject.ext.get(prop) : fallback
}

android {
    compileSdkVersion safeExtGet("compileSdkVersion", 34)
    namespace "com.paintcanvas"

    defaultConfig {
        minSdkVersion safeExtGet("minSdkVersion", 24)
        targetSdkVersion safeExtGet("targetSdkVersion", 34)
    }

    buildFeatures {
        buildConfig false
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    sourceSets {
        main {
            java.srcDirs = ['src/main/java']
        }
    }
}

dependencies {
    implementation 'com.facebook.react:react-android'
    implementation "org.jetbrains.kotlin:kotlin-stdlib-jdk8:${safeExtGet('kotlinVersion', '1.9.22')}"
}
```

### 4. app.json
```json
{
  "expo": {
    // ... 다른 설정들
    // ❌ 제거: "plugins": ["./modules/paint-canvas/plugin/build/index.js"]
  }
}
```

## 장점
1. **신뢰성**: Expo의 표준 autolinking 방식 사용
2. **유지보수성**: Config Plugin 관리 불필요
3. **호환성**: 로컬/EAS 모두 동일하게 작동
4. **확장성**: 추가 네이티브 모듈도 동일한 패턴 적용 가능

## 검증 방법
```bash
# 로컬 prebuild 테스트
npx expo prebuild --clean

# MainApplication.kt에서 확인
cat android/app/src/main/java/com/wisangwon/ColorPlayExpo/MainApplication.kt | grep PaintCanvas

# EAS 빌드
npx eas build --profile development --platform android
```

## 향후 네이티브 모듈 추가 시
1. `modules/[module-name]/expo-module.config.json` 생성
2. `modules/[module-name]/android/build.gradle` 생성
3. `modules/[module-name]/android/src/main/AndroidManifest.xml` 생성
4. Kotlin 소스 파일 작성
5. `npx expo prebuild --clean`으로 검증
6. EAS 빌드 실행

## 관련 커밋
- `1438a21`: Config Plugin을 Expo Autolinking으로 전환
- `e897b51`: @expo/config-plugins를 dependencies로 이동 (실패한 시도)
- `688aa3c`: 플러그인 디버깅 로깅 추가 (실패한 시도)
