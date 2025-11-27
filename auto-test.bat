@echo off
echo ===================================
echo Auto Test Script
echo ===================================

REM 1. Wait for app to load
echo.
echo Waiting for app to load...
timeout /t 5 /nobreak >nul

REM 2. Take screenshot
echo.
echo Taking screenshot...
adb shell screencap -p /sdcard/screenshot.png

REM 3. Pull screenshot to PC
echo.
echo Pulling screenshot to PC...
adb pull /sdcard/screenshot.png "D:\OneDrive\코드작업\결과물\screenshot.png"

REM 4. Open screenshot
echo.
echo Opening screenshot...
start "" "D:\OneDrive\코드작업\결과물\screenshot.png"

echo.
echo ===================================
echo Test completed!
echo ===================================
