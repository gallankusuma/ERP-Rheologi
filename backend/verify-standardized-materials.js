const mysql = require('mysql2/promise');

async function main() {
  const db = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'erp_manufacturing',
  });

  try {
    const [rows] = await db.query(`
      SELECT COUNT(1) AS total
      FROM master_materials
      WHERE code REGEXP '^MT-2026-[0-9]{4}$' AND is_active = 1
    `);
    console.log('Active MT-2026 rows:', rows[0].total);
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error('Verifikasi gagal:', e.message);
  process.exit(1);
});
