# =============================================================
# ERP Rheologi — Restore Script
# =============================================================
# Usage: .\restore.ps1 -BackupZip "backup\ERP-backup-XXXXXXXX-XXXX.zip"
#
# Options:
#   -BackupZip     Path to the backup ZIP file
#   -Target        "dev" | "live" | "both" (default: dev)
#   -SkipDB        Skip database restore (code only)
#   -SkipCode      Skip code deploy (database only)
#
# Examples:
#   .\restore.ps1 -BackupZip "backup\ERP-backup-20260623-1015.zip"
#   .\restore.ps1 -BackupZip "backup\ERP-backup-20260623-1015.zip" -Target both
#   .\restore.ps1 -BackupZip "backup\ERP-backup-20260623-1015.zip" -SkipDB
# =============================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupZip,
    
    [ValidateSet("dev", "live", "both")]
    [string]$Target = "dev",
    
    [switch]$SkipDB,
    [switch]$SkipCode
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $BackupZip)) {
    Write-Host "ERROR: Backup file not found: $BackupZip" -ForegroundColor Red
    exit 1
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$extractPath = "backup\_restore_temp_$timestamp"

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " ERP Rheologi - RESTORE" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " Source : $BackupZip" -ForegroundColor White
Write-Host " Target : $Target" -ForegroundColor White
Write-Host " DB     : $(if ($SkipDB) { 'SKIP' } else { 'YES' })" -ForegroundColor White
Write-Host " Code   : $(if ($SkipCode) { 'SKIP' } else { 'YES' })" -ForegroundColor White
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Confirm
$confirm = Read-Host "Are you sure you want to restore? This will OVERWRITE current deployment (Y/N)"
if ($confirm -ne "Y" -and $confirm -ne "y") {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 0
}

# Extract backup
Write-Host "[1/4] Extracting backup..." -ForegroundColor Yellow
Expand-Archive -Path $BackupZip -DestinationPath $extractPath -Force
Write-Host "  [OK] Extracted" -ForegroundColor Green

# ----- Restore Database -----
if (!$SkipDB) {
    Write-Host ""
    Write-Host "[2/4] Restoring database..." -ForegroundColor Yellow
    
    if ($Target -eq "dev" -or $Target -eq "both") {
        $devDump = "$extractPath\database\erp_rheologi_dev.sql"
        if (Test-Path $devDump) {
            Write-Host "  -> Restoring DEV database (erp_rheologi_dev)..." -ForegroundColor Gray
            scp $devDump root@76.13.22.155:/tmp/restore_dev.sql
            ssh root@76.13.22.155 "mysql -u erp_user -p'ErpSecure2024!' erp_rheologi_dev < /tmp/restore_dev.sql && rm -f /tmp/restore_dev.sql"
            Write-Host "  [OK] DEV database restored" -ForegroundColor Green
        } else {
            Write-Host "  [WARN] DEV database dump not found in backup" -ForegroundColor Yellow
        }
    }
    
    if ($Target -eq "live" -or $Target -eq "both") {
        $liveDump = "$extractPath\database\erp_rheologi.sql"
        if (Test-Path $liveDump) {
            Write-Host "  -> Restoring LIVE database (erp_rheologi)..." -ForegroundColor Gray
            Write-Host "  !! WARNING: You are restoring the PRODUCTION database !!" -ForegroundColor Red
            $confirmLive = Read-Host "  Type 'RESTORE-LIVE' to confirm"
            if ($confirmLive -eq "RESTORE-LIVE") {
                scp $liveDump root@76.13.22.155:/tmp/restore_live.sql
                ssh root@76.13.22.155 "mysql -u erp_user -p'ErpSecure2024!' erp_rheologi < /tmp/restore_live.sql && rm -f /tmp/restore_live.sql"
                Write-Host "  [OK] LIVE database restored" -ForegroundColor Green
            } else {
                Write-Host "  [SKIP] LIVE database restore cancelled" -ForegroundColor Yellow
            }
        } else {
            Write-Host "  [WARN] LIVE database dump not found in backup" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "[2/4] Skipping database restore" -ForegroundColor Gray
}

# ----- Restore Code -----
if (!$SkipCode) {
    Write-Host ""
    Write-Host "[3/4] Deploying code to server..." -ForegroundColor Yellow
    
    if ($Target -eq "dev" -or $Target -eq "both") {
        Write-Host "  -> Deploying to DEV server..." -ForegroundColor Gray
        if (Test-Path "$extractPath\backend\dist") {
            scp -r "$extractPath\backend\dist\*" root@76.13.22.155:/var/www/erp-rheologi-dev/backend/dist/
        }
        if (Test-Path "$extractPath\frontend\dist") {
            scp -r "$extractPath\frontend\dist\*" root@76.13.22.155:/var/www/erp-rheologi-dev/frontend/dist/
        }
        Write-Host "  [OK] DEV code deployed" -ForegroundColor Green
    }
    
    if ($Target -eq "live" -or $Target -eq "both") {
        Write-Host "  -> Deploying to LIVE server..." -ForegroundColor Gray
        if (Test-Path "$extractPath\backend\dist") {
            scp -r "$extractPath\backend\dist\*" root@76.13.22.155:/var/www/erp-rheologi/backend/dist/
        }
        if (Test-Path "$extractPath\frontend\dist") {
            scp -r "$extractPath\frontend\dist\*" root@76.13.22.155:/var/www/erp-rheologi/frontend/dist/
        }
        Write-Host "  [OK] LIVE code deployed" -ForegroundColor Green
    }
    
    # Restart PM2
    Write-Host ""
    Write-Host "[4/4] Restarting server processes..." -ForegroundColor Yellow
    if ($Target -eq "dev" -or $Target -eq "both") {
        ssh root@76.13.22.155 "pm2 restart erp-rheologi-dev"
    }
    if ($Target -eq "live" -or $Target -eq "both") {
        ssh root@76.13.22.155 "pm2 restart erp-backend"
    }
    Write-Host "  [OK] PM2 restarted" -ForegroundColor Green
} else {
    Write-Host "[3/4] Skipping code deploy" -ForegroundColor Gray
    Write-Host "[4/4] Skipping PM2 restart" -ForegroundColor Gray
}

# Cleanup
Remove-Item -Path $extractPath -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host " RESTORE COMPLETE!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
