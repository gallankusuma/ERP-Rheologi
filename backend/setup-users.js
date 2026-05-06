const mysql = require('mysql2/promise');

async function setupUsers() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing',
  });

  try {
    const connection = await pool.getConnection();
    
    // Get all users
    const [users] = await connection.execute('SELECT id, email, username FROM users');
    
    console.log('Setting user_level for all users...\n');

    // Update all users to have level 4 (Admin)
    await connection.execute('UPDATE users SET user_level = 4');
    
    console.log('Updated users:');
    const [updatedUsers] = await connection.execute('SELECT id, email, user_level FROM users');
    updatedUsers.forEach(u => {
      console.log(`  ID: ${u.id} | Email: ${u.email} | Level: ${u.user_level}`);
    });

    connection.release();
    pool.end();

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

setupUsers();
