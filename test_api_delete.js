const axios = require('axios');
const mysql = require('mysql2/promise');
require('dotenv').config();

const API_URL = 'http://localhost:3000/api';
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'erp_manufacturing'
};

async function testDelete() {
  let connection;
  try {
    // 1. Login
    console.log('Logging in...');
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: 'master@admin.com',
      password: 'master'
    });
    const token = loginRes.data.token;
    console.log('Login successful.');

    // 2. Create Dummy AHSP
    console.log('Creating dummy AHSP...');
    const createRes = await axios.post(`${API_URL}/estimator/ahsp`, {
        kode: 'TEST.DEL.001',
        name: 'Test Delete Item',
        satuan: 'ls',
        version: '2024',
        discipline_id: 1,
        items: []
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Created AHSP ID:', createRes.data.id);
    const id = createRes.data.id;

    // 3. Delete Dummy AHSP
    console.log(`Deleting AHSP ID ${id}...`);
    try {
        const deleteRes = await axios.delete(`${API_URL}/estimator/ahsp/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Delete response:', deleteRes.data);
    } catch (err) {
        console.error('Delete API failed:', err.response?.data || err.message);
    }

    // 4. Verify in DB
    connection = await mysql.createConnection(DB_CONFIG);
    const [rows] = await connection.execute('SELECT id, status FROM ahsp_headers WHERE id = ?', [id]);
    console.log('DB Status:', rows[0]);

    if (rows[0] && rows[0].status === 'inactive') {
        console.log('SUCCESS: AHSP was soft deleted.');
    } else {
        console.error('FAILURE: AHSP status is not inactive.');
    }

  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  } finally {
    if (connection) await connection.end();
  }
}

testDelete();
