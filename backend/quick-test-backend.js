const axios = require('axios');

async function quickTest() {
  try {
    // Login
    const loginRes = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'master@admin.com',
      password: 'master'
    });
    const token = loginRes.data.token;
    console.log('✅ Login OK');
    
    // Get template
    const templateRes = await axios.get('http://localhost:3001/api/import/template/materials', {
      responseType: 'arraybuffer',
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Template downloaded');
    
    // Check headers in response
    const XLSX = require('xlsx');
    const fs = require('fs');
    fs.writeFileSync('temp_test.xlsx', templateRes.data);
    const workbook = XLSX.readFile('temp_test.xlsx');
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    const columns = data.length > 0 ? Object.keys(data[0]) : [];
    console.log(`📋 Template columns: ${columns.join(', ')}`);
    
    if (columns.includes('vendor')) {
      console.log('✅ VENDOR COLUMN PRESENT - Backend has latest code!');
    } else {
      console.log('❌ VENDOR COLUMN MISSING - Backend needs restart!');
      console.log('🔧 Kill process 23700 and restart backend task');
    }
    
    fs.unlinkSync('temp_test.xlsx');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

quickTest();
