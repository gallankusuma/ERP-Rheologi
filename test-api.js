// Test script untuk check apakah events tersimpan di API

const testAPI = async () => {
  try {
    // First, login to get token
    console.log('Attempting to get events from API...\n');
    
    const response = await fetch('http://localhost:3000/api/production/events', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6ImFkbWluIiwiaWF0IjoxNzM4NjEzMzQxLCJleHAiOjE3MzkyMTgxNDF9.tJJMTlhXK3V9HeYPrGjn5y6xZ0qZv6n7w9v7q5v8H5c'
      }
    });

    console.log('Response Status:', response.status);
    const data = await response.json();
    console.log('Response Data:', JSON.stringify(data, null, 2));
    
    if (Array.isArray(data)) {
      console.log(`\nTotal events from API: ${data.length}`);
      if (data.length > 0) {
        console.log('\nFirst event:');
        console.log(JSON.stringify(data[0], null, 2));
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
};

testAPI();
