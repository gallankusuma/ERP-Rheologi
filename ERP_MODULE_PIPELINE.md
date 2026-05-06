# ERP Module Implementation Pipeline
## Standard Corporate Manufacturing ERP

---

## Project Status Overview

| Category | Count | Status |
|----------|-------|--------|
| Database Tables | 66 | ✅ All created |
| Backend Route Files | 29 | ✅ Active |
| Implemented Frontend Pages | 62 | ✅ Active |
| Placeholder Pages | 51 | 🔴 Need implementation |
| Pinia Stores | 17 | ✅ Active |

---

## PHASE 1 — Production Module (7 pages)
**Priority: CRITICAL** | **ETA: First**

Production is the heart of manufacturing ERP. All 7 sub-pages are currently placeholders.
DB Tables exist: `work_orders`, `wo_materials`, `wo_process_logs`, `wo_results`, `production_events`, `production_tasks`

| # | Route | Page | What to Build |
|---|-------|------|---------------|
| 1 | `/production/planning` | Production Planning | Calendar/Gantt view of scheduled WOs. Create/edit production schedules. Capacity planning with resource allocation. |
| 2 | `/production/mrp` | Material Requirement Planning | BOM explosion from WO demand. Calculate material shortages vs inventory. Auto-generate Purchase Requests for shortfalls. |
| 3 | `/production/issue-material` | Issue Material | Pick list from WO → issue raw materials from warehouse. Update `wo_materials.quantity_issued`. Batch selection with FIFO/FEFO logic. |
| 4 | `/production/execution` | Production Execution | Real-time WO tracking. Start/stop/pause operations. Log process steps into `wo_process_logs`. Update WO status flow: Planned → In Progress → Completed. |
| 5 | `/production/yield` | Yield & Scrap | Record output quantities and losses into `wo_results`. Calculate yield % and loss %. Scrap reason codes. |
| 6 | `/production/fg-receipt` | Finished Goods Receipt | Receive completed products into warehouse inventory. Create batch records for FG. Update `inventory_stocks` and `stock_movements`. |
| 7 | `/production/history` | Production History | Search/filter all completed WOs. Timeline view. Export to Excel. |

### Backend Needs (Phase 1)
- Extend `production.routes.ts` with endpoints for planning, MRP calculation, material issuance, execution tracking, yield recording, FG receipt
- Add DB migration for `production_schedules` table (capacity planning)

### Frontend Needs (Phase 1)
- Create `production.store.ts` Pinia store
- 7 new Vue view files replacing PlaceholderPage

---

## PHASE 2 — Quality Management (7 pages)
**Priority: CRITICAL** | **ETA: Second**

Quality control ensures product standards. All 7 sub-pages are placeholders.
DB Tables exist: `qc_tests`, `qc_results`

| # | Route | Page | What to Build |
|---|-------|------|---------------|
| 1 | `/quality/test-methods` | QC Test Methods | CRUD for test definitions (chemical, physical, microbiological). Link tests to products. Define acceptance criteria/limits. |
| 2 | `/quality/sampling` | QC Sampling | Sampling plans per product/batch. Define sample size, frequency. AQL (Acceptable Quality Level) configuration. |
| 3 | `/quality/results` | QC Results | Record test results per batch. Pass/Fail/Conditional determination. Attach lab certificates. |
| 4 | `/quality/batch-release` | Batch Release | Approve/reject batches based on QC results. Release for sale or hold for investigation. Batch status workflow: Testing → Released / Rejected / On Hold. |
| 5 | `/quality/ncr` | Non-Conformance Report | Log non-conforming materials/products. Root cause analysis. CAPA (Corrective & Preventive Actions). |
| 6 | `/quality/rework` | Rework Management | Create rework orders from NCR. Track rework WOs. Re-test after rework. |
| 7 | `/quality/reports` | QC Reports | QC summary dashboards. Trend analysis. Batch release statistics. Export. |

### Backend Needs (Phase 2)
- Extend `quality.routes.ts` with sampling, batch-release, NCR, rework endpoints
- Add DB tables: `qc_sampling_plans`, `qc_ncr`, `qc_ncr_actions`, `qc_rework_orders`

### Frontend Needs (Phase 2)
- Extend existing `quality.store.ts`
- 7 new Vue view files

---

## PHASE 3 — Finance Module (6 pages)
**Priority: HIGH** | **ETA: Third**

Finance backend routes exist (`finance.routes.ts`). Need dedicated frontend pages.
DB Tables exist: `cogs_tracking`, `profitability_tracking`, `accounts_payable`, `accounts_receivable`, `financial_summary`

| # | Route | Page | What to Build |
|---|-------|------|---------------|
| 1 | `/finance/cogs` | COGS Calculation | View/calculate COGS per product/batch/period. Material + Labor + Overhead breakdown. |
| 2 | `/finance/ap` | Accounts Payable | Outstanding payables from POs. Payment tracking. Aging report. |
| 3 | `/finance/ar` | Accounts Receivable | Outstanding receivables from invoices. Payment tracking. Aging report. |
| 4 | `/finance/cost-analysis` | Cost Analysis | Compare standard vs actual costs. Variance analysis. Cost trends by product. |
| 5 | `/finance/margin` | Margin Analysis | Gross margin by product/customer/period. Profitability ranking. |
| 6 | `/finance/summary` | Financial Summary | P&L overview. Revenue vs COGS vs Operating Expenses. Period comparison. |

### Backend Needs (Phase 3)
- `finance.routes.ts` already has 10 endpoints — mostly sufficient
- May need additional aggregation/reporting endpoints

### Frontend Needs (Phase 3)
- Create `finance.store.ts` Pinia store
- 6 new Vue view files with charts (Chart.js or similar)

---

## PHASE 4 — Sales Completion (5 pages)
**Priority: HIGH** | **ETA: Fourth**

Sales backend routes exist (`sales.routes.ts`). Some pages implemented (`/sales-orders`, `/deliveries`, `/sales-invoices`), but 5 sub-module pages are placeholders.

| # | Route | Page | What to Build |
|---|-------|------|---------------|
| 1 | `/sales/orders` | Sales Orders List | Enhanced SO list with filters, status badges. Link to existing `/sales-orders` CRUD. |
| 2 | `/sales/approval` | SO Approval | Approval workflow for sales orders above threshold. Approve/reject with comments. |
| 3 | `/sales/price-list` | Price List Management | Product pricing tiers. Customer-specific pricing. Volume discounts. Effective dates. |
| 4 | `/sales/delivery` | Delivery Orders | Enhanced DO management. Pick/pack/ship workflow. Link to shipment tracking. |
| 5 | `/sales/history` | Sales History | Historical sales data with filtering. Sales trends. Customer purchase history. Export. |

### Backend Needs (Phase 4)
- `sales.routes.ts` has comprehensive endpoints — mostly sufficient
- Add `price_lists` and `price_list_items` tables
- Add sales approval endpoints

### Frontend Needs (Phase 4)
- Extend existing `sales.store.ts`
- 5 new Vue view files

---

## PHASE 5 — Approval System (5 pages)
**Priority: HIGH** | **ETA: Fifth**

No backend routes exist. Need full implementation from scratch.
Approval workflows currently hardcoded per-entity (PR, PO, GRN have individual approve/reject endpoints).

| # | Route | Page | What to Build |
|---|-------|------|---------------|
| 1 | `/approval/inbox` | My Approval Inbox | Unified inbox showing all pending approvals (PR, PO, GRN, SO, WO). Quick approve/reject actions. |
| 2 | `/approval/history` | Approval History | All past approval decisions. Filter by entity type, approver, date. |
| 3 | `/approval/rules` | Approval Rules | Configure approval rules: amount thresholds, entity types, required approvers, multi-level approval chains. |
| 4 | `/approval/delegation` | Delegation | Delegate approval authority to another user. Date range, entity type scope. |
| 5 | `/approval/escalation` | Escalation Rules | Auto-escalate if not approved within X hours. Notification triggers. |

### Backend Needs (Phase 5)
- Create `approval.routes.ts` — new file
- New DB tables: `approval_rules`, `approval_delegations`, `approval_escalations`, `approval_history`
- Refactor existing approve/reject endpoints to use centralized approval engine

### Frontend Needs (Phase 5)
- Create `approval.store.ts` Pinia store
- 5 new Vue view files

---

## PHASE 6 — Reports Module (8 pages)
**Priority: MEDIUM** | **ETA: Sixth**

No backend routes exist. Reports are read-only aggregation views over existing data.

| # | Route | Page | What to Build |
|---|-------|------|---------------|
| 1 | `/reports/production` | Production Reports | WO completion rates, cycle times, capacity utilization, output vs target. |
| 2 | `/reports/inventory` | Inventory Reports | Stock valuation, aging, turnover ratio, dead stock, reorder alerts. |
| 3 | `/reports/procurement` | Procurement Reports | PO lead times, vendor performance, spend analysis, price trends. |
| 4 | `/reports/qc` | QC Reports | Pass/fail rates, NCR trends, batch release stats, test coverage. |
| 5 | `/reports/sales` | Sales Reports | Revenue by customer/product/period, order fulfillment rate, backlog. |
| 6 | `/reports/finance` | Finance Reports | P&L, cash flow, AP/AR aging, COGS trends, margin analysis. |
| 7 | `/reports/custom` | Custom Reports | User-defined report builder. Select entity, columns, filters. Save report templates. |
| 8 | `/reports/export` | Export Data | Bulk export to Excel/CSV/PDF. Scheduled exports. |

### Backend Needs (Phase 6)
- Create `reports.routes.ts` — new file with aggregation queries
- No new DB tables needed (queries existing tables)
- Add `report_templates` table for custom reports

### Frontend Needs (Phase 6)
- Create `reports.store.ts` Pinia store
- 8 new Vue view files with charts and data tables

---

## PHASE 7 — Dashboard KPIs (5 pages)
**Priority: MEDIUM** | **ETA: Seventh**

Enhance the main dashboard with drilling down into KPI sub-pages.

| # | Route | Page | What to Build |
|---|-------|------|---------------|
| 1 | `/dashboard/production` | Production KPI | WO status summary, throughput, efficiency %, downtime. |
| 2 | `/dashboard/inventory` | Inventory KPI | Stock levels, value, turnover, expiring soon, low stock alerts. |
| 3 | `/dashboard/sales` | Sales KPI | Revenue MTD/YTD, orders pipeline, top customers, conversion rate. |
| 4 | `/dashboard/approvals` | Approval Summary | Pending approvals count by type, average approval time, bottlenecks. |
| 5 | `/dashboard/alerts` | System Alerts | Low stock, overdue POs, expiring batches, failed QC, pending approvals. |

### Backend Needs (Phase 7)
- Add KPI aggregation endpoints to existing dashboard route or create `dashboard.routes.ts`
- Aggregation queries over production, inventory, sales, approval data

### Frontend Needs (Phase 7)
- 5 new Vue view files with KPI cards and charts

---

## PHASE 8 — Admin & System (6 pages)
**Priority: LOW** | **ETA: Last**

Some admin features already exist (`/system-settings`, `/audit-log`, `/notifications`). These placeholder pages duplicate or extend them.

| # | Route | Page | What to Build |
|---|-------|------|---------------|
| 1 | `/admin/settings` | System Settings | Redirect or extend existing `/system-settings`. Company profile, defaults. |
| 2 | `/admin/approval-config` | Approval Config | Configure approval workflows. Links to Phase 5 approval rules. |
| 3 | `/admin/audit-log` | Audit Log | Redirect or extend existing `/audit-log`. Enhanced filtering. |
| 4 | `/admin/notifications` | Notification Settings | Email/in-app notification preferences. Template management. |
| 5 | `/admin/integration` | Integration Settings | API keys, webhook configs, third-party integrations. |
| 6 | `/admin/backup` | Backup & Restore | Database backup, scheduled backups, restore functionality. |

### Backend Needs (Phase 8)
- Extend `settings.routes.ts` for integration and backup endpoints
- Add `integration_configs`, `backup_logs` tables

### Frontend Needs (Phase 8)
- 6 new Vue view files (some may redirect to existing pages)

---

## PHASE 9 — Procurement Approval (2 pages)
**Priority: LOW** | **ETA: With Phase 5**

Backend approve/reject already works. Need dedicated approval queue pages.

| # | Route | Page | What to Build |
|---|-------|------|---------------|
| 1 | `/procurement/pr-approval` | PR Approval Queue | List PRs pending approval. Bulk approve. Comments. |
| 2 | `/procurement/po-approval` | PO Approval Queue | List POs pending approval. Bulk approve. Comments. |

---

## Implementation Checklist Per Module

For each module page, follow this standard:

### Backend
- [ ] Define/verify DB tables exist
- [ ] Create/extend route file with CRUD + business logic endpoints
- [ ] Use parameterized queries (SQL injection prevention)
- [ ] Add JWT auth middleware (`req.user.userId`)
- [ ] Add audit logging for create/update/delete operations
- [ ] Return consistent JSON: `{ success, data, message, pagination }`

### Frontend
- [ ] Create Vue 3 Composition API view file
- [ ] Create/extend Pinia store with API calls
- [ ] Use DataTable component for list views
- [ ] Use FormField component for forms
- [ ] Add proper loading states and error handling
- [ ] Add search, filter, and pagination
- [ ] Use Tailwind CSS for styling
- [ ] Remove route from `placeholderMeta` array
- [ ] Add real route entry in router/index.ts

### Quality Standards
- [ ] TypeScript strict — no `any` types
- [ ] Responsive design (mobile-friendly)
- [ ] Proper form validation
- [ ] Success/error toast notifications
- [ ] Confirmation dialogs for destructive actions
- [ ] Export to Excel capability for list views

---

## Total Implementation Summary

| Phase | Module | Pages | New Backend Routes | New DB Tables | Priority |
|-------|--------|-------|-------------------|---------------|----------|
| 1 | Production | 7 | Extend existing | 1 | CRITICAL |
| 2 | Quality | 7 | Extend existing | 4 | CRITICAL |
| 3 | Finance | 6 | Mostly done | 0 | HIGH |
| 4 | Sales | 5 | Mostly done | 2 | HIGH |
| 5 | Approval | 5 | New file | 4 | HIGH |
| 6 | Reports | 8 | New file | 1 | MEDIUM |
| 7 | Dashboard KPIs | 5 | New endpoints | 0 | MEDIUM |
| 8 | Admin | 6 | Extend existing | 2 | LOW |
| 9 | Procurement Approval | 2 | Done | 0 | LOW |
| **TOTAL** | | **51** | | **14** | |

---

## Execution Order

```
PHASE 1: Production (7 pages)     ← Manufacturing core
   ↓
PHASE 2: Quality (7 pages)        ← Quality assurance
   ↓
PHASE 3: Finance (6 pages)        ← Financial visibility
   ↓
PHASE 4: Sales (5 pages)          ← Revenue tracking
   ↓
PHASE 5: Approval (5 pages)       ← Governance & control
   ↓
PHASE 6: Reports (8 pages)        ← Analytics & insights
   ↓
PHASE 7: Dashboard KPIs (5 pages) ← Executive overview
   ↓
PHASE 8: Admin (6 pages)          ← System management
   ↓
PHASE 9: Procurement Approval (2 pages) ← Queue pages
```

**Total: 51 pages to implement across 9 phases**
