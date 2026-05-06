const http = require('http');

// Test with hardcoded master user credentials
const credentials = Buffer.from('master@admin.com:master').toString('base64');

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL('http://localhost:3000/api' + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test() {
  try {
    console.log('📝 Step 1: Login with master credentials...');
    const loginResult = await makeRequest('POST', '/auth/login', {
      email: 'master@admin.com',
      password: 'master'
    });
    
    if (loginResult.status !== 200) {
      console.log('❌ Login failed:', loginResult.body);
      return;
    }
    
    const token = loginResult.body.token;
    console.log('✅ Login successful')
    console.log('Token:', token.substring(0, 50) + '...\n');
    
    // Now test procurement endpoints with valid token
    console.log('🧪 Testing Procurement Endpoints...\n');
    
    const tests = [
      { name: 'GET /procurement/vendors', path: '/procurement/vendors' },
      { name: 'GET /procurement/purchase-requests', path: '/procurement/purchase-requests' },
      { name: 'GET /procurement/purchase-orders', path: '/procurement/purchase-orders' },
      { name: 'GET /procurement/goods-receipts', path: '/procurement/goods-receipts' },
      { name: 'GET /procurement/vendor-prices', path: '/procurement/vendor-prices' },
      { name: 'GET /procurement/procurement-history', path: '/procurement/procurement-history' },
    ];
    
    let passCount = 0;
    for (const test of tests) {
      const result = await makeRequestWithToken('GET', test.path, null, token);
      if (result.status >= 200 && result.status < 300) {
        console.log(`✅ ${test.name}`);
        passCount++;
      } else {
        console.log(`❌ ${test.name} - Status: ${result.status}`);
        console.log(`   Error: ${JSON.stringify(result.body)}`);
      }
    }
    
    console.log(`\n📊 Results: ${passCount}/${tests.length} endpoints working`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

function makeRequestWithToken(method, path, body = null, token) {
  return new Promise((resolve, reject) => {
    const url = new URL('http://localhost:3000/api' + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

test().catch(console.error);
