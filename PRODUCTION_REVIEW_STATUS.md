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
