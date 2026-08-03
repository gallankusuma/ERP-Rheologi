# =============================================================
# ERP Rheologi — Full Backup Script (Code + Database)
# =============================================================
# Usage: .\backup.ps1
# Creates: backup\ERP-backup-YYYYMMDD-HHMM.zip
# =============================================================

$ErrorActionPreference = "Continue"
$timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$backupDir = "backup"
$backupName = "ERP-backup-$timestamp"
$backupPath = "$backupDir\$backupName"

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " ERP Rheologi - Full Backup" -ForegroundColor Cyan
Write-Host " $timestamp" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Create backup directory
if (!(Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir | Out-Null }
if (!(Test-Path $backupPath)) { New-Item -ItemType Directory -Path $backupPath | Out-Null }
if (!(Test-Path "$backupPath\database")) { New-Item -ItemType Directory -Path "$backupPath\database" | Out-Null }

# ----- STEP 1: Dump databases from server -----
Write-Host "[1/4] Dumping databases from server..." -ForegroundColor Yellow

Write-Host "  -> DEV database (erp_rheologi_dev)..." -ForegroundColor Gray
ssh root@76.13.22.155 "mysqldump -u erp_user -p'ErpSecure2024!' --single-transaction --routines --triggers erp_rheologi_dev > /tmp/erp_rheologi_dev_$timestamp.sql 2>/dev/null"
scp root@76.13.22.155:/tmp/erp_rheologi_dev_$timestamp.sql "$backupPath\database\erp_rheologi_dev.sql"
ssh root@76.13.22.155 "rm -f /tmp/erp_rheologi_dev_$timestamp.sql"
Write-Host "  [OK] DEV database dumped" -ForegroundColor Green

Write-Host "  -> LIVE database (erp_rheologi)..." -ForegroundColor Gray
ssh root@76.13.22.155 "mysqldump -u erp_user -p'ErpSecure2024!' --single-transaction --routines --triggers erp_rheologi > /tmp/erp_rheologi_$timestamp.sql 2>/dev/null"
scp root@76.13.22.155:/tmp/erp_rheologi_$timestamp.sql "$backupPath\database\erp_rheologi.sql"
ssh root@76.13.22.155 "rm -f /tmp/erp_rheologi_$timestamp.sql"
Write-Host "  [OK] LIVE database dumped" -ForegroundColor Green

# ----- STEP 2: Copy server config files -----
Write-Host ""
Write-Host "[2/4] Backing up server config files..." -ForegroundColor Yellow

if (!(Test-Path "$backupPath\server-config")) { New-Item -ItemType Directory -Path "$backupPath\server-config" | Out-Null }
if (!(Test-Path "$backupPath\server-config\dev")) { New-Item -ItemType Directory -Path "$backupPath\server-config\dev" | Out-Null }
if (!(Test-Path "$backupPath\server-config\live")) { New-Item -ItemType Directory -Path "$backupPath\server-config\live" | Out-Null }

scp root@76.13.22.155:/var/www/erp-rheologi-dev/backend/.env "$backupPath\server-config\dev\.env" 2>$null
scp root@76.13.22.155:/var/www/erp-rheologi/backend/.env "$backupPath\server-config\live\.env" 2>$null
Write-Host "  [OK] Server .env files backed up" -ForegroundColor Green

# ----- STEP 3: Copy source code -----
Write-Host ""
Write-Host "[3/4] Copying source code..." -ForegroundColor Yellow

# Copy backend source
Copy-Item -Path "backend\src" -Destination "$backupPath\backend\src" -Recurse -Force
Copy-Item -Path "backend\dist" -Destination "$backupPath\backend\dist" -Recurse -Force
Copy-Item -Path "backend\package.json" -Destination "$backupPath\backend\package.json" -Force
Copy-Item -Path "backend\package-lock.json" -Destination "$backupPath\backend\package-lock.json" -Force -ErrorAction SilentlyContinue
Copy-Item -Path "backend\tsconfig.json" -Destination "$backupPath\backend\tsconfig.json" -Force

# Copy frontend source
Copy-Item -Path "frontend\src" -Destination "$backupPath\frontend\src" -Recurse -Force
Copy-Item -Path "frontend\dist" -Destination "$backupPath\frontend\dist" -Recurse -Force
Copy-Item -Path "frontend\public" -Destination "$backupPath\frontend\public" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item -Path "frontend\package.json" -Destination "$backupPath\frontend\package.json" -Force
Copy-Item -Path "frontend\package-lock.json" -Destination "$backupPath\frontend\package-lock.json" -Force -ErrorAction SilentlyContinue
Copy-Item -Path "frontend\tsconfig.json" -Destination "$backupPath\frontend\tsconfig.json" -Force -ErrorAction SilentlyContinue
Copy-Item -Path "frontend\tsconfig.app.json" -Destination "$backupPath\frontend\tsconfig.app.json" -Force -ErrorAction SilentlyContinue
Copy-Item -Path "frontend\tsconfig.node.json" -Destination "$backupPath\frontend\tsconfig.node.json" -Force -ErrorAction SilentlyContinue
Copy-Item -Path "frontend\vite.config.ts" -Destination "$backupPath\frontend\vite.config.ts" -Force -ErrorAction SilentlyContinue
Copy-Item -Path "frontend\index.html" -Destination "$backupPath\frontend\index.html" -Force -ErrorAction SilentlyContinue

# Copy deploy scripts and other root files
Copy-Item -Path "deploy.sh" -Destination "$backupPath\deploy.sh" -Force -ErrorAction SilentlyContinue
Copy-Item -Path "deploy_tmp.ps1" -Destination "$backupPath\deploy_tmp.ps1" -Force -ErrorAction SilentlyContinue
Copy-Item -Path "start.ps1" -Destination "$backupPath\start.ps1" -Force -ErrorAction SilentlyContinue
Copy-Item -Path "CREDENTIALS.txt" -Destination "$backupPath\CREDENTIALS.txt" -Force -ErrorAction SilentlyContinue
Copy-Item -Path "README_DEPLOY.md" -Destination "$backupPath\README_DEPLOY.md" -Force -ErrorAction SilentlyContinue

# Copy migrations
if (Test-Path "backend\migrations") {
    Copy-Item -Path "backend\migrations" -Destination "$backupPath\backend\migrations" -Recurse -Force
}

Write-Host "  [OK] Source code copied" -ForegroundColor Green

# ----- STEP 4: Create ZIP archive -----
Write-Host ""
Write-Host "[4/4] Creating ZIP archive..." -ForegroundColor Yellow

$zipPath = "$backupDir\$backupName.zip"
Compress-Archive -Path "$backupPath\*" -DestinationPath $zipPath -Force
Write-Host "  [OK] Archive created: $zipPath" -ForegroundColor Green

# Calculate sizes
$zipSize = (Get-Item $zipPath).Length / 1MB
$dbDevSize = if (Test-Path "$backupPath\database\erp_rheologi_dev.sql") { (Get-Item "$backupPath\database\erp_rheologi_dev.sql").Length / 1MB } else { 0 }
$dbLiveSize = if (Test-Path "$backupPath\database\erp_rheologi.sql") { (Get-Item "$backupPath\database\erp_rheologi.sql").Length / 1MB } else { 0 }

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host " BACKUP COMPLETE!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host " Archive : $zipPath" -ForegroundColor White
Write-Host " Size    : $([math]::Round($zipSize, 2)) MB" -ForegroundColor White
Write-Host " DB DEV  : $([math]::Round($dbDevSize, 2)) MB" -ForegroundColor White
Write-Host " DB LIVE : $([math]::Round($dbLiveSize, 2)) MB" -ForegroundColor White
Write-Host ""
Write-Host " To restore, run: .\restore.ps1 -BackupZip `"$zipPath`"" -ForegroundColor Cyan
Write-Host ""
