const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing'
  });

  console.log('🔄 Adding missing master data...\n');

  let addedLabor = 0;
  let addedMaterial = 0;

  // ===== ADD MISSING LABOR =====
  const laborToAdd = [
    { code: 'L.20', name: 'Kepala tukang batu', satuan: 'oh', harga: 128000 },
    { code: 'L.21', name: 'Tukang besi', satuan: 'oh', harga: 111055 },
    { code: 'L.22', name: 'Operator crane', satuan: 'OH', harga: 150000 },
    { code: 'L.23', name: 'Pembantu operator crane', satuan: 'OH', harga: 100000 },
    { code: 'L.24', name: 'Tukang vibrator', satuan: 'OH', harga: 100000 },
    { code: 'L.25', name: 'Tukang ereksi', satuan: 'OH', harga: 111055 },
    { code: 'L.26', name: 'Tukang Batu/Pipa', satuan: 'OH', harga: 111055 },
    { code: 'L.27', name: 'Mandor/Supervisor/ Penyelia', satuan: 'OH', harga: 125685 },
    { code: 'L.28', name: 'Tukang cat', satuan: 'oh', harga: 111055 }
  ];

  for (const labor of laborToAdd) {
    const [existing] = await conn.query('SELECT id FROM master_labor WHERE name = ?', [labor.name]);
    if (existing.length === 0) {
      await conn.query(
        'INSERT INTO master_labor (code, name, satuan, harga, is_active) VALUES (?, ?, ?, ?, 1)',
        [labor.code, labor.name, labor.satuan, labor.harga]
      );
      console.log(`✅ Added labor: ${labor.name}`);
      addedLabor++;
    } else {
      console.log(`⏭️  Labor exists: ${labor.name}`);
    }
  }

  // ===== ADD MISSING MATERIALS =====
  const materialsToAdd = [
    { code: 'M.100', jenis: 'Pasir', name: 'Pasir Pasang', satuan: 'm3', harga: 190 },
    { code: 'M.101', jenis: 'Semen', name: 'Semen portland', satuan: 'Kg', harga: 1417 },
    { code: 'M.102', jenis: 'Semen', name: 'Semen warna', satuan: 'Kg', harga: 2000 },
    { code: 'M.103', jenis: 'Pasir', name: 'PP', satuan: 'm3', harga: 190 },
    { code: 'M.104', jenis: 'Bata', name: 'Bata merah', satuan: 'buah', harga: 1200 },
    { code: 'M.105', jenis: 'Semen', name: 'Semen PC', satuan: 'Kg', harga: 1417 },
    { code: 'M.106', jenis: 'Batu', name: 'Batu belah', satuan: 'm3', harga: 350000 },
    { code: 'M.107', jenis: 'Kayu', name: 'Kayu kelas III', satuan: 'm3', harga: 5000000 },
    { code: 'M.108', jenis: 'Paku', name: 'Paku 5 cm – 12 cm', satuan: 'kg', harga: 20403 },
    { code: 'M.109', jenis: 'Besi', name: 'Kawat beton', satuan: 'Kg', harga: 15000 },
    { code: 'M.110', jenis: 'Kerikil', name: 'Kerikil (Maks 30mm)', satuan: 'kg', harga: 0.211 },
    { code: 'M.111', jenis: 'Minyak', name: 'Minyak bekisting', satuan: 'Liter', harga: 8750 },
    { code: 'M.112', jenis: 'Lem', name: 'Lem', satuan: 'Kg', harga: 50000 },
    { code: 'M.113', jenis: 'Besi', name: 'Besi angker diameter 8', satuan: 'Kg', harga: 15000 },
    { code: 'M.114', jenis: 'Kapur', name: 'Kapur Padam', satuan: 'm3', harga: 150000 },
    { code: 'M.115', jenis: 'Kayu', name: 'Balok kayu kelas II', satuan: 'm3', harga: 8000000 },
    { code: 'M.116', jenis: 'Kapur', name: 'KP', satuan: 'm3', harga: 150000 },
    { code: 'M.117', jenis: 'Keramik', name: 'Ubin keramik', satuan: 'Bh', harga: 50000 },
    { code: 'M.118', jenis: 'BBM', name: 'Solar', satuan: 'L', harga: 6800 },
    { code: 'M.119', jenis: 'Pasir', name: 'Pasir urug', satuan: 'm3', harga: 150000 },
    { code: 'M.120', jenis: 'Kayu', name: 'Plywood tebal 9 mm', satuan: 'Lbr', harga: 150000 },
    { code: 'M.121', jenis: 'Keramik', name: 'Keramik artistik', satuan: 'buah', harga: 80000 },
    { code: 'M.122', jenis: 'Kapur', name: 'Kapur', satuan: 'm3', harga: 150000 },
    { code: 'M.123', jenis: 'Minyak', name: 'Minyak cetakan (bekisting)', satuan: 'L', harga: 8750 },
    { code: 'M.124', jenis: 'Keramik', name: 'Plint keramik', satuan: 'Bh', harga: 20000 },
    { code: 'M.125', jenis: 'Kayu', name: 'Phenol film 12 mm', satuan: 'Lbr', harga: 250000 },
    { code: 'M.126', jenis: 'Paku', name: 'Paku biasa 2" – 5"', satuan: 'Kg', harga: 20403 },
    { code: 'M.127', jenis: 'Keramik', name: 'Ubin keramik', satuan: 'doos', harga: 500000 },
    { code: 'M.128', jenis: 'Kerikil', name: 'Koral beton', satuan: 'm3', harga: 211000 },
    { code: 'M.129', jenis: 'Keramik', name: 'Plint ubin warna', satuan: 'Bh', harga: 25000 },
    { code: 'M.130', jenis: 'Batu', name: 'Dolken Kayu Ø 8-10/400 cm', satuan: 'Batang', harga: 35000 },
    { code: 'M.131', jenis: 'Seng', name: 'Seng gelombang', satuan: 'Lbr', harga: 75000 },
    { code: 'M.132', jenis: 'Cat', name: 'Meni besi', satuan: 'Kg', harga: 25000 },
    { code: 'M.133', jenis: 'Conblock', name: 'Paving block', satuan: 'M2', harga: 100000 }
  ];

  for (const material of materialsToAdd) {
    const [existing] = await conn.query('SELECT id FROM master_materials WHERE name = ?', [material.name]);
    if (existing.length === 0) {
      await conn.query(
        'INSERT INTO master_materials (code, jenis, name, satuan, harga, is_active) VALUES (?, ?, ?, ?, ?, 1)',
        [material.code, material.jenis, material.name, material.satuan, material.harga]
      );
      console.log(`✅ Added material: ${material.name}`);
      addedMaterial++;
    } else {
      console.log(`⏭️  Material exists: ${material.name}`);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Added ${addedLabor} labor items`);
  console.log(`   ✅ Added ${addedMaterial} material items`);
  console.log(`   📈 Total: ${addedLabor + addedMaterial} new master data entries`);

  await conn.end();
  console.log('\n✨ Master data update completed!');
})().catch(console.error);
