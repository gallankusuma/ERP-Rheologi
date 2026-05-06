const mysql = require('mysql2/promise');
require('dotenv').config();

async function inspectTable() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing'
  });

  try {
    console.log('Inspecting master_sub_disciplines table...');
    const [rows] = await pool.query("DESCRIBE master_sub_disciplines");
    console.log(JSON.stringify(rows, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    await pool.end();
  }
}

inspectTable();
