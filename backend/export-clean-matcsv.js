const fs = require('fs');
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
        ROW_NUMBER() OVER (ORDER BY m.id ASC) AS nomor_produk,
        m.code,
        IFNULL(m.jenis, '') AS jenis,
        m.name,
        m.satuan,
        m.harga,
        IFNULL(v.name, '') AS vendor,
        CASE WHEN m.is_active = 1 THEN 'ACTIVE' ELSE 'INACTIVE' END AS status
      FROM master_materials m
      LEFT JOIN vendors v ON v.id = m.vendor_id
      WHERE m.code LIKE 'MAT-CSV-%' AND m.is_active = 1
      ORDER BY m.id ASC
    `);

    const exportRows = rows.map((r) => ({
      'NOMOR PRODUK': r.nomor_produk,
      CODE: r.code,
      JENIS: r.jenis,
      NAMA: r.name,
      SATUAN: r.satuan,
      HARGA: Number(r.harga),
      VENDOR: r.vendor,
      STATUS: r.status,
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MATERIAL_CLEAN');

    const outFile = path.join(__dirname, 'MATERIAL_clean_active.csv');
    XLSX.writeFile(wb, outFile, { bookType: 'csv' });

    console.log('File clean aktif dibuat:', outFile);
    console.log('Total rows:', exportRows.length);
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error('Gagal export clean CSV:', e.message);
  process.exit(1);
});
