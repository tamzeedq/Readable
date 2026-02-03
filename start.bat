@echo off
REM ReadFlow App Quick Start Script for Windows

cls
echo.
echo  ======================================
echo  ReadFlow - Speed Reading App
echo  ======================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed. Please install Node.js 18+
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Node.js %NODE_VERSION%
echo.

REM Install dependencies if needed
if not exist "node_modules" (
    echo [*] Installing dependencies...
    call npm install
    echo.
)

echo [*] Starting development server...
echo     The app will open in a window shortly...
echo.
echo Keyboard Shortcuts:
echo     Space      - Play/Pause/Resume
echo     Left/Right - Seek word back/forward
echo     +/-        - Adjust speed
echo     Ctrl+S     - Settings
echo.
echo ======================================
echo.

call npm run tauri dev
pause
