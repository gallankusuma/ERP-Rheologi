const mysql = require('mysql2/promise');

async function checkAhspItems() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'erp_manufacturing'
  });

  try {
    const ahsp_id = 8;
    const [rows] = await pool.query(
      `SELECT * FROM ahsp_items WHERE ahsp_id = ?`,
      [ahsp_id]
    );
    console.log(JSON.stringify(rows, null, 2));
    
    // Calculate total manually
    let total = 0;
    rows.forEach(r => {
        total += parseFloat(r.koefisien) * parseFloat(r.resource_harga);
    });
    console.log(`Calculated Total: ${total}`);
    
  } catch (error) {
    console.error(error);
  } finally {
    await pool.end();
  }
}

checkAhspItems();
