# ERP Manufacturing System - Progress Status
**Last Updated:** February 7, 2026
**Current Phase:** Procurement Module Fix + GRN Multi-Level Approval Testing

---

## 🏆 STRATEGIC ACCELERATION DECISION (Feb 7, 2026)

### Analysis Completed
✅ Scanned entire backend/src/routes for SQLite vs MySQL:
- **Total route files**: 27
- **Files with SQLite**: 6 (22%)
- **SQLite calls identified**: 81 (in 6 files)
- **Critical path**: Procurement (40 calls) + Inventory (18 calls) = 58 calls (70% of issues)

### Phase 1 Execution: GRN Approval Endpoints ✅ COMPLETE
✅ Fixed critical GRN approval workflow:
- `router.post('/goods-receipts/:id/approve')` - **FULLY CONVERTED** to MySQL/async
  - db.prepare() → await dbGet/dbRun
  - datetime('now') → CURRENT_TIMESTAMP
  - Added proper await for applyGrnToInventory()
  - Column refs fixed (u.name → u.full_name)

- `router.post('/goods-receipts/:id/reject')` - **FULLY CONVERTED** to MySQL/async

- `applyGrnToInventory()` helper - **FULLY CONVERTED** to MySQL/async
  - Uses inventory_stocks table (MySQL standard)
  - All queries using await dbGet/dbRun
  - Removed SQLite-specific lastInsertRowid reference

### Remaining SQLite in Procurement (≈20 more calls)
| Endpoint | Priority | Status | SQLite Calls |
|----------|----------|--------|--------------|
| POST /purchase-orders (create) | CRITICAL | TODO | 3 |
| POST /purchase-orders/:id/approve | CRITICAL | TODO | 5 |
| POST /purchase-orders/:id (update) | MEDIUM | TODO | 3 |
| POST /goods-receipts (create) | CRITICAL | TODO | 1 |
| DELETE endpoints | LOW | TODO | 3 |
| Vendor pricing lookups | MEDIUM | TODO | 3 |

### Strategic Recommendation
**Option A (Recommended): Batch Fix Remaining Procurement**
- Fix remaining 8-10 endpoints methodically  
- Est. time: 1-2 hours following same conversion pattern
- Pays off: Unlocks complete PR→PO→GRN workflow testing

**Option B: Skip to module testing**
- Move to Inventory, Quality, Finance modules
- Test which ones are already working (21 modules are 100% MySQL)
- Document technical debt for later cleanup

**Current Status: Core Approvals Working** ✅
- GRN approval endpoints: ✅ MySQL ready
- Inventory updates: ✅ Async ready
- Missing: GRN/PO creation endpoints (still SQLite)

### Test Result
✅ GRN fetch endpoint works
✅ GRN approval endpoint compiles & responds correctly
⏳ GRN creation endpoint: Not tested (still SQLite)

**Action**: Should we continue with Option A (complete Procurement), or pivot to testing other modules?

---

## ✅ Current Focus (Short)

1. **MySQL Migration Verification**
   - Confirm backend connects to MySQL and auto-initializes schema.
   - Validate default users and seed data creation.

2. **BOM Save Fix (Product Name Input)**
   - Replace Finished Good dropdown with text input for BOM header.
   - Ensure BOM save works with new product_name field.
3. **Project Menu (design.pdf) Alignment**
   - Ensure Project menu & submenu list matches design.pdf.
   - Verify routing targets and labels in UI.

---

## ✅ BOM Module Updates (Product Name Input)

### ✅ Completed
- BOM header now uses `product_name` (text input) instead of product dropdown.
- BOM payload uses `product_name` and detail rows with `raw_material_id`, `quantity`, `unit_of_measure_id`.
- `bom_headers` table updated to include `product_name`, and `product_id` is nullable.
- UoM selector now uses real `uom` IDs.

**Files:**
- [`frontend/src/views/BOM.vue`](frontend/src/views/BOM.vue)
- [`backend/src/routes/bom.routes.ts`](backend/src/routes/bom.routes.ts)
- [`backend/database/schema_mysql.sql`](backend/database/schema_mysql.sql)

### ⚠️ Blocker
- BOM save fails due to FK on `bom_headers.created_by`:
  - Error: `Cannot add or update a child row ... FOREIGN KEY (created_by) REFERENCES users(id)`
  - Current insert uses `created_by` from JWT, but it is NULL.
  - Fix needed: allow NULL or set valid userId on create.

---

## 🎯 Current Focus: Good Receipt (GRN) Multi-Level Approval Workflow

### ✅ Completed Tasks

#### Backend (Node.js + Express)
- Added `approval_status` and `approved_by_*` columns to `goods_receipts` table (runtime ALTER)
- Implemented tiered approval endpoint `/goods-receipts/:id/approve`:
  - **Supervisor (level 2)**: Moves approval_status 0→1 (first review)
  - **Manager (level 3)**: Moves approval_status 1→2 (second review, triggers stock movement)
  - **Director/Master (level 4+)**: Bypasses to approval_status 2 directly
- Added reject/reset endpoint `/goods-receipts/:id/reject` to revert approval_status to 0
- Stock movements only execute on full approval (approval_status = 2)
- Added `received_by` field auto-filled with current user

**File:** [`backend/src/routes/procurement.routes.ts`](backend/src/routes/procurement.routes.ts)

#### Frontend (Vue 3 + Pinia)
- Updated `GoodReceipt` store interface with `approval_status` and `approved_by_*` fields
- Added `approveGoodReceipt()` and `rejectGoodReceipt()` methods calling backend endpoints
- Updated form to display "Received By" as read-only auto-filled field
- Added UI columns: Approval badge (Pending/Supervisor/Manager approved)
- Added helper functions:
  - `approvalBadgeClass()` - styling for approval status
  - `approvalLabel()` - text labels (Pending/Approved Supervisor/Approved Manager)
  - `canApproveGRN()` - permission check (supervisor→manager→director flow)
  - `canRejectGRN()` - allows reset during approval flow
- Action buttons (Approve/Reset) conditionally shown based on user level

**File:** [`frontend/src/views/GoodReceipt.vue`](frontend/src/views/GoodReceipt.vue)  
**Store:** [`frontend/src/stores/goodreceipts.ts`](frontend/src/stores/goodreceipts.ts)

---

### 🔄 In-Progress / Pending Tasks

1. **End-to-End Testing**
   - Test supervisor creates GRN, approval_status=0
   - Test manager approves from 0→1 (should show reset button)
   - Test director approves from 1→2 (stock moves, approval complete)
   - Verify reject/reset clears approval_status back to 0
   - Confirm UI buttons hide/show correctly per user level

2. **Status Default Behavior**
   - Current: GRN inserts with `status='received'` and `approval_status=0`
   - Consider: May need to revert to `status='draft'` if approval_status=0 (pending approval)
   - Clarification needed: Is 'received' status tied to stock movement or approval state?

3. **Backend Stock Movement Validation**
   - Verify stock only moves when `approval_status=2` (full approval)
   - Test with rejected GRN to ensure no partial stock moves
   - Validate warehouse/inventory consistency

---

## 📋 Architecture Overview

### Approval Flow Diagram
```
Create GRN (status='received', approval_status=0)
    ↓
Supervisor Reviews (level=2)
    → Approve: approval_status → 1
    → OR Reject: approval_status → 0
    ↓
Manager Reviews (level=3)
    → Approve: approval_status → 2 ✓ (STOCK MOVES)
    → OR Reject: approval_status → 1
    ↓
Director/Master (level=4+) [Optional, if mgr approval fails]
    → Direct Approve: approval_status → 2 ✓ (STOCK MOVES)
```

### User Levels (from codebase)
- **1:** Regular User
- **2:** Supervisor
- **3:** Manager
- **4+:** Director / Master Admin

---

## 🚀 How to Test GRN Multi-Level Approval

1. **Start dev servers:**
   ```bash
   npm run dev
   ```

2. **Create GRN as supervisor user** (level=2)
   - Go to Procurement → Good Receipt
   - Click "+ Create GRN"
   - Select PO, enter received quantities, submit
   - GRN status='received', approval_status=0

3. **Manager login & approve** (level=3)
   - Refresh GRN list
   - Click "Approve" button on GRN
   - GRN approval_status→1, "Approved (Supervisor)" badge shows
   - Verify Reset button visible

4. **Director login & finalize** (level=4+)
   - Click "Approve" on GRN
   - GRN approval_status→2, "Approved (Manager/Director)" badge shows
   - **Verify stock was moved** in Inventory module
   - Reset button should hide (approval complete)

5. **Test Reject Flow**
   - Create new GRN, supervisor approves (status=1)
   - Click "Reset" button
   - Status reverts to 0 (Pending), Approve button reappears

---

## 📁 Key Files Modified

| File | Purpose | Status |
|------|---------|--------|
| [`backend/src/routes/procurement.routes.ts`](backend/src/routes/procurement.routes.ts) | Tiered approval logic + stock movement | ✅ Done |
| [`frontend/src/views/GoodReceipt.vue`](frontend/src/views/GoodReceipt.vue) | UI + approval helpers + buttons | ✅ Done |
| [`frontend/src/stores/goodreceipts.ts`](frontend/src/stores/goodreceipts.ts) | Store methods for approve/reject | ✅ Done |

---

## 🔗 Related Features (Earlier Work)

- ✅ Received By auto-fill (current user)
- ✅ Warehouse multi-select support
- ✅ PO line items display in GRN form
- ✅ Status badges (draft/received/approved)
- ✅ Soft delete support for GRN

---

## 🎯 Universal Approval & Governance Rules (Applied to ALL Modules)

### ✅ DELETE Button Rules
**Visibility Rule:**
```javascript
v-if="item.status === 'draft' OR item.approval_status === 0"
```
- Delete allowed only when **draft** OR **pending approval** (approval_status=0)
- Once approved (approval_status > 0), use **REJECT** instead (audit trail)
- Always require confirmation: `"Delete this draft [MODULE]? This action cannot be undone."`

**Modules Compliant:**
- ✅ PurchaseRequests (PR)
- ✅ PurchaseOrders (PO) - Added Dec 14, 2025
- ✅ BOM
- ✅ GoodReceipt (GRN) - Just added

---

### ✅ REJECT Button Rules (Multi-Level)

**Permission Matrix:**

| Status | User Level 1-2 | Level 2 (Supervisor) | Level 3 (Manager) | Level 4+ (Director) |
|--------|----------------|----------------------|-------------------|---------------------|
| 0      | No button      | No button (DELETE)   | No button (DELETE) | No button (DELETE)  |
| 1      | No button      | No button            | Yes (→0)           | Yes (→0)            |
| 2      | No button      | No button            | No button          | Yes (→0)            |

**Implementation (useApprovalWorkflow.ts):**
```typescript
const canReject = computed(() => {
  if (currentStatus.value === 0) return false; // Use delete
  if (userLevel.value >= 4) {
    return currentStatus.value === 1 || currentStatus.value === 2; // Director: can reject any
  }
  if (userLevel.value === 3) {
    return currentStatus.value === 1; // Manager: reject only level 1
  }
  return false; // Supervisor & below: no reject
});
```

**Modules Compliant:**
- ✅ PurchaseRequests (PR)
- ✅ PurchaseOrders (PO)
- ✅ BOM
- ✅ GoodReceipt (GRN)

---

### ✅ EDIT/FORM EDITABILITY Rules

**Rule: Based on approval_status**

| approval_status | isEditing | Form Fields | Save Button |
|-----------------|-----------|-------------|-------------|
| 0 (Pending)     | false     | Editable ✏️  | Visible     |
| 1+ (Approved)   | true      | Read-only   | Hidden      |

**Implementation:**
```typescript
// When viewing item
const viewItem = (item: any) => {
  currentItem.value = item;
  isEditing.value = (item.approval_status || 0) > 0; // Read-only if approved
  showModal.value = true;
};

// On form fields
<input :disabled="isEditing" v-model="form.field" />
<button v-if="!isEditing" @click="saveChanges">Save</button>
```

**Modules Compliant:**
- ✅ PurchaseRequests (PR)
- ✅ PurchaseOrders (PO) - Updated Dec 14, 2025
- ✅ BOM
- ✅ GoodReceipt (GRN)

---

### ✅ CONFIRMATION DIALOGS - All Actions

**Mandatory for:**
- ✅ Approve: `"Approve [MODULE]? Pastikan semua data sudah benar."`
- ✅ Reject: `"Reject dan kembalikan [MODULE] ke pending?"`
- ✅ Delete: `"Delete this draft [MODULE]? This action cannot be undone."`

**Modules Compliant:**
- ✅ PurchaseRequests (PR)
- ✅ PurchaseOrders (PO)
- ✅ BOM
- ✅ GoodReceipt (GRN)

---

### ✅ MULTI-LEVEL APPROVAL FLOW (Standard Across All Modules)

**Default Flow (Unless Module-Specific Override):**
```
Create (status='draft', approval_status=0)
    ↓
Level 2 (Supervisor): approval_status 0→1
    ↓
Level 3 (Manager): approval_status 1→2 ⭐ (Triggers stock moves, fulfillment, etc.)
    ↓
Level 4+ (Director): Can approve 0→2 directly OR review 1→2
```

**Modules with Custom Approval:**
- 🔴 **GoodReceipt (GRN)**: Custom - Manager approval (2) triggers stock movement only
- ✅ **PurchaseRequest (PR)**: Standard flow
- ✅ **PurchaseOrder (PO)**: Standard flow
- ✅ **BOM**: Standard flow (no stock impact)

---

### ✅ TABLE COLUMN WIDTH Standards

**Rule: Use `style="min-width: XXXpx"` instead of Tailwind fixed widths**

**Recommended Minimums:**
```vue
<!-- Item/Product Names -->
<th style="min-width: 200px;">Item</th>

<!-- Numeric Fields -->
<th style="min-width: 80px;">Qty</th>
<th style="min-width: 120px;">Unit Price</th>
<th style="min-width: 140px;">Total</th>

<!-- Category/UoM -->
<th style="min-width: 100px;">Category</th>
<th style="min-width: 80px;">UoM</th>

<!-- Long Text -->
<th style="min-width: 180px;">Specification</th>
<th style="min-width: 200px;">Notes</th>

<!-- Actions -->
<th style="min-width: 120px;">Actions</th>
```

---

## 💡 Next Steps for New Chat Session

1. **Verify approval buttons appear/hide correctly** with test users at different levels
2. **Check stock movement** happens only on full approval (status=2)
3. **Confirm reject resets approval_status** properly
4. **Test edge cases:**
   - What if director approves GRN without manager review? (Should work - direct to 2)
   - What if supervisor rejects at level 1? (Reset to 0)
5. **Update GRN status field** if needed (draft vs received logic)
6. **Performance test** with multiple GRNs in approval queue

---

**Chat Context:** This conversation became lengthy due to iterative debugging and testing of multiple ERP modules (Units, ItemTypes, BOM, PurchaseOrders, GoodReceipts, etc.). Suggest fresh chat after verifying GRN approval E2E test passes.

---

## 📎 Reference Files
- [`APPROVAL_WORKFLOW_RULES.md`](APPROVAL_WORKFLOW_RULES.md) - Detailed governance rules
- [`APPROVAL_QUICK_REFERENCE.md`](APPROVAL_QUICK_REFERENCE.md) - Quick lookup table
