const mysql = require('mysql2/promise');

async function simulateAddItem() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'erp_manufacturing'
  });

  try {
    const ahsp_id = 8;
    console.log(`Fetching AHSP ID: ${ahsp_id}`);
    
    // Exact query from estimator.routes.ts
    const [rows] = await pool.query(
      `SELECT kode, name, satuan, harga_satuan FROM ahsp_headers WHERE id = ?`,
      [ahsp_id]
    );
    const ahsp = rows[0];
    
    console.log('AHSP Record:', ahsp);
    
    const unitPrice = parseFloat(ahsp.harga_satuan) || 0;
    console.log('Parsed Unit Price:', unitPrice);
    
    // Simulate calc
    const qty = 10;
    const total = qty * unitPrice;
    console.log(`Qty: ${qty}, Total: ${total}`);
    
  } catch (error) {
    console.error(error);
  } finally {
    await pool.end();
  }
}

simulateAddItem();
