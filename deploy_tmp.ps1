Write-Host "🚚 Deploying database.js to DEV..." -ForegroundColor Yellow
scp backend/dist/config/database.js root@76.13.22.155:/var/www/erp-rheologi-dev/backend/dist/config/database.js

Write-Host "🔄 Restarting DEV backend process..." -ForegroundColor Yellow
ssh root@76.13.22.155 "pm2 restart erp-rheologi-dev"

Write-Host "----------------------------------" -ForegroundColor Cyan

Write-Host "🚚 Deploying database.js to LIVE..." -ForegroundColor Yellow
scp backend/dist/config/database.js root@76.13.22.155:/var/www/erp-rheologi/backend/dist/config/database.js

Write-Host "🔄 Restarting LIVE backend process..." -ForegroundColor Yellow
ssh root@76.13.22.155 "pm2 restart erp-backend"

Write-Host "✅ DEPLOYMENT FINISHED!" -ForegroundColor Green
