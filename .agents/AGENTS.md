# ERP Rheologi - Project Rules

## UI/Frontend Rules
- All data tables must have sticky headers that follow when scrolling. This is handled globally via `style.css` - do NOT remove the sticky thead CSS rules.
- Font sizes in tables should be `text-sm` for headers and `text-base` (default) for cell content. Avoid using `text-xs` in table cells.
- Table layouts should use full width (`w-full`) without restricting `max-w-*` containers.

## Code Style Rules
- Do NOT use AI-style decorative comment headers like `// ========`, `// ── section ──`, or `// ===== TITLE =====`.
- Use simple lowercase comments like `// helper function` or `// validate input`.
- Do NOT use emojis in `console.log` statements (no ✅, 🔒, 🚀, etc).
- Keep JSDoc blocks short (2-3 lines max).
- Use descriptive variable names that make comments unnecessary.

## Auth & Permission
- `requirePermission` middleware checks `roleId === 1` or `userLevel >= 1` for admin bypass.
- Founder accounts (user_level=1) may have `role_id=NULL` - always check both.
- JWT tokens contain `userId` and `userLevel` only. `roleId` is loaded from DB in `authMiddleware`.

## Deployment
- Backend runs on port 3002 at `/var/www/erp-rheologi/backend/`
- Frontend is pre-built: deploy `dist/` folder to `/var/www/erp-rheologi/frontend/dist/`
- Build backend: `npx tsc --skipLibCheck`
- Build frontend: `npx vite build` (skip `vue-tsc` type checking)
- Server: `76.13.22.155`, PM2 process name: `erp-backend`
