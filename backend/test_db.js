const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({
    host: '76.13.22.155',
    user: 'root',
    password: '',
    database: 'erp_rheologi_dev'
  });
  const [rows] = await conn.query('SELECT * FROM products WHERE name LIKE "%C2509%"');
  console.log(rows);
  const [boms] = await conn.query('SELECT * FROM bom_headers WHERE product_id = (SELECT id FROM products WHERE name LIKE "%C2509%" LIMIT 1)');
  console.log(boms);
  process.exit(0);
}
run();
