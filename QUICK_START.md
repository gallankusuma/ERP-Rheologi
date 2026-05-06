# 🚀 Quick Start Guide

## One-Command Setup (Windows)

### Option 1: Double-click (Easiest)
```
Double-click: start.bat
```

### Option 2: PowerShell
```powershell
.\start.ps1
```

### Option 3: Command Prompt
```cmd
start.bat
```

### Option 4: NPM (Alternative)
```bash
npm run dev
```

---

## What It Does

1. ✅ Checks if MySQL is running
2. ✅ Creates `erp_manufacturing` database (if not exists)
3. ✅ Installs all dependencies (root, backend, frontend)
4. ✅ Starts both servers (backend:3000, frontend:5173)
5. ✅ Auto-initializes database schema with seed data

---

## First Time Setup

### 1. Start XAMPP MySQL
- Open XAMPP Control Panel
- Click **Start** on MySQL module
- Wait for green indicator

### 2. Run Start Script
```powershell
.\start.ps1
```

### 3. Open Browser
```
http://localhost:5173
```

## Development Flow

### Edit Backend Code
```typescript
// Edit: backend/src/routes/product.routes.ts
// Auto restart happens, no manual reload needed ✨
```

### Edit Frontend Code
```vue
<!-- Edit: frontend/src/components/Layout.vue -->
<!-- Hot reload updates instantly without page refresh ✨ -->
```

### Change Database
```bash
# Update schema, then reinit
npm run init
# Database reinitializes automatically
```

## Access Points

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/health

## Default Login Credentials

**Super Admin:**
- Email: `master@admin.com`
- Password: `master`

**Regular Admin:**
- Email: `admin@erp.local`
- Password: `admin123`

**⚠️ Change passwords after first login!**

---

## Troubleshooting

### MySQL Not Running
**Error:** `MySQL not running`
**Solution:**
1. Open XAMPP Control Panel
2. Start MySQL module
3. Re-run `start.ps1`

### Port Already in Use
**Error:** `Port 3000 already in use`
**Solution:**
```powershell
# Kill process on port 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Database Connection Failed
**Error:** `ER_ACCESS_DENIED_ERROR`
**Solution:**
- Update `backend/.env` with correct MySQL credentials
- Default XAMPP: user=`root`, password=`` (empty)

---

## Support

For detailed setup: See `MYSQL_SETUP.md`
For migration info: See `MYSQL_MIGRATION_SUMMARY.md`
For project status: See `PROGRESS_STATUS.md`

---

**Ready to build! 🚀**
Password: admin
```

## Other Useful Commands

```bash
npm run setup       # Just run setup without starting servers
npm run dev         # Alternative start (shows more details)
npm run init        # Reinitialize database
npm run build       # Build for production
npm run lint        # Check code quality
npm run format      # Auto-format code
npm run clean       # Remove all node_modules
npm run reinstall   # Clean install from scratch
```

## Stop Everything

Just press `Ctrl + C` in the terminal. Everything shuts down gracefully.

## Troubleshooting

### Port Already in Use
```powershell
# Stop the existing process
netstat -ano | findstr :3000  # Find PID using port 3000
taskkill /PID <PID> /F        # Kill the process
npm start                      # Restart
```

### Database Issues
```bash
npm run init  # Reinitialize database
npm start     # Restart
```

### Everything Broken?
```bash
npm run reinstall  # Clean reinstall everything
npm start          # Start fresh
```

---

**That's all you need to know.** Everything is automated. Happy coding! 🚀
