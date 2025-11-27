@echo off
echo ========================================
echo Minimal Restoration (Claude Code Safe)
echo ========================================
echo.
echo This will restore only SMALL files that won't break Claude Code:
echo - .git (29 files) - for version control
echo - .expo (3 files) - for Expo cache
echo - package-lock.json (1 file) - for dependency locking
echo.
echo WILL NOT restore (keeps Claude Code fast):
echo - node_modules (34,247 files) - use "npm install" when needed
echo - android (982 files) - use "npx expo prebuild" when needed
echo.
set /p confirm="Continue? (y/n): "
if /i not "%confirm%"=="y" goto END

echo.
echo Restoring .git...
if exist "..\ColorPlayExpo_BACKUP\git.bak" (
    move "..\ColorPlayExpo_BACKUP\git.bak" ".git" >nul 2>&1
    echo ✓ Git restored
)

echo Restoring .expo...
if exist "..\ColorPlayExpo_BACKUP\.expo.bak" (
    move "..\ColorPlayExpo_BACKUP\.expo.bak" ".expo" >nul 2>&1
    echo ✓ Expo cache restored
)

echo Restoring package-lock.json...
if exist "..\ColorPlayExpo_BACKUP\package-lock.json" (
    move "..\ColorPlayExpo_BACKUP\package-lock.json" "package-lock.json" >nul 2>&1
    echo ✓ package-lock.json restored
)

echo.
echo ========================================
echo Minimal restoration complete!
echo ========================================
echo.
echo You can now:
echo - Use Git commands (git status, commit, push, etc.)
echo - Use Expo commands (after running "npm install")
echo.
echo To install dependencies:
echo   npm install
echo.
echo To build Android:
echo   npx expo prebuild --clean
echo.
echo Claude Code should still work fast!
echo ========================================

:END
echo.
pause
