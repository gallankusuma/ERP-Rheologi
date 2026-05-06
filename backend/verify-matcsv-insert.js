const mysql = require('mysql2/promise');

async function verify() {
  const c = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'erp_manufacturing'
  });

  const [countRows] = await c.query(
    "SELECT COUNT(*) AS total FROM master_materials WHERE code LIKE 'MAT-CSV-%'"
  );

  const [sampleRows] = await c.query(`
    SELECT m.code, m.name, m.satuan, m.harga, v.name AS vendor_name
    FROM master_materials m
    LEFT JOIN vendors v ON m.vendor_id = v.id
    WHERE m.code LIKE 'MAT-CSV-%'
    ORDER BY m.id DESC
    LIMIT 5
  `);

  console.log('Total MAT-CSV rows:', countRows[0].total);
  console.table(sampleRows);

  await c.end();
}

verify().catch((e) => {
  console.error('Verify gagal:', e.message);
  process.exit(1);
});
