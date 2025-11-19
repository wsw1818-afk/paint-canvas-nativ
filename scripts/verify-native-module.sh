#!/bin/bash

# Native Module 검증 스크립트
# EAS 빌드 전에 네이티브 모듈이 제대로 설정되었는지 확인

set -e

echo "🔍 네이티브 모듈 검증 시작..."

# 1. expo-module.config.json 존재 확인
if [ ! -f "modules/paint-canvas/expo-module.config.json" ]; then
    echo "❌ expo-module.config.json이 없습니다"
    exit 1
fi
echo "✅ expo-module.config.json 존재"

# 2. build.gradle 존재 확인
if [ ! -f "modules/paint-canvas/android/build.gradle" ]; then
    echo "❌ build.gradle이 없습니다"
    exit 1
fi
echo "✅ build.gradle 존재"

# 3. Kotlin 파일들 존재 확인
KOTLIN_FILES=(
    "modules/paint-canvas/android/src/main/java/com/paintcanvas/PaintCanvasPackage.kt"
    "modules/paint-canvas/android/src/main/java/com/paintcanvas/PaintCanvasView.kt"
    "modules/paint-canvas/android/src/main/java/com/paintcanvas/PaintCanvasViewManager.kt"
)

for file in "${KOTLIN_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ $file이 없습니다"
        exit 1
    fi
done
echo "✅ Kotlin 파일들 존재"

# 4. Git tracking 확인
for file in "${KOTLIN_FILES[@]}"; do
    if ! git ls-files --error-unmatch "$file" > /dev/null 2>&1; then
        echo "❌ $file이 git에 추적되지 않습니다"
        echo "   git add $file을 실행하세요"
        exit 1
    fi
done
echo "✅ 모든 파일이 git에 추적됨"

# 5. Prebuild 테스트
echo "🧪 Prebuild 테스트 중..."
rm -rf android
npx expo prebuild --platform android --clean > /dev/null 2>&1

# 6. MainApplication.kt에 PaintCanvasPackage 등록 확인
if ! grep -q "PaintCanvasPackage" android/app/src/main/java/com/wisangwon/ColorPlayExpo/MainApplication.kt; then
    echo "❌ MainApplication.kt에 PaintCanvasPackage가 등록되지 않았습니다"
    exit 1
fi
echo "✅ MainApplication.kt에 PaintCanvasPackage 등록됨"

echo "✅ 모든 검증 통과!"
echo "🚀 EAS 빌드를 시작할 수 있습니다"
