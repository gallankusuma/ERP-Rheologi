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

async function testGRNApproval() {
  try {
    console.log('🧪 Testing GRN Multi-Level Approval Workflow\n');

    // Step 1: Login as Master (level 4+)
    console.log('📝 Step 1: Login as Master Admin (Level 4)...');
    const masterRes = await makeRequest('POST', '/api/auth/login', {
      email: 'master@admin.com',
      password: 'master',
    });

    if (masterRes.status !== 200) {
      console.log('❌ Login failed');
      process.exit(1);
    }

    const masterToken = masterRes.body.token;
    const masterUserId = masterRes.body.user.id;
    console.log(`✅ Master login successful! (ID: ${masterUserId}, Level: ${masterRes.body.user.user_level})\n`);

    // Step 2: Fetch GRNs to see current status
    console.log('📝 Step 2: Fetching existing GRNs...');
    const grnListRes = await makeRequest('GET', '/api/procurement/goods-receipts', null, masterToken);
    
    if (grnListRes.status === 200) {
      const grns = grnListRes.body.data || [];
      console.log(`✅ Found ${grns.length} GRN(s)`);
      
      if (grns.length > 0) {
        const latestGrn = grns[0];
        console.log(`\n   Latest GRN:`);
        console.log(`   - ID: ${latestGrn.id}`);
        console.log(`   - GR Number: ${latestGrn.gr_number || 'N/A'}`);
        console.log(`   - Status: ${latestGrn.status || 'N/A'}`);
        console.log(`   - Approval Status: ${latestGrn.approval_status || 'N/A'}`);
        console.log(`   - PO ID: ${latestGrn.po_id || 'N/A'}`);

        // Step 3: Try to get GRN details
        console.log(`\n📝 Step 3: Fetching GRN #${latestGrn.id} details...`);
        const grnDetailRes = await makeRequest('GET', `/api/procurement/goods-receipts/${latestGrn.id}`, null, masterToken);
        
        if (grnDetailRes.status === 200) {
          console.log(`✅ GRN details fetched`);
          const grn = grnDetailRes.body.data;
          console.log(`   Current approval_status: ${grn.approval_status || 0}`);

          // Step 4: Test approval 
          console.log(`\n📝 Step 4: Testing GRN Approval (Master direct approve)...`);
          const approveRes = await makeRequest('POST', `/api/procurement/goods-receipts/${latestGrn.id}/approve`, {}, masterToken);
          
          if (approveRes.status === 200) {
            console.log(`✅ Approval request successful!`);
            console.log(`   Response:`, approveRes.body.message);
            const approvedGrn = approveRes.body.data;
            console.log(`   New approval_status: ${approvedGrn.approval_status || 'N/A'}`);
            process.exit(0);
          } else {
            console.log(`❌ Approval failed!`);
            console.log(`   Status: ${approveRes.status}`);
            console.log(`   Error:`, approveRes.body);
            process.exit(1);
          }
        } else {
          console.log(`❌ Failed to fetch GRN details`);
          console.log(`   Status: ${grnDetailRes.status}`);
          console.log(`   Response:`, grnDetailRes.body);
          process.exit(1);
        }
      } else {
        console.log(`⚠️  No GRNs found. Please create a GRN first in the UI.`);
        process.exit(0);
      }
    } else {
      console.log(`❌ Failed to fetch GRNs`);
      console.log(`   Status: ${grnListRes.status}`);
      console.log(`   Response:`, grnListRes.body);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Test error:', error.message);
    process.exit(1);
  }
}

testGRNApproval();
