const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkUsers() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'erp_manufacturing'
  });

  console.log('📋 Checking users table...\n');

  const [users] = await connection.query('SELECT id, username, full_name, user_level FROM users ORDER BY id');
  
  console.table(users);
  console.log(`\n✅ Total users: ${users.length}`);
  
  await connection.end();
}

checkUsers().catch(console.error);
