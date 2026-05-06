const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const mysql = require('mysql2/promise');

const SOURCE_CSV = 'C:\\Users\\GK\\Documents\\MATERIAL.csv';
const OUTPUT_CSV = path.join(__dirname, 'MATERIAL_with_codes.csv');

const parsePrice = (value) => {
  if (value === null || value === undefined) return 0;
  const cleaned = String(value)
    .replace(/Rp/gi, '')
    .replace(/[^0-9,.-]/g, '')
    .replace(/,/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const clean = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const normalizeHeader = (header) => clean(header).toUpperCase();

async function main() {
  if (!fs.existsSync(SOURCE_CSV)) {
    throw new Error(`File tidak ditemukan: ${SOURCE_CSV}`);
  }

  // XLSX can parse CSV safely including quoted commas.
  const workbook = XLSX.readFile(SOURCE_CSV, { raw: false, codepage: 65001 });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    raw: false,
  });

  const cleanedRows = rows
    .map((row) => {
      const normalized = {};
      for (const [key, value] of Object.entries(row)) {
        normalized[normalizeHeader(key)] = value;
      }
      return normalized;
    })
    .filter((row) => clean(row.NAMA));

  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'erp_manufacturing',
  });

  let inserted = 0;
  let skipped = 0;
  let generated = 0;

  try {
    await connection.beginTransaction();

    const outputRows = [];

    for (let i = 0; i < cleanedRows.length; i++) {
      const row = cleanedRows[i];
      const seq = i + 1;

      const nomorProduk = clean(row['NOMOR PRODUK']) || String(seq);
      const code = clean(row.CODE) || `MAT-CSV-${String(seq).padStart(5, '0')}`;
      const jenis = clean(row.JENIS) || null;
      const name = clean(row.NAMA);
      const satuan = clean(row.SATUAN) || 'Pcs';
      const harga = parsePrice(row.HARGA);
      const vendorName = clean(row.VENDOR);
      const status = (clean(row.STATUS) || 'ACTIVE').toUpperCase();

      if (!clean(row.CODE)) generated++;

      // Skip duplicate code so script is re-runnable.
      const [existingRows] = await connection.query('SELECT id FROM master_materials WHERE code = ? LIMIT 1', [code]);
      if (existingRows.length > 0) {
        skipped++;
        outputRows.push({
          'NOMOR PRODUK': nomorProduk,
          CODE: code,
          JENIS: jenis || '',
          NAMA: name,
          SATUAN: satuan,
          HARGA: harga,
          VENDOR: vendorName,
          STATUS: status,
          NOTE: 'SKIPPED_DUPLICATE_CODE',
        });
        continue;
      }

      let vendorId = null;
      if (vendorName) {
        const [vendorRows] = await connection.query('SELECT id FROM vendors WHERE name = ? LIMIT 1', [vendorName]);
        if (vendorRows.length > 0) {
          vendorId = vendorRows[0].id;
        } else {
          const vendorCode = `VND-CSV-${Date.now()}-${seq}`;
          const [vendorInsert] = await connection.query(
            'INSERT INTO vendors (code, name, is_active) VALUES (?, ?, 1)',
            [vendorCode, vendorName]
          );
          vendorId = vendorInsert.insertId;
        }
      }

      await connection.query(
        'INSERT INTO master_materials (code, jenis, name, satuan, harga, vendor_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [code, jenis, name, satuan, harga, vendorId, status === 'ACTIVE' ? 1 : 0]
      );

      inserted++;
      outputRows.push({
        'NOMOR PRODUK': nomorProduk,
        CODE: code,
        JENIS: jenis || '',
        NAMA: name,
        SATUAN: satuan,
        HARGA: harga,
        VENDOR: vendorName,
        STATUS: status,
        NOTE: 'INSERTED',
      });
    }

    await connection.commit();

    const outWs = XLSX.utils.json_to_sheet(outputRows);
    const outWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(outWb, outWs, 'MATERIAL');
    XLSX.writeFile(outWb, OUTPUT_CSV, { bookType: 'csv' });

    console.log('=== HASIL INJEK MATERIAL ===');
    console.log(`Total baris valid   : ${cleanedRows.length}`);
    console.log(`Code auto-generated : ${generated}`);
    console.log(`Berhasil diinsert   : ${inserted}`);
    console.log(`Skip duplikat code  : ${skipped}`);
    console.log(`File hasil update   : ${OUTPUT_CSV}`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('Gagal proses:', err.message);
  process.exit(1);
});
