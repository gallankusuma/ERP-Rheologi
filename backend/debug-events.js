const jwt = require('jsonwebtoken');
const axios = require('axios');

const secret = 'your-secret-key-change-in-production';
const token = jwt.sign({ id: 1, role: 'admin' }, secret, { expiresIn: '1h' });

console.log('Testing GET /api/clients/events/all');

async function test() {
    try {
        const res = await axios.get('http://localhost:3001/api/clients/events/all?page=1&limit=100', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Success:', res.data);
    } catch (err) {
        if (err.response) {
            console.log('Error Status:', err.response.status);
            console.log('Error Data:', JSON.stringify(err.response.data, null, 2));
        } else {
            console.error('Request failed:', err.message);
        }
    }
}

test();
