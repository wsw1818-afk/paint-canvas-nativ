@echo off
echo ===================================
echo Full Auto Deploy and Test
echo ===================================

REM 1. Build
echo.
echo [1/6] Building APK...
call android\gradlew.bat -p android assembleDebug
if %ERRORLEVEL% NEQ 0 (
    echo Build failed!
    exit /b 1
)

REM 2. Copy
echo.
echo [2/6] Copying APK...
copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "D:\OneDrive\코드작업\결과물\ColorPlayExpo-debug.apk"

REM 3. Uninstall
echo.
echo [3/6] Uninstalling old version...
adb uninstall com.anonymous.ColorPlayExpo
timeout /t 2 /nobreak >nul

REM 4. Install
echo.
echo [4/6] Installing new APK...
adb install -r "android\app\build\outputs\apk\debug\app-debug.apk"

REM 5. Launch
echo.
echo [5/6] Launching app...
adb shell am start -n com.anonymous.ColorPlayExpo/.MainActivity

REM 6. Wait and screenshot
echo.
echo [6/6] Waiting 5 seconds and taking screenshot...
timeout /t 5 /nobreak >nul
adb shell screencap -p /sdcard/screenshot.png
adb pull /sdcard/screenshot.png "D:\OneDrive\코드작업\결과물\screenshot_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%.png"
start "" "D:\OneDrive\코드작업\결과물\"

echo.
echo ===================================
echo All done! Check the screenshot.
echo ===================================
