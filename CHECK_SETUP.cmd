@echo off
REM Verify NHRC Hybrid RAG Setup

echo.
echo ====================================
echo NHRC Hybrid RAG - Setup Verification
echo ====================================
echo.

setlocal enabledelayedexpansion

REM Check Node.js
echo [1/5] Checking Node.js...
node --version >nul 2>&1
if !errorlevel! equ 0 (
    echo   ✓ Node.js is installed
    node --version
) else (
    echo   ✗ Node.js is NOT installed
    echo   Please install from: https://nodejs.org/
)

echo.

REM Check npm
echo [2/5] Checking npm...
npm --version >nul 2>&1
if !errorlevel! equ 0 (
    echo   ✓ npm is installed
    npm --version
) else (
    echo   ✗ npm is NOT installed
)

echo.

REM Check index file
echo [3/5] Checking index file...
if exist "data\nhrc_index.json" (
    echo   ✓ Index file exists
    for %%A in (data\nhrc_index.json) do (
        echo   Size: %%~zA bytes
    )
) else (
    echo   ✗ Index file NOT found
    echo   Run: python setup_obsidian_index.py
)

echo.

REM Check web folder
echo [4/5] Checking web folder...
if exist "web\package.json" (
    echo   ✓ Web folder exists
) else (
    echo   ✗ Web folder NOT found
)

if exist "web\node_modules" (
    echo   ✓ node_modules exists
) else (
    echo   ✗ node_modules NOT found
    echo   Run: cd web ^& npm install
)

echo.

REM Check Python
echo [5/5] Checking Python...
python --version >nul 2>&1
if !errorlevel! equ 0 (
    echo   ✓ Python is installed
    python --version
) else (
    echo   ✗ Python is NOT installed (optional)
)

echo.
echo ====================================
echo Setup Verification Complete
echo ====================================
echo.

echo Next steps:
echo   1. Run: START_WEB.cmd
echo   2. Open: http://localhost:3000/knowledge/search
echo   3. Enjoy the app!
echo.

pause
