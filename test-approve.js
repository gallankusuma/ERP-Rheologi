const http = require('http');

async function testApproveAPI() {
  try {
    // First, get a PR to approve
    console.log('Fetching purchase requests...');
    const response = await fetch('http://localhost:3000/api/procurement/purchase-requests', {
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });

    if (!response.ok) {
      console.error('Failed to fetch PRs:', response.statusText);
      return;
    }

    const data = await response.json();
    console.log(`Found ${data.data?.length || 0} PRs`);
    
    if (data.data && data.data.length > 0) {
      const pr = data.data[0];
      console.log(`\nFirst PR: ${pr.pr_number}`);
      console.log(`  Current approval_status: ${pr.approval_status}`);
      console.log(`  Current status: ${pr.status}`);

      // Try to approve it
      console.log('\nAttempting to approve...');
      const approveResponse = await fetch(`http://localhost:3000/api/procurement/purchase-requests/${pr.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({})
      });

      const approveData = await approveResponse.json();
      
      if (approveResponse.ok) {
        console.log('✓ Approve request succeeded!');
        console.log(`  Response:`, approveData);
      } else {
        console.log('✗ Approve request failed!');
        console.log(`  Status: ${approveResponse.status}`);
        console.log(`  Response:`, approveData);
      }
    } else {
      console.log('No purchase requests found');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testApproveAPI();
