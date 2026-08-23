# Finance & General Ledger — Target Architecture Blueprint

Status: Proposed canonical target contract  
Version: 1.0  
Date: 21 August 2026  
Target stack: Node.js/Express/TypeScript modular monolith, MySQL/MariaDB, Vue 3  
Primary audience: Finance owner, ERP system owner, backend/frontend developers, QA, internal auditor

## 1. Executive decision

General Ledger is mandatory and becomes the accounting system of record for this ERP.

This decision supersedes the older statement in readme_goal.md that Finance is simplified and has no full accounting ledger. Operational modules remain the owner of their business facts, while AccountingPostingService is the only authority allowed to create posted accounting entries.

Recommended accounting basis:

- Accrual accounting.
- Perpetual inventory.
- Double-entry bookkeeping.
- Base currency IDR, with multi-currency transaction support.
- Exact lot/batch costing for inventory and manufacturing traceability.
- Immutable posted journals and compensating reversal journals.
- Monthly fiscal periods with soft close and hard close.
- One modular monolith and one database transaction where operational posting and GL posting must succeed together.

The GL must never be implemented as a best-effort report populated after the business transaction. If an event is defined as financially postable, the operational transition, accounting event, journal entry, audit evidence, and idempotency outcome form one atomic business result.

## 2. Scope

### 2.1 Included

- Chart of Accounts.
- Fiscal years and accounting periods.
- Manual and automatic journals.
- General Ledger detail and Trial Balance.
- Balance Sheet, Profit and Loss, and Cash Flow.
- Accounts Payable subledger.
- Accounts Receivable subledger.
- Vendor invoices, customer invoices, debit notes, and credit notes.
- Cash and bank receipts/disbursements.
- Payment allocation and bank reconciliation.
- Inventory valuation by exact lot.
- WIP and Finished Goods costing.
- COGS by batch, product, customer, and shipment.
- Tax posting structure.
- Cost center and project dimensions.
- Period close, reopen, and prior-period adjustments.
- Reconciliation between subledgers and GL control accounts.
- Full RBAC, segregation of duties, audit, idempotency, reversal, and recovery.

### 2.2 Not included in the first implementation wave

- Consolidation of multiple legal entities.
- Budgeting and forecasting ledger.
- Fixed-asset depreciation engine.
- Payroll calculation.
- Advanced treasury forecasting.
- Regulatory tax filing automation.

The schema should leave room for these features, but the first implementation must remain a reliable modular monolith.

## 3. Current workspace assessment

The repository already contains a useful GL foundation:

- backend/src/routes/gl.routes.ts provides COA, manual journal, post/void, Trial Balance, Balance Sheet, Profit and Loss, Cash Flow, and dashboard endpoints.
- frontend/src/views/GeneralLedger.vue provides a working initial GL user interface.
- backend/migrations/finance_gl_foundation.sql defines COA, fiscal periods, journal entries, journal lines, period balances, and a starter COA.
- backend/database/migrations/027_consolidate_permissions.sql adds a first GL permission catalog.
- backend/src/routes/finance.routes.ts contains AP, AR, COGS, profitability, and fund request endpoints.

This foundation is not yet safe to treat as an accounting system of record.

### 3.1 Active architectural gaps in the existing foundation

1. The GL schema is stored under backend/migrations instead of the active versioned migration stream under backend/database/migrations. It is therefore not reproducible through the current canonical migration runner.
2. bootstrap_ledger.sql manually inserts migration ledger rows. It does not create the GL schema and can report migrations as applied without proving their DDL outcome.
3. Manual journal creation inserts the header and each line through separate calls without one database transaction.
4. Journal posting and voiding read and update rows without FOR UPDATE, fixed lock order, idempotency, or one atomic transaction. Concurrent requests can double-apply balances.
5. Posting silently skips missing accounts. Accounting effects must fail closed.
6. Void mutates the original posted entry and current balances. It does not create an immutable reversal journal.
7. chart_of_accounts.current_balance duplicates a value that is derivable from posted journal lines. It can drift and currently acts as a second source of truth.
8. Several reports LEFT JOIN journal entries with posting/date predicates but SUM journal line values without conditioning on a matched posted entry. Draft, voided, or out-of-period lines can therefore enter reported balances.
9. Several sensitive read/report endpoints require authentication only, not finance.general-ledger view/report permissions.
10. Debit and credit totals use JavaScript Number and tolerance logic before persistence. This is unsafe for authoritative money calculations.
11. Entry numbers use a random four-digit suffix rather than a locked sequence.
12. Fiscal period lookup can return no row, yet a journal may still be created with a null period.
13. Cash Flow hardcodes four account codes instead of using effective-dated account roles.
14. Generic update/delete permissions are too broad for create, submit, approve, post, reverse, period close, period reopen, and report actions.
15. AP, AR, payments, fund requests, inventory, production, shipment, and GL are not connected by a canonical accounting event/posting service.

The target below preserves useful UI and query concepts but replaces unsafe write semantics.

## 4. Domain ownership

| Business fact | Canonical owner | GL responsibility |
|---|---|---|
| PO commitment and price | Procurement | Optional commitment reporting; no statutory journal by default |
| Goods received and exact lot | Procurement + Inventory | Inventory/GRNI posting |
| QC disposition | QC | Reclassification between hold, available, rejected, or return states |
| Vendor invoice | AP subledger | AP, tax, GRNI, and variance posting |
| Material issue/return | Production + Inventory | RM/WIP posting |
| Yield, scrap, and FG receipt | Production | WIP, FG hold, variance posting |
| Delivery shipment | Sales Fulfillment + Inventory | FG reduction and COGS |
| Revenue recognition | Sales/contract terms | AR or unbilled AR, revenue, tax |
| Customer invoice | AR subledger | AR and revenue/unbilled reclassification |
| Payment/receipt | Treasury | AP/AR settlement and bank posting |
| Account, journal, fiscal period | Finance/GL | Canonical accounting record |
| Financial statement | GL reporting service | Derived only from immutable posted journals |

Rules:

- Operational tables must not write journal lines directly.
- Routes must not contain account-number-specific posting SQL.
- AccountingPostingService resolves an effective posting profile and creates a complete balanced journal.
- A posting profile is snapshotted on the accounting event so later configuration changes do not rewrite history.
- GL does not own stock quantity, delivery quantity, or invoice business status. It owns their financial representation.

## 5. Context flow

    Procurement GRN/QC ─┐
    Production/WIP/FG ──┤
    Inventory movement ─┼─> AccountingPostingService ─> Accounting Event
    Sales shipment ─────┤                              └> Journal Entry + Lines
    AP/AR invoice ──────┤                                  ├> GL reports
    Cash/Bank ──────────┘                                  └> Reconciliation

Within this modular monolith, a financially mandatory operational posting should call AccountingPostingService with the same database connection. Notifications and non-authoritative projections may use a transactional outbox.

## 6. Accounting invariants

The following invariants are non-negotiable:

1. Every posted journal has at least two lines.
2. Total base debit equals total base credit exactly after deterministic currency rounding.
3. Each line has either debit or credit, never both, and neither can be negative.
4. Header totals equal the sum of persisted lines.
5. Every line references one active, postable, non-header account.
6. Every journal belongs to exactly one fiscal period.
7. A journal cannot be posted into a closed period.
8. Posted headers and lines are immutable.
9. A correction creates a new reversal or adjustment journal; it never edits or deletes a posted journal.
10. One source event produces at most one canonical posting outcome per source revision.
11. Retry with the same idempotency key and payload returns the original stored response.
12. The same key with a different payload returns a conflict and creates no new effect.
13. Source lineage is mandatory down to the most precise available line and lot identity.
14. GL reports use posted journals only.
15. Subledger control-account balances must reconcile to GL.
16. current_balance, if retained as a cache, must be rebuildable and cannot be authoritative.
17. No generic suspense-account fallback is allowed during normal posting.
18. Negative inventory quantity and missing inventory cost are posting blockers unless an explicit controlled exception policy exists.

## 7. Precision and currency contract

Recommended database precision:

| Value | Type |
|---|---|
| Physical quantity | DECIMAL(20,6) |
| Unit cost/price | DECIMAL(20,8) |
| Transaction-currency journal amount | DECIMAL(20,4) |
| Exchange rate | DECIMAL(20,10) |
| Base-currency journal amount | DECIMAL(20,4) |
| Percentage/tax rate | DECIMAL(12,8) |

API rules:

- Money and quantity values are transported as decimal strings.
- Backend uses a decimal library; JavaScript Number is not used for authoritative calculations.
- Currency has an ISO code and configured minor-unit exponent.
- Exchange rate is snapshotted with source, effective date/time, and direction.
- Rounding happens once at the defined posting boundary.
- Rounding differences post to an explicit configured rounding account.
- A journal is balanced in both transaction currency where applicable and base currency.

Recommended first-release decision:

- Base currency: IDR.
- Transaction currencies: IDR and USD initially.
- Rate convention: base amount = foreign amount × rate.
- Rate source: controlled Finance master data, not a live network call during posting.

## 8. Minimum canonical data model

### 8.1 Accounting configuration

accounting_settings:

- company_id.
- base_currency_code.
- fiscal_year_start_month.
- inventory_cost_method.
- revenue_recognition_default.
- rounding_account_id.
- retained_earnings_account_id.
- default_fx_gain_account_id.
- default_fx_loss_account_id.
- effective_from/effective_to.

account_roles:

- role_code, such as AR_CONTROL, AP_CONTROL, GRNI, INVENTORY_RM_AVAILABLE, INVENTORY_FG_AVAILABLE, COGS_PRODUCT.
- account_id.
- optional product category, warehouse, customer/vendor class, tax code, project, or cost center scope.
- effective_from/effective_to.
- priority and configuration version.

posting_profiles and posting_profile_rules:

- source_event_type.
- debit/credit account role.
- amount expression selected from a strict server-side rule catalog.
- required dimensions.
- effective dates and approval status.
- immutable version/hash.

### 8.2 Chart of Accounts

chart_of_accounts minimum fields:

- id and company_id.
- account_code and account_name.
- account_type and financial_statement_section.
- parent_id and display_order.
- normal_balance.
- is_header.
- is_postable.
- is_control_account.
- control_subledger type.
- allow_manual_posting.
- currency_policy.
- active_from and inactive_at.
- created/approved actors and timestamps.

Constraints:

- Unique company_id + account_code.
- Header accounts are not postable.
- Control accounts reject manual journals unless an explicit controlled override permission and reason are supplied.
- Accounts with journal history are deactivated, never deleted.
- Account type/normal balance cannot be changed after posting history without a controlled migration.
- Opening balance is created through an opening journal, not stored as an editable COA field.

### 8.3 Fiscal periods

fiscal_years:

- company_id, year label, start/end date, status.

fiscal_periods:

- fiscal_year_id.
- period number/name and start/end.
- status: OPEN, SOFT_CLOSED, CLOSED.
- close run ID.
- closed/reopened actor, reason, and timestamp.
- version for optimistic checks.

No date may belong to overlapping periods for the same company.

### 8.4 Accounting events and idempotency

accounting_events:

- immutable event ID/UUID.
- company_id.
- source_module, source_type, source_id, source_line_id.
- source_revision and source_event_type.
- source_business_date and source_hash.
- posting_profile_version/hash.
- status: RECEIVED, VALIDATED, POSTED, FAILED, REVERSED.
- journal_entry_id.
- failure_code and recovery state.
- created actor/time.

idempotency_outcomes:

- company_id.
- command scope.
- idempotency key.
- payload hash.
- stored HTTP status/body.
- accounting event/journal IDs.
- created/expires timestamps.

Unique constraints:

- company_id + command_scope + idempotency_key.
- company_id + source_event_type + source_id + source_line_id + source_revision.

### 8.5 Journal header and lines

journal_entries:

- id/UUID and sequence-generated entry number.
- company_id.
- journal type: MANUAL, SYSTEM, OPENING, CLOSING, REVERSAL, ADJUSTMENT.
- entry date, posting date, and fiscal period.
- status: DRAFT, PENDING_APPROVAL, APPROVED, POSTED, REVERSED.
- description.
- accounting_event_id.
- source reference fields.
- original_journal_id and reversal_journal_id.
- transaction/base currencies.
- total transaction/base debit and credit.
- immutable content hash.
- creator, approver, poster, reversal actor/timestamps.

journal_lines:

- journal_entry_id and line number.
- account_id.
- debit/credit in transaction and base currency.
- exchange rate snapshot.
- description.
- cost_center_id and project_id.
- product_id, warehouse_id, lot_id, batch_id.
- vendor_id/customer_id.
- AP/AR document and payment allocation reference.
- tax code and tax document reference.
- source line reference.

Constraints:

- Unique journal_entry_id + line_number.
- Check amounts nonnegative.
- Check exactly one of debit/credit is positive.
- Mandatory dimensions driven by account/posting rule.

### 8.6 AP subledger

Minimum tables:

- vendor_invoices.
- vendor_invoice_lines.
- three_way_match_allocations.
- vendor_credit_notes.
- ap_open_items.
- supplier_payments.
- supplier_payment_allocations.

Key constraints:

- Unique vendor + normalized invoice number + legal entity.
- Invoice line references PO/PO line and GRN/GRN line where applicable.
- Matched quantity cannot exceed accepted receipt quantity.
- Allocated payment cannot exceed payment amount.
- Open item equals posted invoice/debit note less credit notes and payments.

### 8.7 AR subledger

Minimum tables:

- customer_invoices.
- customer_invoice_lines.
- shipment_invoice_allocations.
- customer_credit_notes.
- ar_open_items.
- customer_receipts.
- customer_receipt_allocations.

Key constraints:

- Customer invoice line references SO line and delivered/shipped fulfillment line.
- Invoice quantity cannot exceed eligible fulfillment under the configured billing rule.
- Revenue-recognition and billing events are separated when contract timing differs.

### 8.8 Inventory valuation and manufacturing cost

inventory_cost_layers:

- lot_id and inventory balance/source event.
- quantity received, remaining, and allocated.
- unit material cost, landed cost, and base unit cost.
- currency/rate snapshot.
- cost status: PROVISIONAL or FINAL.

inventory_cost_allocations:

- outbound movement ID.
- source cost layer/lot.
- allocated quantity and cost.

batch_cost_sheets:

- WO, batch, and FG lot.
- exact material issue cost.
- direct labor.
- absorbed overhead.
- outside processing.
- scrap/rework treatment.
- accepted output quantity.
- provisional/final unit cost.
- cost version/hash and finalized actor/time.

### 8.9 Cash, bank, and reconciliation

Minimum tables:

- bank_accounts with linked GL account role.
- cash_transactions.
- bank_statement_headers/lines.
- bank_reconciliation_runs.
- bank_reconciliation_matches.

No bank account is identified by a hardcoded GL account code.

### 8.10 Reconciliation evidence

reconciliation_runs:

- reconciliation type.
- as-of date/cutoff.
- source and GL totals.
- difference.
- status and issue count.
- started/completed actor/time.

reconciliation_issues:

- run ID.
- source record and expected journal.
- difference type and amount.
- resolution status, actor, reason, and linked adjustment/reversal.

## 9. State machines

### 9.1 Manual journal

    DRAFT -> PENDING_APPROVAL -> APPROVED -> POSTED -> REVERSED

Rules:

- Draft may be edited/deleted by its maker.
- Submit freezes a content version/hash.
- Approver cannot be the maker.
- Poster cannot be the maker; recommended poster also differs from approver.
- POSTED is immutable.
- Reverse creates and posts a linked opposite journal in an open period.
- Rejected approval returns to DRAFT as a new revision with retained history.

### 9.2 Automatic journal

    RECEIVED -> VALIDATED -> POSTED
                    └-----> FAILED_REQUIRES_ACTION
    POSTED -> REVERSED

Automatic journals do not bypass validation, period, account mapping, idempotency, or audit.

### 9.3 Vendor invoice/AP

    DRAFT -> MATCHED -> PENDING_APPROVAL -> APPROVED -> POSTED
    POSTED -> PARTIALLY_PAID -> PAID
    POSTED/PARTIALLY_PAID -> CREDITED or REVERSED

Posted vendor invoices are not edited. Corrections use credit/debit notes.

### 9.4 Customer invoice/AR

    DRAFT -> APPROVED -> ISSUED/POSTED -> PARTIALLY_PAID -> PAID
    ISSUED/POSTED -> CREDITED or REVERSED

### 9.5 Payment

    DRAFT -> PENDING_APPROVAL -> APPROVED -> POSTED -> CLEARED -> RECONCILED

Rejected or cancelled payment instructions have no GL effect. Posted payments use reversal, not delete.

### 9.6 Fiscal period

    OPEN -> SOFT_CLOSED -> CLOSED
    CLOSED -> REOPENED -> OPEN

Reopen requires Finance Manager/Controller permission, reason, and immutable audit. A safer normal correction is a current-period prior-period adjustment.

## 10. Posting matrix

Account codes below are illustrative. Runtime posting uses effective account roles, not hardcoded codes.

### 10.1 Procure-to-Pay

| Source event | Debit | Credit | Notes |
|---|---|---|---|
| PR/PO approved | No statutory entry | No statutory entry | Optional commitment ledger only |
| GRN posted, QC required | Inventory RM/PKG QC Hold | GRNI | Use accepted quantity and snapshotted PO cost |
| GRN posted, QC not required | Inventory RM/PKG Available | GRNI | Exact receipt lot |
| Incoming QC released | Inventory Available | Inventory QC Hold | Exact lot, equal value |
| Incoming QC rejected and returned | GRNI | Inventory QC Hold | Reversal tied to rejected exact lot |
| Vendor invoice posted | GRNI, Input Tax, Purchase Variance | AP Control | Three-way match |
| Vendor invoice for expense/service | Expense/Prepaid/Asset, Input Tax | AP Control | No inventory match where not applicable |
| Supplier payment posted | AP Control | Bank/Cash | Payment allocation required |
| Purchase credit note | AP Control | Inventory/Expense/Input Tax | Exact original invoice allocation |
| FX settlement difference | AP Control plus/minus FX | Bank/Cash | Snapshot payment rate |

GRNI reconciliation:

- GRNI receipt credits must reconcile to received-but-not-invoiced receipt allocations.
- Vendor invoice matching clears GRNI by exact GRN line.
- Price differences post to configured purchase price variance, not back into quantity.

### 10.2 Production and batch costing

| Source event | Debit | Credit | Notes |
|---|---|---|---|
| Exact-lot material issue | WIP | RM/PKG Inventory | Cost from exact issued lot layer |
| Material return | RM/PKG Inventory | WIP | Original cost allocation |
| Direct labor absorption | WIP | Payroll/Direct Labor Clearing | Approved time/cost source |
| Manufacturing overhead absorption | WIP | Overhead Applied | Effective rate snapshot |
| FG receipt into QC hold | FG QC Hold | WIP | Provisional or final batch cost |
| FG QC release | FG Available | FG QC Hold | Exact FG lot |
| FG QC rejection/scrap | Production Scrap/Variance | FG QC Hold or WIP | Reason and disposition required |
| WO close favorable/unfavorable variance | WIP/Production Variance | Production Variance/WIP | Finalizes batch cost |
| Rework issue/receipt | Rework WIP | Source inventory/WIP | Original batch lineage retained |

Partial FG receipt:

- Each receipt creates one immutable FG lot and cost layer.
- Cost may be PROVISIONAL until WO close.
- WO close computes final actual batch cost.
- Cost difference creates a separate variance/revaluation journal; historical receipt journals are not edited.

### 10.3 Order-to-Cash

| Source event | Debit | Credit | Notes |
|---|---|---|---|
| DO allocated/picked | No GL entry | No GL entry | Inventory reservation only |
| DO shipped | COGS | FG Available Inventory | Exact shipped FG lot cost |
| Revenue recognized at shipment | Unbilled AR or AR Control | Sales Revenue, Output Tax | Based on contract snapshot |
| Customer invoice after recognized shipment | AR Control | Unbilled AR | Plus billing/tax adjustments |
| Customer invoice when invoice is recognition trigger | AR Control | Sales Revenue, Output Tax | Configured contract rule |
| Customer receipt | Bank/Cash | AR Control | Allocation to open items |
| Sales return accepted into QC hold | Returned Inventory QC Hold | COGS Recovery | Exact original shipped cost |
| Customer credit note | Sales Return, Output Tax | AR Control/Refund Payable | References original invoice |
| FX settlement difference | Bank/Cash plus/minus FX | AR Control | Snapshot receipt rate |

Revenue-recognition recommendation:

- Default to SHIPPED only when transfer of control legally occurs on shipment.
- Otherwise use DELIVERED or another contract milestone.
- Snapshot the rule on the SO/contract; do not derive it later from mutable customer master data.

### 10.4 Inventory

| Source event | Debit | Credit | Notes |
|---|---|---|---|
| Warehouse transfer within same valuation/legal scope | No net GL entry | No net GL entry | Dimension movement may be recorded |
| Positive approved adjustment | Inventory | Inventory Gain/Adjustment | Exact lot and reason |
| Negative approved adjustment | Inventory Loss/Adjustment | Inventory | Exact lot and reason |
| Stock opname difference | Inventory or Opname Loss | Opname Gain or Inventory | Posted from immutable count cutoff |
| Disposal/expiry | Disposal/Expiry Expense | Inventory | Approved exact lot |
| Landed-cost allocation | Inventory | Freight/AP/Clearing | Allocated by approved rule |
| Inventory revaluation | Inventory/Valuation Loss | Valuation Gain/Inventory | Controlled Finance command |

No pending/rejected adjustment has a GL effect.

### 10.5 Fund request and treasury

| Source event | Debit | Credit | Notes |
|---|---|---|---|
| Fund request submitted/approved | No GL entry | No GL entry | Workflow/commitment only |
| AP payment from approved fund request | AP Control | Bank/Cash | Only when money is actually disbursed |
| Employee/vendor advance disbursed | Advance Asset | Bank/Cash | Requires accountable party |
| Advance settlement to expense | Expense/Asset/AP | Advance Asset | Evidence/receipt required |
| Unused advance returned | Bank/Cash | Advance Asset | Exact settlement link |
| Bank charge | Bank Fee Expense | Bank | Statement/reference required |
| Interest received | Bank | Interest Income | Statement/reference required |

Approval of a fund request must never be mistaken for payment.

## 11. Costing policy

Recommended target for this batch-based biochemical ERP:

- Physical picking: FEFO where expiry applies, FIFO otherwise.
- Financial valuation: exact lot actual cost.
- Raw material/packaging lot cost: purchase price + allocated landed cost + approved price variance treatment.
- WIP cost: exact issued material cost + direct labor + absorbed overhead + outside processing.
- FG lot cost: allocated WIP cost divided by accepted FG output for that receipt/batch.
- Shipment COGS: exact shipped FG lot unit cost × shipped quantity.
- Return valuation: original outbound cost, not current average.
- Negative stock: prohibited.
- Missing cost layer: posting blocker with INVENTORY_COST_MISSING.

Scrap policy must be configured:

- Normal scrap may be absorbed into accepted output cost.
- Abnormal scrap posts to a separate variance/expense account.
- Rework cost remains linked to the original batch and reason.

## 12. Posting transaction contract

Preferred same-database atomic boundary:

1. Authenticate immutable actor.
2. Validate permission and segregation of duties.
3. Validate Idempotency-Key and payload hash.
4. Lock source document header.
5. Lock source lines in ascending ID order.
6. Lock exact inventory lot/cost layers or AP/AR open items in ascending ID order.
7. Lock fiscal period and relevant sequence row.
8. Resolve and snapshot posting profile.
9. Calculate amounts with decimal arithmetic.
10. Insert accounting event.
11. Insert journal header and lines.
12. Validate persisted totals and dimensions.
13. Transition source and journal status.
14. Insert audit and stored idempotency outcome.
15. Commit once.

If any mandatory step fails, all mutations roll back.

Lock-order consistency is required across all commands to avoid deadlocks.

## 13. Idempotency and concurrency

Every externally callable financial command requires Idempotency-Key:

- Manual journal create/submit/approve/post/reverse.
- Vendor invoice post and credit.
- Supplier payment.
- Customer invoice post and credit.
- Customer receipt.
- Shipment financial posting.
- Inventory adjustment/opname financial posting.
- WO close/cost finalization.
- Period close/reopen.

Replay behavior:

- Same scope + key + identical payload hash: return original HTTP status and body.
- Same scope + key + different hash: 409 IDEMPOTENCY_MISMATCH.
- Source already posted by another key: return stored source posting outcome or 409 SOURCE_ALREADY_POSTED according to command semantics.

Concurrency acceptance:

- Two POST requests for one draft journal create one posted result.
- Two payments cannot over-allocate one AP/AR open item.
- Two shipments cannot allocate the same available lot quantity.
- Period close cannot race with a backdated posting.

## 14. Reversal and correction

A posted journal is never changed to make it disappear from history.

Reversal contract:

- Create a new journal with exact opposite lines.
- Link original_journal_id and reversal_journal_id.
- Store reason, actor, approval, request ID, and reversal date.
- The original remains POSTED with a derived REVERSED relationship.
- Reversal posts to an open period.
- If the original period is closed, use the current open period and preserve original document/business date metadata.
- Source module creates its compensating business event first or atomically with the reversal.

Examples:

- Sales return creates inventory return/reinspection plus COGS reversal and credit note.
- Purchase return creates exact-lot outbound plus vendor credit.
- Payment reversal reopens AP/AR allocation and creates bank reversal.
- Incorrect manual journal uses a reversal plus corrected journal.

## 15. API and error contract

Recommended resource groups:

- /api/accounting/coa
- /api/accounting/periods
- /api/accounting/posting-profiles
- /api/accounting/manual-journals
- /api/accounting/journals
- /api/accounting/ap/invoices
- /api/accounting/ap/payments
- /api/accounting/ar/invoices
- /api/accounting/ar/receipts
- /api/accounting/bank-statements
- /api/accounting/reconciliations
- /api/accounting/reports

Representative commands:

- POST manual-journals: 201.
- POST manual-journals/{id}/submit: 200.
- POST manual-journals/{id}/approve: 200.
- POST journals/{id}/post: 200.
- POST journals/{id}/reverse: 201.
- POST periods/{id}/soft-close: 200.
- POST periods/{id}/close: 200.
- POST periods/{id}/reopen: 200.
- POST reconciliations/run: 202 or synchronous 200 for bounded runs.

Stable error mapping:

| HTTP | Example code |
|---|---|
| 401 | AUTH_PRINCIPAL_INVALID |
| 403 | FINANCE_PERMISSION_DENIED, SOD_VIOLATION |
| 404 | ACCOUNT_NOT_FOUND, JOURNAL_NOT_FOUND, PERIOD_NOT_FOUND |
| 409 | IDEMPOTENCY_MISMATCH, PERIOD_CLOSED, SOURCE_ALREADY_POSTED, PAYMENT_OVERALLOCATED, CONCURRENT_MODIFICATION |
| 422 | JOURNAL_UNBALANCED, ACCOUNT_NOT_POSTABLE, MISSING_DIMENSION, INVALID_CURRENCY_RATE, INVENTORY_COST_MISSING, MATCH_FAILED |
| 500 | ACCOUNTING_INTERNAL_ERROR |

Every error response includes:

- stable code.
- human-readable message.
- request/correlation ID.
- field errors where applicable.
- safe recovery hint.

## 16. RBAC and segregation of duties

Recommended roles:

- Finance Viewer.
- AP Clerk.
- AR Clerk.
- Treasury Clerk.
- Cost Accountant.
- GL Accountant.
- Finance Supervisor.
- Finance Manager/Controller.
- Internal Auditor.
- System Administrator.

Minimum permission actions:

- finance.coa.view/create/update/deactivate/approve.
- finance.journal.view/create/submit/approve/post/reverse.
- finance.period.view/soft-close/close/reopen.
- finance.ap.view/create/match/approve/post/pay/reverse.
- finance.ar.view/create/approve/post/receive/reverse.
- finance.treasury.view/create/approve/post/reconcile.
- finance.cost.view/calculate/finalize/revalue.
- finance.reconciliation.view/run/resolve.
- finance.reports.view/export.

SoD rules:

- Maker cannot approve or post their own manual journal.
- Vendor master maintainer cannot approve a payment to that vendor.
- AP invoice maker cannot be the final payment approver.
- AR invoice maker cannot approve a customer credit note they created.
- Bank account master maintainer cannot reconcile their own cash posting.
- Cost calculation preparer cannot finalize their own batch cost.
- Period closer cannot have unresolved personal draft/approval work included in the close.
- Emergency override requires a special permission, reason, second review, and audit.

All GET/report endpoints must also enforce deny-by-default permissions.

## 17. Reconciliation framework

Mandatory daily or period-end reconciliations:

| Reconciliation | Invariant |
|---|---|
| Trial Balance | Total posted debit = total posted credit |
| AP | AP Control GL = AP open-item subledger |
| AR | AR Control GL = AR open-item subledger |
| Inventory | Inventory GL by account/dimension = exact lot cost layers |
| WIP | WIP GL = open WO/batch cost sheets |
| FG/COGS | Shipment COGS = exact shipped lot cost allocations |
| GRNI | GRNI GL = received-not-invoiced match allocations |
| Bank | Bank GL = reconciled bank statement balance plus outstanding items |
| Tax | Tax control accounts = posted tax-document subledger |
| Source events | Every financially postable source event has one posting or explicit exception |
| Idempotency | No duplicate source-event journal |

Reconciliation failures are visible operational issues, never silently auto-fixed.

## 18. Period close

### 18.1 Soft close checklist

- All required source events through cutoff are posted.
- No failed/unmapped accounting events.
- AP/AR and payment approvals completed or explicitly deferred.
- Inventory quantity and valuation reconcile.
- WIP and batch costing complete or explicitly provisional.
- GRNI reviewed.
- Bank reconciliation complete.
- FX revaluation posted.
- Accruals, prepayments, depreciation, and tax journals posted as applicable.
- Trial Balance is balanced.
- AP, AR, Inventory, WIP, Bank, and Tax control accounts reconcile.

### 18.2 Hard close

- Acquire period lock.
- Re-run reconciliation against a fixed cutoff.
- Persist reconciliation evidence and report hashes.
- Create closing entries where required.
- Transition period to CLOSED in the same transaction as close evidence.
- Reject all new backdated postings with 409 PERIOD_CLOSED.

### 18.3 Reopen

- Finance Manager/Controller only.
- Reason and affected reports mandatory.
- Reopen creates an audit event and invalidates/revisions affected report snapshots.
- Reclose must repeat all reconciliation gates.

## 19. Reporting

Mandatory reports:

- Journal register with source trace.
- General Ledger detail by account/dimension.
- Trial Balance.
- Balance Sheet.
- Profit and Loss.
- Cash Flow.
- AP aging and vendor statement.
- AR aging and customer statement.
- Inventory valuation by product/warehouse/lot/status.
- WIP valuation by WO/batch.
- COGS by batch, product, shipment, customer, and period.
- Purchase price, production, scrap, and FX variance.
- Bank reconciliation.
- Tax summary.
- Project/cost-center profitability.
- Unposted source events and reconciliation exceptions.

Report rules:

- Posted journals only.
- Explicit as-of/cutoff and timezone.
- Pagination and deterministic ordering.
- Decimal strings in API.
- Export includes parameters, generation timestamp, user, report hash, and data version.
- Current balances are derived from posted journal lines or verified period balances.
- Account classifications/roles drive reports; account codes are not hardcoded in queries.

## 20. Recommended COA account roles

Illustrative account roles:

| Role | Example account |
|---|---|
| CASH_ON_HAND | Kas |
| BANK_OPERATING | Bank Operasional |
| AR_CONTROL | Piutang Usaha |
| UNBILLED_AR | Piutang Belum Ditagih |
| INVENTORY_RM_QC_HOLD | Persediaan RM QC Hold |
| INVENTORY_RM_AVAILABLE | Persediaan RM Available |
| INVENTORY_WIP | Persediaan WIP |
| INVENTORY_FG_QC_HOLD | Persediaan FG QC Hold |
| INVENTORY_FG_AVAILABLE | Persediaan FG Available |
| INVENTORY_VARIANCE | Selisih Persediaan |
| AP_CONTROL | Utang Usaha |
| GRNI | Barang Diterima Belum Ditagih |
| ADVANCE_EMPLOYEE | Uang Muka Karyawan |
| ADVANCE_VENDOR | Uang Muka Vendor |
| INPUT_TAX | Pajak Masukan |
| OUTPUT_TAX | Pajak Keluaran |
| SALES_REVENUE_PRODUCT | Penjualan Produk |
| SALES_RETURN | Retur Penjualan |
| COGS_PRODUCT | HPP Produk |
| SCRAP_ABNORMAL | Beban Scrap Abnormal |
| PRODUCTION_VARIANCE | Selisih Produksi |
| FX_GAIN | Laba Selisih Kurs |
| FX_LOSS | Rugi Selisih Kurs |
| ROUNDING_DIFFERENCE | Selisih Pembulatan |
| RETAINED_EARNINGS | Laba Ditahan |

Codes may follow the existing PSAK-oriented seed, but mappings must use roles and effective dates.

## 21. Migration and cutover strategy

### Phase 0 — Decisions and data profiling

- Confirm legal entity, base currency, fiscal year, tax treatment, revenue trigger, and costing policy.
- Inventory current AP/AR, invoices, payments, bank accounts, stock quantities, cost data, and existing journals.
- Identify duplicate invoices, negative stock, missing lots/costs, and inconsistent statuses.

### Phase 1 — Migration foundation

- First repair the canonical migration runner and fail-closed startup.
- Move the GL foundation into the next strict versioned migration.
- Do not mark legacy scripts applied through manual bootstrap placeholders.
- Create clean-install, legacy-upgrade, rerun, checksum, and rollback tests on a disposable database.

### Phase 2 — Canonical journal engine

- Implement AccountingPostingService with decimal arithmetic, transaction/locks, idempotency, sequences, periods, RBAC/SoD, and reversals.
- Replace current mutable balance posting.
- Rebuild reports from posted lines and verified period balances.

### Phase 3 — Shadow posting

- Generate journals for operational events without making them authoritative.
- Reconcile shadow output against known source totals.
- Fix account mappings and source-data gaps.
- No production/business data mutation by automated tests.

### Phase 4 — Inventory and Production

- Implement cost layers, exact-lot allocation, WIP, FG, QC reclassification, and shipment COGS.
- Finalize batch-cost and WO-close variance.

### Phase 5 — AP and Procure-to-Pay

- Vendor invoice, three-way match, GRNI, credit notes, payments, and aging.

### Phase 6 — AR and Order-to-Cash

- Shipment eligibility, revenue recognition, invoice allocation, receipts, credit notes, and aging.

### Phase 7 — Treasury and close

- Bank statement import, matching, reconciliation, period close/reopen, and report snapshots.

### Phase 8 — Cutover

- Choose a cutover date.
- Freeze relevant operational postings for a bounded window.
- Create one approved opening-balance journal with source reconciliation evidence.
- Import open AP/AR items and cost layers with exact provenance.
- Run parallel Trial Balance/Inventory/AP/AR/Bank reconciliation.
- Enable authoritative posting only after zero unexplained differences.

Do not fabricate historical journals where source evidence does not exist. Use an opening balance journal with transparent provenance.

## 22. Acceptance test matrix

Tests run only on a disposable migrated database with isolated fixtures.

### 22.1 Journal engine

- Balanced manual journal posts once.
- Unbalanced journal returns 422 and zero mutation.
- Header account/control account manual posting is denied.
- Two parallel post requests produce one journal effect.
- Retry after response loss returns stored response.
- Same key with changed payload returns 409.
- Failure after one line insert rolls back header and all lines.
- Missing account/profile fails closed.
- Maker/approver/poster SoD is enforced.
- Closed-period posting returns 409.
- Reversal produces exact opposite journal and preserves original.

### 22.2 Procure-to-Pay

- GRN partial/full receipt creates exact lot cost and GRNI.
- QC release only reclassifies exact lot.
- Vendor invoice matches PO/GRN quantity and clears GRNI.
- Price variance and input tax post correctly.
- Duplicate vendor invoice is rejected.
- Partial payment and final payment update AP allocation exactly.
- Payment reversal reopens AP.
- Purchase return after payment follows credit/refund contract.

### 22.3 Production

- Exact-lot RM issue transfers correct cost to WIP.
- RM return uses original cost.
- Partial FG receipts retain distinct lot/cost layers.
- QC hold/release uses exact FG lot.
- Normal/abnormal scrap follows configured rule.
- WO close finalizes cost and posts variance once.
- BOM/master changes after WO release do not change historical cost snapshot.

### 22.4 Order-to-Cash

- Partial and multi-lot shipment posts exact COGS.
- Revenue timing follows snapshotted contract trigger.
- Invoice cannot exceed eligible shipment.
- Partial receipt and full receipt allocate AR correctly.
- Sales return restores original cost into QC hold and creates credit note.
- Two shippers cannot consume the same lot balance.

### 22.5 Reconciliation and close

- AP/AR/Inventory/WIP/Bank/Tax subledgers reconcile to GL.
- Draft/voided/out-of-period lines never enter reports.
- Trial Balance remains balanced at every cutoff.
- Period close refuses unresolved reconciliation.
- Reopen requires authorization and invalidates affected report snapshot.
- Reports reproduce from the same commit SHA and schema version.

## 23. Performance and scale

- Index journal lines by account + journal, source dimensions, lot, customer/vendor, and project.
- Index journal headers by period, status, entry date, source event, and posting date.
- Use cursor pagination for journal/ledger detail.
- Period balances are rebuildable projections with source cutoff/hash.
- Large reconciliation runs persist checkpoints and deterministic cursors.
- No N+1 account lookups during posting; lock required accounts in one ordered query.
- Reporting queries must join/filter posted headers before summing lines.

## 24. Observability and operational recovery

Every financial command logs:

- request/correlation ID.
- source event ID and hash.
- idempotency scope/key hash.
- journal ID/number.
- fiscal period.
- actor and outcome.
- duration and retry/deadlock count.

Metrics:

- failed/unmapped accounting events.
- unposted event age.
- reconciliation differences.
- duplicate-key conflicts.
- posting latency.
- period-close blocker count.
- reversal count/reason.

Recovery tools:

- Read-only posting diagnostics.
- Reconciliation run with exact source/journal evidence.
- Explicit reprocess command for a FAILED accounting event.
- Explicit reversal/adjustment command.
- No direct production SQL repair as normal operating procedure.

## 25. Required implementation order

1. Canonical versioned migration runner and disposable schema tests.
2. Accounting settings, account roles, COA, fiscal periods, and strict permission catalog.
3. Transactional AccountingPostingService and immutable journal/reversal model.
4. Correct Trial Balance and financial reports from posted journals only.
5. Exact-lot inventory valuation and WIP/FG batch costing.
6. GRNI, vendor invoice matching, AP, and supplier payment.
7. Shipment COGS, revenue recognition, AR, and customer receipt.
8. Bank reconciliation, period close/reopen, and report snapshots.
9. Shadow posting, parallel reconciliation, and controlled cutover.

## 26. Near-FIRM acceptance gate for Finance

Finance is near-FIRM only when:

1. No active P0 remains in migration, Inventory, Production/QC, Sales Delivery, or Finance dependencies.
2. Canonical ownership and posting matrix are implemented and internally consistent.
3. Backend and frontend production builds pass.
4. Versioned migrations reproduce the schema on a disposable database.
5. Journal create/post/reverse, AP/AR, inventory costing, and period close tests pass with exact DB assertions.
6. Retry, concurrency, partial failure, and reversal tests prove one financial effect per business intent.
7. AP, AR, Inventory, WIP, COGS, Bank, Tax, and Trial Balance reconciliation differences are zero or explicitly approved.
8. RBAC and SoD are verified through menu, frontend action, API, and permission catalog.
9. Posted journals and closed periods are immutable.
10. User manuals and screenshots are produced only from the same tested SHA/schema after this gate is satisfied.

## 27. Decisions requiring Finance owner confirmation

Recommended default is listed first:

1. Revenue recognition: at SHIPPED when control transfers at shipment; otherwise configurable per contract.
2. Inventory valuation: exact-lot actual cost; alternative moving average is not recommended for this batch-traceability target.
3. Base currency: IDR with IDR/USD transaction support.
4. Fiscal year: January–December.
5. Cost finalization: provisional FG receipt cost, finalized at WO close with variance journal.
6. Normal scrap: absorbed into accepted output; abnormal scrap expensed separately.
7. AP recognition: vendor invoice with GRNI from accepted GRN.
8. Tax: effective-dated tax-code master reviewed by qualified Finance/Tax owner.
9. Payment approval thresholds and bank signatory rules.
10. Whether cost centers/projects are mandatory on expense, COGS, WIP, and revenue accounts.

These decisions must be recorded and versioned before Finance posting becomes authoritative.
