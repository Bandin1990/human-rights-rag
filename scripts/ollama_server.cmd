@echo off
set "PROJECT_ROOT=%~dp0.."
for %%I in ("%PROJECT_ROOT%") do set "PROJECT_ROOT=%%~fI"

set "OLLAMA_DIR=%PROJECT_ROOT%\.tools\ollama"
set "USERPROFILE=%PROJECT_ROOT%\.tools\ollama-home"
set "HOME=%PROJECT_ROOT%\.tools\ollama-home"
set "OLLAMA_MODELS=%PROJECT_ROOT%\.tools\ollama-models"
set "PATH=%OLLAMA_DIR%\lib\ollama;%OLLAMA_DIR%;%PATH%"

if not exist "%USERPROFILE%" mkdir "%USERPROFILE%"
if not exist "%OLLAMA_MODELS%" mkdir "%OLLAMA_MODELS%"

cd /d "%OLLAMA_DIR%"
"%OLLAMA_DIR%\ollama.exe" serve >> "%PROJECT_ROOT%\.tools\ollama-server.log" 2>> "%PROJECT_ROOT%\.tools\ollama-server.err.log"
