@echo off
setlocal enabledelayedexpansion

echo ========================================
echo ColorPlayExpo Mode Switcher
echo ========================================
echo.
echo Current Mode:
if exist "node_modules" (
    echo [FULL MODE] - Build/Run enabled
) else (
    echo [LIGHT MODE] - Code editing only
)
echo.
echo Select mode:
echo 1. Switch to LIGHT MODE (for Claude Code editing)
echo 2. Switch to FULL MODE (for build/run)
echo 3. Exit
echo.
set /p choice="Enter choice (1-3): "

if "%choice%"=="1" goto LIGHT
if "%choice%"=="2" goto FULL
if "%choice%"=="3" goto END
echo Invalid choice
goto END

:LIGHT
echo.
echo Switching to LIGHT MODE...
if exist "node_modules" (
    echo Moving node_modules to backup...
    move "node_modules" "..\ColorPlayExpo_BACKUP\node_modules.bak" >nul 2>&1
)
if exist "android" (
    echo Moving android to backup...
    move "android" "..\ColorPlayExpo_BACKUP\android.bak" >nul 2>&1
)
if exist ".expo" (
    echo Moving .expo to backup...
    move ".expo" "..\ColorPlayExpo_BACKUP\.expo.bak" >nul 2>&1
)
if exist ".git" (
    echo Moving .git to backup...
    move ".git" "..\ColorPlayExpo_BACKUP\git.bak" >nul 2>&1
)
echo.
echo ✓ LIGHT MODE activated
echo ✓ Restart VS Code for best performance
goto END

:FULL
echo.
echo Switching to FULL MODE...
if exist "..\ColorPlayExpo_BACKUP\node_modules.bak" (
    echo Restoring node_modules...
    move "..\ColorPlayExpo_BACKUP\node_modules.bak" "node_modules" >nul 2>&1
)
if exist "..\ColorPlayExpo_BACKUP\android.bak" (
    echo Restoring android...
    move "..\ColorPlayExpo_BACKUP\android.bak" "android" >nul 2>&1
)
if exist "..\ColorPlayExpo_BACKUP\.expo.bak" (
    echo Restoring .expo...
    move "..\ColorPlayExpo_BACKUP\.expo.bak" ".expo" >nul 2>&1
)
if exist "..\ColorPlayExpo_BACKUP\git.bak" (
    echo Restoring .git...
    move "..\ColorPlayExpo_BACKUP\git.bak" ".git" >nul 2>&1
)
echo.
echo ✓ FULL MODE activated
echo ✓ You can now build and run the app
echo.
echo WARNING: Close VS Code before using Claude Code editing
goto END

:END
echo.
pause
