const axios = require('axios');

(async () => {
  try {
    // Login
    console.log('🔐 Logging in...');
    const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
      email: 'master@admin.com',
      password: 'master'
    });
    
    const token = loginRes.data.token;
    console.log('✅ Login successful\n');
    
    // Get AHSP data
    console.log('📊 Fetching AHSP data from API...');
    const ahspRes = await axios.get('http://localhost:3000/api/estimator/ahsp', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const ahspData = ahspRes.data;
    console.log(`✅ Got ${ahspData.length} AHSP records\n`);
    
    // Show first 5 records
    console.log('📋 First 5 AHSP records:\n');
    ahspData.slice(0, 5).forEach((item, idx) => {
      console.log(`${idx + 1}. ${item.kode} - ${item.name.substring(0, 50)}...`);
      console.log(`   Discipline: ${item.discipline_name || '(EMPTY)'}`);
      console.log(`   Sub-Discipline: ${item.sub_discipline_name || '(EMPTY)'}`);
      console.log(`   Harga: Rp ${item.harga_satuan}\n`);
    });
    
    // Count empties
    const withDiscipline = ahspData.filter(a => a.discipline_name).length;
    const withSubDiscipline = ahspData.filter(a => a.sub_discipline_name).length;
    
    console.log('📈 Statistics:');
    console.log(`   Total records: ${ahspData.length}`);
    console.log(`   With discipline_name: ${withDiscipline}`);
    console.log(`   With sub_discipline_name: ${withSubDiscipline}`);
    
  } catch (err) {
    console.error('❌ Error:', err.response?.data || err.message);
  }
})();
