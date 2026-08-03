#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# ERP Rheologi - One-Click Deploy Script
# Run this on your target Ubuntu server
# Usage: bash deploy.sh
# ═══════════════════════════════════════════════════════════════

set -e

APP_DIR="/var/www/erp-rheologi"
DB_NAME="erp_rheologi"
DB_USER="erp_user"
DB_PASS="ErpSecure2024!"
PORT=3002

echo "═══════════════════════════════════════════"
echo "  ERP Rheologi - Deployment Script"
echo "═══════════════════════════════════════════"

# 1. Install Node.js if not present
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
echo "✅ Node.js: $(node -v)"

# 2. Install PM2 if not present
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    npm install -g pm2
fi
echo "✅ PM2: $(pm2 -v)"

# 3. Install MySQL if not present
if ! command -v mysql &> /dev/null; then
    echo "📦 Installing MySQL..."
    apt-get install -y mysql-server
    systemctl enable mysql
    systemctl start mysql
fi
echo "✅ MySQL: $(mysql --version | head -1)"

# 4. Setup database
echo ""
echo "🗄️  Setting up database..."
mysql -u root <<EOSQL
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
EOSQL

# 5. Import database dump
echo "📥 Importing database backup..."
mysql -u ${DB_USER} -p"${DB_PASS}" ${DB_NAME} < database_backup.sql
echo "✅ Database imported"

# 6. Create app directory
echo ""
echo "📁 Setting up application..."
mkdir -p ${APP_DIR}
cp -r backend ${APP_DIR}/
cp -r frontend ${APP_DIR}/

# 7. Setup backend
echo "📦 Installing backend dependencies..."
cd ${APP_DIR}/backend
cp .env.production .env
npm install --production
echo "✅ Backend ready"

# 8. Setup Nginx (optional - if installed)
if command -v nginx &> /dev/null; then
    echo ""
    echo "🌐 Configuring Nginx..."
    cat > /etc/nginx/sites-available/erp-rheologi <<'NGINX'
server {
    listen 80;
    server_name app.rheologi.id;

    # Frontend static files
    location / {
        root /var/www/erp-rheologi/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # Uploads
    location /uploads/ {
        alias /var/www/erp-rheologi/backend/uploads/;
    }

    client_max_body_size 50M;
}
NGINX
    ln -sf /etc/nginx/sites-available/erp-rheologi /etc/nginx/sites-enabled/
    nginx -t && systemctl reload nginx
    echo "✅ Nginx configured"
fi

# 9. Start with PM2
echo ""
echo "🚀 Starting application..."
cd ${APP_DIR}/backend
pm2 delete erp-backend 2>/dev/null || true
pm2 start dist/index.js --name erp-backend
pm2 save
pm2 startup 2>/dev/null || true

echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ DEPLOYMENT COMPLETE!"
echo "═══════════════════════════════════════════"
echo ""
echo "  Backend:  http://localhost:${PORT}"
echo "  Frontend: Open in browser via Nginx"
echo ""
echo "  PM2 Status: pm2 status"
echo "  PM2 Logs:   pm2 logs erp-backend"
echo ""
