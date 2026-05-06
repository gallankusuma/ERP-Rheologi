const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

const csvPath = path.join(__dirname, 'ahsp_parsed_data_clean.csv');

(async () => {
  try {
    // Step 1: Login to get token
    console.log('🔐 Logging in...\n');
    const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
      email: 'master@admin.com',
      password: 'master'
    });
    
    const token = loginRes.data.token;
    console.log('✅ Login successful!\n');
    
    // Step 2: Upload CSV
    console.log('📤 Uploading AHSP data to API...\n');
    
    const form = new FormData();
    form.append('file', fs.createReadStream(csvPath));
    
    const importRes = await axios.post('http://localhost:3000/api/import/import/ahsp', form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${token}`
      },
      timeout: 60000
    });
    
    const result = importRes.data;
    console.log('✅ Import successful!\n');
    console.log('📊 Results:');
    console.log(`   - Created: ${result.created} AHSP`);
    console.log(`   - Updated: ${result.updated} AHSP`);
    console.log(`   - Items inserted: ${result.itemsInserted || 'N/A'}`);
    console.log(`   - Total: ${result.totalRows} rows processed\n`);
    
    console.log('🎉 AHSP data imported successfully!');
  } catch (err) {
    if (err.response?.status === 400 && err.response?.data?.validation) {
      const validation = err.response.data.validation;
      console.error('\n❌ Validation Error:');
      console.error(`   - Total rows: ${validation.totalRows}`);
      console.error(`   - Valid rows: ${validation.validRows}`);
      console.error(`   - Invalid rows: ${validation.invalidRows?.length || 0}`);
      if (validation.firstError) {
        console.error(`\n   First error at row ${validation.firstError.rowNumber}:`);
        console.error(`   ${JSON.stringify(validation.firstError.errors, null, 2)}`);
      }
    } else {
      console.error('❌ Error:');
      console.error(err.response?.data || err.message);
    }
    process.exit(1);
  }
})();
