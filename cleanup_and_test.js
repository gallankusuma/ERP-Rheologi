const axios = require('axios');
const mysql = require('mysql2/promise');
require('dotenv').config();

const API_URL = 'http://localhost:3000/api';

async function testDelete() {
  try {
    // 1. Login
    console.log('Logging in...');
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: 'master@admin.com',
      password: 'master'
    });
    const token = loginRes.data.token;
    console.log('Login successful.');

    // 2. Create Dummy AHSP with random code
    const rnd = Math.floor(Math.random() * 10000);
    const code = `TEST.DEL.${rnd}`;
    console.log(`Creating dummy AHSP with code ${code}...`);
    
    let id;
    try {
        const createRes = await axios.post(`${API_URL}/estimator/ahsp`, {
            kode: code,
            name: `Test Delete Item ${rnd}`,
            satuan: 'ls',
            version: '2024',
            discipline_id: 1,
            items: []
        }, {
        headers: { Authorization: `Bearer ${token}` }
        });
        id = createRes.data.id;
        console.log('Created AHSP ID:', id);
    } catch (e) {
        console.error('Create failed:', e.response?.data || e.message);
        return;
    }

    // 3. Delete Dummy AHSP
    console.log(`Deleting AHSP ID ${id}...`);
    try {
        const deleteRes = await axios.delete(`${API_URL}/estimator/ahsp/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Delete response:', deleteRes.data);
    } catch (err) {
        console.error('Delete API failed:', err.response?.data || err.message);
        if (err.response?.status === 404) {
            console.error('Route not found (404). Backend might not have reloaded.');
        }
    }

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testDelete();
