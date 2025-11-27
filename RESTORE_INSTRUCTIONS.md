# ColorPlayExpo 폴더 복원 가이드

## 현재 상태
VS Code/Claude Code 성능 문제 해결을 위해 대용량 폴더를 임시로 백업했습니다.

### 백업된 폴더
- `node_modules` → `node_modules.bak`
- `android` → `android.bak`

## 작업 재개 시 복원 방법

### 1. node_modules 복원
```bash
# 방법 A: 백업 복원
cd H:\Claude_work\ColorPlayExpo
Rename-Item node_modules.bak node_modules

# 방법 B: 새로 설치 (권장)
npm install
```

### 2. android 폴더 복원
```bash
# 방법 A: 백업 복원
Rename-Item android.bak android

# 방법 B: 새로 생성 (권장)
npx expo prebuild --clean
```

## Claude Code 사용 팁
- **코드 작업 시**: 백업 폴더 그대로 두고 작업 (src/, scripts/ 등만 수정)
- **빌드/테스트 시**: 필요한 폴더만 복원
- **작업 완료 후**: 다시 .bak으로 변경

---
생성일: 2025-11-26
