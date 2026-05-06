const mysql = require('mysql2/promise');

async function checkProposalItems() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'erp_manufacturing'
  });

  try {
    const [rows] = await pool.query("SELECT * FROM proposal_items ORDER BY id DESC LIMIT 5");
    console.log(JSON.stringify(rows, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    await pool.end();
  }
}

checkProposalItems();
