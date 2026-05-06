const mysql = require('mysql2/promise');

const normalizeText = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
};

const normalizeJenis = (value) => {
  const v = normalizeText(value);
  if (!v || v === '-' || v === ' - ') return null;
  return v;
};

const normalizeSatuan = (value) => {
  const raw = normalizeText(value).toUpperCase();
  if (!raw) return 'PCS';

  const map = {
    PCS: 'PCS',
    PC: 'PCS',
    'PCS.': 'PCS',
    Pcs: 'PCS',
    BATANG: 'BATANG',
    BTG: 'BATANG',
    UNIT: 'UNIT',
    SET: 'SET',
    LOT: 'LOT',
    ROLL: 'ROLL',
    PACK: 'PACK',
    BOX: 'BOX',
    LUSIN: 'LUSIN',
    M: 'M',
    M2: 'M2',
    M3: 'M3',
    KG: 'KG',
    SAK: 'SAK',
    ZAK: 'SAK',
    DAYS: 'DAYS',
    DAY: 'DAYS',
    GALON: 'GALON',
    TABUNG: 'TABUNG',
    LEMBAR: 'LEMBAR',
    OH: 'OH',
  };

  return map[raw] || raw;
};

async function main() {
  const db = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'erp_manufacturing',
  });

  let updatedRows = 0;
  let deactivatedRows = 0;

  try {
    await db.beginTransaction();

    const [materials] = await db.query(`
      SELECT id, code, jenis, name, satuan, harga, vendor_id, is_active
      FROM master_materials
      WHERE code LIKE 'MAT-CSV-%'
      ORDER BY id ASC
    `);

    const [vendorRows] = await db.query(`
      SELECT id, name
      FROM vendors
      WHERE id IN (
        SELECT DISTINCT vendor_id
        FROM master_materials
        WHERE code LIKE 'MAT-CSV-%' AND vendor_id IS NOT NULL
      )
    `);

    const vendorNameMap = new Map();
    for (const v of vendorRows) {
      vendorNameMap.set(v.id, normalizeText(v.name));
    }

    for (const v of vendorRows) {
      const fixedName = normalizeText(v.name);
      if (fixedName !== v.name) {
        await db.query('UPDATE vendors SET name = ? WHERE id = ?', [fixedName, v.id]);
      }
    }

    for (const row of materials) {
      const newJenis = normalizeJenis(row.jenis);
      const newName = normalizeText(row.name);
      const newSatuan = normalizeSatuan(row.satuan);

      if (newJenis !== row.jenis || newName !== row.name || newSatuan !== row.satuan) {
        await db.query(
          'UPDATE master_materials SET jenis = ?, name = ?, satuan = ? WHERE id = ?',
          [newJenis, newName, newSatuan, row.id]
        );
        updatedRows++;
      }
    }

    const [afterNormalize] = await db.query(`
      SELECT id, jenis, name, satuan, harga, vendor_id, is_active
      FROM master_materials
      WHERE code LIKE 'MAT-CSV-%'
      ORDER BY id ASC
    `);

    const keeperByKey = new Map();
    for (const row of afterNormalize) {
      const key = [
        normalizeText(row.name).toLowerCase(),
        normalizeText(row.jenis || '').toLowerCase(),
        normalizeSatuan(row.satuan),
        Number(row.harga || 0).toFixed(2),
        row.vendor_id || 0,
      ].join('|');

      if (!keeperByKey.has(key)) {
        keeperByKey.set(key, row.id);
      } else if (row.is_active === 1) {
        await db.query('UPDATE master_materials SET is_active = 0 WHERE id = ?', [row.id]);
        deactivatedRows++;
      }
    }

    await db.commit();

    const [summary] = await db.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_count,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS inactive_count
      FROM master_materials
      WHERE code LIKE 'MAT-CSV-%'
    `);

    const [dupGroupsAfter] = await db.query(`
      SELECT COUNT(*) AS duplicate_groups
      FROM (
        SELECT
          LOWER(TRIM(name)) AS n,
          LOWER(TRIM(IFNULL(jenis, ''))) AS j,
          UPPER(TRIM(satuan)) AS s,
          harga AS h,
          IFNULL(vendor_id, 0) AS v,
          COUNT(*) AS c
        FROM master_materials
        WHERE code LIKE 'MAT-CSV-%' AND is_active = 1
        GROUP BY n, j, s, h, v
        HAVING COUNT(*) > 1
      ) x
    `);

    console.log('=== RAPIIHKAN DATA MATERIAL CSV ===');
    console.log('Row dinormalisasi        :', updatedRows);
    console.log('Duplikat di-nonaktifkan  :', deactivatedRows);
    console.log('Total MAT-CSV            :', summary[0].total);
    console.log('Active MAT-CSV           :', summary[0].active_count);
    console.log('Inactive MAT-CSV         :', summary[0].inactive_count);
    console.log('Dup group aktif (after)  :', dupGroupsAfter[0].duplicate_groups);

    const [sample] = await db.query(`
      SELECT m.code, m.jenis, m.name, m.satuan, m.harga, v.name AS vendor_name, m.is_active
      FROM master_materials m
      LEFT JOIN vendors v ON v.id = m.vendor_id
      WHERE m.code LIKE 'MAT-CSV-%'
      ORDER BY m.id DESC
      LIMIT 10
    `);
    console.table(sample);
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error('Gagal rapihin data:', e.message);
  process.exit(1);
});
