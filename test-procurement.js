const http = require('http');

function makeRequest(method, path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          body: responseData ? JSON.parse(responseData) : null,
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function testProcurement() {
  try {
    console.log('🧪 Testing Procurement Module\n');

    // Login
    console.log('📝 Step 1: Login...');
    const loginRes = await new Promise((resolve) => {
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/login',
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
      };
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
      });
      req.write(JSON.stringify({ email: 'master@admin.com', password: 'master' }));
      req.end();
    });

    if (loginRes.status !== 200) {
      console.log('❌ Login failed:', loginRes);
      process.exit(1);
    }

    const token = loginRes.body.token;
    console.log('✅ Login successful\n');

    // Test Purchase Requests GET
    console.log('📝 Step 2: Fetching Purchase Requests...');
    const prRes = await makeRequest('GET', '/api/procurement/purchase-requests', token);
    
    if (prRes.status === 200) {
      console.log('✅ Purchase Requests fetched successfully!');
      console.log(`   Total PRs: ${prRes.body.data?.length || 0}`);
      if (prRes.body.data?.length > 0) {
        console.log(`   First PR: ${prRes.body.data[0].pr_number || 'N/A'}`);
      }
      process.exit(0);
    } else {
      console.log('❌ Failed!');
      console.log('   Status:', prRes.status);
      console.log('   Response:', prRes.body);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Test error:', error.message);
    process.exit(1);
  }
}

testProcurement();
