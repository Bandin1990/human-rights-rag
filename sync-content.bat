@echo off
REM Double-click this after adding/editing files in the Obsidian vault to
REM push the changes into the website. Does the two steps that were
REM previously two separate manual commands in two different folders:
REM   1) rebuild data/nhrc_index.json, nhrc_content/, nhrc_graph.json from
REM      the vault (python)
REM   2) backfill Gemini embeddings for any new/changed document so AI
REM      search can actually find it (node, in web/)
REM Safe to run any time - both steps skip/overwrite cleanly, nothing gets
REM duplicated by running this more than once.

cd /d "%~dp0"
set PYTHONIOENCODING=utf-8

echo ============================================
echo   1/2  Rebuilding the search index from Obsidian...
echo ============================================
python setup_obsidian_index.py
if errorlevel 1 (
    echo.
    echo ** Step 1 failed - see the error above. Step 2 was skipped. **
    pause
    exit /b 1
)

echo.
echo ============================================
echo   2/2  Updating AI search (embeddings)...
echo ============================================
cd web
node scripts/embed-nhrc-documents.mjs
cd ..

echo.
echo ============================================
echo   Done. Restart the local dev server (or wait
echo   for the next production deploy) to see the changes.
echo ============================================
pause
