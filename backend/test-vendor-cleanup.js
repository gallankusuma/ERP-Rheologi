const axios = require('axios');

const baseURL = 'http://localhost:3000';

async function testVendorCleanup() {
  try {
    // First, check current vendor count for VENDOR-IMPORT codes
    console.log('🔍 Checking current vendor status...');
    const countBefore = await axios.get(`${baseURL}/api/vendors?filter=VENDOR-IMPORT`, {
      validateStatus: () => true
    });
    
    // For simplicity, just query the database directly via another endpoint
    // Instead, let's just call the cleanup endpoint
    
    console.log('\n📋 Calling vendor cleanup endpoint...');
    console.log('🔐 Note: This requires authentication. Testing without token first...\n');
    
    const response = await axios.post(
      `${baseURL}/api/import/vendors/cleanup`,
      {},
      {
        validateStatus: () => true
      }
    );
    
    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 401) {
      console.log('\n⚠️  Expected: Auth required. Need to provide valid JWT token.');
      console.log('💡 To test with auth, update this script with token from login endpoint.');
    } else if (response.status === 200) {
      console.log('\n✅ Vendor cleanup succeeded!');
      console.log(JSON.stringify(response.data.result, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testVendorCleanup();
