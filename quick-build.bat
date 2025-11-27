@echo off
cd android
call gradlew.bat assembleDebug
if %ERRORLEVEL% EQU 0 (
    copy /Y "app\build\outputs\apk\debug\app-debug.apk" "D:\OneDrive\코드작업\결과물\ColorPlayExpo-debug.apk"
    echo Build completed successfully!
) else (
    echo Build failed!
)
