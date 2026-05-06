# Form Validation & UI Components Setup

## Phase 1: Installed ✅

### 1. **VeeValidate + Zod** 
- **VeeValidate**: Form validation library for Vue 3
- **Zod**: TypeScript-first schema validation

### 2. **Created Reusable Components**

#### FormField Component (`src/components/FormField.vue`)
Reusable form input component supporting:
- Text inputs
- Textarea
- Select dropdowns
- Error display
- Required field indicators

**Usage Example:**
```vue
<FormField
  name="sku"
  label="SKU"
  type="text"
  placeholder="e.g., PROD-001"
  required
  :model-value="values.sku"
  :error="errors.sku"
  @update:model-value="(val) => { values.sku = val }"
/>
```

#### DataTable Component (`src/components/DataTable.vue`)
Reusable table component supporting:
- Column definitions with custom rendering
- Row actions (Edit, Delete, etc.)
- Pagination controls
- Hover effects

**Usage Example:**
```vue
<DataTable
  :columns="tableColumns"
  :rows="products"
  :actions="tableActions"
  :pagination="pagination"
  @prev-page="previousPage"
  @next-page="nextPage"
/>
```

### 3. **Validation Schemas** (`src/schemas/forms.ts`)
Pre-built Zod schemas for:
- Product form validation
- Category form validation
- BOM form validation

**Features:**
- String length validation
- Number min/max validation
- Custom error messages
- Enum validation for dropdowns

### 4. **Form Composable** (`src/composables/useFormValidation.ts`)
Composable for form handling:
- Centralized validation logic
- Error state management
- Submission handling
- Form reset

**Usage:**
```typescript
const { handleSubmit, values, errors, isSubmitting, resetForm } = useFormValidation(
  productSchema,
  async (data) => {
    await api.post('/products', data);
  },
  initialValues
);
```

### 5. **Enhanced API Interceptors** (`src/lib/api.ts`)
- **Request Interceptor**: Auto-inject JWT token
- **Response Interceptor**:
  - Handle 401 (redirect to login)
  - Handle 403 (permission denied)
  - Handle 404 (not found)
  - Handle 500 (server error)
  - Trigger error notifications

### 6. **Error Notification System** (`src/App.vue`)
- Global error toast at top-right
- Auto-dismiss after 5 seconds
- Integrated with API interceptor

## Example Implementation

See `src/views/ProductForm.vue` for complete example using:
- FormField components
- useFormValidation composable
- productSchema validation
- Error handling
- Form submission

## Next Steps (Phase 2)

1. **shadcn-vue Installation** - Premium UI components
2. **Apply to All Existing Forms** - Products, Categories, BOM, etc.
3. **Permission Directives** - v-permission for RBAC
4. **Server-side DataTable** - Pagination/filter/sort on backend

## Architecture Flow

```
User Input (FormField)
    ↓
VeeValidate (Validation)
    ↓
Zod Schema (Type Safety)
    ↓
useFormValidation Composable (Form Logic)
    ↓
API Call (api.post/put/delete)
    ↓
Interceptor (Token + Error Handling)
    ↓
Error Callback (Toast Notification)
```
