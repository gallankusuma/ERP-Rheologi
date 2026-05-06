const XLSX = require('xlsx');
const path = require('path');
const axios = require('axios');

// ========================================
// CONFIGURATION
// ========================================
const EXCEL_FILE = 'A1. AHSP Konstruksi bagian 1.xlsx';
const API_URL = 'http://localhost:3001';

// Import options
const IMPORT_LABOR = true;  // Import from TENAGA sheet
const IMPORT_MATERIALS = true; // Import materials from work sheets

// Default prices for items with 0 price
const DEFAULT_LABOR_PRICES = {
  'Pekerja': 100000,
  'Tukang': 125000,
  'Kepala tukang': 150000,
  'Mandor': 175000
};

// ========================================
// MAIN IMPORT FUNCTION
// ========================================
async function importAHSPData() {
  try {
    console.log('🚀 Starting AHSP Import Process...\n');

    // Step 1: Read Excel file
    console.log(`📂 Reading Excel file: ${EXCEL_FILE}`);
    const filePath = path.join(__dirname, EXCEL_FILE);
    const workbook = XLSX.readFile(filePath);
    console.log(`✅ Found ${workbook.SheetNames.length} sheets\n`);

    // Step 2: Login
    console.log('🔐 Logging in to API...');
    const loginRes = await axios.post(`${API_URL}/api/auth/login`, {
      email: 'master@admin.com',
      password: 'master'
    });
    const token = loginRes.data.token;
    console.log('✅ Login successful!\n');

    // Step 3: Get or create categories and units
    const categories = await getCategories(token);
    const units = await getUnits(token);

    let totalImported = 0;

    // Step 4: Import Labor from TENAGA sheet
    if (IMPORT_LABOR && workbook.SheetNames.includes('TENAGA')) {
      console.log('👷 IMPORTING LABOR DATA');
      console.log('='.repeat(60));
      
      const laborCount = await importLaborData(workbook, token, categories, units);
      totalImported += laborCount;
      console.log(`✅ Imported ${laborCount} labor items\n`);
    }

    // Step 5: Import Materials from work sheets
    if (IMPORT_MATERIALS) {
      console.log('🧱 IMPORTING MATERIALS DATA');
      console.log('='.repeat(60));
      
      const materialCount = await importMaterialsData(workbook, token, categories, units);
      totalImported += materialCount;
      console.log(`✅ Imported ${materialCount} material items\n`);
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Total Items Imported: ${totalImported}`);
    console.log('='.repeat(60));
    console.log('\n🎉 Import process completed!\n');

  } catch (err) {
    console.error('\n❌ FATAL ERROR:');
    console.error(err.response?.data || err.message);
    process.exit(1);
  }
}

// ========================================
// IMPORT LABOR DATA
// ========================================
async function importLaborData(workbook, token, categories, units) {
  const worksheet = workbook.Sheets['TENAGA'];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  let laborCategory = categories.find(c => c.name === 'Labor') || categories.find(c => c.name === 'Tenaga Kerja');
  
  if (!laborCategory) {
    const catRes = await axios.post(`${API_URL}/api/categories`, {
      name: 'Tenaga Kerja',
      description: 'Labor / Tenaga Kerja',
      active: true
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    laborCategory = catRes.data;
    categories.push(laborCategory);
  }

  let ohUnit = units.find(u => u.code.toUpperCase() === 'OH');
  if (!ohUnit) {
    const unitRes = await axios.post(`${API_URL}/api/units`, {
      code: 'OH',
      name: 'Orang Hari',
      category: 'labor',
      description: 'Unit for labor per day',
      active: true
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    ohUnit = unitRes.data;
    units.push(ohUnit);
  }

  let count = 0;
  const materials = new Map(); // Track unique materials

  for (let i = 5; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 5) continue;

    const name = String(row[1] || '').trim();
    const code = String(row[2] || '').trim();
    const unit = String(row[3] || 'OH').trim().toUpperCase();
    let price = parseFloat(row[4]) || 0;

    if (!name || name === '') continue;

    // Apply default price if 0
    if (price === 0) {
      for (const [key, defaultPrice] of Object.entries(DEFAULT_LABOR_PRICES)) {
        if (name.toLowerCase().includes(key.toLowerCase())) {
          price = defaultPrice;
          break;
        }
      }
    }

    const sku = code || `LABOR-${String(i).padStart(3, '0')}`;

    // Check if already added
    if (materials.has(sku)) continue;
    materials.set(sku, true);

    try {
      await createOrUpdateProduct({
        sku,
        name,
        description: `Tenaga Kerja - ${name}`,
        category_id: laborCategory.id,
        uom_id: ohUnit.id,
        item_type: 'service',
        standard_cost: price,
        selling_price: price,
        reorder_point: 0,
        is_active: true
      }, token);

      count++;
      console.log(`   ✅ ${name} (${sku}) - Rp ${price.toLocaleString('id-ID')}/OH`);
    } catch (err) {
      console.log(`   ⚠️ ${name} - ${err.message}`);
    }
  }

  return count;
}

// ========================================
// IMPORT MATERIALS DATA
// ========================================
async function importMaterialsData(workbook, token, categories, units) {
  const workSheets = workbook.SheetNames.filter(name => 
    name.startsWith('A.1.') && !name.includes('DAFTAR') && !name.includes('REKAP')
  );

  let materialCategory = categories.find(c => c.name === 'Raw Materials') || categories.find(c => c.name === 'Bahan');
  
  if (!materialCategory) {
    const catRes = await axios.post(`${API_URL}/api/categories`, {
      name: 'Bahan',
      description: 'Bahan / Raw Materials',
      active: true
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    materialCategory = catRes.data;
    categories.push(materialCategory);
  }

  let count = 0;
  const materials = new Map(); // Track unique materials to avoid duplicates

  for (const sheetName of workSheets) {
    console.log(`\n   📄 Processing: ${sheetName}`);
    
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 2) continue;

      const cell = String(row[1] || '').trim();
      
      // Check if this is a BAHAN (material) section
      if (cell === 'BAHAN' || cell === 'B') {
        // Process following rows as materials until we hit next section
        for (let j = i + 1; j < data.length; j++) {
          const matRow = data[j];
          if (!matRow || matRow.length < 3) break;

          const section = String(matRow[1] || '').trim();
          if (section === 'PERALATAN' || section === 'C' || section === 'JUMLAH' || section === 'TENAGA' || section === 'A') {
            break;
          }
          
          // Skip if first column is empty or a number (it's a sub-item marker)
          const firstCol = String(matRow[0] || '').trim();
          if (firstCol !== '' || /^\d+$/.test(section)) {
            continue; // Skip numbered rows or rows with content in first column
          }

          const name = String(matRow[1] || '').trim();
          const unit = String(matRow[3] || 'KG').trim().toUpperCase();
          const qty = parseFloat(matRow[4]) || 0;

          // Skip invalid names
          if (!name || name === '' || name === 'BAHAN' || name === 'JUMLAH' || name.includes('Harga') || /^\d+$/.test(name)) {
            continue;
          }

          // Generate SKU from name
          const sku = generateSKU(name);

          // Skip if already processed
          if (materials.has(sku)) continue;
          materials.set(sku, true);

          // Get or create unit
          let unitObj = units.find(u => u.code.toUpperCase() === unit);
          if (!unitObj) {
            try {
              const unitRes = await axios.post(`${API_URL}/api/units`, {
                code: unit,
                name: unit,
                category: 'general',
                description: `Unit ${unit}`,
                active: true
              }, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              unitObj = unitRes.data;
              units.push(unitObj);
            } catch (err) {
              unitObj = units[0]; // Default to first unit
            }
          }

          try {
            await createOrUpdateProduct({
              sku,
              name,
              description: `Bahan - ${name}`,
              category_id: materialCategory.id,
              uom_id: unitObj.id,
              item_type: 'inventory',
              standard_cost: 0, // Will be updated later with actual prices
              selling_price: 0,
              reorder_point: 0,
              is_active: true
            }, token);

            count++;
            console.log(`      ✅ ${name} (${unit})`);
          } catch (err) {
            // Silently skip errors for materials (many duplicates expected)
          }
        }
      }
    }
  }

  return count;
}

// ========================================
// HELPER FUNCTIONS
// ========================================
async function getCategories(token) {
  const res = await axios.get(`${API_URL}/api/categories`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return Array.isArray(res.data) ? res.data : (res.data.data || []);
}

async function getUnits(token) {
  const res = await axios.get(`${API_URL}/api/units`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return Array.isArray(res.data) ? res.data : (res.data.data || []);
}

async function createOrUpdateProduct(productData, token) {
  try {
    await axios.post(`${API_URL}/api/products`, productData, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
  } catch (err) {
    if (err.response?.status === 409 || err.response?.data?.error?.includes('UNIQUE')) {
      // Product exists, try update
      const existingRes = await axios.get(`${API_URL}/api/products?sku=${productData.sku}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (existingRes.data?.length > 0) {
        const existingId = existingRes.data[0].id;
        await axios.put(`${API_URL}/api/products/${existingId}`, productData, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
    } else {
      throw err;
    }
  }
}

function generateSKU(name) {
  // Generate SKU from name
  const clean = name.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  const words = clean.split(/\s+/);
  
  if (words.length >= 2) {
    return `MAT-${words[0].substring(0, 3).toUpperCase()}${words[1].substring(0, 3).toUpperCase()}`;
  } else {
    return `MAT-${clean.substring(0, 6).toUpperCase()}`;
  }
}

// Run the import
importAHSPData();
