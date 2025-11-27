# ColorPlayExpo - Lightweight Mode (경량 모드)

## 현재 상태
VS Code/Claude Code 성능 최적화를 위해 **모든 대용량 폴더를 백업**했습니다.

## 백업된 폴더 목록

### 루트 폴더
- `node_modules` → `node_modules.bak` (34,247개 파일)
- `android` → `android.bak`
- `.expo` → `.expo.bak`
- `dist` → `dist.bak`
- `.git` → `git.bak` (Git 히스토리)

### modules/paint-canvas 서브모듈
- `modules/paint-canvas/.git` → `git.bak`
- `modules/paint-canvas/android` → `android.bak`
- `modules/paint-canvas/ios` → `ios.bak`

## 이 모드의 장점
✅ VS Code 즉시 로딩
✅ Claude Code "Sussing..." 없이 바로 응답
✅ 소스 코드 편집에만 집중

## 복원 방법

### 전체 복원 (빌드/테스트 필요 시)
```powershell
cd H:\Claude_work\ColorPlayExpo

# 필수 복원
Rename-Item git.bak .git
Rename-Item node_modules.bak node_modules

# 선택 복원 (필요 시)
Rename-Item android.bak android
Rename-Item .expo.bak .expo
Rename-Item dist.bak dist
```

### 부분 복원 (Git만 필요 시)
```powershell
cd H:\Claude_work\ColorPlayExpo
Rename-Item git.bak .git
```

## 권장 워크플로우

### 1. 코드 편집 작업
- 현재 상태 그대로 유지
- src/, scripts/, docs/ 폴더만 작업
- Git 필요 시 `git.bak` → `.git` 변경

### 2. 빌드/테스트 필요 시
- node_modules.bak → node_modules 복원
- 또는 `npm install` 재실행

### 3. 작업 완료 후
- 다시 .bak로 변경 (경량 모드 유지)

---
생성일: 2025-11-26
경량 모드 활성화됨
