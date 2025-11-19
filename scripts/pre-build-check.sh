#!/bin/bash
# EAS 빌드 전 체크리스트 - 재발 방지 스크립트
# 사용법: bash scripts/pre-build-check.sh

set -e  # 에러 발생 시 스크립트 중단

echo "======================================"
echo "EAS 빌드 전 체크 시작"
echo "======================================"
echo ""

# 1. Expo Doctor 검증
echo "[1/6] expo doctor 검증 중..."
if npx expo-doctor 2>&1 | grep -q "No issues detected"; then
    echo "✅ expo doctor 통과"
else
    echo "❌ expo doctor 실패"
    echo "자세한 내용:"
    npx expo-doctor
    exit 1
fi
echo ""

# 2. Git 상태 확인
echo "[2/6] Git 상태 확인 중..."
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  커밋되지 않은 변경사항이 있습니다:"
    git status --short
    echo ""
    read -p "계속하시겠습니까? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "빌드 취소됨"
        exit 1
    fi
else
    echo "✅ Git 상태 깨끗함"
fi
echo ""

# 3. Package.json 검증
echo "[3/6] package.json 검증 중..."
ERRORS=0

# react-native-worklets 확인
if grep -q '"react-native-worklets"' package.json; then
    echo "✅ react-native-worklets 설치 확인"
else
    echo "❌ react-native-worklets 누락"
    ERRORS=$((ERRORS+1))
fi

# expo 버전 확인
if grep -q '"expo": "~54.0' package.json; then
    echo "✅ Expo SDK 54 확인"
else
    echo "⚠️  Expo SDK 버전 확인 필요"
fi
echo ""

# 4. Build.gradle 검증
echo "[4/6] build.gradle 검증 중..."
BUILD_GRADLE="modules/paint-canvas/android/build.gradle"

if grep -q "expo.modules:expo-modules-core:3.0" "$BUILD_GRADLE"; then
    echo "✅ expo-modules-core 버전 명시 확인"
else
    echo "❌ expo-modules-core 버전이 명시되지 않음"
    echo "   예상: implementation 'expo.modules:expo-modules-core:3.0.+'"
    ERRORS=$((ERRORS+1))
fi

if grep -q "repositories {" "$BUILD_GRADLE"; then
    echo "✅ repositories 설정 확인"
else
    echo "❌ repositories 설정 누락"
    ERRORS=$((ERRORS+1))
fi
echo ""

# 5. .easignore 검증
echo "[5/6] .easignore 검증 중..."
if grep -q "^/android/" .easignore && grep -q "^/ios/" .easignore; then
    echo "✅ .easignore 설정 정상 (루트 레벨만 제외)"
else
    echo "⚠️  .easignore 설정 확인 필요"
fi

if grep -q "^\.git/" .easignore; then
    echo "⚠️  .git/ 폴더가 제외되어 있습니다 - 최신 커밋이 반영되지 않을 수 있습니다"
fi
echo ""

# 6. 최근 커밋 확인
echo "[6/6] 최근 커밋 확인..."
echo "현재 HEAD:"
git log -1 --oneline
echo ""

# 최종 결과
echo "======================================"
if [ $ERRORS -eq 0 ]; then
    echo "✅ 모든 검증 통과!"
    echo "======================================"
    echo ""
    echo "EAS 빌드 실행 권장 명령어:"
    echo "  npx eas-cli build --platform android --profile development"
    echo ""
    exit 0
else
    echo "❌ $ERRORS 개의 오류 발견"
    echo "======================================"
    echo "오류를 수정한 후 다시 실행해주세요."
    exit 1
fi
