# Heat Rush 2.0 - Local Development Server

@echo off
cd /d "%~dp0"

echo ========================================
echo   Heat Rush 2.0 - Starting Server
echo ========================================

echo.
echo Installing dependencies if needed...
call npm install

echo.
echo Starting development server...
echo Server will open at http://localhost:5173
echo.

npm run dev

pause