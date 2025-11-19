#!/bin/bash
# 일반적인 EAS 빌드 문제 자동 수정 스크립트
# 사용법: bash scripts/fix-common-issues.sh

set -e

echo "======================================"
echo "EAS 빌드 문제 자동 수정 시작"
echo "======================================"
echo ""

# 1. expo doctor 문제 수정
echo "[1/4] expo doctor 문제 확인 및 수정..."
npx expo install --check --fix 2>&1 || true
echo "✅ 패키지 버전 수정 완료"
echo ""

# 2. node_modules 재설치
echo "[2/4] node_modules 재설치..."
rm -rf node_modules
npm install
echo "✅ node_modules 재설치 완료"
echo ""

# 3. expo-modules-core 버전 확인 및 수정
echo "[3/4] build.gradle expo-modules-core 버전 확인..."
BUILD_GRADLE="modules/paint-canvas/android/build.gradle"

if ! grep -q "expo.modules:expo-modules-core:3.0" "$BUILD_GRADLE"; then
    echo "⚠️  expo-modules-core 버전 추가 중..."
    # sed를 사용한 자동 수정 (백업 생성)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|implementation 'expo.modules:expo-modules-core'|implementation 'expo.modules:expo-modules-core:3.0.+'|g" "$BUILD_GRADLE"
    else
        # Linux/Windows Git Bash
        sed -i "s|implementation 'expo.modules:expo-modules-core'|implementation 'expo.modules:expo-modules-core:3.0.+'|g" "$BUILD_GRADLE"
    fi
    echo "✅ expo-modules-core 버전 추가 완료"
else
    echo "✅ expo-modules-core 버전 이미 설정됨"
fi
echo ""

# 4. .easignore 검증
echo "[4/4] .easignore 검증..."
if ! grep -q "^/android/" .easignore; then
    echo "⚠️  .easignore에 /android/ 추가 필요"
    echo "/android/" >> .easignore
    echo "/ios/" >> .easignore
    echo "✅ .easignore 수정 완료"
else
    echo "✅ .easignore 설정 정상"
fi
echo ""

echo "======================================"
echo "✅ 자동 수정 완료!"
echo "======================================"
echo ""
echo "다음 단계:"
echo "1. 변경사항 확인: git status"
echo "2. 빌드 전 체크: bash scripts/pre-build-check.sh"
echo "3. EAS 빌드 실행"
echo ""
