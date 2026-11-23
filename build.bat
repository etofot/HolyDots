# Heat Rush 2.0 - Build for Production

@echo off
cd /d "%~dp0"

echo ========================================
echo   Heat Rush 2.0 - Production Build
echo ========================================

echo.
echo Installing dependencies if needed...
call npm install

echo.
echo Building project...
call npm run build

echo.
echo Build complete! Files are in the 'dist' folder.
echo To serve locally, use: npx serve dist
echo.

pause