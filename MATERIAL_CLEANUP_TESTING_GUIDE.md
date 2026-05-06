# Master Data Cleanup Features - Complete Testing Guide

## ✅ Implementation Status
Frontend and Backend fully implemented and code-verified for **Materials** and **Vendors**.

### Material Cleanup
- **Frontend**: [frontend/src/views/EstimatorMasters.vue](frontend/src/views/EstimatorMasters.vue)
- **Backend**: [backend/src/routes/import.routes.ts](backend/src/routes/import.routes.ts) - POST `/api/import/materials/cleanup`

### Vendor Cleanup  
- **Frontend**: [frontend/src/views/Procurement.vue](frontend/src/views/Procurement.vue)
- **Backend**: [backend/src/routes/import.routes.ts](backend/src/routes/import.routes.ts) - POST `/api/import/vendors/cleanup`

---

## Features Overview

### Material Cleanup & Standardize (EstimatorMasters)
The feature automatically:
1. **Normalizes** material data (names, unit codes, categories)
2. **Deduplicates** materials keeping first occurrence
3. **Standardizes** codes from `MAT-CSV-*` to `MT-2026-####` format

### Vendor Cleanup & Standardize (Procurement)
The feature automatically:
1. **Normalizes** vendor data (names, contact information)
2. **Deduplicates** vendors keeping first occurrence
3. **Standardizes** codes from `VENDOR-CSV-*` to `VND-2026-####` format

---

## Frontend Implementation - MATERIALS

### Button Location
**Tab**: Materials (Bahan / Material)  
**Position**: Top-right toolbar, orange button labeled "🧹 Cleanup & Standardize"

### Button Behavior
- **Default State**: "🧹 Cleanup & Standardize" (clickable)
- **Processing State**: "⏳ Cleaning..." (disabled, showing loader)
- **After Completion**: Shows success alert with detailed results

### Code Location
- **Button Component**: [Line 130-136](frontend/src/views/EstimatorMasters.vue#L130-L136)
- **State Variable**: `isCleaningUp` at [Line 657](frontend/src/views/EstimatorMasters.vue#L657)
- **Handler Function**: `cleanupMaterials()` at [Line 659-686](frontend/src/views/EstimatorMasters.vue#L659-L686)

### Function Details
```javascript
const cleanupMaterials = async () => {
  // 1. Shows confirmation dialog explaining what will happen
  // 2. Sets isCleaningUp = true (disables button)
  // 3. Calls POST /api/import/materials/cleanup
  // 4. Reloads materials list
  // 5. Shows detailed results alert
  // 6. Sets isCleaningUp = false (re-enables button)
}
```

---

## Frontend Implementation - VENDORS

### Button Location
**Page**: Procurement  
**Section**: Vendors (top of the page)  
**Position**: Next to "Save" button, orange button labeled "🧹 Cleanup & Standardize"

### Button Behavior
- **Default State**: "🧹 Cleanup & Standardize" (clickable)
- **Processing State**: "⏳ Cleaning..." (disabled, showing loader)
- **After Completion**: Shows success alert with detailed results

### Code Location
- **Button Component**: [Line 26-32](frontend/src/views/Procurement.vue#L26-L32)
- **State Variable**: `isCleaningUpVendors` at [Line 217](frontend/src/views/Procurement.vue#L217)
- **Handler Function**: `cleanupVendors()` at [Line 256-278](frontend/src/views/Procurement.vue#L256-L278)

### Function Details
```javascript
const cleanupVendors = async () => {
  // 1. Shows confirmation dialog explaining what will happen
  // 2. Sets isCleaningUpVendors = true (disables button)
  // 3. Calls POST /api/import/vendors/cleanup
  // 4. Reloads vendors list via store.fetchVendors()
  // 5. Shows detailed results alert
  // 6. Sets isCleaningUpVendors = false (re-enables button)
}
```

---

## Backend Implementation

### Endpoint Details
- **Method**: POST
- **Route**: `/api/import/materials/cleanup`
- **Auth**: Requires `authMiddleware` (JWT token required)
- **Code Location**: [Line 392-404](backend/src/routes/import.routes.ts#L392-L404)

### Processing Function
**Function**: `cleanupImportedMaterials()`  
**Location**: [Line 1049-1175](backend/src/routes/import.routes.ts#L1049-L1175)

#### Phase 1: Normalization (Lines 1058-1110)
```
Input Tables: master_materials where code LIKE 'MAT-CSV-%' OR code LIKE 'MT-2026-%'

Normalizations Applied:
- Vendor names: normalizeText() → Title Case, no special chars
- Material "jenis": normalizeJenis() → Standardized categories
- Material names: normalizeText() → Title Case
- Units (satuan): normalizeSatuan() → Standardized unit codes

Output: normalizedRows count
```

#### Phase 2: Deduplication (Lines 1112-1128)
```
Input: Normalized master_materials rows

Duplicate Key: name + jenis + satuan + harga + vendor_id

Logic:
- First occurrence: KEEP (is_active = 1)
- Subsequent occurrences: DEACTIVATE (is_active = 0)

Output: duplicateDeactivated count
```

#### Phase 3: Code Standardization (Lines 1130-1161)
```
Input: master_materials where code LIKE 'MAT-CSV-%' AND is_active = 1

Logic:
- Find max existing code like 'MT-2026-####'
- For each MAT-CSV row:
  - Increment sequence
  - Assign new code: MT-2026-{sequence padded to 4 digits}
  - Verify no collision with existing codes

Output:
- codesStandardized count
- standardizedRange: "MT-2026-0001..MT-2026-0042"
```

### Response Format
```json
{
  "success": true,
  "message": "Material cleanup completed",
  "result": {
    "normalizedRows": 45,
    "duplicateDeactivated": 12,
    "codesStandardized": 38,
    "standardizedRange": "MT-2026-0001..MT-2026-0038"
  }
}
```

---

## Backend Implementation - VENDORS

### Endpoint Details
- **Method**: POST
- **Route**: `/api/import/vendors/cleanup`
- **Auth**: Requires `authMiddleware` (JWT token required)
- **Code Location**: [Line 407-421](backend/src/routes/import.routes.ts#L407-L421)

### Processing Function
**Function**: `cleanupImportedVendors()`  
**Location**: [Line 1185-1285](backend/src/routes/import.routes.ts#L1185-L1285)

#### Phase 1: Normalization (Lines 1198-1210)
```
Input Tables: vendors where code LIKE 'VENDOR-CSV-%' OR code LIKE 'VND-2026-%'

Normalizations Applied:
- Vendor names: normalizeText() → Title Case, no special chars
- Contact info: normalizeText() → Title Case

Output: normalizedRows count
```

#### Phase 2: Deduplication (Lines 1212-1228)
```
Input: Normalized vendors rows

Duplicate Key: name + contact + email

Logic:
- First occurrence: KEEP (is_active = 1)
- Subsequent occurrences: DEACTIVATE (is_active = 0)

Output: duplicateDeactivated count
```

#### Phase 3: Code Standardization (Lines 1230-1260)
```
Input: vendors where code LIKE 'VENDOR-CSV-%' AND is_active = 1

Logic:
- Find max existing code like 'VND-2026-####'
- For each VENDOR-CSV row:
  - Increment sequence
  - Assign new code: VND-2026-{sequence padded to 4 digits}
  - Verify no collision with existing codes

Output:
- codesStandardized count
- standardizedRange: "VND-2026-0001..VND-2026-0015"
```

### Response Format
```json
{
  "success": true,
  "message": "Vendor cleanup completed",
  "result": {
    "normalizedRows": 8,
    "duplicateDeactivated": 3,
    "codesStandardized": 7,
    "standardizedRange": "VND-2026-0001..VND-2026-0007"
  }
}
```

---

## Testing Procedures

### Prerequisites
1. **Database**: MySQL/MariaDB running on localhost:3306
2. **Backend**: Node.js server running on localhost:3000
3. **Frontend**: Vite dev server running on localhost:5173
4. **Authentication**: Valid JWT token in localStorage

### Startup Commands
```bash
# In workspace root
npm run dev

# Or separately:
npm run dev:backend    # Terminal 1
npm run dev:frontend   # Terminal 2
```

### Test Case 1: Basic Cleanup
**Objective**: Verify button visibility and basic cleanup execution

1. Navigate to `http://localhost:5173`
2. Go to **Estimator Masters** → **Materials** tab
3. Verify button exists: "🧹 Cleanup & Standardize"
4. Click button
5. Confirm dialog appears asking to:
   - Normalize names/units
   - Deactivate duplicates
   - Standardize codes to `MT-2026-xxxx`
6. Click "OK" to proceed
7. Button changes to "⏳ Cleaning..." (disabled)
8. Success alert appears with results
9. Button returns to normal state

**Expected Results**:
- ✅ At least one message shows non-zero count (or "0..." if no data)
- ✅ Standardized range format: `MT-2026-xxxx..MT-2026-yyyy`
- ✅ View refreshes and shows updates

### Test Case 2: Data Verification

**Before Cleanup** (Browser DevTools > Network > /materials):
```
Material List:
[
  { id: 1, "code": "MAT-CSV-001", "jenis": "Steel", "name": " steel plate ", "satuan": "pcs" },
  { id: 2, "code": "MAT-CSV-002", "jenis": "STEEL", "name": "Steel Plate", "satuan": "pieces" },  // duplicate
  { id: 3, "code": "MAT-CSV-003", "jenis": "Cement", "name": "  CEMENT  ", "satuan": "bag" }
]
```

**After Cleanup** (Check same endpoint):
```
Material List:
[
  { id: 1, "code": "MT-2026-0001", "jenis": "Steel", "name": "Steel Plate", "satuan": "Pcs", "is_active": 1 },
  { id: 2, "code": "MAT-CSV-002", "jenis": "Steel", "name": "Steel Plate", "satuan": "Pcs", "is_active": 0 },  // DEACTIVATED
  { id: 3, "code": "MT-2026-0002", "jenis": "Cement", "name": "Cement", "satuan": "Bag", "is_active": 1 }
]
```

**Check Points**:
- ✅ `MAT-CSV-*` codes → `MT-2026-####`
- ✅ Jenis normalized (case-fixed, standardized)
- ✅ Names trimmed and title-cased
- ✅ Satuan standardized
- ✅ Duplicates deactivated (`is_active = 0`)
- ✅ No data loss (all rows still exist)

### Test Case 3: Idempotency

**Run the cleanup twice** in succession:

1. First run: Click button, confirm, wait for completion
2. Verify results (e.g., 5 codes standardized)
3. Second run: Click button again, confirm
4. Verify results (should show "codesStandardized: 0" since all already standardized)

**Expected**: Second run should show minimal/no changes

### Test Case 4: Error Handling

**Test network error recovery**:
1. Open DevTools Network tab
2. Throttle network to "Offline"
3. Click cleanup button
4. Button shows "⏳ Cleaning..."
5. Timeout error occurs
6. Alert shows: "❌ Gagal cleanup material. Coba lagi."
7. Button re-enables for retry

**Test API failure**:
1. Backend API returns 500 error
2. Alert shows: "❌ Gagal cleanup material. Coba lagi."
3. Materials list doesn't reload (preserves current state)

---

## Testing Procedures - VENDORS

### Test Case 1: Basic Vendor Cleanup
**Objective**: Verify vendor cleanup button visibility and basic execution

1. Navigate to `http://localhost:5173`
2. Go to **Procurement** page
3. Find **Vendors** section at the top
4. Verify button exists: "🧹 Cleanup & Standardize"
5. Click button
6. Confirm dialog appears asking to:
   - Normalize names/contact
   - Deactivate duplicates
   - Standardize codes to `VND-2026-xxxx`
7. Click "OK" to proceed
8. Button changes to "⏳ Cleaning..." (disabled)
9. Success alert appears with results
10. Button returns to normal state
11. Vendors list refreshes

**Expected Results**:
- ✅ At least one message shows non-zero count (or "0..." if no data)
- ✅ Standardized range format: `VND-2026-xxxx..VND-2026-yyyy`
- ✅ Vendor table updates with new data

### Test Case 2: Vendor Data Verification

**Before Cleanup** (Database or API call to `/procurement/vendors`):
```
Vendor List:
[
  { id: 1, "code": "VENDOR-CSV-001", "name": " PT Semen Gresik ", "contact": "john doe" },
  { id: 2, "code": "VENDOR-CSV-002", "name": "PT Semen Gresik", "contact": "JOHN DOE" },  // DUPLICATE
  { id: 3, "code": "VENDOR-CSV-003", "name": "PT Besi Sumber", "contact": "ali" }
]
```

**After Cleanup**:
```
Vendor List:
[
  { id: 1, "code": "VND-2026-0001", "name": "PT Semen Gresik", "contact": "John Doe", "is_active": 1 },
  { id: 2, "code": "VENDOR-CSV-002", "name": "PT Semen Gresik", "contact": "John Doe", "is_active": 0 },  // DEACTIVATED
  { id: 3, "code": "VND-2026-0002", "name": "PT Besi Sumber", "contact": "Ali", "is_active": 1 }
]
```

**Check Points**:
- ✅ `VENDOR-CSV-*` codes → `VND-2026-####`
- ✅ Names trimmed and title-cased
- ✅ Contact info normalized (title case)
- ✅ Duplicates deactivated (`is_active = 0`)
- ✅ No data loss (all rows still exist)

### Test Case 3: Vendor Idempotency

**Run the cleanup twice** for vendors:

1. First run: Click cleanup button, confirm, wait for completion
2. Verify results (e.g., "5 kode di-standardisasi")
3. Second run: Click cleanup button again, confirm
4. Verify results (should show "codesStandardized: 0" since all already standardized)

**Expected**: Second run should show minimal/no changes since already standardized

### Test Case 4: Vendor Error Handling

**Test network error recovery**:
1. Open DevTools Network tab
2. Throttle network to "Offline"
3. Click vendor cleanup button
4. Button shows "⏳ Cleaning..."
5. Timeout error occurs
6. Alert shows: "❌ Gagal cleanup vendor. Coba lagi."
7. Button re-enables for retry

**Test API failure**:
1. Backend API returns 500 error
2. Alert shows: "❌ Gagal cleanup vendor. Coba lagi."
3. Vendor list doesn't reload (preserves current state)

---

## Debugging Guide

### Frontend Debugging

**Check if cleanup function is called**:
```javascript
// In browser console
Vue.devtools.openInspector()  // Open Vue DevTools
// Navigate to EstimatorMasters component
// Check: isCleaningUp reactive value
// Try: window.location.reload() to test hot reload
```

**Check API calls**:
```
DevTools > Network tab
Filter: XHR
Click cleanup button
Look for: POST /api/import/materials/cleanup
Check status: 200, 400, 500, timeout
```

**Check button state**:
```html
<!-- Expected DOM in HTML tab -->
<button 
  @click="cleanupMaterials" 
  :disabled="isCleaningUp"
  class="px-3 py-2 bg-orange-600 text-white rounded-lg">
  🧹 Cleanup & Standardize
</button>
```

### Backend Debugging

**Enable request logging**:
```bash
# Backend console should show:
POST /api/import/materials/cleanup received
Database query: SELECT MAX(CAST(SUBSTRING(code, 9) AS UNSIGNED))...
Processing 38 materials...
Cleanup completed: normalized=45, deactivated=12, standardized=38
```

**Database state check**:
```sql
-- Check materials before/after
SELECT code, jenis, name, satuan, is_active 
FROM master_materials 
WHERE code LIKE 'MAT-CSV-%' OR code LIKE 'MT-2026-%'
ORDER BY id;

-- Verify deactivated items
SELECT COUNT(*) as deactivated_count
FROM master_materials
WHERE is_active = 0 AND (code LIKE 'MAT-CSV-%' OR code LIKE 'MT-2026-%');
```

---

## Troubleshooting

### MATERIALS - Issue: Button doesn't appear
- ✅ Check if you're on Materials tab in EstimatorMasters
- ✅ Check browser console for Vue errors
- ✅ Verify EstimatorMasters.vue changes are loaded (hot reload)
- ✅ Hard refresh: `Ctrl+Shift+R`

### MATERIALS - Issue: Click does nothing
- ✅ Check if button is disabled (isCleaningUp = true)
- ✅ Check browser console for JavaScript errors
- ✅ Verify API endpoint is accessible: `curl http://localhost:3000/api/import/materials/cleanup`

### VENDORS - Issue: Button doesn't appear
- ✅ Check if you're on the Procurement page
- ✅ Check browser console for Vue errors
- ✅ Verify Procurement.vue changes are loaded (hot reload)
- ✅ Hard refresh: `Ctrl+Shift+R`

### VENDORS - Issue: Click does nothing
- ✅ Check if button is disabled (isCleaningUpVendors = true)
- ✅ Check browser console for JavaScript errors
- ✅ Verify API endpoint is accessible: `curl http://localhost:3000/api/import/vendors/cleanup`

### General - Issue: Error alert appears
- ✅ Check backend console for server errors
- ✅ Verify JWT token is valid
- ✅ Check database connection
- ✅ Review API response in DevTools Network tab

### MATERIALS - Issue: Materials don't update after cleanup
- ✅ Check if backend returned success (200 status)
- ✅ Verify `loadMaterials()` function was called
- ✅ Check if response contains updated data
- ✅ Check database directly for changes

### VENDORS - Issue: Vendors don't update after cleanup
- ✅ Check if backend returned success (200 status)
- ✅ Verify `store.fetchVendors()` function was called
- ✅ Check if response contains updated data
- ✅ Check database directly for changes

---

## Code Quality Checklist

### Frontend Code (EstimatorMasters.vue & Procurement.vue)
- ✅ Functions are `async`/`await` compliant
- ✅ Error handling: try/catch blocks
- ✅ User feedback: confirmation dialog, loading state, alert notifications
- ✅ State management: `isCleaningUp` / `isCleaningUpVendors` ref properly tracked
- ✅ API calls through configured `api` instance
- ✅ Data reload: `loadMaterials()` / `store.fetchVendors()` called after cleanup
- ✅ TypeScript: Functions properly typed

### Backend Code (import.routes.ts)
- ✅ Routes protected by `authMiddleware`
- ✅ Error handling: try/catch with 500 error response
- ✅ Database queries: parameterized (prevent SQL injection)
- ✅ Transactions: Operations properly sequenced
- ✅ Results returned: All three metrics included (normalizedRows, duplicateDeactivated, codesStandardized)
- ✅ Logging: Console feedback for debugging
- ✅ Response format: Consistent with API standards
- ✅ Code patterns match between materials and vendors (consistency)

---

## Performance Notes

- Expected cleanup time for 1000 materials: < 5 seconds
- Expected cleanup time for 100 vendors: < 2 seconds
- Database queries use indexed fields (code, is_active)
- No frontend blocking during processing
- Results update reflects database state immediately
- All operations are idempotent (safe to run multiple times)

---

## Related Documentation

- [EstimatorMasters.vue](frontend/src/views/EstimatorMasters.vue) - Material Cleanup
- [Procurement.vue](frontend/src/views/Procurement.vue) - Vendor Cleanup
- [Import API Routes](backend/src/routes/import.routes.ts)
- [Database Schema](backend/database/schema.sql)
- [API Documentation](QUICK_REFERENCE.md)

---

**Last Updated**: March 9, 2026  
**Status**: ✅ Fully Implemented - Materials & Vendors  
**Database Requirement**: MySQL 8.0+ / MariaDB 10.4+  
**Features**: Material Cleanup, Vendor Cleanup, Automatic Deduplication, Code Standardization

