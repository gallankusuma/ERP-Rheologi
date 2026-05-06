# Universal Item Display Rules

## Overview
To maintain consistency across the ERP system, all item collections must follow these display rules.

## Rule 1: Vertical Item List Display

### When to Apply
- Whenever displaying **multiple items** (2 or more) in a table cell or UI section
- PR items listing
- PO items listing  
- GRN items listing
- Any other item collections (Batch items, Quality items, etc.)

### How to Apply

#### Option 1: Use `ItemsList` Component (Recommended)
```vue
<ItemsList 
  :items="items" 
  :show-quantity="true"
  :show-price="false"
/>
```

**Props:**
- `items` (Array): Array of item objects
- `showQuantity` (Boolean, default: true): Display quantity with UoM
- `showPrice` (Boolean, default: false): Display unit price

**Flexible Field Support:**
- Item name: `productName` or `name`
- Quantity: `qty` or `quantity`
- Unit: `uom` or `unit`
- Price: `price` or `unit_price`

#### Option 2: Manual Template (for complex scenarios)
```vue
<div v-if="!items || items.length === 0" class="text-gray-500">-</div>
<div v-else class="space-y-1">
  <div v-for="(item, idx) in items" :key="idx" class="text-xs py-0.5">
    <span class="font-semibold text-gray-900">{{ item.productName || item.name }}</span>
    <span class="text-gray-600">({{ item.qty || 0 }}{{ item.uom ? ' ' + item.uom : '' }})</span>
  </div>
</div>
```

#### Option 3: Backend String Aggregation (for List queries)
When aggregating items in backend GROUP_CONCAT query:
```sql
GROUP_CONCAT(
  item_name || ' (' || COALESCE(quantity, 0) || ' ' || COALESCE(uom, '') || ')',
  ' | '
) as items_description
```

Then format on frontend:
```typescript
function formatItemsDescription(description: string | null): string {
  if (!description) return '-';
  return description
    .split('|')
    .map(item => item.trim())
    .filter(item => item.length > 0)
    .join('\n');
}
```

### Display Format

**Before (Old Style):**
```
Bottle 500ml (100 pcs) • Energy Drink (50 ctn) • Coffee (25 kg)
```

**After (New Style):**
```
Bottle 500ml (100 pcs)
Energy Drink (50 ctn)
Coffee (25 kg)
```

### Styling Classes
- Container: `space-y-1` (small vertical spacing)
- Item wrapper: `text-xs py-0.5` (small text, light padding)
- Item name: `font-semibold text-gray-900` (bold, dark)
- Item details: `text-gray-600` (gray for qty, uom, price)

## Rule 2: Always Include Quantity with Item Display

### When to Apply
- **ALWAYS** include quantity (qty) and unit of measure (UOM) whenever displaying item names
- This applies to all contexts: lists, tables, modals, detail views, aggregated strings

### Format Standard
```
Item Name (Qty UOM)
```

**Examples:**
- ✅ Bottle 500ml (100 pcs)
- ✅ Energy Drink (50 ctn)
- ✅ Coffee (25 kg)
- ❌ Bottle 500ml (without qty)
- ❌ 100 pcs (without item name)

### Why This Rule?
- **Clarity**: Quantity immediately visible with item name
- **Completeness**: Full picture at a glance (what + how much)
- **Consistency**: Users always see same format everywhere
- **Scanning**: Easier to quickly scan and compare items

### Backend Implementation
When aggregating items in database queries:
```sql
-- Include UOM in GROUP_CONCAT
COALESCE(item_name, '') || ' (' || COALESCE(qty, 0) || ' ' || COALESCE(uom, '') || ')'

-- Example for SQLite
item_name || ' (' || qty || ' ' || uom || ')'

-- Example for MySQL
CONCAT(item_name, ' (', qty, ' ', uom, ')')
```

### Frontend Implementation
Ensure `showQuantity` is **always true** in ItemsList component:
```vue
<!-- Always show qty -->
<ItemsList :items="items" :show-quantity="true" />

<!-- Never do this -->
<ItemsList :items="items" :show-quantity="false" />  <!-- ❌ Wrong -->
```

## Exceptions

### Single Item Display
If an item collection has only **1 item**, display inline is acceptable:
```
Bottle 500ml (100 pcs)
```

### Table Cell Width
Set `max-w-md` or `max-w-lg` on parent `<td>` to prevent excessive width:
```vue
<td class="px-6 py-4 text-sm text-gray-700 max-w-md">
  <ItemsList :items="items" />
</td>
```

## Implementation Checklist

When adding item display to any view:
- [ ] Use `ItemsList` component if item structure is standard
- [ ] Add `max-w-*` class to prevent excessive cell width
- [ ] Show quantity by default (unless space is critical)
- [ ] Show price only when necessary (e.g., PO detail view)
- [ ] Handle empty items gracefully (show "-")
- [ ] Test with 1 item, 3+ items scenarios

## Files Using These Rules

### Current Implementation (Rule 1: Vertical Display)
- `frontend/src/components/ItemsList.vue` - Reusable component
- `frontend/src/views/PurchaseRequests.vue` - PR list table (using ItemsList component)

### Current Implementation (Rule 2: Include Quantity)
- `frontend/src/views/PurchaseRequests.vue` - PR list (format: Item (Qty UOM))
- `frontend/src/views/PurchaseOrders.vue` - PO list (format: Item (Qty UOM))
- `backend/src/routes/procurement.routes.ts` - Backend aggregation includes quantity

### To Be Updated
- `frontend/src/views/GoodReceipt.vue` - GRN items listing
- `frontend/src/views/Batches.vue` - Batch items
- `frontend/src/views/Quality.vue` - Quality items
- Any other item-listing views

## Summary

### Quick Checklist for New Item Display Features

1. **Is it multiple items?**
   - YES → Use vertical layout (Rule 1)
   - NO → Single item is ok inline

2. **Does it show quantity?**
   - YES → Format as `Item Name (Qty UOM)` (Rule 2)
   - NO → Add quantity! It's required

3. **Which approach?**
   - Structured items → Use `ItemsList` component
   - Aggregated string → Format with `formatItemsDescription()`
   - Backend query → Include qty in GROUP_CONCAT

4. **Styling correct?**
   - Bold item names → `font-semibold text-gray-900`
   - Gray qty/uom → `text-gray-600`
   - Small spacing → `space-y-1`

## Future Enhancements

- [ ] Support for item icons/badges (inventory vs non-inventory)
- [ ] Tooltip on hover for long item names
- [ ] Expandable item list for 5+ items ("Show more" button)
- [ ] Item filtering/search in large lists

