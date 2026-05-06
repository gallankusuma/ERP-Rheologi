const http = require('http');

function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

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

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function testPRCreation() {
  try {
    console.log('🧪 Testing Purchase Request Creation\n');

    // Step 1: Login
    console.log('📝 Step 1: Login...');
    const loginRes = await makeRequest('POST', '/api/auth/login', {
      email: 'master@admin.com',
      password: 'master',
    });

    if (loginRes.status !== 200) {
      console.log('❌ Login failed:', loginRes);
      process.exit(1);
    }

    const token = loginRes.body.token;
    console.log(`✅ Login successful! Token: ${token.substring(0, 20)}...\n`);

    // Step 2: Create PR
    console.log('📝 Step 2: Creating Purchase Request...');
    const prData = {
      pr_number: `PR-TEST-${Date.now()}`,
      status: 'DRAFT',
      notes: 'Test PR for Baut M6 - qty 10 units',
    };

    console.log('   Payload:', JSON.stringify(prData, null, 2));

    const prRes = await makeRequest('POST', '/api/procurement/purchase-requests', prData, token);

    if (prRes.status === 201 || prRes.status === 200) {
      console.log('\n✅ Purchase Request created successfully!');
      console.log(`   Response:`, prRes.body);
      process.exit(0);
    } else {
      console.log('\n❌ PR creation failed!');
      console.log(`   Status: ${prRes.status}`);
      console.log(`   Error:`, prRes.body);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Test error:', error.message);
    process.exit(1);
  }
}

testPRCreation();
