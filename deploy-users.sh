#!/bin/bash
set -e
for D in /var/www/erp /var/www/erp-rheologi; do
  echo "=== Deploying to $D ==="
  cp /tmp/erp-deploy/user.routes.ts "$D/backend/src/routes/user.routes.ts"
  cp /tmp/erp-deploy/database.ts    "$D/backend/src/config/database.ts"
done
echo "=== Restarting pm2 ==="
pm2 restart erp-backend erp-rheologi --update-env
sleep 8
echo "=== Verify users columns ==="
for DB in erp_manufacturing erp_rheologi; do
  echo "--- $DB.users ---"
  mysql -u erp_user -pErpSecure2024! "$DB" -N -e "SHOW COLUMNS FROM users" 2>/dev/null | awk '{print $1}' | grep -E '^(user_level|phone|address)$' || echo "MISSING"
done
echo "=== Health ==="
curl -s http://127.0.0.1:3001/api/health || echo "3001 down"
echo
curl -s http://127.0.0.1:3002/api/health || echo "3002 down"
echo
