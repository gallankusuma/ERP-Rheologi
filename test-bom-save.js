const http = require('http');

// Helper to make HTTP requests
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
          headers: res.headers,
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

async function testBOMSave() {
  try {
    console.log('🧪 Testing BOM Save Functionality\n');

    // Step 1: Login to get a token
    console.log('📝 Step 1: Login to get authentication token...');
    const loginResponse = await makeRequest('POST', '/api/auth/login', {
      email: 'master@admin.com',
      password: 'master',
    });

    if (loginResponse.status !== 200) {
      console.log('❌ Login failed:', loginResponse);
      process.exit(1);
    }

    const token = loginResponse.body.token;
    const userId = loginResponse.body.user.id;
    console.log(`✅ Login successful!`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Token: ${token.substring(0, 20)}...\n`);

    // Step 2: Get available products for BOM details
    console.log('📝 Step 2: Fetching available products...');
    const productsResponse = await makeRequest('GET', '/api/products', null, token);
    
    let productIds = [];
    if (productsResponse.status === 200 && productsResponse.body.data) {
      productIds = productsResponse.body.data.slice(0, 3).map((p) => p.id);
      console.log(`✅ Found ${productsResponse.body.data.length} products`);
      console.log(`   Using product IDs: ${productIds.join(', ')}\n`);
    } else {
      console.log('⚠️  Could not fetch products, will create BOM without details\n');
    }

    // Step 3: Create a BOM
    console.log('📝 Step 3: Creating BOM with product_name and details...');
    const bomData = {
      product_name: 'Test Finished Good - ' + new Date().toISOString().substring(0, 10),
      notes: 'Test BOM created at ' + new Date().toISOString(),
      details: productIds.length > 0 ? [
        {
          raw_material_id: productIds[0],
          quantity: 10.5,
          unit_of_measure_id: 1,
        },
        {
          raw_material_id: productIds[1] || productIds[0],
          quantity: 5.0,
          unit_of_measure_id: 1,
        }
      ] : [],
    };

    console.log('   Payload:', JSON.stringify(bomData, null, 2));

    const bomResponse = await makeRequest('POST', '/api/bom', bomData, token);

    if (bomResponse.status === 201 || bomResponse.status === 200) {
      console.log(`✅ BOM created successfully!`);
      console.log(`   Response:`, bomResponse.body);
      process.exit(0);
    } else {
      console.log(`❌ BOM creation failed!`);
      console.log(`   Status: ${bomResponse.status}`);
      console.log(`   Response:`, bomResponse.body);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Test error:', error.message);
    process.exit(1);
  }
}

testBOMSave();
