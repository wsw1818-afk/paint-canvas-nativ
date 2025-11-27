@echo off
echo ===================================
echo Auto Deploy Script
echo ===================================

REM 1. Build APK
echo.
echo [1/4] Building APK...
call android\gradlew.bat -p android assembleDebug
if %ERRORLEVEL% NEQ 0 (
    echo Build failed!
    exit /b 1
)

REM 2. Copy to result folder
echo.
echo [2/4] Copying APK to result folder...
copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "D:\OneDrive\코드작업\결과물\ColorPlayExpo-debug.apk"

REM 3. Uninstall old version
echo.
echo [3/4] Uninstalling old version...
adb uninstall com.anonymous.ColorPlayExpo
timeout /t 2 /nobreak >nul

REM 4. Install new APK
echo.
echo [4/4] Installing new APK...
adb install -r "android\app\build\outputs\apk\debug\app-debug.apk"

REM 5. Launch app
echo.
echo [5/5] Launching app...
adb shell am start -n com.anonymous.ColorPlayExpo/.MainActivity

echo.
echo ===================================
echo Deployment completed!
echo ===================================
