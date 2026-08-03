const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

async function main() {
  const envPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_rheologi',
  });

  const [rows] = await connection.execute("SHOW COLUMNS FROM sales_orders LIKE 'customer_id'");
  console.log('LIVE sales_orders.customer_id Nullability:', rows[0].Null);
  await connection.end();
}

main().catch(console.error);
