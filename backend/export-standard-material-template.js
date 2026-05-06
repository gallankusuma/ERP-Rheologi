const path = require('path');
const mysql = require('mysql2/promise');
const XLSX = require('xlsx');

async function main() {
  const db = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'erp_manufacturing',
  });

  try {
    const [rows] = await db.query(`
      SELECT
        m.code,
        IFNULL(m.jenis, '') AS jenis,
        m.name,
        m.satuan,
        m.harga,
        IFNULL(v.name, '') AS vendor
      FROM master_materials m
      LEFT JOIN vendors v ON v.id = m.vendor_id
      WHERE m.code REGEXP '^MT-2026-[0-9]{4}$' AND m.is_active = 1
      ORDER BY m.id ASC
    `);

    const output = rows.map((r) => ({
      code: r.code,
      jenis: r.jenis,
      name: r.name,
      satuan: r.satuan,
      harga: Number(r.harga),
      vendor: r.vendor,
    }));

    const ws = XLSX.utils.json_to_sheet(output);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'materials');

    const csvPath = path.join(__dirname, 'MATERIAL_standard_template.csv');
    const xlsxPath = path.join(__dirname, 'MATERIAL_standard_template.xlsx');

    XLSX.writeFile(wb, csvPath, { bookType: 'csv' });
    XLSX.writeFile(wb, xlsxPath, { bookType: 'xlsx' });

    console.log('Template CSV :', csvPath);
    console.log('Template XLSX:', xlsxPath);
    console.log('Total rows   :', output.length);
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error('Gagal export template standar:', e.message);
  process.exit(1);
});
