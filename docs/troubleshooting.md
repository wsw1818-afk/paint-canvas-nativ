# 문제 해결 가이드

## Claude API 에러: 이미지 크기 제한 (5MB)

### 에러 메시지
```
API Error: 400 {"type":"error","error":{"type":"invalid_request_error","message":"messages.50.content.4.image.source.base64: image exceeds 5 MB maximum: 5390616 bytes > 5242880 bytes"}}
```

### 원인
Claude API는 **base64로 인코딩된 이미지의 최대 크기를 5MB로 제한**합니다.
대화 중에 업로드한 스크린샷이나 이미지가 이 제한을 초과하면 전체 대화가 차단됩니다.

### 해결 방법

#### 1. 이미지 업로드 전 압축 (권장)

**Windows에서:**
- 이미지 우클릭 → `편집` → Paint 실행
- `크기 조정` → 50% 또는 1024x1024 이하로 축소
- `파일` → `다른 이름으로 저장` → JPEG 형식 선택

**macOS에서:**
- 이미지 우클릭 → `미리보기로 열기`
- `도구` → `크기 조정` → 1024x1024 이하로 축소
- `파일` → `내보내기` → 품질 70% JPEG

**온라인 도구:**
- [TinyPNG](https://tinypng.com/) - PNG/JPEG 압축
- [Squoosh](https://squoosh.app/) - 고급 이미지 최적화

#### 2. 스크린샷 해상도 줄이기

**Windows:**
- `설정` → `시스템` → `디스플레이` → `배율 및 레이아웃`을 100%로 설정 후 스크린샷

**Android:**
- 일부 기기는 고해상도 스크린샷 생성. 스크린샷 후 이미지 편집 앱에서 크기 조정

#### 3. 큰 이미지는 여러 부분으로 나누기

- 화면의 특정 영역만 캡처
- Windows: `Win + Shift + S` → 영역 선택
- macOS: `Cmd + Shift + 4` → 영역 드래그

### 예방 조치

앱 내에서 생성되는 이미지는 이미 최적화되어 있습니다:
- ✅ 최대 해상도: 1024x1024
- ✅ 포맷: JPEG (70-80% 품질)
- ✅ 예상 파일 크기: 200KB ~ 1MB (5MB 이하)

### 파일 크기 확인

**Windows:**
- 파일 우클릭 → `속성` → 크기 확인 (5,242,880 bytes = 5MB)

**macOS:**
- 파일 우클릭 → `정보 가져오기` → 크기 확인

**명령줄:**
```bash
# Windows (PowerShell)
(Get-Item "이미지경로.png").length

# macOS/Linux
ls -lh 이미지경로.png
```

### 긴급 해결

대화가 차단되었다면:
1. 새 대화 시작
2. 이전 이미지를 압축하여 다시 업로드
3. 컨텍스트 요약하여 새 대화에 붙여넣기
