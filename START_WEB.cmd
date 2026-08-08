@echo off
REM Start NHRC Hybrid RAG Web Application

echo.
echo ====================================
echo NHRC Hybrid RAG - Web Application
echo ====================================
echo.

cd web

echo Checking Node.js...
node --version
npm --version

echo.
echo Starting development server...
echo.
echo Website will be available at:
echo   - Search: http://localhost:3000/knowledge/search
echo   - Dashboard: http://localhost:3000/knowledge/dashboard
echo.
echo Press Ctrl+C to stop the server
echo.

npm run dev
