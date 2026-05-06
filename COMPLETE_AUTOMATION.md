# 🤖 Complete Automation Guide

## One Command

```bash
npm start
```

That's literally all you need. Everything else is completely automatic.

---

## What Happens Automatically

```
$ npm start
│
├─ 🔍 Setup Phase
│  ├─ Check dependencies
│  ├─ Verify .env file
│  ├─ Initialize database (if missing)
│  └─ Validate hot-reload setup
│
├─ 🚀 Server Startup
│  ├─ Backend (Port 3000)
│  │  ├─ Connect to database
│  │  ├─ Load all routes
│  │  └─ Watch for file changes
│  │
│  └─ Frontend (Port 5173)
│     ├─ Start Vite dev server
│     ├─ Enable HMR (Hot Module Reload)
│     └─ Setup API proxy
│
├─ ✨ Ready Screen
│  ├─ Show access URLs
│  ├─ Display test credentials
│  └─ Confirm all systems operational
│
└─ 🔄 Auto-Reload Active
   ├─ Backend changes → Auto-restart
   ├─ Frontend changes → Instant HMR
   └─ Styles update → No refresh needed
```

---

## File Watcher Behavior

### Backend Changes
```
You save: backend/src/routes/product.routes.ts
│
└─ File watcher detects
   └─ tsx watch re-transpiles
      └─ Server auto-restarts
         └─ API ready instantly ✨
```

### Frontend Changes  
```
You save: frontend/src/components/Layout.vue
│
└─ Vite watches file
   └─ HMR processes change
      └─ Component updates in browser
         └─ No page refresh ✨
```

### Style Changes
```
You save: frontend/src/style.css
│
└─ Vite detects
   └─ HMR injects styles
      └─ Updated instantly ✨
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Your Browser                     │
│              http://localhost:5173                 │
│  ┌──────────────────────────────────────────────┐  │
│  │          Vue 3 + Tailwind UI                 │  │
│  │  • Real-time updates via HMR                │  │
│  │  • Auto-connected to backend                │  │
│  │  • Instant style reflection                 │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
              ↕ (API & WebSocket)
┌─────────────────────────────────────────────────────┐
│              Backend API Server                     │
│              http://localhost:3000                  │
│  ┌──────────────────────────────────────────────┐  │
│  │       Express + TypeScript                   │  │
│  │  • File watching enabled                    │  │
│  │  • Auto-restart on changes                  │  │
│  │  • Full CORS support                        │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
              ↕ (Database)
┌─────────────────────────────────────────────────────┐
│              SQLite Database                        │
│              backend/database.db                    │
│  ┌──────────────────────────────────────────────┐  │
│  │  • 25 pre-configured tables                 │  │
│  │  • Test users seeded                        │  │
│  │  • Auto-initialized on startup              │  │
│  │  • Ready for development                    │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## Automation Files

### `scripts/setup.js`
Runs automatically before servers start:
- Checks Node.js dependencies
- Creates `.env` if missing
- Initializes database if missing
- Validates hot-reload setup
- Logs everything to `backend/.setup-log`

### `scripts/start.js`
Main orchestrator:
- Calls setup.js
- Starts backend server
- Starts frontend server
- Monitors health
- Shows ready status
- Handles graceful shutdown

### Configuration Files (Auto-Enhanced)
- `package.json` - New npm scripts
- `backend/package.json` - tsx watch enabled
- `frontend/package.json` - Vite HMR enabled
- `frontend/vite.config.ts` - Enhanced with file polling

---

## Commands Available

```bash
# Main commands
npm start              # Start everything (RECOMMENDED)
npm run dev            # Start with setup (alternative)

# Component-specific
npm run dev:backend    # Backend only
npm run dev:frontend   # Frontend only

# Utilities
npm run setup          # Just run setup (no server start)
npm run init           # Reinitialize database
npm run build          # Build for production
npm run lint           # Check code quality
npm run format         # Auto-format code
npm run clean          # Remove node_modules
npm run reinstall      # Full clean install
```

---

## Development Experience

### Before (Manual)
```
Edit code
→ Manual restart backend
→ Manual refresh browser
→ Lost scroll position
→ Re-authenticate
→ Repeat
😫
```

### After (Auto) ✨
```
Edit code
→ File watcher detects
→ Auto-restart backend OR instant HMR
→ Changes reflected immediately
→ State preserved
→ Still authenticated
→ Repeat
😊
```

---

## Access Points

When running (`npm start`):

| What | URL | Purpose |
|------|-----|---------|
| Frontend | http://localhost:5173 | Web interface |
| Backend | http://localhost:3000 | REST API |
| Health | http://localhost:3000/api/health | Status check |

---

## Test Credentials

```
Admin Account:
  Email: admin@test.com
  Password: admin

Manager Account:
  Email: manager@test.com
  Password: manager

Supervisor Account:
  Email: supervisor@test.com
  Password: supervisor

Staff Account:
  Email: staff@test.com
  Password: staff
```

---

## Logs & Debugging

### Setup Log
```bash
# Location
backend/.setup-log

# View contents
cat backend/.setup-log

# Contains all setup information
```

### Console Output
All real-time logs output to terminal:
- Backend startup messages
- API requests
- Frontend compilation
- HMR updates
- Errors and warnings

---

## Stopping

```bash
# Press Ctrl+C in terminal
# Or
taskkill /F /IM node.exe  # Windows force kill

# Graceful shutdown
- Backend stops cleanly
- Database connection closes
- Frontend dev server stops
- All processes terminate
```

---

## Troubleshooting

### Issue: "Port already in use"
```bash
# Find & kill process
netstat -ano | findstr :3000
taskkill /PID <PID> /F
npm start
```

### Issue: "Database locked"
```bash
# Reinitialize
npm run init
npm start
```

### Issue: "Hot reload not working"
```bash
# Clear caches
rm -rf frontend/.vite backend/node_modules/.cache
npm start
```

### Issue: "Dependencies missing"
```bash
# Reinstall everything
npm run reinstall
npm start
```

### Issue: "Can't connect to backend"
```bash
# Check backend is running
curl http://localhost:3000/api/health

# If not, restart
npm start
```

---

## Performance

### Backend Hot Reload
- **Restart time**: ~1-2 seconds
- **Trigger**: Any .ts file change
- **Includes**: Route changes, logic updates

### Frontend HMR
- **Update time**: < 100ms
- **Trigger**: Any .vue, .ts, .css change
- **Preserves**: Component state, scroll position

### Database
- **Auto-init**: ~500ms (first time only)
- **Queries**: Standard SQLite performance
- **Transactions**: Full ACID support

---

## What's NOT Automatic

- 🔴 Closing files in editor (manual)
- 🔴 Deleting source files (manual)
- 🔴 NPM package changes (manual: run npm install)
- 🔴 Environment variable changes (.env) (requires restart)
- 🔴 Database schema changes (manual: edit + npm run init)

---

## Production Note

This automation is **development-only**. For production:
1. Remove tsx watch (compile to JS)
2. Disable HMR
3. Use production database
4. Change JWT_SECRET
5. Enable HTTPS
6. Deploy built bundle

---

## Summary

| Aspect | Status |
|--------|--------|
| Auto setup | ✅ Enabled |
| Auto database init | ✅ Enabled |
| Backend auto-reload | ✅ Enabled (tsx watch) |
| Frontend HMR | ✅ Enabled (Vite) |
| File watching | ✅ Enabled (polling) |
| Proxy to backend | ✅ Enabled |
| Health checks | ✅ Enabled |
| Graceful shutdown | ✅ Enabled |
| Setup logging | ✅ Enabled |

**Everything is automated and ready.** 🚀

Just run:
```bash
npm start
```

And start coding!
