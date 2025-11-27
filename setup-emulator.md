# Android 에뮬레이터 설정 가이드

## 1. Android Studio 설치 (이미 있다면 스킵)
- https://developer.android.com/studio

## 2. AVD (Android Virtual Device) 생성
```bash
# SDK Manager에서 System Image 다운로드
# Tools > AVD Manager > Create Virtual Device
# Phone > Pixel 6 선택
# System Image > Android 13 (API 33) 선택
```

## 3. 에뮬레이터 실행
```bash
# 명령줄에서 실행
emulator -avd Pixel_6_API_33

# 또는 Android Studio에서 AVD Manager로 실행
```

## 4. 자동화 스크립트 사용
```bash
# 에뮬레이터 실행 후
full-auto.bat
```

## 장점:
- USB 연결 불필요
- 빠른 설치/삭제
- 스크린샷 자동 캡처
- 멀티터치 시뮬레이션 가능

## 단점:
- 초기 설정 필요 (10분)
- PC 리소스 사용 (RAM 4GB+)
