const axios = require('axios');

async function testAPI() {
  try {
    // Step 1: Login to get token
    console.log('1. Logging in...');
    const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
      email: 'admin@erp.local',
      password: 'admin123'
    });
    
    const token = loginRes.data.token;
    console.log('✓ Got token:', token.substring(0, 20) + '...');
    
    // Step 2: Create vendor price
    console.log('\n2. Creating vendor price...');
    const data = {
      vendor_id: 3,  // Packaging Solutions
      product_id: 2,  // Cat Duco Merah
      price: 25000,
      currency: 'IDR',
      effective_date: '2026-02-10',
      valid_until: '2026-02-28',
      min_order_qty: 0,
      lead_time_days: 0,
      notes: ''
    };
    
    console.log('Data to send:', data);
    
    const res = await axios.post('http://localhost:3000/api/procurement/vendor-prices', data, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✓ Success!', res.data);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.status, error.response?.data);
    console.error('Full error:', error.message);
  }
}

testAPI();
