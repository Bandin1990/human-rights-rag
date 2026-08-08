# Start NHRC Hybrid RAG Web Application

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "NHRC Hybrid RAG - Web Application" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

Set-Location "web"

Write-Host "Checking Node.js..." -ForegroundColor Green
node --version
npm --version

Write-Host ""
Write-Host "Starting development server..." -ForegroundColor Green
Write-Host ""
Write-Host "Website will be available at:" -ForegroundColor Yellow
Write-Host "  - Search: http://localhost:3000/knowledge/search" -ForegroundColor White
Write-Host "  - Dashboard: http://localhost:3000/knowledge/dashboard" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

npm run dev
