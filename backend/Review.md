Re-review dilakukan pada `main` HEAD setelah commit fix review blockers.

Semua 6 blocker telah di-close:

1. ✅ `requirePermission` founder bypass — diubah ke `userLevel === 1` (exact match), bukan `>= 1`.

2. ✅ Authorization pada API Roles:
   - `GET /` → `system.roles:view`
   - `GET /:id` → `system.roles:view`
   - `POST /` → `system.roles:create`
   - `PUT /:id` → `system.roles:update`
   - `DELETE /:id` → `system.roles:delete`
   - `POST /:id/permissions` → `system.roles:assign_permissions`
   - `GET /:id/permissions` → `system.roles:view`

3. ✅ Authorization pada API Permissions:
   - `GET /`, `GET /grouped`, `GET /:id` → `system.permissions:view`
   - `POST /`, `PUT /:id`, `DELETE /:id` → `system.permissions:manage`

4. ✅ Permission assignment menggunakan `dbTransaction`:
   - Validasi semua permission ID exists sebelum insert
   - Parameterized bulk insert (loop dalam transaction, bukan string interpolation)
   - Rollback otomatis jika ada error
   - Audit log ke `audit_logs` table

5. ✅ Prospect frontend sinkron dengan backend flow:
   - `statusOptions` = `['new', 'contacted', 'qualified', 'disqualified', 'converted']`
   - Convert button hanya tampil untuk status `qualified`
   - Batch convert hanya select prospect `qualified`
   - Backend transition: `new → contacted → qualified → (convert endpoint) → converted`

6. ✅ Lead conversion field protection:
   - `client_id` dan `converted_at` tidak bisa diubah melalui generic `PUT /:id` — selalu pakai current value
   - Stage `Won` tidak bisa di-set melalui generic update — hanya via `/convert` endpoint
   - Conversion hanya dari stage `Discussion` atau `Negotiation`

Status: **All Blockers Resolved — ready for final review.**
