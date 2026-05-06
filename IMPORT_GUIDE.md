# 📥 Material Import Guide

## ✅ What Was Imported

Your AHSP data has been imported successfully:
- **16 Labor Items** (Pekerja, Tukang, Mandor, etc.) - SKU: L.01 to L.16
- **Materials** - Various construction materials

## 🎯 Simple Material Import Method

If you have material pricing data in Excel with simple columns, use this method:

### Step 1: Prepare Your Excel File

Create a simple Excel with these columns:

| Code      | Name            | Unit | Price    | Category      |
|-----------|-----------------|------|----------|---------------|
| SEMEN-001 | Semen Portland  | KG   | 1500     | Bahan         |
| PASIR-001 | Pasir Beton     | M3   | 190000   | Bahan         |
| BATU-001  | Batu Split      | M3   | 250000   | Bahan         |
| BESI-001  | Besi Beton 10mm | KG   | 12000    | Bahan         |

### Step 2: Edit Column Mapping

Edit `import-materials-from-excel.js` file and update the COLUMN_MAPPING section:

```javascript
const COLUMN_MAPPING = {
  'Code': 'code',
  'Name': 'name',
  'Unit': 'unit',
  'Price': 'price',
  'Category': 'category'
};
```

### Step 3: Run Import

```bash
node import-materials-from-excel.js
```

## 📊 View Imported Data

### Via API (Command Line)
```bash
# Login first
$token = (Invoke-RestMethod -Uri http://localhost:3001/api/auth/login -Method POST -Body (@{email='master@admin.com';password='master'}|ConvertTo-Json) -ContentType 'application/json').token

# Get all products
$products = (Invoke-RestMethod -Uri http://localhost:3001/api/products -Headers @{Authorization="Bearer $token"})
$products | ConvertTo-Json

# Filter labor items only
$products | Where-Object { $_.sku -like 'L.*' }

# Filter materials only
$products | Where-Object { $_.sku -like 'MAT-*' }
```

### Via Frontend
1. Navigate to `http://localhost:5173`
2. Login with: master@admin.com / master
3. Go to **Products** module
4. You'll see all imported materials

## 🔧 Available Import Scripts

### 1. `import-ahsp-materials.js`
- Imports from complex AHSP Excel format
- Extracts labor and materials from multiple sheets
- Good for AHSP Construction data

### 2. `import-materials-from-excel.js`
- Simple Excel importer
- Works with any Excel that has columns: Code, Name, Unit, Price
- Customizable column mapping

### 3. Direct SQL Insert (Advanced)
If you have CSV/SQL data, you can directly insert:

```sql
INSERT INTO products (sku, name, description, category_id, uom_id, item_type, standard_cost, selling_price, is_active)
VALUES ('CEMENT-001', 'Portland Cement 50kg', 'Standard portland cement', 1, 1, 'inventory', 65000, 75000, 1);
```

## 🎨 Update Prices for Existing Items

If you want to update prices for labor items that currently have Rp 0:

### Edit `import-ahsp-materials.js`:
```javascript
const DEFAULT_LABOR_PRICES = {
  'Pekerja': 100000,
  'Tukang': 150000,
  'Kepala tukang': 175000,
  'Mandor': 200000,
  'Juru ukur': 180000,
  'Operator': 160000,
  'Sopir': 140000
};
```

Then run: `node import-ahsp-materials.js`

## 📞 Need Help?

Just tell me:
1. What format is your pricing data in? (Excel columns, CSV, etc.)
2. Do you want to update existing items or add new ones?
3. Show me a sample of your data structure

I can create a custom import script for your exact format!

## 🚀 Quick Commands

```bash
# Analyze your Excel structure
node analyze-excel.js

# Import from simple Excel
node import-materials-from-excel.js

# Import from AHSP Excel
node import-ahsp-materials.js

# Check what's in database
node -e "const axios = require('axios'); (async () => { const login = await axios.post('http://localhost:3001/api/auth/login', {email: 'master@admin.com', password: 'master'}); const token = login.data.token; const products = await axios.get('http://localhost:3001/api/products', {headers: {'Authorization': 'Bearer ' + token}}); console.log('Total:', products.data.length); products.data.forEach(p => console.log(p.sku, '-', p.name, '-', p.standard_cost)); })();"
```
