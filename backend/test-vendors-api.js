const mysql = require('mysql2/promise');

async function testVendorsAPI() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing',
  });

  try {
    const connection = await pool.getConnection();
    
    // Simulate what the API endpoint does
    console.log('Testing vendor query (same as API):\n');
    
    const [vendors] = await connection.execute(
      'SELECT * FROM vendors ORDER BY name ASC'
    );

    console.log('API Response (data.data):');
    console.log(JSON.stringify({ data: vendors }, null, 2));

    console.log('\nFrontend will receive:');
    vendors.forEach(v => {
      console.log(`  - ${v.name} (${v.code})`);
      console.log(`    Supply: ${v.supply}`);
      console.log(`    ID: ${v.id}`);
    });

    connection.release();
    pool.end();

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testVendorsAPI();
