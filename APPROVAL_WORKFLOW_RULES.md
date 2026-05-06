# APPROVAL WORKFLOW RULES
## Standard Rules for All Transaction Modules

**Last Updated**: December 14, 2025  
**Applies To**: All transaction modules requiring approval (PR, PO, GRN, BOM, Sales Orders, Work Orders, Batches, and all future modules)

**Quick Summary - Recent Updates**:
- ✅ Applied to **PurchaseRequests.vue** - Fully compliant
- ✅ Applied to **BOM.vue** - Fully compliant
- ✅ Applied to **PurchaseOrders.vue** - Fully compliant (Dec 14, 2025)
  * Added DELETE backend endpoint (`/procurement/purchase-orders/:id`)
  * Added delete button with visibility: `status === 'draft' OR approval_status === 0`
  * Fixed `canReject` to exclude status 0 (god-level 4+ can reject 1 or 2, level 2-3 can reject 1 only)
  * Updated `viewPO` to set `isEditing` based on `approval_status` (editable if 0, read-only if >0)
  * Added `currentPO` ref for tracking viewed/edited PO
  * Improved confirmation dialogs for approve/reject/delete
  * Updated `closeModal` to clear `currentPO` and reset `isEditing`
  * Added `deletePurchaseOrder` method to procurement store

---

## 1. DELETE BUTTON VISIBILITY

**Rule**: Delete button should be visible when:
```javascript
status === 'draft' OR approval_status === 0
```

**Reasoning**: 
- Items in draft or pending (approval_status = 0) state can be deleted
- Once approved (approval_status > 0), items should be rejected instead of deleted for audit trail

**Implementation**:
```vue
<button 
  v-if="item.status === 'draft' || (item.approval_status || 0) === 0"
  @click="deleteItem(item.id)"
  class="...">
  Delete
</button>
```

---

## 2. REJECT BUTTON LOGIC

**Rule**: Reject button visibility and permissions based on user level and item status:

| Status | User Level 1-2 | User Level 3 | User Level 4+ (God) |
|--------|----------------|--------------|---------------------|
| 0      | No button (use DELETE) | No button (use DELETE) | No button (use DELETE) |
| 1      | No button | Yes (→0) | Yes (→0) |
| 2      | No button | No button | Yes (→0) |

**Implementation in `useApprovalWorkflow.ts`**:
```typescript
const canReject = computed(() => {
  if (currentStatus.value === 0) return false; // Use delete instead
  if (userLevel.value >= 4) {
    return currentStatus.value === 1 || currentStatus.value === 2;
  }
  if (userLevel.value >= 2) {
    return currentStatus.value === 1;
  }
  return false;
});
```

---

## 3. CONFIRMATION DIALOGS

**Rule**: ALL destructive or approval actions MUST have confirmation dialogs

**Required Confirmations**:
- **Approve**: `"Approve [MODULE]? Pastikan semua data sudah benar."`
- **Reject**: `"Reject dan kembalikan [MODULE] ke pending?"`
- **Delete**: `"Delete this draft [MODULE]? This action cannot be undone."`

**Implementation**:
```typescript
const approveItem = async (id: number) => {
  if (!confirm('Approve PR? Pastikan semua data sudah benar.')) return;
  // ... proceed with approval
};

const rejectItem = async (id: number) => {
  if (!confirm('Reject dan kembalikan PR ke pending?')) return;
  // ... proceed with rejection
};

const deleteItem = async (id: number) => {
  if (!confirm('Delete this draft PR? This action cannot be undone.')) return;
  // ... proceed with deletion
};
```

---

## 4. VIEW/EDIT EDITABLE STATE

**Rule**: Form editability based on approval status

| Approval Status | isEditing | Form State | Save Button |
|-----------------|-----------|------------|-------------|
| 0 (Pending)     | false     | Editable   | Visible     |
| 1+ (Approved)   | true      | Read-only  | Hidden      |

**Implementation**:
```typescript
// When opening view/edit modal
const viewItem = (item: any) => {
  currentItem.value = item;
  isEditing.value = (item.approval_status || 0) > 0;
  showModal.value = true;
};

// When closing modal
const closeModal = () => {
  showModal.value = false;
  currentItem.value = null;
  isEditing.value = false;
};
```

**In Template**:
```vue
<input 
  :disabled="isEditing"
  v-model="formData.field"
  class="...">

<button 
  v-if="!isEditing"
  @click="saveChanges">
  Save Changes
</button>
```

---

## 5. MANDATORY FIELDS

**Rule**: Critical transaction fields MUST be mandatory

**Common Mandatory Fields**:
- **Quantity**: `required`, `min="1"`, `type="number"`
- **Item/Product Selection**: `required`
- **Department**: `required`
- **Date**: `required`
- **Unit of Measure**: `required`

**Optional but Recommended**:
- **Specification**: Important for quality control (use textarea with min-width)
- **Notes**: Optional context field

**Implementation**:
```vue
<input 
  type="number"
  v-model.number="item.qty"
  required
  min="1"
  class="border"
  :class="{'border-red-500': !item.qty}">
```

---

## 6. TABLE COLUMN FLEXIBILITY

**Rule**: Use `min-width` inline styles instead of fixed Tailwind classes

**Why**: 
- Fixed widths (w-16, w-32) don't adapt to varying content lengths
- Min-width allows columns to expand as needed while maintaining minimum readable width
- Better responsive design

**Standard Column Widths**:
```vue
<!-- Item/Product Name -->
<th style="min-width: 200px;">Item</th>

<!-- Numeric Fields (Qty, Price, etc.) -->
<th style="min-width: 80px;">Qty</th>
<th style="min-width: 120px;">Unit Price</th>
<th style="min-width: 140px;">Total</th>

<!-- Text Fields (UoM, Category, etc.) -->
<th style="min-width: 80px;">UoM</th>
<th style="min-width: 150px;">Category</th>

<!-- Long Text Fields (Specification, Notes) -->
<th style="min-width: 180px;">Specification</th>
<th style="min-width: 200px;">Notes</th>

<!-- Action Buttons -->
<th style="min-width: 100px;">Actions</th>
```

**For Textarea Fields**:
```vue
<textarea
  v-model="item.specification"
  rows="2"
  class="w-full border rounded px-2 py-1 resize-vertical"
  style="min-width: 180px;">
</textarea>
```

---

## 7. APPROVAL WORKFLOW COMPOSABLE

**Rule**: ALL transaction modules MUST use `useApprovalWorkflow` composable

**Implementation**:
```typescript
import { useApprovalWorkflow } from '@/composables/useApprovalWorkflow';

const { 
  canApprove, 
  canReject, 
  getNextApprovalStatus,
  getApprovalLabel 
} = useApprovalWorkflow(
  computed(() => currentItem.value?.approval_status || 0)
);
```

**Benefits**:
- Centralized approval logic
- Consistent behavior across all modules
- Easier to maintain and update

---

## 8. BACKEND DELETE ENDPOINT PATTERN

**Rule**: All transaction DELETE endpoints must check status before deletion

**Implementation**:
```typescript
// backend/src/routes/[module].routes.ts
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  // Check current status
  const item = db.prepare('SELECT status FROM [table] WHERE id = ?').get(id);
  
  if (!item) {
    return res.status(404).json({ error: '[Item] not found' });
  }
  
  if (item.status !== 'draft') {
    return res.status(400).json({ 
      error: 'Only draft [items] can be deleted' 
    });
  }
  
  // Delete related items first (if any)
  db.prepare('DELETE FROM [table]_items WHERE [table]_id = ?').run(id);
  
  // Delete main record
  db.prepare('DELETE FROM [table] WHERE id = ?').run(id);
  
  res.json({ message: '[Item] deleted successfully' });
});
```

---

## 9. FRONTEND DELETE FUNCTION PATTERN

**Rule**: Frontend delete functions must call API and refresh list

**Implementation**:
```typescript
// stores/[module].ts
const delete[Item] = async (id: number) => {
  if (!confirm('Delete this draft [item]? This action cannot be undone.')) {
    return;
  }
  
  try {
    await api.delete(`/[module]/${id}`);
    await fetch[Items](); // Refresh list
  } catch (error: any) {
    console.error('Failed to delete [item]:', error);
    alert(error.response?.data?.error || 'Failed to delete [item]');
  }
};
```

---

## 10. APPROVAL STATUS LEVELS

**Standard Status Values**:
- `0` = Pending / Not Started
- `1` = Supervisor Approved
- `2` = Fully Approved (Manager/Final)

**User Permission Levels**:
- `1` = Staff (Create only)
- `2` = Supervisor (Approve 0→1)
- `3` = Manager (Approve 1→2)
- `4+` = Director/God (Override all, direct approval)

---

## CHECKLIST FOR NEW TRANSACTION MODULES

When creating a new transaction module, ensure:

- [ ] Delete button visible for `status === 'draft' OR approval_status === 0`
- [ ] Reject button uses `canReject` from `useApprovalWorkflow`
- [ ] All approve/reject/delete actions have confirmation dialogs
- [ ] View modal sets `isEditing` based on `approval_status`
- [ ] Critical fields marked as `required` with validation
- [ ] Table columns use `min-width` inline styles (not fixed Tailwind classes)
- [ ] Long text fields use `<textarea>` with `resize-vertical`
- [ ] Backend DELETE endpoint checks `status === 'draft'`
- [ ] Frontend delete function refreshes list after successful deletion
- [ ] Module uses `useApprovalWorkflow` composable for approval logic

---

## MODULES CURRENTLY COMPLIANT

✅ **PurchaseRequests.vue** - Fully compliant with all rules  
✅ **BOM.vue** - Fully compliant (editable view, approval workflow, confirmations)  
✅ **PurchaseOrders.vue** - Fully compliant (delete button, editable view, approval workflow, confirmations)  
⚠️ **GoodReceipt.vue** - Partial (no multi-level approval, uses simple status-based workflow)  
❌ **Procurement.vue** (Old PO listing) - Deprecated, use PurchaseOrders.vue instead  
❌ **Sales.vue** - No approval workflow needed (simple CRUD)  
❌ **WorkOrders.vue** - No approval workflow needed (simple CRUD)  
❌ **Batches.vue** - No approval workflow needed (status-based workflow)  

**Note**: Approval workflow rules only apply to modules with multi-tier approval requirements (PR, BOM, PO). Simple CRUD modules (Sales, WorkOrders, Batches) and single-tier approval modules (GRN) have different patterns and don't require full compliance.  

---

## MAINTENANCE NOTES

**When updating approval workflow logic**:
1. Update `useApprovalWorkflow.ts` composable first
2. All modules will automatically inherit changes
3. Test with different user levels (1, 2, 3, 4+)
4. Verify confirmation dialogs still work
5. Check delete/reject button visibility

**When adding new transaction modules**:
1. Use PurchaseRequests.vue as reference template
2. Follow checklist above
3. Import and use `useApprovalWorkflow` composable
4. Implement backend DELETE endpoint with status check
5. Test full approval workflow (0→1→2, reject, delete)

---

**Document Version**: 1.0  
**Author**: GitHub Copilot  
**Review Required**: When adding new approval levels or changing workflow logic
