# MEMORY.md (SSOT: 규칙/기술 스택/제약)

## 1) Goal / Scope (정적)
- 목표: Paint by Numbers 스타일 색칠 앱 (사진을 퍼즐로 변환하여 색칠)
- 범위: 이미지 선택/촬영 → 색상 분석 → 퍼즐 생성 → 색칠 플레이 → 갤러리 저장
- Non-goals: 멀티플레이어, 소셜 기능, 클라우드 동기화

## 2) Tech Stack (정적, 캐시 최적화)
- Framework: Expo SDK 54 + React Native 0.81.5 (New Architecture 활성화)
- Language: JavaScript (TypeScript 타입 정의만 devDep)
- State/Networking: React useState/useCallback + AsyncStorage (로컬 저장)
- Backend/DB: 없음 (순수 클라이언트 앱), AsyncStorage + FileSystem
- Build/CI: Expo Dev Client, Gradle (Android), 수동 APK/AAB 빌드
- Target platforms: Android (주력), iOS (지원), Web (미지원)

## 3) Constraints (가끔 변함)
- OS/Node/Java/Gradle/SDK 버전:
  - Node: 18+
  - Java: 17 (Gradle 호환)
  - Android SDK: 34 (targetSdk)
  - Expo SDK: 54
- 빌드/배포 제약:
  - 배포 경로: `D:\OneDrive\코드작업\결과물\ColorPlay\`
  - 키스토어: `android/app/release.keystore` (백업: 결과물/키스토어/)
- 성능/번들 제약:
  - Native Canvas 모듈 사용 (paint-canvas-native)
  - 대용량 이미지 처리 시 메모리 관리 필요
- 금지사항:
  - 정식 AdMob ID를 테스트 기기에서 사용 금지
  - JS/TS 외 네이티브 코드 변경 시 prebuild 필수

## 4) Coding Rules (정적)
- 최소 diff 원칙
- 테스트/수정 루프(최대 3회): lint/typecheck/test 우선
- 비밀정보 금지: 값 금지(변수명/위치만)
- 큰 변경(프레임워크/DB/상태관리 교체)은 사용자 1회 확인 후 진행
- JS/TS 수정은 빌드 불필요 (Hot Reload), Native 코드는 APK 빌드 필수

## 5) Architecture Notes (가끔 변함)
- 폴더 구조 요약:
  ```
  src/
  ├── screens/        # 화면 컴포넌트 (Home, Generate, Play, Gallery, Settings, Help)
  ├── components/     # 재사용 컴포넌트 (TexturePickerModal)
  ├── utils/          # 유틸리티 (puzzleStorage, imageProcessor, adManager, pointsStorage)
  ├── locales/        # 다국어 (ko, en, ja, zh)
  └── theme/          # 스타일 테마 (spotify.js)
  modules/
  └── paint-canvas/   # Native Canvas 모듈 (Kotlin)
  ```
- 주요 모듈 책임:
  - `PlayScreenNativeModule.js`: 메인 게임 화면, Native Canvas 연동
  - `imageProcessor.js`: 이미지 색상 분석 및 영역 분할
  - `puzzleStorage.js`: 퍼즐 CRUD (AsyncStorage)
  - `adManager.js`: Google AdMob 전면 광고 관리
  - `paint-canvas-native`: Kotlin 기반 Canvas 렌더링 (성능 최적화)
- 데이터 흐름:
  1. 이미지 선택 (ImagePicker) → 색상 분석 (imageProcessor)
  2. 퍼즐 생성 → AsyncStorage 저장 (puzzleStorage)
  3. 플레이 화면 → Native Canvas 렌더링 → 진행 상황 저장
  4. 완료 시 캡처 → 갤러리 저장

## 6) Testing / Release Rules (정적)
- 통과 기준(lint/typecheck/test):
  - 현재 테스트 프레임워크 미설정 (향후 Jest 도입 권장)
  - TypeScript 타입 체크: `tsc --noEmit`
- 릴리즈 체크리스트 위치: `.claude/CLAUDE.md` 참고
  - [ ] AdMob ID 정식 ID로 변경
  - [ ] JS 번들 검증 (APK 내 index.android.bundle)
  - [ ] 4가지 캐시 삭제 후 clean 빌드
  - [ ] 결과물 폴더에 복사
