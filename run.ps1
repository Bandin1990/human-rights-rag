# NHRC Hybrid RAG - Setup and Run Script

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "NHRC Hybrid RAG - Auto Setup & Run" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Check index
Write-Host "📊 Checking index..." -ForegroundColor Green
if (-not (Test-Path "data/nhrc_index.json")) {
    Write-Host "❌ Index not found. Creating..." -ForegroundColor Red
    python setup_obsidian_index.py
}

Write-Host ""
Write-Host "📦 Setting up web app..." -ForegroundColor Green
Set-Location "web"

if (-not (Test-Path "node_modules")) {
    Write-Host "📥 Installing dependencies..." -ForegroundColor Yellow
    npm install
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "🚀 Starting development server..." -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Website will be available at:" -ForegroundColor Cyan
Write-Host "  🔍 Search:    http://localhost:3000/knowledge/search" -ForegroundColor White
Write-Host "  📊 Dashboard: http://localhost:3000/knowledge/dashboard" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

npm run dev
