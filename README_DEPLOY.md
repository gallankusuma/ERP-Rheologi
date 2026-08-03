# ERP Rheologi - Backup & Deployment Guide

## 📦 Contents

```
ERP/
├── backend/                 # Backend source + compiled
│   ├── src/                 # TypeScript source code
│   ├── dist/                # Compiled JavaScript (ready to run)
│   ├── .env.production      # Production environment config
│   ├── package.json         # Dependencies
│   └── uploads/             # Uploaded files
├── frontend/
│   ├── src/                 # Vue.js source code
│   ├── dist/                # Built static files (ready to serve)
│   └── package.json         # Dependencies
├── database_backup.sql      # Full database dump (schema + data)
├── deploy.sh                # One-click deploy script for Ubuntu
└── README_DEPLOY.md         # This file
```

## 🚀 Quick Deploy (Ubuntu Server)

### Option 1: One-Click Script
```bash
# Upload this entire folder to your server, then:
chmod +x deploy.sh
sudo bash deploy.sh
```

### Option 2: Manual Setup

#### 1. Database
```bash
# Create database
mysql -u root -e "CREATE DATABASE erp_rheologi CHARACTER SET utf8mb4;"
mysql -u root -e "CREATE USER 'erp_user'@'localhost' IDENTIFIED BY 'ErpSecure2024!';"
mysql -u root -e "GRANT ALL ON erp_rheologi.* TO 'erp_user'@'localhost';"

# Import data
mysql -u erp_user -p'ErpSecure2024!' erp_rheologi < database_backup.sql
```

#### 2. Backend
```bash
cd backend
cp .env.production .env
npm install --production
pm2 start dist/index.js --name erp-backend
```

#### 3. Frontend
Frontend sudah di-build (`frontend/dist/`). Tinggal serve via Nginx:
```nginx
location / {
    root /path/to/frontend/dist;
    try_files $uri $uri/ /index.html;
}
location /api/ {
    proxy_pass http://127.0.0.1:3002;
}
```

## 🔧 Development (Local)

### Backend
```bash
cd backend
cp .env.production .env   # Edit DB credentials as needed
npm install
npm run dev               # Runs on port 3002
```

### Frontend
```bash
cd frontend
npm install
npm run dev               # Runs on port 5173 with HMR
```

### Build for Production
```bash
cd frontend && npm run build    # Output: frontend/dist/
cd backend && npx tsc --outDir dist  # Output: backend/dist/
```

## 📋 Tech Stack
- **Frontend**: Vue 3 + TypeScript + Tailwind CSS + Vite
- **Backend**: Express.js + TypeScript + MySQL
- **Database**: MySQL 8.0
- **Process Manager**: PM2
- **Web Server**: Nginx (reverse proxy)

## 🔑 Environment Variables (.env)
| Variable | Description |
|----------|-------------|
| PORT | Backend port (default: 3002) |
| DB_HOST | MySQL host |
| DB_USER | MySQL username |
| DB_PASSWORD | MySQL password |
| DB_NAME | Database name |
| JWT_SECRET | JWT signing secret |
| OPENAI_API_KEY | OpenAI API key (for AI Price Check) |
| GEMINI_API_KEY | Gemini API key (for AI Price Check) |

## 📅 Backup Date
- **Date**: 2026-06-02
- **Source**: app.rheologi.id (Production)
