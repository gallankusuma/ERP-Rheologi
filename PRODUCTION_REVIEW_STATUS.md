# Production Module — Review Status & Change Log

## Current Status

**PRODUCTION CODE REVIEW = CONDITIONALLY CLEAN / TEST GATE REQUIRED ✅**

Latest reviewed SHA: `b515224`
CI: All GREEN (Backend Build, Frontend Build, PPIC Integration Smoke)

---

## Review History

### Review #1 → Commit `626d95d`

7 P0 + 2 P1 closed:

| Blocker | Fix |
|---|---|
| WO state machine bypass from Execution | Shared `validateTransition()` in `backend/src/utils/wo-transitions.ts` |
| PPIC WO RELEASED not visible in Execution | Execution query includes RELEASED/IN_PROGRESS/ON_HOLD |
| BOM Production ignores `wo.bom_id` | Generate Materials uses `wo.bom_id` first |
| BOM `status='approved'` vs ACTIVE mismatch | Fixed to `status = 'ACTIVE'` |
| Issue Material fallback to warehouse 1 | `warehouse_id` mandatory, no fallback |
| FG Receipt not enforcing QC/actual output | Requires QC-passed + limited to actual accepted output |
| Yield allows manual `qc_status='passed'` | Backend always inserts `'pending'`; UI dropdown removed |
| MRP dashboard queries legacy schema | Rewritten to `bom_headers`/`bom_details`/`inventory_stocks` |
| WorkOrders UI legacy status labels | Canonical state machine labels via `woStatus.ts` |

### Review #2 → Commit `5bb53f5`

3 residuals closed (5 of 8 items already fixed in prior commit):

| Blocker | Fix |
|---|---|
| QC bypass via generic `PUT /workorders/:id` | Mandatory QC checkpoint check added |
| Manual WO no `bom_id` + fallback lookup | Auto-pin BOM at WO creation; Generate Material rejects if null |
| MRP dashboard DTO mismatch | Backend field aliases match frontend contract |

### Review #3 → Commit `e3589d0`

3 items closed:

| Blocker | Fix |
|---|---|
| BOM `approval_status` not checked | Auto-pin requires `approval_status = 2`; Release validates full BOM |
| FG Receipt QC reads `wo_results.qc_status` | Derives from `wo_qc_checkpoints` (same as POST gate) |
| MRP UOM column `p.uom_id` | Fixed to `p.unit_of_measure_id` |

### Review #4 → Commit `b515224`

1 item closed:

| Blocker | Fix |
|---|---|
| FG Receipt QC derive counts optional failures | Only mandatory checkpoints determine pass/fail |

---

## Key Files Changed

### New Files
- `backend/src/utils/wo-transitions.ts` — Shared WO state machine
- `frontend/src/utils/woStatus.ts` — Canonical status labels/badges

### Backend
- `backend/src/routes/workorder.routes.ts` — QC gate, BOM validation, release prerequisites
- `backend/src/routes/production.routes.ts` — Execution, yield, FG receipt, MRP dashboard

### Frontend
- `frontend/src/views/ProductionExecution.vue` — Canonical status
- `frontend/src/views/ProductionYield.vue` — QC dropdown removed
- `frontend/src/views/ProductionFGReceipt.vue` — Idempotency key
- `frontend/src/views/ProductionIssueMaterial.vue` — Canonical status filter
- `frontend/src/views/ProductionMRP.vue` — Uses canonical DTO
- `frontend/src/views/WorkOrders.vue` — Canonical status options

---

## Negative Gates Enforced

```
Draft → Start                         REJECTED
Approved → Start                      REJECTED
Released without line process          REJECTED
Released without approved BOM          REJECTED
Released with unapproved BOM           REJECTED
Issue material on DRAFT/COMPLETED      REJECTED
Issue material without warehouse       REJECTED
Generate material without bom_id       REJECTED
Generate material with invalid BOM     REJECTED
Complete with mandatory QC pending     REJECTED (both endpoints)
Production self-set QC passed          REMOVED from API
FG receipt before QC passed            REJECTED
FG receipt > actual output             REJECTED
Duplicate FG receipt                   REJECTED (idempotency key)
```

## Production Smoke Test Target

```
DRAFT → APPROVED → RELEASED → Generate Material → Issue Material
→ IN_PROGRESS → QC → Yield → COMPLETED → FG Receipt → Inventory
```

---

## Server Info

- Backend: port 3002, PM2 process `erp-backend`
- Frontend: pre-built `dist/` served via Nginx
- Server: `76.13.22.155`

---

## Runtime Verification (v5 — clean, API-only, exact SHA)

| Field | Value |
|---|---|
| Tested SHA | `3d0858b` |
| Environment | Production (`76.13.22.155`) |
| Date/Time | 2026-08-10T04:47:00Z |
| Tester | Automated: `tests/production_smoke_test.py` (env-var creds, no direct DB) |
| WO Used | id=36, bom_id=17, product_id=470, warehouse=1 |

### Positive Flow: 23/23 PASS

| # | Step | Result |
|---|---|---|
| 1 | Create DRAFT WO (auto-pin ACTIVE+approved BOM) | PASS (bom_id=17) |
| 2 | DRAFT → APPROVED | PASS |
| 3 | APPROVED → RELEASED (validates BOM + line) | PASS |
| 4 | Generate Materials from pinned BOM | PASS |
| 5 | Issue Material (explicit warehouse) | PASS (wo_mat=57, issued=60) |
| 5a | RM stock deduction | PASS (2320 → 2260, delta=-60) |
| 5b | wo_materials.quantity_issued | PASS (60.0) |
| 5c | stock_movements OUT | PASS (60.0, reference_type=work_order) |
| 6 | RELEASED → IN_PROGRESS | PASS |
| 7 | Create mandatory QC checkpoint (auto-creates FPA) | PASS |
| 8 | Complete rejected while QC pending | PASS (400) |
| 9 | Quality pass QC via FPA module | PASS (checkpoint=passed) |
| 10 | Record Yield (output=85, loss=15) | PASS |
| 11 | IN_PROGRESS → COMPLETED | PASS |
| 12 | FG Receipt (qty=85) | PASS |
| 12a | FG inventory reconciliation | PASS (340 → 425, delta=+85) |
| 12b | stock_movements IN | PASS (85.0, reference_type=fg_receipt) |
| 13 | Duplicate receipt (same idempotency key) | PASS (rejected 400) |

### Negative Gates: PASS

| # | Gate | Result |
|---|---|---|
| N1 | DRAFT → Start | REJECTED (400) |
| N2 | APPROVED → Start | REJECTED (400) |
| N3 | Issue without warehouse | REJECTED (400) |
| N4 | FG receipt > actual output | REJECTED (400) |
| N5 | Yield self-set QC passed | BLOCKED (qc_status unchanged) |

### Inventory Reconciliation Evidence

```
RM Issue:
  product_id=72, warehouse=1
  BEFORE: 2320.0
  AFTER:  2260.0
  DELTA:  -60.0 (matches BOM qty 0.6 * WO qty 100)
  stock_movements OUT = 60.0 (reference_type=work_order, reference_id=36)

FG Receipt:
  product_id=470, warehouse=1
  BEFORE: 340.0
  AFTER:  425.0
  DELTA:  +85.0 (matches yield output_quantity)
  stock_movements IN = 85.0 (reference_type=fg_receipt, reference_id=36)

wo_materials.quantity_issued: 60.0
```

### Security Remediation (P0)

| Issue | Status |
|---|---|
| Plaintext DB creds in smoke test | FIXED — env vars only, old history purged via git-filter-repo |
| Plaintext admin creds in smoke test | FIXED — env vars only |
| Direct SQL production stock seeding | FIXED — uses audited API (POST /inventory) |
| DB credential rotation | DONE — `erp_user` password rotated |
| Git history purge | DONE — force-pushed `e305881...3d0858b` |

### Bugfix Found During Smoke

`production.routes.ts` line 598: mysql2 returns DECIMAL columns as strings.
`(mat.quantity_issued || 0) + quantity` concatenated string + number instead of adding.
Fixed with `Number()` coercion. Previous runs showed `quantity_issued=0.0001`.

### Summary

```
PASS: 23 / 23
FAIL: 0 / 23
```

**PRODUCTION MODULE = FIRM / FREEZE ✅**
