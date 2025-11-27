@echo off
echo ================================================
echo Quick Deploy: Build + Copy + Install
echo ================================================

echo.
echo [1/3] Building APK...
cd android
call gradlew.bat assembleDebug
if %errorlevel% neq 0 (
    echo Build FAILED!
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo [2/3] Copying APK to results folder...
copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "D:\OneDrive\코드작업\결과물\ColorPlayExpo-debug.apk"

echo.
echo [3/3] Installing to device...
adb install -r "D:\OneDrive\코드작업\결과물\ColorPlayExpo-debug.apk"

echo.
echo ================================================
echo Deploy Complete! Launch the app on your device.
echo ================================================
pause
