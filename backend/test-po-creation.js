const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

async function testPOCreation() {
  // First, make sure we have a user
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing',
  });

  const JWT_SECRET = 'secret';

  try {
    const connection = await pool.getConnection();
    
    // Get or create a test user
    let [users] = await connection.execute('SELECT id, user_level FROM users LIMIT 1');
    let userId, userLevel;
    
    if (users.length === 0) {
      console.log('Creating test user...');
      const result = await connection.execute(
        'INSERT INTO users (email, password, full_name, name, user_level) VALUES (?, ?, ?, ?, ?)',
        ['test@test.com', 'hashed_pass', 'Test User', 'Test', 4]
      );
      userId = result[0].insertId;
      userLevel = 4;
    } else {
      userId = users[0].id;
      userLevel = users[0].user_level || 4;
    }

    console.log(`Using user ID: ${userId}, Level: ${userLevel}\n`);

    // Create JWT token
    const token = jwt.sign(
      { userId, userLevel },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('Sending PO creation request...\n');

    // Test PO creation
    const testPayload = {
      vendor_id: 1,
      pr_id: null,
      status: 'draft',
      currency: 'IDR',
      notes: 'Test PO',
      items: [
        {
          product_id: 1,
          quantity: 5,
          uom: 'unit',
          unit_price: 50000,
          currency: 'IDR'
        }
      ]
    };

    console.log('Request payload:');
    console.log(JSON.stringify(testPayload, null, 2));

    const response = await fetch('http://localhost:3000/api/procurement/purchase-orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(testPayload)
    });

    const data = await response.json();

    console.log(`\nResponse status: ${response.status}`);
    console.log('Response:');
    console.log(JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✅ PO creation successful!');
    } else {
      console.log('\n❌ PO creation failed');
    }

    connection.release();
    pool.end();

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testPOCreation();
