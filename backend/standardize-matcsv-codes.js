const mysql = require('mysql2/promise');

async function main() {
  const db = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'erp_manufacturing',
  });

  let updated = 0;

  try {
    await db.beginTransaction();

    const [maxRows] = await db.query(`
      SELECT MAX(CAST(SUBSTRING(code, 9) AS UNSIGNED)) AS max_no
      FROM master_materials
      WHERE code REGEXP '^MT-2026-[0-9]{4}$'
    `);

    let counter = Number(maxRows[0].max_no || 0);

    const [rows] = await db.query(`
      SELECT id, code
      FROM master_materials
      WHERE code LIKE 'MAT-CSV-%' AND is_active = 1
      ORDER BY id ASC
    `);

    for (const row of rows) {
      let newCode;
      while (true) {
        counter += 1;
        newCode = `MT-2026-${String(counter).padStart(4, '0')}`;
        const [exists] = await db.query('SELECT id FROM master_materials WHERE code = ? LIMIT 1', [newCode]);
        if (exists.length === 0) break;
      }

      await db.query('UPDATE master_materials SET code = ? WHERE id = ?', [newCode, row.id]);
      updated += 1;
    }

    await db.commit();

    const [sample] = await db.query(`
      SELECT code, name, satuan, harga
      FROM master_materials
      WHERE code REGEXP '^MT-2026-[0-9]{4}$'
      ORDER BY id DESC
      LIMIT 10
    `);

    console.log('=== STANDARDISASI CODE MATERIAL ===');
    console.log('Updated rows:', updated);
    console.table(sample);
  } catch (e) {
    await db.rollback();
    throw e;
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error('Gagal standardisasi code:', e.message);
  process.exit(1);
});
