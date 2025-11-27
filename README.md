# ColorPlayExpo

Paint by Numbers 스타일의 색칠 퍼즐 앱

## 주요 기능

- 갤러리/카메라에서 이미지 선택
- AI 기반 색상 분석 및 격자 생성
- 3가지 난이도 (쉬움/보통/어려움)
- 네이티브 터치 성능 최적화
- 줌/팬 제스처 지원

## 기술 스택

- React Native + Expo
- Kotlin Native Module (PaintCanvas)
- K-means 색상 클러스터링
- Expo Image Manipulator

## 설치 및 실행

```bash
# 의존성 설치
npm install

# Android 빌드 (디버그)
npx expo run:android

# APK 생성
cd android
./gradlew assembleDebug
```

빌드 후 APK는 자동으로 `D:\OneDrive\코드작업\결과물\`에 복사됩니다.

## 문제 해결

### Claude API 이미지 크기 제한 에러

Claude와 대화 중 이미지 업로드 시 5MB 제한 에러가 발생할 수 있습니다:

```
API Error: 400 ... image exceeds 5 MB maximum
```

**해결 방법:**
1. 스크린샷/이미지를 1024x1024 이하로 리사이즈
2. JPEG 형식으로 저장 (70-80% 품질)
3. 온라인 압축 도구 사용: [TinyPNG](https://tinypng.com/), [Squoosh](https://squoosh.app/)

자세한 내용은 [docs/troubleshooting.md](docs/troubleshooting.md)를 참조하세요.

## 프로젝트 구조

```
ColorPlayExpo/
├── src/
│   ├── screens/        # 화면 컴포넌트
│   └── utils/          # 이미지 처리 유틸
├── modules/
│   └── paint-canvas/   # 네이티브 모듈 (Kotlin)
├── docs/               # 문서
└── android/            # Android 프로젝트
```

## 라이선스

MIT
