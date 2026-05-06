const axios = require('axios');

async function main() {
  try {
    const login = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'master@admin.com',
      password: 'master',
    });

    const token = login.data.token;

    const res = await axios.post(
      'http://localhost:3001/api/import/materials/cleanup',
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(res.data, null, 2));
  } catch (error) {
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
}

main();
