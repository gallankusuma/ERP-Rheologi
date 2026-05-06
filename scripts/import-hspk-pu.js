/**
 * Import HSPK (Harga Satuan Pekerjaan Konstruksi) from PU Website
 * Source: https://maspetruk.dpubinmarcipka.jatengprov.go.id
 * 
 * API Endpoints:
 *   List:   /manajemen_master/pekerjaan/list_arsip/{bidang}/{kab_id}
 *   Detail: /manajemen_master/pekerjaan/detail_json_file/{id}/{kab_id}
 * 
 * Bidang IDs:
 *   1 = Cipta Karya dan Perumahan  (hspk)
 *   2 = Bina Marga                 (hspk_binamarga)
 *   3 = Umum                       (hspk_umum)
 * 
 * Usage: node scripts/import-hspk-pu.js [kab_id] [bidang_ids]
 *   Default kab_id: 3301 (Kab. Cilacap)
 *   Default bidang: 1,2,3 (all)
 *   Example: node scripts/import-hspk-pu.js 3301 1,2,3
 *            node scripts/import-hspk-pu.js 3301 2   (Bina Marga only)
 */

const https = require('https');
const mysql = require('mysql2/promise');

const BASE_HOST = 'maspetruk.dpubinmarcipka.jatengprov.go.id';
const KAB_ID = process.argv[2] || '3301';
const BIDANG_INPUT = process.argv[3] || '1,2,3';

const BIDANG_CONFIG = {
  1: { name: 'Cipta Karya & Perumahan', code: 'CK' },
  2: { name: 'Bina Marga', code: 'BM' },
  3: { name: 'Bidang Umum', code: 'UMUM' },
};

// Section mapping: PU jenis_uraian → AHSP section
const SECTION_MAP = {
  tenaga: { section: 'A', resource_type: 'labor' },
  bahan: { section: 'B', resource_type: 'material' },
  peralatan: { section: 'C', resource_type: 'equipment' },
};

function fetchJSON(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_HOST,
      path,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON parse error for ${path}: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const bidangIds = BIDANG_INPUT.split(',').map(Number).filter(id => BIDANG_CONFIG[id]);
  console.log(`\n=== HSPK PU Import — Kab ID: ${KAB_ID} ===`);
  console.log(`Bidang: ${bidangIds.map(id => BIDANG_CONFIG[id].name).join(', ')}\n`);

  const db = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'erp_manufacturing',
  });

  let grandTotal = 0, grandImported = 0, grandErrors = 0;

  for (const bidangId of bidangIds) {
    const cfg = BIDANG_CONFIG[bidangId];
    const VERSION = `PU-${KAB_ID}-B${bidangId}-2025`;

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📋 ${cfg.name} (bidang=${bidangId})`);
    console.log(`${'═'.repeat(60)}`);

    // 1. Fetch list
    console.log('Fetching HSPK list...');
    const listResp = await fetchJSON(`/manajemen_master/pekerjaan/list_arsip/${bidangId}/${KAB_ID}`);
    const items = listResp.data;
    console.log(`Found ${items.length} HSPK items`);

    // 2. Ensure discipline exists
    const [existingDisc] = await db.query(
      'SELECT id FROM master_disciplines WHERE name = ?',
      [cfg.name]
    );
    let disciplineId;
    if (existingDisc.length > 0) {
      disciplineId = existingDisc[0].id;
    } else {
      const [res] = await db.query(
        'INSERT INTO master_disciplines (name, code) VALUES (?, ?)',
        [cfg.name, cfg.code]
      );
      disciplineId = res.insertId;
    }
    console.log(`Discipline "${cfg.name}" id: ${disciplineId}`);

    // 3. Create sub-disciplines from jenis_pekerjaan
    const subDiscMap = {};
    const jenisList = [...new Set(items.map((i) => i.jenis_pekerjaan))];
    console.log(`Sub-discipline groups (${jenisList.length}):`);

    for (const jenis of jenisList) {
      const shortName = jenis
        .replace(/^HARGA SATUAN PEKERJAAN\s*/i, '')
        .replace(/^PEKERJAAN\s*/i, '')
        .trim();
      const displayName = shortName.charAt(0).toUpperCase() + shortName.slice(1).toLowerCase();

      const [existing] = await db.query(
        'SELECT id FROM master_sub_disciplines WHERE name = ? AND discipline_id = ?',
        [displayName, disciplineId]
      );

      if (existing.length > 0) {
        subDiscMap[jenis] = existing[0].id;
      } else {
        const code = displayName.substring(0, 3).toUpperCase();
        const [res] = await db.query(
          'INSERT INTO master_sub_disciplines (name, code, discipline_id) VALUES (?, ?, ?)',
          [displayName, code, disciplineId]
        );
        subDiscMap[jenis] = res.insertId;
      }
      console.log(`  ${displayName} → id ${subDiscMap[jenis]}`);
    }

    // 4. Clear old import for this bidang+kab
    const [existingImport] = await db.query(
      'SELECT COUNT(*) as cnt FROM ahsp_headers WHERE version = ?',
      [VERSION]
    );
    if (existingImport[0].cnt > 0) {
      console.log(`\n⚠️  Found ${existingImport[0].cnt} existing with version "${VERSION}". Clearing...`);
      const [oldHeaders] = await db.query('SELECT id FROM ahsp_headers WHERE version = ?', [VERSION]);
      const oldIds = oldHeaders.map((h) => h.id);
      if (oldIds.length > 0) {
        await db.query(`DELETE FROM ahsp_items WHERE ahsp_id IN (${oldIds.join(',')})`);
        await db.query(`DELETE FROM ahsp_sub_discipline_map WHERE ahsp_id IN (${oldIds.join(',')})`);
        await db.query('DELETE FROM ahsp_headers WHERE version = ?', [VERSION]);
      }
      console.log('Old data cleared.');
    }

    // 5. Import items
    let imported = 0, errors = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const progress = `[${i + 1}/${items.length}]`;

      try {
        const detail = await fetchJSON(
          `/manajemen_master/pekerjaan/detail_json_file/${item.id}/${KAB_ID}`
        );
        const resources = detail.data || [];

        let hargaTenaga = 0, hargaBahan = 0, hargaAlat = 0;
        for (const r of resources) {
          const jumlah = (parseFloat(r.koefisien) || 0) * (parseFloat(r.harga) || 0);
          if (r.jenis_uraian === 'tenaga') hargaTenaga += jumlah;
          else if (r.jenis_uraian === 'bahan') hargaBahan += jumlah;
          else if (r.jenis_uraian === 'peralatan') hargaAlat += jumlah;
        }
        const hargaLangsung = hargaTenaga + hargaBahan + hargaAlat;
        const overheadProfit = hargaLangsung * 0.10;
        const hargaSatuan = hargaLangsung + overheadProfit;

        const kode = (item.kode || '').trim();
        const name = (item.nama_pekerjaan || '').trim();
        const satuan = (item.satuan || '').trim();

        const [headerRes] = await db.query(
          `INSERT INTO ahsp_headers 
           (kode, name, satuan, version, status, harga_tenaga, harga_bahan, harga_alat, harga_langsung, overhead_profit, harga_satuan)
           VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`,
          [kode, name, satuan, VERSION, hargaTenaga, hargaBahan, hargaAlat, hargaLangsung, overheadProfit, hargaSatuan]
        );
        const ahspId = headerRes.insertId;

        const subDiscId = subDiscMap[item.jenis_pekerjaan];
        if (subDiscId) {
          await db.query(
            'INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id) VALUES (?, ?)',
            [ahspId, subDiscId]
          );
        }

        for (const r of resources) {
          const mapping = SECTION_MAP[r.jenis_uraian];
          if (!mapping) continue;
          const koef = parseFloat(r.koefisien) || 0;
          const harga = parseFloat(r.harga) || 0;
          await db.query(
            `INSERT INTO ahsp_items 
             (ahsp_id, section, resource_type, resource_id, koefisien, resource_name, resource_satuan, resource_harga, jumlah_harga)
             VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)`,
            [ahspId, mapping.section, mapping.resource_type, koef, (r.nama || '').trim(), (r.satuan || '').trim(), harga, koef * harga]
          );
        }

        imported++;
        if (i % 50 === 0 || i === items.length - 1) {
          console.log(`${progress} ✅ ${kode} — ${name.substring(0, 50)} (${resources.length} items, ${formatRp(hargaSatuan)})`);
        }

        // Polite delay
        if (i % 20 === 19) await sleep(300);

      } catch (err) {
        errors++;
        console.error(`${progress} ❌ ${item.kode} — ${err.message}`);
      }
    }

    console.log(`\n  ✅ Imported: ${imported}  ❌ Errors: ${errors}  📊 Total: ${items.length}`);
    grandTotal += items.length;
    grandImported += imported;
    grandErrors += errors;
  }

  // Also clean up old version format (PU-3301-2025) from previous import
  const [oldFormat] = await db.query(
    "SELECT COUNT(*) as cnt FROM ahsp_headers WHERE version = ?",
    [`PU-${KAB_ID}-2025`]
  );
  if (oldFormat[0].cnt > 0) {
    console.log(`\n🧹 Cleaning up ${oldFormat[0].cnt} items with old version format "PU-${KAB_ID}-2025"...`);
    const [oldHeaders] = await db.query('SELECT id FROM ahsp_headers WHERE version = ?', [`PU-${KAB_ID}-2025`]);
    const oldIds = oldHeaders.map((h) => h.id);
    if (oldIds.length > 0) {
      await db.query(`DELETE FROM ahsp_items WHERE ahsp_id IN (${oldIds.join(',')})`);
      await db.query(`DELETE FROM ahsp_sub_discipline_map WHERE ahsp_id IN (${oldIds.join(',')})`);
      await db.query('DELETE FROM ahsp_headers WHERE version = ?', [`PU-${KAB_ID}-2025`]);
    }
    console.log('Old format data cleaned.');
  }

  // Sync master price tables from ahsp_items
  console.log(`\n🔄 Syncing Harga Satuan Dasar to master tables...`);
  const [uniqueRes] = await db.query(`
    SELECT resource_type, resource_name, resource_satuan, MAX(resource_harga) as harga
    FROM ahsp_items WHERE resource_name IS NOT NULL AND resource_name != ''
    GROUP BY resource_type, resource_name, resource_satuan
  `);

  const masterTables = {
    labor: { table: 'master_labor', prefix: 'L', pad: 2 },
    material: { table: 'master_materials', prefix: 'M', pad: 4 },
    equipment: { table: 'master_equipment', prefix: 'E', pad: 3 },
  };

  let syncAdded = 0, syncUpdated = 0;
  for (const [type, cfg] of Object.entries(masterTables)) {
    const items = uniqueRes.filter(r => r.resource_type === type);
    const [existing] = await db.query(`SELECT id, name, satuan, harga FROM ${cfg.table} WHERE is_active = 1`);
    const [maxCode] = await db.query(`SELECT MAX(CAST(SUBSTRING(code, ${cfg.prefix.length + 2}) AS UNSIGNED)) as maxNum FROM ${cfg.table} WHERE code LIKE '${cfg.prefix}.%'`);
    let codeNum = maxCode[0].maxNum || 0;

    for (const item of items) {
      const ex = existing.find(e => e.name === item.resource_name && e.satuan === item.resource_satuan);
      if (ex) {
        if (parseFloat(ex.harga) !== parseFloat(item.harga)) {
          await db.query(`UPDATE ${cfg.table} SET harga = ? WHERE id = ?`, [item.harga, ex.id]);
          syncUpdated++;
        }
      } else {
        codeNum++;
        const code = `${cfg.prefix}.${String(codeNum).padStart(cfg.pad, '0')}`;
        await db.query(`INSERT INTO ${cfg.table} (code, name, satuan, harga, is_active) VALUES (?, ?, ?, ?, 1)`, [code, item.resource_name, item.resource_satuan, item.harga]);
        existing.push({ id: 0, name: item.resource_name, satuan: item.resource_satuan, harga: item.harga });
        syncAdded++;
      }
    }
  }
  console.log(`  Master prices: Added ${syncAdded}, Updated ${syncUpdated}`);

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🏁 GRAND TOTAL`);
  console.log(`  ✅ Imported: ${grandImported}`);
  console.log(`  ❌ Errors:   ${grandErrors}`);
  console.log(`  📊 Total:    ${grandTotal}`);
  console.log(`${'═'.repeat(60)}\n`);

  await db.end();
}

function formatRp(val) {
  return 'Rp ' + Math.round(val).toLocaleString('id-ID');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
