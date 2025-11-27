# ColorPlayExpo 듀얼 모드 사용 가이드

## 문제 상황
전체 파일이 있으면 Claude Code가 "Sussing...", "Ideating..."에서 멈춤

## 해결책: 모드 전환

### LIGHT MODE (현재 상태)
**용도:** Claude Code로 코드 편집
**특징:**
- ✅ VS Code 즉시 로딩
- ✅ Claude Code 빠른 응답
- ❌ 앱 실행 불가
- ❌ 빌드 불가

**파일 상태:**
- 소스 코드만 존재 (63개 파일, 807KB)
- node_modules, android, .git 등 백업됨

### FULL MODE
**용도:** 앱 빌드/실행/테스트
**특징:**
- ✅ npm 명령 실행 가능
- ✅ Expo 실행 가능
- ✅ Android 빌드 가능
- ✅ Git 사용 가능
- ❌ Claude Code 멈춤 (사용 불가)

**파일 상태:**
- 모든 파일 복원 (35,000+ 파일)

## 사용 방법

### 모드 전환 (자동)
```bash
# switch-mode.bat 실행
switch-mode.bat

# 1번: LIGHT MODE로 전환 (Claude Code 편집용)
# 2번: FULL MODE로 전환 (빌드/실행용)
```

### 워크플로우 예시

#### 1. 코드 편집 작업
```bash
# LIGHT MODE로 전환
switch-mode.bat → 1번 선택

# VS Code 재시작
# Claude Code로 코드 편집
```

#### 2. 빌드/테스트 필요 시
```bash
# FULL MODE로 전환
switch-mode.bat → 2번 선택

# 빌드 실행
npm install  # 필요 시
npx expo prebuild --clean
cd android && ./gradlew assembleDebug

# 완료 후 다시 LIGHT MODE로
```

#### 3. Git 커밋 필요 시
```bash
# FULL MODE로 전환
switch-mode.bat → 2번 선택

# Git 작업
git add .
git commit -m "message"
git push

# 완료 후 LIGHT MODE로
```

## 주의사항

⚠️ **VS Code 열린 상태에서 모드 전환 금지**
- 반드시 VS Code 닫고 전환
- 전환 후 VS Code 재시작

⚠️ **FULL MODE에서 Claude Code 사용 금지**
- 멈춤 현상 재발
- 코드 편집은 LIGHT MODE에서만

⚠️ **모드 전환 시 백업 폴더 유지**
- `H:\Claude_work\ColorPlayExpo_BACKUP\` 삭제 금지
- 모든 대용량 파일이 여기 저장됨

## 빠른 참조

| 작업 | 모드 | 명령 |
|------|------|------|
| Claude Code 편집 | LIGHT | - |
| Expo 실행 | FULL | `npx expo start` |
| Android 빌드 | FULL | `cd android && ./gradlew assembleDebug` |
| Git 커밋 | FULL | `git commit` |
| npm 설치 | FULL | `npm install` |

---
생성일: 2025-11-26
