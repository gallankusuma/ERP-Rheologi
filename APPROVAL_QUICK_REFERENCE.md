# QUICK REFERENCE: Approval Workflow Implementation

## ✅ Untuk Modul Baru yang Butuh Approval

Ikuti checklist ini saat membuat modul transaksi baru:

### Backend (Express.js)

```typescript
// 1. DELETE endpoint (hanya allow status='draft')
router.delete('/:id', authMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;
  const item = db.prepare('SELECT status FROM [table] WHERE id = ?').get(id);
  
  if (!item) return res.status(404).json({ error: 'Not found' });
  if (item.status !== 'draft') {
    return res.status(400).json({ error: 'Only draft items can be deleted' });
  }
  
  // Delete items first, then main record
  db.prepare('DELETE FROM [table]_items WHERE [table]_id = ?').run(id);
  db.prepare('DELETE FROM [table] WHERE id = ?').run(id);
  
  res.json({ message: 'Deleted successfully' });
});
```

### Frontend (Vue 3)

```vue
<script setup lang="ts">
import { useApprovalWorkflow } from '@/composables/useApprovalWorkflow';

const currentItem = ref<any>(null);
const { canApprove, canReject } = useApprovalWorkflow(
  computed(() => currentItem.value?.approval_status || 0)
);

// VIEW Function - Set isEditing based on approval_status
const viewItem = (item: any) => {
  currentItem.value = item;
  isEditing.value = (item.approval_status || 0) > 0; // ✅ KEY RULE
  showModal.value = true;
  // ... load item data
};

// CLOSE Modal - Clear state
const closeModal = () => {
  showModal.value = false;
  currentItem.value = null;
  isEditing.value = false; // ✅ Reset
};

// UPDATE Function - For editing existing item (status 0)
const updateItem = async () => {
  if (!currentItem.value?.id) return;
  if (!confirm('Save changes to this item?')) return;
  
  try {
    await store.updateItem(currentItem.value.id, {
      status: currentItem.value.status || 'draft', // Keep existing status
      // ... other fields
    });
    await fetchItems();
    closeModal();
  } catch (error: any) {
    alert(error.response?.data?.error || 'Failed to update');
  }
};

// DELETE Function - With confirmation
const deleteItem = async (id: number) => {
  if (!confirm('Delete this draft item? This action cannot be undone.')) return;
  try {
    await api.delete(`/[module]/${id}`);
    await fetchItems(); // Refresh list
  } catch (error: any) {
    alert(error.response?.data?.error || 'Failed to delete');
  }
};

// APPROVE Function - With confirmation
const approveItem = async (id: number) => {
  if (!confirm('Approve this item? Pastikan semua data sudah benar.')) return;
  try {
    await api.post(`/[module]/${id}/approve`);
    await fetchItems();
  } catch (error: any) {
    alert(error.response?.data?.error || 'Failed to approve');
  }
};

// REJECT Function - With confirmation
const rejectItem = async (id: number) => {
  if (!confirm('Reject dan kembalikan ke pending?')) return;
  try {
    await api.post(`/[module]/${id}/reject`);
    await fetchItems();
  } catch (error: any) {
    alert(error.response?.data?.error || 'Failed to reject');
  }
};
</script>

<template>
  <!-- Table Actions -->
  <td class="px-6 py-4 text-right space-x-2">
    <!-- Approve Button -->
    <button
      v-if="canApprove"
      @click="approveItem(item.id)"
      class="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">
      Approve
    </button>
    
    <!-- Reject Button (status 0 excluded by canReject) -->
    <button
      v-if="canReject"
      @click="rejectItem(item.id)"
      class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700">
      Reject
    </button>
    
    <!-- View Button -->
    <button @click="viewItem(item)" class="text-blue-600 hover:text-blue-900">
      View
    </button>
    
    <!-- Delete Button (status 0 ONLY) -->
    <button
      v-if="item.status === 'draft' || (item.approval_status || 0) === 0"
      @click="deleteItem(item.id)"
      class="text-red-600 hover:text-red-900">
      Delete
    </button>
  </td>
  
  <!-- Modal Form Fields -->
  <input 
    v-model="form.field"
    :disabled="isEditing"
    required
    class="border rounded px-3 py-2" />
    
  <!-- Save Button (hidden when read-only) -->
  <button
    v-if="!isEditing && currentItem"
    @click="updateItem"
    class="px-4 py-2 bg-blue-600 text-white rounded">
    💾 Save Changes
  </button>
  
  <!-- Create Button (only for new items) -->
  <button
    v-if="!isEditing && !currentItem"
    @click="createItem"
    class="px-4 py-2 bg-blue-600 text-white rounded">
    Submit for Approval
  </button>
  
  <!-- Table with min-width -->
  <table>
    <thead>
      <tr>
        <th style="min-width: 200px;">Item</th>
        <th style="min-width: 80px;">Qty *</th>
        <th style="min-width: 140px;">Price</th>
      </tr>
    </thead>
  </table>
</template>
```
Update vs Create** | Check `currentItem` - if exists use update, else create |
| **Confirmation** | ALL approve/reject/delete/upda
## 🎯 Critical Rules (MUST FOLLOW)

| Rule | Implementation |
|------|----------------|
| **Delete Button** | `v-if="status === 'draft' OR approval_status === 0"` |
| **Reject Button** | Use `canReject` from composable (excludes status 0) |
| **Editable View** | `isEditing = (approval_status || 0) > 0` |
| **Confirmation** | ALL approve/reject/delete must have `confirm()` |
| **Table Columns** | Use `style="min-width: Xpx"` NOT fixed Tailwind classes |
| **Composable** | Import `useApprovalWorkflow` for consistent logic |

## 📋 Testing Checklist

- [ ] Delete button shows for status 0, hides for status 1+
- [ ] Reject button shows for status 1+ (based on user level), hides for status 0
- [ ] View opens form in read-only mode if approved (status >0)
- [ ] View opens form in editable mode if pending (status 0)
- [ ] All action buttons have confirmation dialogs
- [ ] Table columns are flexible (min-width, not fixed)
- [ ] Backend DELETE endpoint checks status='draft'
- [ ] Store has delete method that refreshes list

## 🔄 Common Mistakes to Avoid

❌ **WRONG**: `canReject = level >= 2 && status > 0`  
✅ **CORRECT**: Use composable `canReject` (excludes status 0)

❌ **WRONG**: `isEditing = true` (always read-only)  
✅ **CORRECT**: `isEditing = (item.approval_status || 0) > 0`

❌ **WRONG**: Delete without checking status in backend  
✅ **CORRECT**: Check `status === 'draft'` before delete

❌ **WRONG**: No confirmation dialogs  
✅ **CORRECT**: All actions have `confirm()` prompt

❌ **WRONG**: `class="w-32"` (fixed width)  
✅ **CORRECT**: `style="min-width: 140px"` (flexible)

## 📁 Files Modified (Dec 14, 2025)

### Backend
- `backend/src/routes/procurement.routes.ts` - Added DELETE /purchase-orders/:id

### Frontend
- `frontend/src/stores/procurement.ts` - Added deletePurchaseOrder method
- `frontend/src/views/PurchaseOrders.vue` - Full compliance implementation
- `frontend/src/views/PurchaseRequests.vue` - Already compliant
- `frontend/src/views/BOM.vue` - Already compliant

### Documentation
- `APPROVAL_WORKFLOW_RULES.md` - Comprehensive rules document
- `APPROVAL_QUICK_REFERENCE.md` - This file (quick copy-paste guide)

## 🚀 Quick Copy-Paste Templates

### useApprovalWorkflow Import
```typescript
import { useApprovalWorkflow } from '@/composables/useApprovalWorkflow';
const { canApprove, canReject } = useApprovalWorkflow(
  computed(() => currentItem.value?.approval_status || 0)
);
```

### Delete Button Template
```vue
<button
  v-if="item.status === 'draft' || (item.approval_status || 0) === 0"
  @click="deleteItem(item.id)"
  class="text-red-600 hover:text-red-900">
  Delete
</button>
```

### viewItem Template
```typescript
const viewItem = (item: any) => {
  currentItem.value = item;
  isEditing.value = (item.approval_status || 0) > 0;
  showModal.value = true;
  // Load item details...
};
```

### Table Header Template
```vue
<th style="min-width: 200px;">Product</th>
<th style="min-width: 80px;">Qty *</th>
<th style="min-width: 140px;">Price</th>
```

---

**Remember**: Konsistensi adalah kunci! Follow rules ini untuk SEMUA modul transaksi yang butuh approval.
