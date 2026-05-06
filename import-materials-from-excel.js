const XLSX = require('xlsx');
const path = require('path');
const axios = require('axios');

// ========================================
// CONFIGURATION - EDIT THIS SECTION
// ========================================

// 1. Excel file path (put your Excel file name here)
const EXCEL_FILE = 'A1. AHSP Konstruksi bagian 1.xlsx'; // Change this to your file name

// 2. Sheet name in Excel (default: first sheet)
const SHEET_NAME = null; // null = first sheet, or specify like 'Sheet1'

// 3. Column mapping (map your Excel columns to database fields)
const COLUMN_MAPPING = {
  // Excel Column Name -> Database Field
  'kode': 'code',           // Material code/SKU
  'nama': 'name',           // Material name
  'satuan': 'unit',         // Unit (PCS, KG, LTR, etc.)
  'harga': 'price',         // Price
  'jenis': 'category',      // Category/Type (optional)
  'deskripsi': 'description' // Description (optional)
};

// 4. Starting row (set to 2 if row 1 is header, adjust if needed)
const START_ROW = 2;

// 5. API endpoint
const API_URL = 'http://localhost:3001'; // Change if your backend uses different port

// ========================================
// IMPORT LOGIC - NO NEED TO EDIT BELOW
// ========================================

async function importMaterials() {
  try {
    console.log('🚀 Starting Material Import Process...\n');

    // Step 1: Read Excel file
    console.log(`📂 Reading Excel file: ${EXCEL_FILE}`);
    const filePath = path.join(__dirname, EXCEL_FILE);
    const workbook = XLSX.readFile(filePath);
    
    const sheetName = SHEET_NAME || workbook.SheetNames[0];
    console.log(`📄 Using sheet: ${sheetName}`);
    
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    
    console.log(`✅ Found ${data.length} rows in Excel\n`);

    // Step 2: Login to get token
    console.log('🔐 Logging in to API...');
    const loginRes = await axios.post(`${API_URL}/api/auth/login`, {
      email: 'master@admin.com',
      password: 'master'
    });
    
    const token = loginRes.data.token;
    console.log('✅ Login successful!\n');

    // Step 3: Get or create categories and units
    console.log('📦 Fetching existing categories and units...');
    const categoriesRes = await axios.get(`${API_URL}/api/categories`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const unitsRes = await axios.get(`${API_URL}/api/units`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const categories = categoriesRes.data;
    const units = unitsRes.data;
    console.log(`✅ Found ${categories.length} categories, ${units.length} units\n`);

    // Step 4: Process and import materials
    console.log('📥 Importing materials...\n');
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + START_ROW;

      try {
        // Map Excel columns to material object
        const material = {
          sku: String(row[findKey(COLUMN_MAPPING, 'code')] || `MAT-${String(rowNum).padStart(5, '0')}`),
          name: String(row[findKey(COLUMN_MAPPING, 'name')] || '').trim(),
          description: String(row[findKey(COLUMN_MAPPING, 'description')] || '').trim(),
          category: String(row[findKey(COLUMN_MAPPING, 'category')] || 'Raw Material').trim(),
          unit: String(row[findKey(COLUMN_MAPPING, 'unit')] || 'PCS').toUpperCase().trim(),
          standard_cost: parseFloat(row[findKey(COLUMN_MAPPING, 'price')] || 0),
          item_type: 'inventory',
          reorder_point: 0,
          is_active: true
        };

        // Skip empty rows
        if (!material.name || material.name === '') {
          skippedCount++;
          continue;
        }

        // Get or create category
        let categoryId = categories.find(c => 
          c.name.toLowerCase() === material.category.toLowerCase()
        )?.id;

        if (!categoryId) {
          try {
            const catRes = await axios.post(`${API_URL}/api/categories`, {
              name: material.category,
              description: `Auto-created from import`,
              active: true
            }, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            categoryId = catRes.data.id;
            categories.push(catRes.data);
            console.log(`   ➕ Created new category: ${material.category}`);
          } catch (err) {
            categoryId = 1; // Default to first category
          }
        }

        // Get or create unit
        let uomId = units.find(u => 
          u.code.toUpperCase() === material.unit.toUpperCase()
        )?.id;

        if (!uomId) {
          try {
            const unitRes = await axios.post(`${API_URL}/api/units`, {
              code: material.unit,
              name: material.unit,
              category: 'general',
              description: `Auto-created from import`,
              active: true
            }, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            uomId = unitRes.data.id;
            units.push(unitRes.data);
            console.log(`   ➕ Created new unit: ${material.unit}`);
          } catch (err) {
            uomId = 1; // Default to first unit
          }
        }

        // Create product/material
        const productPayload = {
          sku: material.sku,
          name: material.name,
          description: material.description || material.name,
          category_id: categoryId,
          uom_id: uomId,
          item_type: material.item_type,
          standard_cost: material.standard_cost,
          selling_price: material.standard_cost * 1.3, // 30% markup
          reorder_point: material.reorder_point,
          is_active: material.is_active
        };

        try {
          await axios.post(`${API_URL}/api/products`, productPayload, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          successCount++;
          console.log(`   ✅ Row ${rowNum}: ${material.name} (${material.sku}) - Rp ${material.standard_cost.toLocaleString('id-ID')}`);
        } catch (err) {
          if (err.response?.status === 409 || err.response?.data?.error?.includes('UNIQUE')) {
            // Product already exists, try to update
            try {
              const existingRes = await axios.get(`${API_URL}/api/products?sku=${material.sku}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              
              if (existingRes.data?.length > 0) {
                const existingId = existingRes.data[0].id;
                await axios.put(`${API_URL}/api/products/${existingId}`, productPayload, {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                successCount++;
                console.log(`   🔄 Row ${rowNum}: Updated ${material.name} (${material.sku})`);
              }
            } catch (updateErr) {
              errorCount++;
              console.log(`   ⚠️ Row ${rowNum}: Skipped (already exists) - ${material.name}`);
            }
          } else {
            throw err;
          }
        }

      } catch (err) {
        errorCount++;
        console.error(`   ❌ Row ${rowNum}: Error - ${err.response?.data?.error || err.message}`);
      }
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`📊 Total: ${data.length}`);
    console.log('='.repeat(60));
    console.log('\n🎉 Import process completed!\n');

  } catch (err) {
    console.error('\n❌ FATAL ERROR:');
    console.error(err.response?.data || err.message);
    console.error('\nStack trace:', err.stack);
    process.exit(1);
  }
}

// Helper function to find key in mapping object
function findKey(mapping, value) {
  return Object.keys(mapping).find(key => mapping[key] === value) || '';
}

// Run the import
importMaterials();
