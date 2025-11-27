# Claude Code 사용 팁

## API 5MB 제한 관련

### 문제 상황
```
API Error: 400 {"type":"error","error":{"type":"invalid_request_error","message":"messages.46.content.9.image.source.base64: image exceeds 5 MB maximum: 6096280 bytes > 5242880 bytes"}}
```

### 원인
- Claude Code가 읽은 **이미지 파일**이 5MB를 초과
- 대화 컨텍스트에 누적된 스크린샷/이미지가 너무 큼

### 해결 방법
1. **세션 클리어**: `/clear` 명령으로 대화 히스토리 초기화
2. **이미지 최적화**:
   - 스크린샷은 필요한 영역만 캡처
   - PNG → JPG 변환으로 용량 줄이기
   - 이미지 압축 도구 사용
3. **대용량 이미지 직접 읽기 피하기**:
   - 이미지 메타데이터만 확인할 때는 파일 크기/타입만 체크
   - 필요시 이미지를 다운샘플링한 버전으로 미리 변환

### 예방
- 갤러리 기능 개발 시 **썸네일 생성**을 기본으로 구현
- 원본 이미지는 저장만 하고, UI/분석에는 썸네일 사용
- 이미지 파일 읽기 전 크기 체크:
  ```javascript
  const stats = await FileSystem.getInfoAsync(uri);
  if (stats.size > 3 * 1024 * 1024) { // 3MB
    console.warn('이미지가 너무 큽니다. 썸네일을 사용하세요.');
  }
  ```

### 권장 이미지 크기
- **썸네일**: 200x200px, < 100KB
- **미리보기**: 800x800px, < 500KB
- **원본**: 필요시만 로드, 5MB 이하로 제한
