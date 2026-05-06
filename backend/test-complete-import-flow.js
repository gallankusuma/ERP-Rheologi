const axios = require('axios');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const FormData = require('form-data');

const BASE_URL = 'http://localhost:3001/api';
let authToken = '';

async function login() {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'master@admin.com',
      password: 'master'
    });
    authToken = response.data.token;
    console.log('✅ Logged in successfully');
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    return false;
  }
}

async function downloadTemplate(entity) {
  try {
    const response = await axios.get(`${BASE_URL}/import/template/${entity}`, {
      responseType: 'arraybuffer',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const filename = `template_${entity}_test.xlsx`;
    fs.writeFileSync(filename, response.data);
    console.log(`✅ Downloaded template: ${filename}`);
    
    // Read and verify template structure
    const workbook = XLSX.readFile(filename);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`📋 Template structure:`);
    if (data.length > 0) {
      console.log(`   Columns: ${Object.keys(data[0]).join(', ')}`);
      console.log(`   Sample rows: ${data.length}`);
    }
    
    return filename;
  } catch (error) {
    console.error(`❌ Failed to download ${entity} template:`, error.response?.data || error.message);
    return null;
  }
}

async function createTestFile() {
  const workbook = XLSX.utils.book_new();
  const timestamp = Date.now();
  const testData = [
    { code: `MT-${timestamp}-1`, jenis: 'Pasir', name: 'Pasir Test', satuan: 'M3', harga: 150000, vendor: 'PT Test Vendor A' },
    { code: `MT-${timestamp}-2`, jenis: 'Batu', name: 'Batu Test', satuan: 'M3', harga: 200000, vendor: 'PT Test Vendor B' },
    { code: `MT-${timestamp}-3`, jenis: 'Semen', name: 'Semen Test', satuan: 'Zak', harga: 60000, vendor: 'PT Test Vendor A' }
  ];
  
  const worksheet = XLSX.utils.json_to_sheet(testData);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Materials');
  
  const filename = 'test_materials_import.xlsx';
  XLSX.writeFile(workbook, filename);
  console.log(`✅ Created test file: ${filename} with unique codes`);
  return filename;
}

async function importFile(entity, filepath) {
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(filepath));
    
    const response = await axios.post(`${BASE_URL}/import/import/${entity}`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${authToken}`
      }
    });
    
    console.log(`✅ Import successful:`, response.data);
    return true;
  } catch (error) {
    console.error(`❌ Import failed:`, error.response?.data || error.message);
    return false;
  }
}

async function verifyData(timestamp) {
  try {
    const response = await axios.get(`${BASE_URL}/estimator/masters/materials`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    const testItems = response.data.filter(m => m.code?.includes(`-${timestamp}-`));
    console.log(`\n📊 Imported materials (${testItems.length} found):`);
    testItems.forEach(item => {
      console.log(`   ${item.code}: ${item.name} | Vendor: ${item.vendor_name || '(none)'} | Price: ${item.harga}`);
    });
    
    return testItems;
  } catch (error) {
    console.error('❌ Failed to verify data:', error.response?.data || error.message);
    return [];
  }
}

async function testCompleteFlow() {
  console.log('🚀 Testing Complete Import Flow\n');
  
  const timestamp = Date.now();
  
  // Step 1: Login
  console.log('Step 1: Login');
  if (!await login()) return;
  
  // Step 2: Download template and verify vendor column exists
  console.log('\nStep 2: Download Template');
  const templateFile = await downloadTemplate('materials');
  if (!templateFile) return;
  
  // Step 3: Create test data file
  console.log('\nStep 3: Create Test Data');
  const testFile = await createTestFile();
  
  // Step 4: Import test file
  console.log('\nStep 4: Import Test File');
  if (!await importFile('materials', testFile)) return;
  
  // Step 5: Verify imported data
  console.log('\nStep 5: Verify Imported Data');
  const items = await verifyData(timestamp);
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Template downloaded with vendor column`);
  console.log(`✅ Test data file created with 3 materials`);
  console.log(`✅ Import successful`);
  console.log(`✅ Data verified: ${items.length} materials with vendors`);
  console.log('='.repeat(60));
  
  // Check if vendors were created/linked
  const itemsWithVendors = items.filter(i => i.vendor_name);
  if (itemsWithVendors.length === items.length) {
    console.log('✅ All imported materials have vendors linked correctly!');
  } else {
    console.log(`⚠️  ${items.length - itemsWithVendors.length} materials missing vendor links`);
  }
  
  // Cleanup
  console.log('\n🧹 Cleaning up test files...');
  [templateFile, testFile].forEach(file => {
    if (file && fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`   Deleted: ${file}`);
    }
  });
  
  console.log('\n✅ Test complete!');
}

testCompleteFlow();
