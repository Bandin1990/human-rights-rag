@echo off
set "PROJECT_ROOT=%~dp0.."
for %%I in ("%PROJECT_ROOT%") do set "PROJECT_ROOT=%%~fI"

set "PATH=%PROJECT_ROOT%\.venv\Scripts;%PATH%"
cd /d "%PROJECT_ROOT%"
"%PROJECT_ROOT%\.venv\Scripts\python.exe" -m streamlit run app.py --server.headless true --server.address 127.0.0.1 --server.port 8501 --server.fileWatcherType none >> "%PROJECT_ROOT%\.tools\streamlit.log" 2>> "%PROJECT_ROOT%\.tools\streamlit.err.log"
