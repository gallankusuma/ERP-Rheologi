const mysql = require('mysql2/promise');

async function checkUsersSchema() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing',
  });

  try {
    const connection = await pool.getConnection();
    
    // Get users table structure
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_NAME = 'users' AND TABLE_SCHEMA = ?`,
      [process.env.DB_NAME || 'erp_manufacturing']
    );

    console.log('Users table columns:');
    columns.forEach(col => {
      console.log(`  ${col.COLUMN_NAME}`);
    });

    const hasUserLevel = columns.some(c => c.COLUMN_NAME === 'user_level');
    
    if (!hasUserLevel) {
      console.log('\n✓ Adding user_level column...');
      await connection.execute('ALTER TABLE users ADD COLUMN user_level INT DEFAULT 1');
      console.log('✓ Added user_level column');
    }

    // Get a user
    const [users] = await connection.execute('SELECT id FROM users LIMIT 1');
    if (users.length === 0) {
      console.log('\n✓ Creating admin user...');
      const result = await connection.execute(
        'INSERT INTO users (email, password, name, full_name, user_level) VALUES (?, ?, ?, ?, ?)',
        ['admin@test.com', 'hashed', 'admin', 'Admin User', 4]
      );
      console.log('✓ Created admin user ID:', result[0].insertId);
    } else {
      console.log(`\n✓ Found existing user ID: ${users[0].id}`);
    }

    connection.release();
    pool.end();

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkUsersSchema();
