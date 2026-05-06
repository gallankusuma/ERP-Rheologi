# ERP Manufacturing System - Quick Start Script
# Last Updated: February 4, 2026

Write-Host "🚀 Starting ERP Manufacturing System..." -ForegroundColor Cyan
Write-Host ""

# Check if MySQL is running
Write-Host "📊 Checking MySQL status..." -ForegroundColor Yellow
$mysqlProcess = Get-Process mysqld -ErrorAction SilentlyContinue
if (-not $mysqlProcess) {
    Write-Host "⚠️  MySQL not running. Please start XAMPP MySQL first!" -ForegroundColor Red
    Write-Host "   1. Open XAMPP Control Panel" -ForegroundColor Gray
    Write-Host "   2. Click 'Start' on MySQL module" -ForegroundColor Gray
    Write-Host ""
    Read-Host "Press Enter after starting MySQL"
}

# Check if database exists
Write-Host "🗄️  Checking database..." -ForegroundColor Yellow
$dbExists = & mysql -u root -e "SHOW DATABASES LIKE 'erp_manufacturing';" 2>$null
if (-not $dbExists) {
    Write-Host "📦 Creating database erp_manufacturing..." -ForegroundColor Cyan
    & mysql -u root -e "CREATE DATABASE erp_manufacturing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>$null
    if ($?) {
        Write-Host "✅ Database created successfully!" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to create database. Check MySQL credentials in backend/.env" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ Database already exists" -ForegroundColor Green
}

# Install dependencies if needed
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing root dependencies..." -ForegroundColor Yellow
    npm install
}

if (-not (Test-Path "backend/node_modules")) {
    Write-Host "📦 Installing backend dependencies..." -ForegroundColor Yellow
    Set-Location backend
    npm install
    Set-Location ..
}

if (-not (Test-Path "frontend/node_modules")) {
    Write-Host "📦 Installing frontend dependencies..." -ForegroundColor Yellow
    Set-Location frontend
    npm install
    Set-Location ..
}

Write-Host ""
Write-Host "✅ All dependencies installed!" -ForegroundColor Green
Write-Host ""

# Start servers
Write-Host "🎯 Starting development servers..." -ForegroundColor Cyan
Write-Host "   Backend: http://localhost:3000" -ForegroundColor Gray
Write-Host "   Frontend: http://localhost:5173" -ForegroundColor Gray
Write-Host ""
Write-Host "🔑 Default Login Credentials:" -ForegroundColor Yellow
Write-Host "   Super Admin: master@admin.com / master" -ForegroundColor White
Write-Host "   Regular Admin: admin@erp.local / admin123" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop servers" -ForegroundColor Gray
Write-Host ""

npm run dev
