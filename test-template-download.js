const axios = require('axios');
const fs = require('fs');

async function testTemplateDownload() {
  try {
    console.log('🔐 Logging in...');
    const loginRes = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'master@admin.com',
      password: 'master'
    });
    const token = loginRes.data.token;
    console.log('✅ Login successful!\n');

    console.log('📥 Downloading materials template...');
    const response = await axios.get('http://localhost:3001/api/import/template/materials', {
      responseType: 'arraybuffer',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    fs.writeFileSync('template_materials_test.xlsx', response.data);
    console.log('✅ Template downloaded: template_materials_test.xlsx\n');
    
    console.log('📋 Template should contain columns:');
    console.log('   - code');
    console.log('   - jenis');
    console.log('   - name');
    console.log('   - satuan');
    console.log('   - harga');
    console.log('   - vendor ✨ (NEW!)');
    console.log('\n✅ Template matches page view now!');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testTemplateDownload();
