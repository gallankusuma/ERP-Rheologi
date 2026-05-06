# ERP Manufacturing — Handover Document

> Last updated: 2026-04-24
> Stack: Node 20 + Express + TypeScript (backend) · Vue 3 + Vite + TS + Tailwind (frontend) · MariaDB 10.4 (XAMPP)

---

## 1. Production Servers (VPS)

### SSH Access
| Field        | Value                       |
|--------------|-----------------------------|
| Host         | `76.13.22.155`              |
| User         | `root`                      |
| SSH command  | `ssh root@76.13.22.155`     |
| OS           | Ubuntu 24.04                |
| Web server   | nginx 1.24                  |
| Process mgr  | pm2                         |

> ⚠️ Password / SSH key tidak disimpan di file ini. Login pakai SSH key yg sudah di-setup di workstation lokal (`~/.ssh/id_*`). Kalau perlu rotasi, update key via `ssh-copy-id`.

### Hosted Sites
| Domain                  | App (pm2)      | Backend port | DB name             | Frontend dir                  |
|-------------------------|----------------|--------------|---------------------|-------------------------------|
| `app.dipasukses.com`    | `erp-backend`  | 3001         | `erp_manufacturing` | `/var/www/erp/frontend`       |
| `app.rheologi.id`       | `erp-rheologi` | 3002         | `erp_rheologi`      | `/var/www/erp-rheologi/frontend` |

Backend source dirs: `/var/www/erp/backend` and `/var/www/erp-rheologi/backend`
pm2 ecosystem files: `/var/www/erp/backend/ecosystem.config.js`, `/var/www/erp-rheologi/backend/ecosystem.config.cjs`

### Production MySQL
- Host: `localhost` (server-internal)
- User: `erp_user`
- Password: `ErpSecure2024!`
- Version: MySQL 8.0.45
- DBs: `erp_manufacturing` (3001), `erp_rheologi` (3002)
- JWT secrets:
  - `erp-backend`: `erp_manufacturing_jwt_secret_2024_prod`
  - `erp-rheologi`: `erp_rheologi_jwt_secret_2024_prod`

### Other pm2 apps on the same VPS (do NOT touch)
`cylo`, `idxflash`

### Nginx configs (in repo)
- [deploy/nginx-erp.conf](deploy/nginx-erp.conf) — `app.dipasukses.com` → 3001
- [deploy/nginx-rheologi.conf](deploy/nginx-rheologi.conf) → `app.rheologi.id` → 3002

### Common production commands
```bash
# Status
ssh root@76.13.22.155 "pm2 list"

# Logs
ssh root@76.13.22.155 "pm2 logs erp-backend --lines 50"
ssh root@76.13.22.155 "pm2 logs erp-rheologi --lines 50"

# Restart
ssh root@76.13.22.155 "pm2 restart erp-backend erp-rheologi --update-env"

# DB shell
ssh root@76.13.22.155
mysql -u erp_user -pErpSecure2024! erp_manufacturing
```

---

## 2. Local Development

### Folder
`C:\xampp1\htdocs\ERP`

### Local DB (XAMPP MariaDB 10.4.32)
- Host: `127.0.0.1:3306`
- User: `root` (no password by default)
- DB: `erp_manufacturing_dev`
- mysqld binary: `C:\xampp1\mysql\bin\mysqld.exe`
- mysql CLI: `C:\xampp1\mysql\bin\mysql.exe`
- ini: `C:\xampp1\mysql\bin\my.ini`

### Start everything
```powershell
# 1. MySQL (if not running)
Start-Process -FilePath "C:\xampp1\mysql\bin\mysqld.exe" `
  -ArgumentList "--defaults-file=C:\xampp1\mysql\bin\my.ini","--standalone" `
  -WorkingDirectory "C:\xampp1\mysql\bin" -WindowStyle Hidden

# 2. Backend + frontend (concurrently)
cd C:\xampp1\htdocs\ERP
npm run dev
```

Backend: http://localhost:3001 · Frontend: http://localhost:5173

### Local logins
| Role           | Email                | Password   | Notes                             |
|----------------|----------------------|------------|-----------------------------------|
| Master bypass  | `master@admin.com`   | `master`   | Hardcoded, userId=99999, level=10 |
| Default admin  | `admin@erp.local`    | `admin123` | Seeded via init script            |

---

## 3. Architecture Notes (carry forward)

- **JWT payload** is `{ userId, userLevel }`. Use `req.user.userId` (NOT `req.user.id`).
- **Approval gate** for fund requests: `userLevel >= 4` (admin/director).
- **Schema-on-startup**: [`backend/src/config/database.ts`](backend/src/config/database.ts) `ensureProcurementPaymentSchema()` runs on every backend boot. CREATE TABLE IF NOT EXISTS + ALTER TABLE … ADD COLUMN IF NOT EXISTS.
  - Production fix: MySQL 8 doesn't support `ADD COLUMN IF NOT EXISTS`. Patched `execSchemaEnsure` to catch `ER_PARSE_ERROR`/1064, look up column in `INFORMATION_SCHEMA`, then re-issue ALTER without the modifier. See `tryFallbackAddColumn` in [database.ts](backend/src/config/database.ts).
- Frontend API base: `frontend/src/lib/api.ts` (`http://localhost:3001/api`).
- Vite proxy in [vite.config.ts](frontend/vite.config.ts) → port 3001.

### Schema gotchas
- `users` table uses `full_name` (not `name`). `users` also has `user_level`, `phone`, `address`.
- `batches`: `manufacture_date`/`expiry_date`, `warehouse_id`.
- `invoices`: `total_amount`/`invoice_date`/`due_date`.
- `qc_tests`/`qc_results`: see existing notes; mappings already handled in routes.
- `so_items` (not `sales_order_items`).
- `production_tasks.assigned_to_user_id` (no `assigned_to`).
- `employees.status` is VARCHAR (not boolean).

---

## 4. Modules Implemented in This Cycle

### 4.1 Fund Request (Pengajuan Dana) — multi-line + per-item approval

**Header table** `fund_requests`: `request_number`, `purpose`, `needed_date`, `amount` (sum), `status`, `cash_account`, `cash_account_note`.

**Items table** `fund_request_items` (NEW):
- `id`, `fund_request_id` FK CASCADE
- `po_id`, `po_schedule_id`, `vendor_id` (auto-resolved if `po_schedule_id` given)
- `description`, `amount`
- `status` enum: `pending`/`approved`/`rejected` (default `pending`)
- `approved_by`, `approved_at`, `rejection_reason`
- `ap_id` (NEW) — link to AP record after auto-pay
- `payment_recorded_at` (NEW) — idempotency marker

**Header status state machine** (recomputed from items in [`recomputeFundRequestStatus`](backend/src/routes/finance.routes.ts)):
- any pending → `submitted`
- all approved → `approved`
- all rejected → `rejected`
- mix approved + rejected (no pending) → `partially_approved`

**Endpoints** in [`backend/src/routes/finance.routes.ts`](backend/src/routes/finance.routes.ts):
- `GET /api/finance/fund-requests` — list with `item_count`, `pending_count`, `approved_count`, `rejected_count`
- `GET /api/finance/fund-requests/:id` — header + items[]
- `POST /api/finance/fund-requests` — accepts `items[]` (multi-line) or single legacy fields
- `PUT /api/finance/fund-requests/:id/submit` — draft/rejected → submitted; creates `approval_requests` row
- `PUT /api/finance/fund-requests/:id/approve` — admin-only (level≥4); bulk-approves all pending items + auto-pays; returns `auto_payments[]`
- `PUT /api/finance/fund-requests/:id/reject` — admin-only; bulk reject with reason
- `PUT /api/finance/fund-requests/:id/items/:itemId/approve` — per-item; admin-only; auto-pays
- `PUT /api/finance/fund-requests/:id/items/:itemId/reject` — per-item; admin-only

**Auto-pay AP** ([`autoPayApFromFundRequestItem`](backend/src/routes/finance.routes.ts)):
- Idempotent via `payment_recorded_at` check
- Finds AP via `accounts_payable.po_schedule_id` first, falls back to `schedule.ap_id`
- Updates AP `paid_amount` + status (`paid`/`partial`)
- Updates `purchase_order_payment_schedules` accordingly
- Sets `fund_request_items.ap_id` + `payment_recorded_at`

**Frontend** [`FinanceFundRequests.vue`](frontend/src/views/FinanceFundRequests.vue):
- List badges: `N items` (indigo if >1) and `N pending` (yellow if mix)
- Create/Edit modal: purpose, needed date, cash account, cash account note + transactions sub-table (PO ID, Schedule ID, Vendor ID, Description, Amount) with auto-total
- Detail modal: per-item Approve/Reject for admin when `item.status='pending'` AND parent in `submitted`/`partially_approved`
- `?openId=<id>` query param auto-opens detail (used by Approval Inbox routing)

### 4.2 Approval Inbox (global)

**Endpoint** [`backend/src/routes/approval.routes.ts`](backend/src/routes/approval.routes.ts):
- `GET /api/approval/inbox` — enriched response: each `entity_type='fund_request'` row carries an `entity` summary block (`request_number`, `purpose`, `amount`, `needed_date`, `status`, `cash_account`, `cash_account_note`, `item_count`, `pending_count`).

**Frontend** [`ApprovalInbox.vue`](frontend/src/views/ApprovalInbox.vue):
- Modules dropdown includes `finance`
- Card layout shows the entity summary box for fund_request
- Single "Open & Review" button (gradient blue, external-link icon) routes to `/finance/fund-requests?openId=<id>` for per-item approve/reject
- Other entities keep original Approve / Reject buttons

### 4.3 Aesthetic action buttons (Apr 22)

Both [`FinanceFundRequests.vue`](frontend/src/views/FinanceFundRequests.vue) and [`ApprovalInbox.vue`](frontend/src/views/ApprovalInbox.vue) now use pill buttons with:
- Tinted backgrounds (`bg-emerald-50` / `bg-rose-50` / etc.)
- `ring-1 ring-inset` borders
- Inline SVG icons
- `active:scale-[0.98] transition` micro-interactions
- Gradient CTAs for primary actions

---

## 5. Schema migrations added this cycle (idempotent, run on every boot)

In [`backend/src/config/database.ts`](backend/src/config/database.ts):
```sql
ALTER TABLE fund_requests ADD COLUMN IF NOT EXISTS cash_account VARCHAR(255) NULL;
ALTER TABLE fund_requests ADD COLUMN IF NOT EXISTS cash_account_note TEXT NULL;

CREATE TABLE IF NOT EXISTS fund_request_items ( … );
ALTER TABLE fund_request_items ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending';
ALTER TABLE fund_request_items ADD COLUMN IF NOT EXISTS approved_by INT NULL;
ALTER TABLE fund_request_items ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP NULL;
ALTER TABLE fund_request_items ADD COLUMN IF NOT EXISTS rejection_reason TEXT NULL;
ALTER TABLE fund_request_items ADD COLUMN IF NOT EXISTS ap_id INT NULL;
ALTER TABLE fund_request_items ADD COLUMN IF NOT EXISTS payment_recorded_at TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS approval_rules ( … );
CREATE TABLE IF NOT EXISTS approval_rule_steps ( … );
CREATE TABLE IF NOT EXISTS approval_actions ( … );
```

---

## 6. Deploy procedure (verified working Apr 22)

From local PowerShell at `C:\xampp1\htdocs\ERP`:

```powershell
# 1. Build frontend
cd frontend; npm run build; cd ..

# 2. Stage to VPS
ssh root@76.13.22.155 "mkdir -p /tmp/erp-deploy && rm -rf /tmp/erp-deploy/*"
scp backend/src/config/database.ts `
    backend/src/routes/finance.routes.ts `
    backend/src/routes/approval.routes.ts `
    root@76.13.22.155:/tmp/erp-deploy/
tar -cf - -C frontend/dist . | ssh root@76.13.22.155 `
  "mkdir -p /tmp/erp-deploy/frontend && tar -xf - -C /tmp/erp-deploy/frontend"

# 3. Distribute + restart (use heredoc to preserve $ vars)
@'
set -e
for TARGET in /var/www/erp /var/www/erp-rheologi; do
  cp /tmp/erp-deploy/database.ts $TARGET/backend/src/config/database.ts
  cp /tmp/erp-deploy/finance.routes.ts $TARGET/backend/src/routes/finance.routes.ts
  cp /tmp/erp-deploy/approval.routes.ts $TARGET/backend/src/routes/approval.routes.ts
  rsync -a --delete /tmp/erp-deploy/frontend/ $TARGET/frontend/
done
pm2 restart erp-backend erp-rheologi --update-env
'@ | ssh root@76.13.22.155 "bash -s"
```

---

## 7. Recent incident — local MariaDB recovery (Apr 23)

**Symptom**: Backend won't start, log shows
```
InnoDB: Missing MLOG_CHECKPOINT at 60568141 between the checkpoint 60568141 and the end 60568064
```
mysqld aborts on boot.

**Fix applied (Option A, non-destructive)**:
1. Backup InnoDB files to `C:\xampp1\mysql\data\_innodb_backup_<timestamp>\`
2. Stop mysqld; delete `ib_logfile0`, `ib_logfile1` only (keep `ibdata1` which holds data)
3. Restart mysqld → it recreates redo logs from scratch → all DBs intact
4. Remove temporary `innodb_force_recovery=1` from `my.ini`

Backup folder retained: `C:\xampp1\mysql\data\_innodb_backup_20260423-055148\`

---

## 8. Open todos

- [ ] Wire up rule-based approval routing for `module=finance` (currently falls through to "visible to all" branch via `NOT EXISTS approval_rule_steps`)
- [ ] PO module: similar approval inbox enrichment for purchase orders / GRN
- [ ] AR / collection auto-receipt when invoice paid (mirror of FR auto-pay AP)
