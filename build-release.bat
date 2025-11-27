@echo off
echo ====================================
echo ColorPlayExpo RELEASE Build Script
echo ====================================
echo.

echo [1/4] Exporting JavaScript bundle...
call npx expo export:embed --platform android --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --dev false --minify true
if %ERRORLEVEL% NEQ 0 (
    echo Export failed!
    exit /b 1
)

echo.
echo [2/4] Building RELEASE APK (no dev client)...
cd android
call gradlew.bat assembleRelease
if %ERRORLEVEL% NEQ 0 (
    echo Build failed!
    cd ..
    exit /b 1
)
cd ..

echo.
echo [3/4] Checking APK file...
if not exist "android\app\build\outputs\apk\release\app-release.apk" (
    echo APK not found!
    exit /b 1
)

echo.
echo [4/4] Copying APK to results folder...
copy /Y "android\app\build\outputs\apk\release\app-release.apk" "D:\OneDrive\코드작업\결과물\ColorPlayExpo-release.apk"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ====================================
    echo RELEASE Build SUCCESS!
    echo APK Location: D:\OneDrive\코드작업\결과물\ColorPlayExpo-release.apk
    echo ====================================

    REM Show file info
    dir "D:\OneDrive\코드작업\결과물\ColorPlayExpo-release.apk"
) else (
    echo Copy failed!
    exit /b 1
)
