const http = require('http');
const jwt = require('jsonwebtoken');

const API_BASE = 'http://localhost:3000/api/procurement';
const JWT_SECRET = 'secret'; // default from backend

// Generate valid JWT token
const token = jwt.sign(
  { userId: 99999, userLevel: 4 },
  JWT_SECRET,
  { expiresIn: '7d' }
);

console.log('Generated Token:', token.substring(0, 50) + '...\n');

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
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

async function runTests() {
  console.log('🧪 Testing Procurement Module (All Endpoints)...\n');
  
  let passCount = 0;
  let failCount = 0;
  
  const tests = [
    { name: 'GET /vendors', method: 'GET', path: '/vendors' },
    { name: 'GET /purchase-requests', method: 'GET', path: '/purchase-requests' },
    { name: 'GET /purchase-orders', method: 'GET', path: '/purchase-orders' },
    { name: 'GET /goods-receipts', method: 'GET', path: '/goods-receipts' },
    { name: 'GET /vendor-prices', method: 'GET', path: '/vendor-prices' },
    { name: 'GET /procurement-history', method: 'GET', path: '/procurement-history' },
    { name: 'GET /products/1/last-po-price', method: 'GET', path: '/products/1/last-po-price' },
  ];

  for (const test of tests) {
    try {
      console.log(`Testing: ${test.name}`);
      const result = await makeRequest(test.method, test.path);
      
      if (result.status >= 200 && result.status < 300) {
        console.log(`  ✅ Status: ${result.status}`);
        console.log(`  Response keys: ${Object.keys(result.body).join(', ')}`);
        passCount++;
      } else {
        console.log(`  ❌ Status: ${result.status} - ${JSON.stringify(result.body)}`);
        failCount++;
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      failCount++;
    }
    console.log('');
  }

  console.log(`\n📊 Results: ${passCount} passed, ${failCount} failed`);
  if (failCount === 0) {
    console.log('✅ All Procurement Module endpoints are working correctly!');
  }
}

runTests().catch(console.error);
