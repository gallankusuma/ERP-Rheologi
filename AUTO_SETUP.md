# 🚀 Auto Setup Guide

This ERP Manufacturing System now has complete automation for development setup and auto-reload.

## Quick Start (All Automatic)

### Option 1: Full Auto (Recommended) ⭐
```bash
npm start
```
This single command will:
- ✅ Check dependencies
- ✅ Initialize database (if needed)
- ✅ Start backend with auto-reload
- ✅ Start frontend with hot-reload
- ✅ Show you when everything is ready

### Option 2: Traditional Development
```bash
npm run dev
```
Same as above but you see more startup details.

## Available Commands

| Command | Description |
|---------|-------------|
| `npm start` | Auto-start everything (Full automation) |
| `npm run dev` | Start with setup check + auto-reload |
| `npm run setup` | Just run setup (db init + checks) |
| `npm run init` | Only initialize database |
| `npm run build` | Build frontend for production |
| `npm run lint` | Check code quality |
| `npm run format` | Auto-format all code |
| `npm run clean` | Remove all node_modules |
| `npm run reinstall` | Clean install from scratch |

## Auto Features Enabled

### Backend (Port 3000)
- **File Watching**: Automatically restarts on code changes
- **Hot Reload**: Changes reflected instantly
- **Auto Init**: Database initializes if missing
- **Health Check**: API ready notification

### Frontend (Port 5173)  
- **HMR (Hot Module Reload)**: Vue components update without refresh
- **Fast Refresh**: Styles update instantly
- **Auto Proxy**: All `/api/*` calls forward to backend
- **File Watching**: Polls for file changes automatically

## Access Points

Once everything starts:
- 📱 **Frontend**: http://localhost:5173
- 🔌 **Backend API**: http://localhost:3000
- 📊 **API Health**: http://localhost:3000/api/health

## Default Test Users

Auto-initialized in database:
```
Email: admin@test.com
Password: admin
Role: Administrator

Email: manager@test.com
Password: manager
Role: Manager

Email: supervisor@test.com
Password: supervisor
Role: Supervisor

Email: staff@test.com
Password: staff
Role: Staff
```

## What Happens on First Run

1. **Setup Script Runs**
   - Checks Node.js dependencies
   - Creates `.env` if missing
   - Initializes SQLite database
   - Verifies hot-reload setup

2. **Backend Starts**
   - Connects to database
   - Starts Express server
   - Loads all API routes
   - Watches for file changes

3. **Frontend Starts**
   - Vite dev server boots
   - Sets up HMR connection
   - Configures API proxy
   - Ready for hot updates

4. **Ready Screen**
   - Shows access URLs
   - Confirms all systems operational
   - Lists test credentials

## Development Workflow

### Making Backend Changes
```typescript
// Edit: backend/src/routes/product.routes.ts
// Result: Server auto-restarts, no refresh needed
```

### Making Frontend Changes
```vue
<!-- Edit: frontend/src/components/Layout.vue -->
<!-- Result: Hot reload updates component instantly, no full refresh -->
```

### Database Changes
```sql
/* Edit: backend/database/schema.sql */
/* Run: npm run init */
/* Database reinitializes with new schema */
```

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000 (backend)
npx kill-port 3000

# Kill process on port 5173 (frontend)
npx kill-port 5173

# Then restart
npm start
```

### Database Locked
```bash
# Reinitialize database
npm run init
```

### Dependencies Issues
```bash
# Clean reinstall
npm run reinstall

# Then start
npm start
```

### Hot Reload Not Working
```bash
# Clear Vite cache
rm -rf frontend/.vite

# Restart
npm start
```

## Environment Variables

Created automatically in `backend/.env`:
```env
PORT=3000
NODE_ENV=development
DB_PATH=./database.db
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
API_URL=http://localhost:3000
```

Change these as needed, then restart.

## Production Build

```bash
npm run build
```

Creates optimized build in `frontend/dist/`

## Notes

- 🔄 All auto-reload works in development only
- 🔐 Change JWT_SECRET before deploying to production
- 📝 Setup logs saved to `backend/.setup-log`
- 🛑 Press `Ctrl+C` to stop all servers gracefully

That's it! Everything is automated. Enjoy! 🎉
