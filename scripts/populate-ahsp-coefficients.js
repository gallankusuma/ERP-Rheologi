/**
 * Populate AHSP coefficients (ahsp_items) for all 289 template AHSP entries
 * Also updates harga_satuan on ahsp_headers based on computed totals
 * 
 * Strategy:
 * 1. For items matching existing reference AHSP, copy their coefficients
 * 2. For specialized items, build coefficients from standard SNI/Permen PUPR references
 * 3. Calculate harga_satuan = sum of (koefisien × resource_harga) for each section
 */

const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'erp_user',
    password: 'ErpSecure2024!',
    database: 'erp_manufacturing'
  });

  console.log('Connected to database');

  // Helper to get resource IDs
  const [laborRows] = await conn.query('SELECT id, name, satuan, harga FROM master_labor');
  const [materialRows] = await conn.query('SELECT id, name, satuan, harga FROM master_materials');
  const [equipmentRows] = await conn.query('SELECT id, name, satuan, harga FROM master_equipment');

  const labor = {};
  laborRows.forEach(r => { labor[r.name] = r; });
  const material = {};
  materialRows.forEach(r => { material[r.name] = r; });
  const equipment = {};
  equipmentRows.forEach(r => { equipment[r.name] = r; });

  // Helper functions
  function findLabor(name) {
    if (labor[name]) return labor[name];
    for (const k of Object.keys(labor)) {
      if (k.toLowerCase().includes(name.toLowerCase())) return labor[k];
    }
    return null;
  }
  function findMaterial(name) {
    if (material[name]) return material[name];
    for (const k of Object.keys(material)) {
      if (k.toLowerCase().includes(name.toLowerCase())) return material[k];
    }
    return null;
  }
  function findEquipment(name) {
    if (equipment[name]) return equipment[name];
    for (const k of Object.keys(equipment)) {
      if (k.toLowerCase().includes(name.toLowerCase())) return equipment[k];
    }
    return null;
  }

  // Get all new AHSP headers
  const [headers] = await conn.query(
    `SELECT id, kode, name, satuan FROM ahsp_headers 
     WHERE (kode LIKE 'CB.%' OR kode LIKE 'CS.%' OR kode LIKE 'PP.%' OR kode LIKE 'EL.%' OR kode LIKE 'ME.%')
     ORDER BY kode`
  );
  console.log(`Found ${headers.length} template AHSP headers`);

  // Get reference AHSP coefficients from existing database
  async function getRefCoefficients(refKode) {
    const [rows] = await conn.query(
      `SELECT section, resource_type, resource_id, koefisien, resource_name, resource_satuan, resource_harga 
       FROM ahsp_items WHERE ahsp_id = (SELECT id FROM ahsp_headers WHERE kode = ? LIMIT 1)
       ORDER BY section, id`,
      [refKode]
    );
    return rows;
  }

  // Insert or find resource, return {id, harga}
  async function ensureLabor(name, satuan, harga) {
    let r = findLabor(name);
    if (r) return { id: r.id, harga: parseFloat(r.harga) };
    const [result] = await conn.query(
      'INSERT INTO master_labor (name, satuan, harga) VALUES (?, ?, ?)',
      [name, satuan, harga]
    );
    labor[name] = { id: result.insertId, name, satuan, harga };
    console.log(`  + Added labor: ${name} (${satuan}) @ ${harga}`);
    return { id: result.insertId, harga };
  }

  async function ensureMaterial(name, satuan, harga) {
    let r = findMaterial(name);
    if (r) return { id: r.id, harga: parseFloat(r.harga) };
    const [result] = await conn.query(
      'INSERT INTO master_materials (name, satuan, harga) VALUES (?, ?, ?)',
      [name, satuan, harga]
    );
    material[name] = { id: result.insertId, name, satuan, harga };
    console.log(`  + Added material: ${name} (${satuan}) @ ${harga}`);
    return { id: result.insertId, harga };
  }

  async function ensureEquipment(name, satuan, harga) {
    let r = findEquipment(name);
    if (r) return { id: r.id, harga: parseFloat(r.harga) };
    const [result] = await conn.query(
      'INSERT INTO master_equipment (name, satuan, harga) VALUES (?, ?, ?)',
      [name, satuan, harga]
    );
    equipment[name] = { id: result.insertId, name, satuan, harga };
    console.log(`  + Added equipment: ${name} (${satuan}) @ ${harga}`);
    return { id: result.insertId, harga };
  }

  // Insert coefficient row
  async function insertCoeff(ahspId, section, resourceType, resourceId, koefisien, resourceName, resourceSatuan, resourceHarga) {
    const jumlah = Math.round(koefisien * resourceHarga * 100) / 100;
    await conn.query(
      `INSERT INTO ahsp_items (ahsp_id, section, resource_type, resource_id, koefisien, resource_name, resource_satuan, resource_harga, jumlah_harga)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ahspId, section, resourceType, resourceId, koefisien, resourceName, resourceSatuan, resourceHarga, jumlah]
    );
    return jumlah;
  }

  // Copy coefficients from a reference AHSP, mapping to our resource IDs
  async function copyFromRef(ahspId, refKode) {
    const refCoeffs = await getRefCoefficients(refKode);
    let total = 0;
    for (const rc of refCoeffs) {
      let resId = rc.resource_id;
      let harga = parseFloat(rc.resource_harga) || 0;
      let name = rc.resource_name;
      let satuan = rc.resource_satuan;

      // Try to find matching resource in our master tables
      if (rc.resource_type === 'labor') {
        const found = findLabor(name);
        if (found) { resId = found.id; harga = parseFloat(found.harga); }
      } else if (rc.resource_type === 'material') {
        const found = findMaterial(name);
        if (found) { resId = found.id; harga = parseFloat(found.harga); }
      } else if (rc.resource_type === 'equipment') {
        const found = findEquipment(name);
        if (found) { resId = found.id; harga = parseFloat(found.harga); }
      }

      total += await insertCoeff(ahspId, rc.section, rc.resource_type, resId, parseFloat(rc.koefisien), name, satuan, harga);
    }
    return total;
  }

  // Define coefficient templates for common work types
  // Based on SNI/Permen PUPR 2023 standard coefficients

  // Standard labor references
  const L_MANDOR = { name: 'Mandor', satuan: 'OH', harga: 125685 };
  const L_PEKERJA = { name: 'Pekerja', satuan: 'OH', harga: 94206 };
  const L_TK_KAYU = { name: 'Tukang Kayu', satuan: 'OH', harga: 111055 };
  const L_TK_BATU = { name: 'Tukang Batu', satuan: 'OH', harga: 111055 };
  const L_TK_BESI = { name: 'Tukang Besi', satuan: 'OH', harga: 111055 };
  const L_TK_CAT = { name: 'Tukang Cat', satuan: 'OH', harga: 111055 };
  const L_TK_LISTRIK = { name: 'Tukang Listrik / Elektronik', satuan: 'OH', harga: 111055 };
  const L_TK_LAS = { name: 'Tukang Las', satuan: 'OH', harga: 111055 };
  const L_KEPALA = { name: 'Kepala Tukang', satuan: 'OH', harga: 128000 };
  const L_OPERATOR = { name: 'Tenaga Terampil Operator', satuan: 'OH', harga: 270000 };

  // Build coefficients for each AHSP based on its category
  async function buildCoefficients(h) {
    const kode = h.kode;
    const id = h.id;
    let total = 0;

    // ===================== CB (Civil Bangunan) =====================
    
    // CB.01.xx - Pekerjaan Persiapan
    if (kode === 'CB.01.01' || kode === 'CS.01.01' || kode === 'PP.01.01' || kode === 'EL.01.01' || kode === 'ME.01.01') {
      // Mobilisasi & Demobilisasi - lump sum
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const truck = await ensureEquipment('Dump Truck', 'Jam', 418000);
      total += await insertCoeff(id, 'A', 'labor', mandor.id, 2.0, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 10.0, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'C', 'equipment', truck.id, 8.0, 'Dump Truck', 'Jam', truck.harga);
    }
    else if (kode === 'CB.01.02' || kode === 'CS.01.02') {
      // Papan Nama Proyek - copy from ref 1.1.2.1 (247) or build
      total = await copyFromRef(id, '1.1.2.2');
    }
    else if (kode === 'CB.01.03' || kode === 'CS.01.03' || kode === 'CB.01.07') {
      // Direksi Keet / Gudang Material - copy from 1.1.2.4
      total = await copyFromRef(id, '1.1.2.4');
    }
    else if (kode === 'CB.01.04' || kode === 'CS.01.04') {
      // Bouwplank - copy from 1.1.4.2
      total = await copyFromRef(id, '1.1.4.2');
    }
    else if (kode === 'CB.01.05' || kode === 'CS.01.05' || kode === 'CB.02.01' || kode === 'CS.02.01') {
      // Land Clearing / Clearing & Grubbing
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      total += await insertCoeff(id, 'A', 'labor', mandor.id, 0.025, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.100, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      const exc = await ensureEquipment('Excavator', 'Jam', 450000);
      total += await insertCoeff(id, 'C', 'equipment', exc.id, 0.015, 'Excavator', 'Jam', exc.harga);
    }
    else if (kode === 'CB.01.06') {
      // Pagar Sementara - copy from 1.1.1.2
      total = await copyFromRef(id, '1.1.1.2');
    }
    else if (kode === 'CB.01.08') {
      // Instalasi Listrik & Air Sementara - lump sum
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const tkListrik = await ensureLabor(L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, L_TK_LISTRIK.harga);
      const kabel = await ensureMaterial('Kabel NYM 3x2.5mm', 'm\'', 18500);
      const pipa = await ensureMaterial('Pipa PVC 3/4"', 'm\'', 12500);
      total += await insertCoeff(id, 'A', 'labor', mandor.id, 1.0, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 4.0, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'A', 'labor', tkListrik.id, 2.0, L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, tkListrik.harga);
      total += await insertCoeff(id, 'B', 'material', kabel.id, 50.0, 'Kabel NYM 3x2.5mm', 'm\'', kabel.harga);
      total += await insertCoeff(id, 'B', 'material', pipa.id, 30.0, 'Pipa PVC 3/4"', 'm\'', pipa.harga);
    }
    else if (kode === 'CB.01.09' || kode === 'CS.01.06' || kode === 'PP.01.04' || kode === 'EL.01.04' || kode === 'ME.01.04') {
      // K3 / Safety Equipment - lump sum
      const helm = await ensureMaterial('Helm Safety', 'bh', 75000);
      const rompi = await ensureMaterial('Rompi Safety', 'bh', 45000);
      const sepatu = await ensureMaterial('Sepatu Safety', 'pasang', 250000);
      const sarung = await ensureMaterial('Sarung Tangan', 'pasang', 25000);
      const p3k = await ensureMaterial('Kotak P3K', 'set', 350000);
      const rambu = await ensureMaterial('Rambu K3', 'set', 500000);
      total += await insertCoeff(id, 'B', 'material', helm.id, 20.0, 'Helm Safety', 'bh', helm.harga);
      total += await insertCoeff(id, 'B', 'material', rompi.id, 20.0, 'Rompi Safety', 'bh', rompi.harga);
      total += await insertCoeff(id, 'B', 'material', sepatu.id, 20.0, 'Sepatu Safety', 'pasang', sepatu.harga);
      total += await insertCoeff(id, 'B', 'material', sarung.id, 40.0, 'Sarung Tangan', 'pasang', sarung.harga);
      total += await insertCoeff(id, 'B', 'material', p3k.id, 2.0, 'Kotak P3K', 'set', p3k.harga);
      total += await insertCoeff(id, 'B', 'material', rambu.id, 1.0, 'Rambu K3', 'set', rambu.harga);
    }
    
    // CB.02.xx - Pekerjaan Tanah
    else if (kode === 'CB.02.02' || kode === 'CB.02.03' || kode === 'CS.02.02' || kode === 'CB.03.12') {
      // Galian Tanah Pondasi / Sloof / Sumuran - copy from 1.2.1.1.1
      total = await copyFromRef(id, '1.2.1.1.1');
    }
    else if (kode === 'CB.02.04') {
      // Urugan Tanah Kembali - copy from 1.3.1.1
      total = await copyFromRef(id, '1.3.1.1');
    }
    else if (kode === 'CB.02.05' || kode === 'CS.02.03') {
      // Urugan Pasir - copy from 1.3.1.2
      total = await copyFromRef(id, '1.3.1.2');
    }
    else if (kode === 'CB.02.06' || kode === 'CS.02.04') {
      // Urugan Sirtu - copy from 1.3.2.2
      total = await copyFromRef(id, '1.3.2.2');
    }
    else if (kode === 'CB.02.07' || kode === 'CS.02.05') {
      // Pemadatan Tanah - copy from 1.3.3.1
      total = await copyFromRef(id, '1.3.3.1');
    }
    else if (kode === 'CB.02.08' || kode === 'CS.02.06') {
      // Pembuangan Tanah - copy from 1.4.2.3 (3km)
      total = await copyFromRef(id, '1.4.2.3');
    }
    
    // CB.03.xx - Pekerjaan Pondasi
    else if (kode === 'CB.03.01' || kode === 'CS.03.01') {
      // Lantai Kerja (Lean Concrete) - f'c 7.5 MPa
      total = await copyFromRef(id, '2.2.1.4.1');
    }
    else if (kode === 'CB.03.02' || kode === 'CS.03.02' || kode === 'CS.03.05') {
      // Foot Plate / Pondasi / Pedestal Bekisting - copy from fondasi telapak bekisting
      total = await copyFromRef(id, '2.2.1.3.1');
    }
    else if (kode.match(/CB\.03\.03|CB\.03\.06|CB\.03\.09|CB\.04\.02|CB\.04\.05|CB\.04\.08|CB\.04\.11|CB\.04\.14|CS\.03\.03|CS\.03\.06|CS\.04\.02|CS\.04\.04|CS\.04\.07|CS\.04\.09/) ) {
      // Pembesian - all reinforcement items (per kg)
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const tkBesi = await ensureLabor(L_TK_BESI.name, L_TK_BESI.satuan, L_TK_BESI.harga);
      const kepala = await ensureLabor(L_KEPALA.name, L_KEPALA.satuan, L_KEPALA.harga);
      const besiBeton = await ensureMaterial('Besi Beton Polos/Ulir', 'kg', 13500);
      const kawat = await ensureMaterial('Kawat Beton (Bendrat)', 'kg', 25913);
      total += await insertCoeff(id, 'A', 'labor', mandor.id, 0.0004, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.0070, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'A', 'labor', tkBesi.id, 0.0070, L_TK_BESI.name, L_TK_BESI.satuan, tkBesi.harga);
      total += await insertCoeff(id, 'A', 'labor', kepala.id, 0.0007, L_KEPALA.name, L_KEPALA.satuan, kepala.harga);
      total += await insertCoeff(id, 'B', 'material', besiBeton.id, 1.050, 'Besi Beton Polos/Ulir', 'kg', besiBeton.harga);
      total += await insertCoeff(id, 'B', 'material', kawat.id, 0.015, 'Kawat Beton (Bendrat)', 'kg', kawat.harga);
    }
    else if (kode.match(/CB\.03\.04|CB\.03\.07|CB\.03\.10|CB\.03\.14|CB\.04\.03|CB\.04\.06|CB\.04\.09|CB\.04\.12|CB\.04\.15|CS\.03\.04|CS\.03\.07|CS\.04\.03|CS\.04\.05|CS\.04\.08|CS\.04\.10/) ) {
      // Pengecoran - all concrete items (per m3)
      total = await copyFromRef(id, '2.2.1.6.1');
    }
    else if (kode === 'CB.03.05') {
      // Pengeboran Bored Pile (per m')
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const operator = await ensureLabor(L_OPERATOR.name, L_OPERATOR.satuan, L_OPERATOR.harga);
      const boreMachine = await ensureEquipment('Bored Pile Machine (Hidraulik) Auger dia. 30-60 cm', 'Jam', 15000);
      const crane = await ensureEquipment('Crane', 'Jam', 593750);
      const bentonite = await ensureMaterial('Bentonite', 'kg', 8500);
      total += await insertCoeff(id, 'A', 'labor', mandor.id, 0.080, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.400, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'A', 'labor', operator.id, 0.200, L_OPERATOR.name, L_OPERATOR.satuan, operator.harga);
      total += await insertCoeff(id, 'B', 'material', bentonite.id, 25.0, 'Bentonite', 'kg', bentonite.harga);
      total += await insertCoeff(id, 'C', 'equipment', boreMachine.id, 0.500, 'Bored Pile Machine', 'Jam', boreMachine.harga);
      total += await insertCoeff(id, 'C', 'equipment', crane.id, 0.250, 'Crane', 'Jam', crane.harga);
    }
    else if (kode === 'CB.03.08' || kode === 'CB.03.11') {
      // Pile Cap Bekisting / Pemancangan Mini Pile
      if (kode === 'CB.03.08') {
        total = await copyFromRef(id, '2.2.1.3.1');
      } else {
        // Mini Pile - per m'
        const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
        const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
        const operator = await ensureLabor(L_OPERATOR.name, L_OPERATOR.satuan, L_OPERATOR.harga);
        const miniPile = await ensureMaterial('Mini Pile Beton 20x20cm', 'm\'', 185000);
        const pileDriver = await ensureEquipment('Diesel Hammer', 'Jam', 750000);
        total += await insertCoeff(id, 'A', 'labor', mandor.id, 0.030, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
        total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.200, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
        total += await insertCoeff(id, 'A', 'labor', operator.id, 0.100, L_OPERATOR.name, L_OPERATOR.satuan, operator.harga);
        total += await insertCoeff(id, 'B', 'material', miniPile.id, 1.050, 'Mini Pile Beton 20x20cm', 'm\'', miniPile.harga);
        total += await insertCoeff(id, 'C', 'equipment', pileDriver.id, 0.150, 'Diesel Hammer', 'Jam', pileDriver.harga);
      }
    }
    else if (kode === 'CB.03.13') {
      // Pasangan Batu Kali
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const tkBatu = await ensureLabor(L_TK_BATU.name, L_TK_BATU.satuan, L_TK_BATU.harga);
      const kepala = await ensureLabor(L_KEPALA.name, L_KEPALA.satuan, L_KEPALA.harga);
      const batuKali = await ensureMaterial('Batu Kali/Gunung 15-20cm', 'm3', 175000);
      const semen = await ensureMaterial('Semen Portland (50 kg)', 'zak', 72500);
      const pasir = await ensureMaterial('Pasir Pasang', 'm3', 290000);
      total += await insertCoeff(id, 'A', 'labor', mandor.id, 0.083, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 1.500, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'A', 'labor', tkBatu.id, 0.750, L_TK_BATU.name, L_TK_BATU.satuan, tkBatu.harga);
      total += await insertCoeff(id, 'A', 'labor', kepala.id, 0.075, L_KEPALA.name, L_KEPALA.satuan, kepala.harga);
      total += await insertCoeff(id, 'B', 'material', batuKali.id, 1.200, 'Batu Kali/Gunung 15-20cm', 'm3', batuKali.harga);
      total += await insertCoeff(id, 'B', 'material', semen.id, 4.520, 'Semen Portland (50 kg)', 'zak', semen.harga);
      total += await insertCoeff(id, 'B', 'material', pasir.id, 0.520, 'Pasir Pasang', 'm3', pasir.harga);
    }

    // CB.04.xx - Pekerjaan Struktur Beton  
    else if (kode === 'CB.04.01' || kode === 'CS.03.08' || kode === 'CS.04.01' || kode === 'CS.04.06') {
      // Sloof / Tie Beam / Retaining Wall Bekisting
      total = await copyFromRef(id, '2.2.1.3.3');
    }
    else if (kode === 'CB.04.04') {
      // Kolom Bekisting
      total = await copyFromRef(id, '2.2.1.3.4');
    }
    else if (kode === 'CB.04.07' || kode === 'CB.04.10') {
      // Ring Balok / Balok Lantai Bekisting
      total = await copyFromRef(id, '2.2.1.3.5');
    }
    else if (kode === 'CB.04.13') {
      // Plat Lantai Bekisting
      total = await copyFromRef(id, '2.2.1.3.6');
    }

    // CB.05.xx - Dinding & Pasangan
    else if (kode === 'CB.05.01') {
      // Pasangan Bata Ringan / Hebel - copy from 3.6.4.2 (10cm)
      total = await copyFromRef(id, '3.6.4.2');
    }
    else if (kode === 'CB.05.02') {
      // Plesteran Dinding - copy from 3.7.2
      total = await copyFromRef(id, '3.7.2');
    }
    else if (kode === 'CB.05.03') {
      // Acian Dinding - copy from 3.7.8
      total = await copyFromRef(id, '3.7.8');
    }
    else if (kode === 'CB.05.04') {
      // Benangan / Tali Air
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const tkBatu = await ensureLabor(L_TK_BATU.name, L_TK_BATU.satuan, L_TK_BATU.harga);
      const semen = await ensureMaterial('PC/Portland Cement', 'Kg', 1583);
      const pasir = await ensureMaterial('Pasir Pasang', 'm3', 290000);
      total += await insertCoeff(id, 'A', 'labor', mandor.id, 0.003, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.030, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'A', 'labor', tkBatu.id, 0.015, L_TK_BATU.name, L_TK_BATU.satuan, tkBatu.harga);
      total += await insertCoeff(id, 'B', 'material', semen.id, 1.680, 'PC/Portland Cement', 'Kg', semen.harga);
      total += await insertCoeff(id, 'B', 'material', pasir.id, 0.002, 'Pasir Pasang', 'm3', pasir.harga);
    }
    else if (kode === 'CB.05.05') {
      // Pasangan Batu Bata - copy from existing
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const tkBatu = await ensureLabor(L_TK_BATU.name, L_TK_BATU.satuan, L_TK_BATU.harga);
      const kepala = await ensureLabor(L_KEPALA.name, L_KEPALA.satuan, L_KEPALA.harga);
      const bata = await ensureMaterial('Bata Merah uk. 22x11x4.5cm', 'bh', 900);
      const semen = await ensureMaterial('PC/Portland Cement', 'Kg', 1583);
      const pasir = await ensureMaterial('Pasir Pasang', 'm3', 290000);
      total += await insertCoeff(id, 'A', 'labor', mandor.id, 0.015, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.300, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'A', 'labor', tkBatu.id, 0.100, L_TK_BATU.name, L_TK_BATU.satuan, tkBatu.harga);
      total += await insertCoeff(id, 'A', 'labor', kepala.id, 0.010, L_KEPALA.name, L_KEPALA.satuan, kepala.harga);
      total += await insertCoeff(id, 'B', 'material', bata.id, 70.0, 'Bata Merah uk. 22x11x4.5cm', 'bh', bata.harga);
      total += await insertCoeff(id, 'B', 'material', semen.id, 11.50, 'PC/Portland Cement', 'Kg', semen.harga);
      total += await insertCoeff(id, 'B', 'material', pasir.id, 0.043, 'Pasir Pasang', 'm3', pasir.harga);
    }
    else if (kode === 'CB.05.06') {
      // Dinding Partisi
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const tkKayu = await ensureLabor(L_TK_KAYU.name, L_TK_KAYU.satuan, L_TK_KAYU.harga);
      const gypsum = await ensureMaterial('Gypsum Board 9mm', 'lbr', 72000);
      const hollow = await ensureMaterial('Hollow Galvanis 40x40mm', 'm\'', 35000);
      const sekrup = await ensureMaterial('Sekrup Gypsum', 'bh', 250);
      total += await insertCoeff(id, 'A', 'labor', mandor.id, 0.005, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.100, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'A', 'labor', tkKayu.id, 0.050, L_TK_KAYU.name, L_TK_KAYU.satuan, tkKayu.harga);
      total += await insertCoeff(id, 'B', 'material', gypsum.id, 0.700, 'Gypsum Board 9mm', 'lbr', gypsum.harga);
      total += await insertCoeff(id, 'B', 'material', hollow.id, 2.500, 'Hollow Galvanis 40x40mm', 'm\'', hollow.harga);
      total += await insertCoeff(id, 'B', 'material', sekrup.id, 16.0, 'Sekrup Gypsum', 'bh', sekrup.harga);
    }

    // CB.06.xx - Atap & Rangka
    else if (kode === 'CB.06.01') {
      // Rangka Atap Baja Ringan - copy from 2.1.1.1
      total = await copyFromRef(id, '2.1.1.1');
    }
    else if (kode === 'CB.06.02' || kode === 'CS.06.01') {
      // Penutup Atap Spandek/Galvalum
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const tkKayu = await ensureLabor(L_TK_KAYU.name, L_TK_KAYU.satuan, L_TK_KAYU.harga);
      const spandek = await ensureMaterial('Spandek Galvalum 0.35mm', 'm2', 85000);
      const sekrup = await ensureMaterial('Sekrup Roofing 12-14x25', 'bh', 1500);
      total += await insertCoeff(id, 'A', 'labor', mandor.id, 0.005, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.060, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'A', 'labor', tkKayu.id, 0.030, L_TK_KAYU.name, L_TK_KAYU.satuan, tkKayu.harga);
      total += await insertCoeff(id, 'B', 'material', spandek.id, 1.100, 'Spandek Galvalum 0.35mm', 'm2', spandek.harga);
      total += await insertCoeff(id, 'B', 'material', sekrup.id, 12.0, 'Sekrup Roofing 12-14x25', 'bh', sekrup.harga);
    }
    else if (kode === 'CB.06.03' || kode === 'CS.06.03') {
      // Bubungan / Ridge / Flashing
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const ridge = await ensureMaterial('Nok / Bubungan Galvalum', 'm\'', 55000);
      const sekrup = await ensureMaterial('Sekrup Roofing 12-14x25', 'bh', 1500);
      total += await insertCoeff(id, 'A', 'labor', mandor.id, 0.003, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.030, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', ridge.id, 1.050, 'Nok / Bubungan Galvalum', 'm\'', ridge.harga);
      total += await insertCoeff(id, 'B', 'material', sekrup.id, 6.0, 'Sekrup Roofing 12-14x25', 'bh', sekrup.harga);
    }
    else if (kode === 'CB.06.04' || kode === 'CS.06.04') {
      // Lisplang & Talang Air
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const lisplang = await ensureMaterial('Lisplang GRC/Fiber', 'm\'', 65000);
      const talang = await ensureMaterial('Talang Air PVC', 'm\'', 85000);
      const paku = await ensureMaterial('Paku Biasa 2" - 5"', 'Kg', 25913);
      total += await insertCoeff(id, 'A', 'labor', mandor.id, 0.004, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.040, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', lisplang.id, 1.050, 'Lisplang GRC/Fiber', 'm\'', lisplang.harga);
      total += await insertCoeff(id, 'B', 'material', talang.id, 1.050, 'Talang Air PVC', 'm\'', talang.harga);
      total += await insertCoeff(id, 'B', 'material', paku.id, 0.100, 'Paku Biasa 2" - 5"', 'Kg', paku.harga);
    }
    else if (kode === 'CB.06.05') {
      // Flashing & Sealant
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const flashing = await ensureMaterial('Flashing Galvalum', 'm\'', 45000);
      const sealant = await ensureMaterial('Sealant Silicone', 'tube', 65000);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.050, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', flashing.id, 1.050, 'Flashing Galvalum', 'm\'', flashing.harga);
      total += await insertCoeff(id, 'B', 'material', sealant.id, 0.200, 'Sealant Silicone', 'tube', sealant.harga);
    }
    else if (kode === 'CB.06.06') {
      // Insulation Atap
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const insulation = await ensureMaterial('Glasswool Insulation 50mm', 'm2', 45000);
      const alumFoil = await ensureMaterial('Aluminium Foil Bubble', 'm2', 35000);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.040, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', insulation.id, 1.050, 'Glasswool Insulation 50mm', 'm2', insulation.harga);
      total += await insertCoeff(id, 'B', 'material', alumFoil.id, 1.100, 'Aluminium Foil Bubble', 'm2', alumFoil.harga);
    }

    // CB.07.xx - Plafond
    else if (kode === 'CB.07.01') {
      // Rangka Plafond - copy from 3.5.3.1
      total = await copyFromRef(id, '3.5.3.1');
    }
    else if (kode === 'CB.07.02') {
      // Plafond Gypsum - copy from 3.5.2.1
      total = await copyFromRef(id, '3.5.2.1');
    }
    else if (kode === 'CB.07.03') {
      // List Plafond - copy from 3.5.2.6
      total = await copyFromRef(id, '3.5.2.6');
    }

    // CB.08.xx - Pekerjaan Lantai
    else if (kode === 'CB.08.01' || kode === 'CB.08.02') {
      // Urugan Pasir bawah lantai / Cor Lantai Kerja
      if (kode === 'CB.08.01') {
        total = await copyFromRef(id, '1.3.1.2');
      } else {
        total = await copyFromRef(id, '2.2.1.4.1');
      }
    }
    else if (kode === 'CB.08.03' || kode === 'CB.08.04') {
      // Keramik Lantai / KM/WC - copy from 3.9.7.4 (30x30)
      total = await copyFromRef(id, '3.9.7.4');
    }
    else if (kode === 'CB.08.05') {
      // Keramik Dinding KM/WC - copy from 3.10.1.4 (20x20)
      total = await copyFromRef(id, '3.10.1.4');
    }
    else if (kode === 'CB.08.06' || kode === 'CS.07.01') {
      // Floor Hardener
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const hardener = await ensureMaterial('Floor Hardener', 'kg', 15000);
      total += await insertCoeff(id, 'A', 'labor', mandor.id, 0.003, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.030, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', hardener.id, 5.0, 'Floor Hardener', 'kg', hardener.harga);
    }
    else if (kode === 'CB.08.07') {
      // Waterproofing KM/WC - copy from 3.4.3
      total = await copyFromRef(id, '3.4.3');
    }

    // CB.09.xx - Pintu & Jendela
    else if (kode === 'CB.09.01') {
      // Kusen Aluminium - copy from 3.11.3.1
      total = await copyFromRef(id, '3.11.3.1');
    }
    else if (kode === 'CB.09.02') {
      // Daun Pintu Panel - copy from 3.11.1.12
      total = await copyFromRef(id, '3.11.1.12');
    }
    else if (kode === 'CB.09.03') {
      // Daun Jendela Kaca - copy from 3.11.1.6
      total = await copyFromRef(id, '3.11.1.6');
    }
    else if (kode === 'CB.09.04') {
      // Pintu KM/WC PVC
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const tkKayu = await ensureLabor(L_TK_KAYU.name, L_TK_KAYU.satuan, L_TK_KAYU.harga);
      const pintuPVC = await ensureMaterial('Pintu PVC KM/WC', 'bh', 350000);
      const engsel = await ensureMaterial('Engsel Pintu', 'bh', 35000);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.200, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'A', 'labor', tkKayu.id, 0.200, L_TK_KAYU.name, L_TK_KAYU.satuan, tkKayu.harga);
      total += await insertCoeff(id, 'B', 'material', pintuPVC.id, 1.0, 'Pintu PVC KM/WC', 'bh', pintuPVC.harga);
      total += await insertCoeff(id, 'B', 'material', engsel.id, 3.0, 'Engsel Pintu', 'bh', engsel.harga);
    }
    else if (kode === 'CB.09.05') {
      // Hardware set
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const handle = await ensureMaterial('Handle Pintu', 'bh', 125000);
      const engsel = await ensureMaterial('Engsel Pintu', 'bh', 35000);
      const kunci = await ensureMaterial('Kunci Pintu (Cylinder Lock)', 'bh', 150000);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.300, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', handle.id, 1.0, 'Handle Pintu', 'bh', handle.harga);
      total += await insertCoeff(id, 'B', 'material', engsel.id, 3.0, 'Engsel Pintu', 'bh', engsel.harga);
      total += await insertCoeff(id, 'B', 'material', kunci.id, 1.0, 'Kunci Pintu (Cylinder Lock)', 'bh', kunci.harga);
    }
    else if (kode === 'CB.09.06') {
      // Rolling Door - copy from 3.11.1.1
      total = await copyFromRef(id, '3.11.1.1');
    }

    // CB.10.xx - Pengecatan
    else if (kode === 'CB.10.01' || kode === 'CB.10.03') {
      // Cat Dinding Dalam / Plafond - copy from 3.8.10.1
      total = await copyFromRef(id, '3.8.10.1');
    }
    else if (kode === 'CB.10.02' || kode === 'CB.10.04') {
      // Cat Dinding Luar / Lisplang - copy from 3.8.10.2
      total = await copyFromRef(id, '3.8.10.2');
    }
    else if (kode === 'CB.10.05') {
      // Cat Besi - copy from 3.8.16
      total = await copyFromRef(id, '3.8.16');
    }

    // CB.11.xx - Sanitasi & Plumbing
    else if (kode === 'CB.11.01' || kode === 'CB.11.02' || kode === 'CB.11.03') {
      // Pipa Air Bersih / Kotor / Vent - standard plumbing per m'
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const pipaDia = kode === 'CB.11.01' ? '3/4"' : kode === 'CB.11.02' ? '4"' : '2"';
      const pipaHarga = kode === 'CB.11.01' ? 12500 : kode === 'CB.11.02' ? 65000 : 28000;
      const pipaName = `Pipa PVC ${pipaDia}`;
      const pipa = await ensureMaterial(pipaName, 'm\'', pipaHarga);
      const fittings = await ensureMaterial('Fitting PVC (assorted)', 'bh', 15000);
      const lem = await ensureMaterial('Lem Pipa PVC', 'kaleng', 35000);
      total += await insertCoeff(id, 'A', 'labor', mandor.id, 0.005, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.100, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', pipa.id, 1.050, pipaName, 'm\'', pipa.harga);
      total += await insertCoeff(id, 'B', 'material', fittings.id, 0.500, 'Fitting PVC (assorted)', 'bh', fittings.harga);
      total += await insertCoeff(id, 'B', 'material', lem.id, 0.020, 'Lem Pipa PVC', 'kaleng', lem.harga);
    }
    else if (kode === 'CB.11.04') {
      // Closet - copy from 3.18.3.1
      total = await copyFromRef(id, '3.18.3.1');
    }
    else if (kode === 'CB.11.05') {
      // Wastafel - copy from 3.18.1.1
      total = await copyFromRef(id, '3.18.1.1');
    }
    else if (kode === 'CB.11.06') {
      // Floor Drain
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const floorDrain = await ensureMaterial('Floor Drain Stainless', 'bh', 45000);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.200, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', floorDrain.id, 1.0, 'Floor Drain Stainless', 'bh', floorDrain.harga);
    }
    else if (kode === 'CB.11.07') {
      // Kran Air
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const kran = await ensureMaterial('Kran Air Kuningan 1/2"', 'bh', 75000);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.150, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', kran.id, 1.0, 'Kran Air Kuningan 1/2"', 'bh', kran.harga);
    }
    else if (kode === 'CB.11.08') {
      // Septictank Bio
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const septic = await ensureMaterial('Septictank Bio 1500L', 'unit', 5500000);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 4.0, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', septic.id, 1.0, 'Septictank Bio 1500L', 'unit', septic.harga);
    }
    else if (kode === 'CB.11.09' || kode === 'CS.08.02') {
      // Bak Kontrol
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const tkBatu = await ensureLabor(L_TK_BATU.name, L_TK_BATU.satuan, L_TK_BATU.harga);
      const bata = await ensureMaterial('Bata Merah uk. 22x11x4.5cm', 'bh', 900);
      const semen = await ensureMaterial('PC/Portland Cement', 'Kg', 1583);
      const pasir = await ensureMaterial('Pasir Pasang', 'm3', 290000);
      total += await insertCoeff(id, 'A', 'labor', mandor.id, 0.050, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 1.000, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'A', 'labor', tkBatu.id, 0.500, L_TK_BATU.name, L_TK_BATU.satuan, tkBatu.harga);
      total += await insertCoeff(id, 'B', 'material', bata.id, 100.0, 'Bata Merah uk. 22x11x4.5cm', 'bh', bata.harga);
      total += await insertCoeff(id, 'B', 'material', semen.id, 20.0, 'PC/Portland Cement', 'Kg', semen.harga);
      total += await insertCoeff(id, 'B', 'material', pasir.id, 0.100, 'Pasir Pasang', 'm3', pasir.harga);
    }
    else if (kode === 'CB.11.10' || kode === 'CS.08.01') {
      // Saluran Drainase
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const uditch = await ensureMaterial('U-Ditch 30x30x120cm', 'bh', 185000);
      total += await insertCoeff(id, 'A', 'labor', mandor.id, 0.010, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.200, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', uditch.id, 0.850, 'U-Ditch 30x30x120cm', 'bh', uditch.harga);
    }

    // CB.12.xx - Pekerjaan Listrik
    else if (kode === 'CB.12.01') {
      // Panel Listrik MCB/MCCB
      const tkListrik = await ensureLabor(L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, L_TK_LISTRIK.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const panel = await ensureMaterial('Panel Box MCB 12 Way', 'unit', 1250000);
      const mcb = await ensureMaterial('MCB 1P 16A', 'bh', 85000);
      total += await insertCoeff(id, 'A', 'labor', tkListrik.id, 2.0, L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, tkListrik.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 1.0, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', panel.id, 1.0, 'Panel Box MCB 12 Way', 'unit', panel.harga);
      total += await insertCoeff(id, 'B', 'material', mcb.id, 6.0, 'MCB 1P 16A', 'bh', mcb.harga);
    }
    else if (kode === 'CB.12.02') {
      // Kabel NYM
      const tkListrik = await ensureLabor(L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, L_TK_LISTRIK.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const kabel = await ensureMaterial('Kabel NYM 3x2.5mm', 'm\'', 18500);
      total += await insertCoeff(id, 'A', 'labor', tkListrik.id, 0.020, L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, tkListrik.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.020, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', kabel.id, 1.050, 'Kabel NYM 3x2.5mm', 'm\'', kabel.harga);
    }
    else if (kode === 'CB.12.03') {
      // Conduit PVC
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const conduit = await ensureMaterial('Conduit PVC 20mm', 'm\'', 8500);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.030, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', conduit.id, 1.050, 'Conduit PVC 20mm', 'm\'', conduit.harga);
    }
    else if (kode === 'CB.12.04') {
      // Titik Lampu
      const tkListrik = await ensureLabor(L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, L_TK_LISTRIK.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const kabel = await ensureMaterial('Kabel NYM 3x2.5mm', 'm\'', 18500);
      const conduit = await ensureMaterial('Conduit PVC 20mm', 'm\'', 8500);
      const fitting = await ensureMaterial('Fitting Lampu', 'bh', 15000);
      const tdos = await ensureMaterial('T-Dos / Junction Box', 'bh', 5000);
      total += await insertCoeff(id, 'A', 'labor', tkListrik.id, 0.350, L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, tkListrik.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.350, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', kabel.id, 10.0, 'Kabel NYM 3x2.5mm', 'm\'', kabel.harga);
      total += await insertCoeff(id, 'B', 'material', conduit.id, 10.0, 'Conduit PVC 20mm', 'm\'', conduit.harga);
      total += await insertCoeff(id, 'B', 'material', fitting.id, 1.0, 'Fitting Lampu', 'bh', fitting.harga);
      total += await insertCoeff(id, 'B', 'material', tdos.id, 2.0, 'T-Dos / Junction Box', 'bh', tdos.harga);
    }
    else if (kode === 'CB.12.05') {
      // Stop Kontak
      const tkListrik = await ensureLabor(L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, L_TK_LISTRIK.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const kabel = await ensureMaterial('Kabel NYM 3x2.5mm', 'm\'', 18500);
      const stopKontak = await ensureMaterial('Stop Kontak IB', 'bh', 35000);
      total += await insertCoeff(id, 'A', 'labor', tkListrik.id, 0.300, L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, tkListrik.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.300, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', kabel.id, 12.0, 'Kabel NYM 3x2.5mm', 'm\'', kabel.harga);
      total += await insertCoeff(id, 'B', 'material', stopKontak.id, 1.0, 'Stop Kontak IB', 'bh', stopKontak.harga);
    }
    else if (kode === 'CB.12.06') {
      // Saklar
      const tkListrik = await ensureLabor(L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, L_TK_LISTRIK.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const kabel = await ensureMaterial('Kabel NYM 3x2.5mm', 'm\'', 18500);
      const saklar = await ensureMaterial('Saklar Tunggal IB', 'bh', 25000);
      total += await insertCoeff(id, 'A', 'labor', tkListrik.id, 0.250, L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, tkListrik.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.250, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', kabel.id, 8.0, 'Kabel NYM 3x2.5mm', 'm\'', kabel.harga);
      total += await insertCoeff(id, 'B', 'material', saklar.id, 1.0, 'Saklar Tunggal IB', 'bh', saklar.harga);
    }
    else if (kode === 'CB.12.07') {
      // Lampu LED
      const tkListrik = await ensureLabor(L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, L_TK_LISTRIK.harga);
      const lampu = await ensureMaterial('Lampu LED Downlight 12W', 'bh', 85000);
      total += await insertCoeff(id, 'A', 'labor', tkListrik.id, 0.200, L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, tkListrik.harga);
      total += await insertCoeff(id, 'B', 'material', lampu.id, 1.0, 'Lampu LED Downlight 12W', 'bh', lampu.harga);
    }
    else if (kode === 'CB.12.08') {
      // Grounding System
      const tkListrik = await ensureLabor(L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, L_TK_LISTRIK.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const rod = await ensureMaterial('Grounding Rod Copper 5/8" x 2.4m', 'bh', 350000);
      const kabelBC = await ensureMaterial('Kabel BC 50mm2', 'm\'', 125000);
      total += await insertCoeff(id, 'A', 'labor', tkListrik.id, 4.0, L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, tkListrik.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 4.0, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', rod.id, 4.0, 'Grounding Rod Copper 5/8" x 2.4m', 'bh', rod.harga);
      total += await insertCoeff(id, 'B', 'material', kabelBC.id, 20.0, 'Kabel BC 50mm2', 'm\'', kabelBC.harga);
    }
    else if (kode === 'CB.12.09') {
      // Penangkal Petir
      const tkListrik = await ensureLabor(L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, L_TK_LISTRIK.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const petir = await ensureMaterial('Penangkal Petir Konvensional (set)', 'set', 3500000);
      const kabelBC = await ensureMaterial('Kabel BC 50mm2', 'm\'', 125000);
      total += await insertCoeff(id, 'A', 'labor', tkListrik.id, 4.0, L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, tkListrik.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 4.0, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', petir.id, 1.0, 'Penangkal Petir Konvensional (set)', 'set', petir.harga);
      total += await insertCoeff(id, 'B', 'material', kabelBC.id, 30.0, 'Kabel BC 50mm2', 'm\'', kabelBC.harga);
    }

    // CB.13.xx - Lain-lain & Finishing
    else if (kode === 'CB.13.01') {
      // Taman & Landscape
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const rumput = await ensureMaterial('Rumput Gajah Mini', 'm2', 25000);
      const tanah = await ensureMaterial('Tanah Subur (Top Soil)', 'm3', 150000);
      total += await insertCoeff(id, 'A', 'labor', mandor.id, 0.010, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.100, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', rumput.id, 1.050, 'Rumput Gajah Mini', 'm2', rumput.harga);
      total += await insertCoeff(id, 'B', 'material', tanah.id, 0.050, 'Tanah Subur (Top Soil)', 'm3', tanah.harga);
    }
    else if (kode === 'CB.13.02' || kode === 'CS.09.01') {
      // Paving Block
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const paving = await ensureMaterial('Paving Block K-300 Tebal 8cm', 'm2', 95000);
      const pasir = await ensureMaterial('Pasir Pasang', 'm3', 290000);
      total += await insertCoeff(id, 'A', 'labor', mandor.id, 0.005, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.100, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', paving.id, 1.050, 'Paving Block K-300 Tebal 8cm', 'm2', paving.harga);
      total += await insertCoeff(id, 'B', 'material', pasir.id, 0.040, 'Pasir Pasang', 'm3', pasir.harga);
    }
    else if (kode === 'CB.13.03' || kode === 'CS.09.02') {
      // Pagar & Pintu Gerbang
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const tkLas = await ensureLabor(L_TK_LAS.name, L_TK_LAS.satuan, L_TK_LAS.harga);
      const besi = await ensureMaterial('Pipa Besi Galvanis 2"', 'm\'', 95000);
      const brc = await ensureMaterial('BRC Mesh / Pagar Panel', 'm2', 165000);
      total += await insertCoeff(id, 'A', 'labor', mandor.id, 0.020, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.200, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'A', 'labor', tkLas.id, 0.150, L_TK_LAS.name, L_TK_LAS.satuan, tkLas.harga);
      total += await insertCoeff(id, 'B', 'material', besi.id, 2.500, 'Pipa Besi Galvanis 2"', 'm\'', besi.harga);
      total += await insertCoeff(id, 'B', 'material', brc.id, 1.800, 'BRC Mesh / Pagar Panel', 'm2', brc.harga);
    }
    else if (kode === 'CB.13.04') {
      // Saluran Keliling
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const uditch = await ensureMaterial('U-Ditch 30x30x120cm', 'bh', 185000);
      total += await insertCoeff(id, 'A', 'labor', mandor.id, 0.010, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.200, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', uditch.id, 0.850, 'U-Ditch 30x30x120cm', 'bh', uditch.harga);
    }
    else if (kode === 'CB.13.05') {
      // Railing Tangga
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const tkLas = await ensureLabor(L_TK_LAS.name, L_TK_LAS.satuan, L_TK_LAS.harga);
      const pipa = await ensureMaterial('Pipa Stainless Steel 1.5"', 'm\'', 185000);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.200, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'A', 'labor', tkLas.id, 0.300, L_TK_LAS.name, L_TK_LAS.satuan, tkLas.harga);
      total += await insertCoeff(id, 'B', 'material', pipa.id, 3.000, 'Pipa Stainless Steel 1.5"', 'm\'', pipa.harga);
    }
    else if (kode === 'CB.13.06') {
      // Bak Sampah / Pos Jaga
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const tkBatu = await ensureLabor(L_TK_BATU.name, L_TK_BATU.satuan, L_TK_BATU.harga);
      const bata = await ensureMaterial('Bata Merah uk. 22x11x4.5cm', 'bh', 900);
      const semen = await ensureMaterial('PC/Portland Cement', 'Kg', 1583);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 2.0, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'A', 'labor', tkBatu.id, 1.0, L_TK_BATU.name, L_TK_BATU.satuan, tkBatu.harga);
      total += await insertCoeff(id, 'B', 'material', bata.id, 200.0, 'Bata Merah uk. 22x11x4.5cm', 'bh', bata.harga);
      total += await insertCoeff(id, 'B', 'material', semen.id, 50.0, 'PC/Portland Cement', 'Kg', semen.harga);
    }
    else if (kode === 'CB.13.07' || kode === 'CS.09.03') {
      // Final Cleaning
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      total += await insertCoeff(id, 'A', 'labor', mandor.id, 0.005, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.050, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
    }

    // ===================== CS (Civil Struktur) =====================
    // CS.05.xx - Pekerjaan Baja
    else if (kode.match(/CS\.05\.(01|02|03)/)) {
      // Fabrikasi Baja (per kg)
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const tkLas = await ensureLabor(L_TK_LAS.name, L_TK_LAS.satuan, L_TK_LAS.harga);
      const baja = await ensureMaterial('Baja Profil WF/H-Beam', 'kg', 15500);
      const kawatLas = await ensureMaterial('Kawat Las / Elektroda E7018', 'kg', 32000);
      total += await insertCoeff(id, 'A', 'labor', mandor.id, 0.0003, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.0030, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'A', 'labor', tkLas.id, 0.0050, L_TK_LAS.name, L_TK_LAS.satuan, tkLas.harga);
      total += await insertCoeff(id, 'B', 'material', baja.id, 1.050, 'Baja Profil WF/H-Beam', 'kg', baja.harga);
      total += await insertCoeff(id, 'B', 'material', kawatLas.id, 0.020, 'Kawat Las / Elektroda E7018', 'kg', kawatLas.harga);
    }
    else if (kode.match(/CS\.05\.(04|05|06)/)) {
      // Erection Baja (per kg)
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const tkEreksi = await ensureLabor('Tukang Ereksi', 'OH', 111055);
      const crane = await ensureEquipment('Crane', 'Jam', 593750);
      total += await insertCoeff(id, 'A', 'labor', mandor.id, 0.0003, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.0040, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'A', 'labor', tkEreksi.id, 0.0040, 'Tukang Ereksi', 'OH', tkEreksi.harga);
      total += await insertCoeff(id, 'C', 'equipment', crane.id, 0.0010, 'Crane', 'Jam', crane.harga);
    }
    else if (kode === 'CS.05.07') {
      // Baut High Strength
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const baut = await ensureMaterial('Baut HTB A325 3/4"', 'set', 15000);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.100, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', baut.id, 1.050, 'Baut HTB A325 3/4"', 'set', baut.harga);
    }
    else if (kode === 'CS.05.08') {
      // Pengelasan (per cm)
      const tkLas = await ensureLabor(L_TK_LAS.name, L_TK_LAS.satuan, L_TK_LAS.harga);
      const kawatLas = await ensureMaterial('Kawat Las / Elektroda E7018', 'kg', 32000);
      total += await insertCoeff(id, 'A', 'labor', tkLas.id, 0.020, L_TK_LAS.name, L_TK_LAS.satuan, tkLas.harga);
      total += await insertCoeff(id, 'B', 'material', kawatLas.id, 0.010, 'Kawat Las / Elektroda E7018', 'kg', kawatLas.harga);
    }
    else if (kode === 'CS.05.09' || kode === 'ME.07.02') {
      // Pengecatan Baja - copy from 3.8.16
      total = await copyFromRef(id, '3.8.16');
    }

    // CS.06.xx - Cladding
    else if (kode === 'CS.06.02') {
      // Dinding Cladding
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const tkKayu = await ensureLabor(L_TK_KAYU.name, L_TK_KAYU.satuan, L_TK_KAYU.harga);
      const cladding = await ensureMaterial('Metal Cladding / Dinding Zincalume 0.40mm', 'm2', 110000);
      const sekrup = await ensureMaterial('Sekrup Roofing 12-14x25', 'bh', 1500);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.050, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'A', 'labor', tkKayu.id, 0.030, L_TK_KAYU.name, L_TK_KAYU.satuan, tkKayu.harga);
      total += await insertCoeff(id, 'B', 'material', cladding.id, 1.100, 'Metal Cladding', 'm2', cladding.harga);
      total += await insertCoeff(id, 'B', 'material', sekrup.id, 8.0, 'Sekrup Roofing 12-14x25', 'bh', sekrup.harga);
    }
    else if (kode === 'CS.06.05') {
      // Skylight / Ventilator
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const skylight = await ensureMaterial('Skylight Polycarbonate 6mm', 'lbr', 350000);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.500, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', skylight.id, 1.0, 'Skylight Polycarbonate 6mm', 'lbr', skylight.harga);
    }

    // CS.07.xx - Finishing Lantai
    else if (kode === 'CS.07.02') {
      // Epoxy Floor Coating
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const epoxy = await ensureMaterial('Epoxy Floor Coating', 'kg', 125000);
      total += await insertCoeff(id, 'A', 'labor', mandor.id, 0.003, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.050, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', epoxy.id, 0.500, 'Epoxy Floor Coating', 'kg', epoxy.harga);
    }
    else if (kode === 'CS.07.03') {
      // Joint Sealant / Cutting
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const sealant = await ensureMaterial('Sealant Polyurethane', 'tube', 85000);
      const cutter = await ensureEquipment('Concrete Cutter', 'Jam', 150000);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.050, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', sealant.id, 0.100, 'Sealant Polyurethane', 'tube', sealant.harga);
      total += await insertCoeff(id, 'C', 'equipment', cutter.id, 0.050, 'Concrete Cutter', 'Jam', cutter.harga);
    }

    // CS.08.xx - Drainase
    else if (kode === 'CS.08.03') {
      // Gorong-gorong
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const gorong = await ensureMaterial('Pipa Beton Bertulang D600', 'm\'', 450000);
      total += await insertCoeff(id, 'A', 'labor', mandor.id, 0.020, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.300, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', gorong.id, 1.050, 'Pipa Beton Bertulang D600', 'm\'', gorong.harga);
    }
    else if (kode === 'CS.08.04') {
      // Grating
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const grating = await ensureMaterial('Steel Grating 32x5mm', 'm2', 850000);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.200, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', grating.id, 1.050, 'Steel Grating 32x5mm', 'm2', grating.harga);
    }

    // ===================== PP (Piping) =====================
    else if (kode === 'PP.01.02' || kode === 'EL.01.02' || kode === 'ME.01.02') {
      // Survey - lump sum
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const ahli = await ensureLabor('Tenaga Ahli Pratama', 'OH', 210000);
      total += await insertCoeff(id, 'A', 'labor', mandor.id, 2.0, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 4.0, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'A', 'labor', ahli.id, 2.0, 'Tenaga Ahli Pratama', 'OH', ahli.harga);
    }
    else if (kode === 'PP.01.03' || kode === 'EL.01.03' || kode === 'ME.01.03') {
      // Shop Drawing - lump sum
      const ahli = await ensureLabor('Tenaga Ahli Pratama', 'OH', 210000);
      const drafter = await ensureMaterial('Biaya Drafting/Printing', 'ls', 500000);
      total += await insertCoeff(id, 'A', 'labor', ahli.id, 5.0, 'Tenaga Ahli Pratama', 'OH', ahli.harga);
      total += await insertCoeff(id, 'B', 'material', drafter.id, 1.0, 'Biaya Drafting/Printing', 'ls', drafter.harga);
    }

    // PP.02.xx - Material Pipa
    else if (kode.match(/PP\.02\.(01|02|03|04)/)) {
      // Pipa berbagai jenis (per m')
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      let pipaNama, pipaHarga;
      if (kode === 'PP.02.01') { pipaNama = 'Pipa Carbon Steel SCH40 4"'; pipaHarga = 450000; }
      else if (kode === 'PP.02.02') { pipaNama = 'Pipa Stainless Steel 304 4"'; pipaHarga = 1250000; }
      else if (kode === 'PP.02.03') { pipaNama = 'Pipa HDPE PE100 4"'; pipaHarga = 125000; }
      else { pipaNama = 'Pipa Galvanized 4"'; pipaHarga = 350000; }
      const pipa = await ensureMaterial(pipaNama, 'm\'', pipaHarga);
      total += await insertCoeff(id, 'A', 'labor', mandor.id, 0.010, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.100, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', pipa.id, 1.050, pipaNama, 'm\'', pipa.harga);
    }

    // PP.03.xx - Fittings
    else if (kode.match(/PP\.03\.(01|02|03|04|05)/)) {
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      let fittingNama, fittingHarga;
      if (kode === 'PP.03.01') { fittingNama = 'Elbow 90° CS 4" SCH40'; fittingHarga = 185000; }
      else if (kode === 'PP.03.02') { fittingNama = 'Tee CS 4" SCH40'; fittingHarga = 275000; }
      else if (kode === 'PP.03.03') { fittingNama = 'Flange WN 4" 150# CS'; fittingHarga = 450000; }
      else if (kode === 'PP.03.04') { fittingNama = 'Gasket Spiral Wound 4" 150#'; fittingHarga = 125000; }
      else { fittingNama = 'Coupling CS 4"'; fittingHarga = 95000; }
      const fitting = await ensureMaterial(fittingNama, 'bh', fittingHarga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.200, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', fitting.id, 1.0, fittingNama, 'bh', fitting.harga);
    }

    // PP.04.xx - Valve
    else if (kode.match(/PP\.04\.(01|02|03|04|05)/)) {
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      let valveNama, valveHarga;
      if (kode === 'PP.04.01') { valveNama = 'Gate Valve 4" 150# CS'; valveHarga = 2500000; }
      else if (kode === 'PP.04.02') { valveNama = 'Ball Valve 4" 150# CS'; valveHarga = 3500000; }
      else if (kode === 'PP.04.03') { valveNama = 'Check Valve 4" 150# CS'; valveHarga = 2800000; }
      else if (kode === 'PP.04.04') { valveNama = 'Butterfly Valve 4" CS'; valveHarga = 1800000; }
      else { valveNama = 'Globe Valve 4" 150# CS'; valveHarga = 4500000; }
      const valve = await ensureMaterial(valveNama, 'bh', valveHarga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.500, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', valve.id, 1.0, valveNama, 'bh', valve.harga);
    }

    // PP.05.xx - Support
    else if (kode.match(/PP\.05\.(01|02|03|04|05)/)) {
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const tkLas = await ensureLabor(L_TK_LAS.name, L_TK_LAS.satuan, L_TK_LAS.harga);
      let supportNama, supportHarga;
      if (kode === 'PP.05.01') { supportNama = 'Pipe Shoe CS'; supportHarga = 250000; }
      else if (kode === 'PP.05.02') { supportNama = 'U-Bolt Galvanized 4"'; supportHarga = 35000; }
      else if (kode === 'PP.05.03') { supportNama = 'Hanger Rod Assembly'; supportHarga = 350000; }
      else if (kode === 'PP.05.04') { supportNama = 'Guide & Anchor Support'; supportHarga = 450000; }
      else { supportNama = 'Spring Hanger'; supportHarga = 3500000; }
      const support = await ensureMaterial(supportNama, kode === 'PP.05.05' ? 'bh' : (kode === 'PP.05.03' ? 'set' : 'bh'), supportHarga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.200, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'A', 'labor', tkLas.id, 0.150, L_TK_LAS.name, L_TK_LAS.satuan, tkLas.harga);
      total += await insertCoeff(id, 'B', 'material', support.id, 1.0, supportNama, support.satuan || 'bh', support.harga);
    }

    // PP.06.xx - Fabrikasi
    else if (kode.match(/PP\.06\.(01|02|03|04)/)) {
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const tkLas = await ensureLabor(L_TK_LAS.name, L_TK_LAS.satuan, L_TK_LAS.harga);
      const kawatLas = await ensureMaterial('Kawat Las / Elektroda E7018', 'kg', 32000);
      const grindDisc = await ensureMaterial('Grinding Disc 4"', 'bh', 15000);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, kode === 'PP.06.04' ? 0.050 : 0.300, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'A', 'labor', tkLas.id, kode === 'PP.06.04' ? 0.100 : 0.500, L_TK_LAS.name, L_TK_LAS.satuan, tkLas.harga);
      total += await insertCoeff(id, 'B', 'material', kawatLas.id, kode === 'PP.06.04' ? 0.150 : 0.500, 'Kawat Las / Elektroda E7018', 'kg', kawatLas.harga);
      total += await insertCoeff(id, 'B', 'material', grindDisc.id, kode === 'PP.06.04' ? 0.200 : 0.500, 'Grinding Disc 4"', 'bh', grindDisc.harga);
    }

    // PP.07.xx - Instalasi / Ereksi
    else if (kode.match(/PP\.07\.(01|02|03|04|05)/)) {
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const tkLas = await ensureLabor(L_TK_LAS.name, L_TK_LAS.satuan, L_TK_LAS.harga);
      const crane = await ensureEquipment('Crane', 'Jam', 593750);
      total += await insertCoeff(id, 'A', 'labor', mandor.id, kode === 'PP.07.02' ? 0.010 : 0.005, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, kode === 'PP.07.04' || kode === 'PP.07.05' ? 0.200 : 0.100, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      if (kode !== 'PP.07.04' && kode !== 'PP.07.05') {
        total += await insertCoeff(id, 'A', 'labor', tkLas.id, 0.050, L_TK_LAS.name, L_TK_LAS.satuan, tkLas.harga);
      }
      if (kode === 'PP.07.01') {
        total += await insertCoeff(id, 'C', 'equipment', crane.id, 0.020, 'Crane', 'Jam', crane.harga);
      }
    }

    // PP.08.xx - Welding & NDT
    else if (kode.match(/PP\.08\.(01|02|03)/)) {
      const tkLas = await ensureLabor(L_TK_LAS.name, L_TK_LAS.satuan, L_TK_LAS.harga);
      const kawatLas = await ensureMaterial('Kawat Las / Elektroda E7018', 'kg', 32000);
      const grindDisc = await ensureMaterial('Grinding Disc 4"', 'bh', 15000);
      const koef = kode === 'PP.08.01' ? 0.100 : 0.300;
      total += await insertCoeff(id, 'A', 'labor', tkLas.id, koef, L_TK_LAS.name, L_TK_LAS.satuan, tkLas.harga);
      total += await insertCoeff(id, 'B', 'material', kawatLas.id, koef * 2, 'Kawat Las / Elektroda E7018', 'kg', kawatLas.harga);
      total += await insertCoeff(id, 'B', 'material', grindDisc.id, 0.200, 'Grinding Disc 4"', 'bh', grindDisc.harga);
    }
    else if (kode === 'PP.08.04') {
      // NDT RT
      const ndt = await ensureMaterial('Biaya NDT Radiography (per film)', 'film', 350000);
      total += await insertCoeff(id, 'B', 'material', ndt.id, 1.0, 'Biaya NDT Radiography', 'film', ndt.harga);
    }
    else if (kode === 'PP.08.05') {
      // NDT PT
      const ndt = await ensureMaterial('Biaya NDT Dye Penetrant (per joint)', 'joint', 150000);
      total += await insertCoeff(id, 'B', 'material', ndt.id, 1.0, 'Biaya NDT Dye Penetrant', 'joint', ndt.harga);
    }

    // PP.09.xx - Testing
    else if (kode.match(/PP\.09\.(01|02|03|04)/)) {
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const pump = await ensureEquipment('Hydrostatic Test Pump', 'Jam', 150000);
      total += await insertCoeff(id, 'A', 'labor', mandor.id, 1.0, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 4.0, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'C', 'equipment', pump.id, 4.0, 'Hydrostatic Test Pump', 'Jam', pump.harga);
    }

    // PP.10.xx - Coating & Insulation
    else if (kode.match(/PP\.10\.(01|02|03)/) || kode === 'ME.07.01') {
      // Sandblasting / Painting
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const tkCat = await ensureLabor(L_TK_CAT.name, L_TK_CAT.satuan, L_TK_CAT.harga);
      if (kode === 'PP.10.01' || kode === 'ME.07.01') {
        const sandblast = await ensureEquipment('Sandblasting Machine', 'Jam', 250000);
        const abrasive = await ensureMaterial('Garnet Abrasive', 'kg', 8500);
        total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.100, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
        total += await insertCoeff(id, 'B', 'material', abrasive.id, 5.0, 'Garnet Abrasive', 'kg', abrasive.harga);
        total += await insertCoeff(id, 'C', 'equipment', sandblast.id, 0.100, 'Sandblasting Machine', 'Jam', sandblast.harga);
      } else {
        const cat = await ensureMaterial(kode === 'PP.10.02' ? 'Cat Primer Epoxy' : 'Cat Top Coat Polyurethane', 'kg', kode === 'PP.10.02' ? 95000 : 125000);
        total += await insertCoeff(id, 'A', 'labor', mandor.id, 0.003, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
        total += await insertCoeff(id, 'A', 'labor', tkCat.id, 0.050, L_TK_CAT.name, L_TK_CAT.satuan, tkCat.harga);
        total += await insertCoeff(id, 'B', 'material', cat.id, 0.300, cat.name || 'Cat', 'kg', cat.harga);
      }
    }
    else if (kode === 'PP.10.04' || kode === 'ME.07.03') {
      // Insulation Pipa
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const insulation = await ensureMaterial('Rockwool Pipe Insulation 2"', 'm\'', 95000);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.100, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', insulation.id, 1.050, 'Rockwool Pipe Insulation', 'm\'', insulation.harga);
    }
    else if (kode === 'PP.10.05') {
      // Aluminium Cladding
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const alumClad = await ensureMaterial('Aluminium Cladding 0.5mm', 'm\'', 75000);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.080, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', alumClad.id, 1.100, 'Aluminium Cladding 0.5mm', 'm\'', alumClad.harga);
    }
    else if (kode === 'PP.10.06') {
      // Color Coding
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const catLabel = await ensureMaterial('Cat Marking Pipa', 'kg', 85000);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.020, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', catLabel.id, 0.050, 'Cat Marking Pipa', 'kg', catLabel.harga);
    }

    // PP.11.xx - Civil Support
    else if (kode.match(/PP\.11\.(01|02|03)/)) {
      // Pondasi Pipe Support / Pedestal / Sleeper
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const tkBatu = await ensureLabor(L_TK_BATU.name, L_TK_BATU.satuan, L_TK_BATU.harga);
      const semen = await ensureMaterial('PC/Portland Cement', 'Kg', 1583);
      const pasir = await ensureMaterial('Pasir Beton', 'Kg', 250);
      const split = await ensureMaterial('Agregat', 'm3', 280000);
      const besi = await ensureMaterial('Besi Beton Polos/Ulir', 'kg', 13500);
      total += await insertCoeff(id, 'A', 'labor', mandor.id, 0.100, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 1.000, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'A', 'labor', tkBatu.id, 0.500, L_TK_BATU.name, L_TK_BATU.satuan, tkBatu.harga);
      total += await insertCoeff(id, 'B', 'material', semen.id, 50.0, 'PC/Portland Cement', 'Kg', semen.harga);
      total += await insertCoeff(id, 'B', 'material', pasir.id, 150.0, 'Pasir Beton', 'Kg', pasir.harga);
      total += await insertCoeff(id, 'B', 'material', split.id, 0.100, 'Agregat', 'm3', split.harga);
      total += await insertCoeff(id, 'B', 'material', besi.id, 15.0, 'Besi Beton Polos/Ulir', 'kg', besi.harga);
    }
    else if (kode === 'PP.11.04') {
      // Galian & Urugan Pipa Underground
      total = await copyFromRef(id, '1.2.1.1.1');
    }

    // ===================== EL (Electrical) =====================
    // EL.02.xx - Panel
    else if (kode.match(/EL\.02\.(01|02|03|04|05|06)/)) {
      const tkListrik = await ensureLabor(L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, L_TK_LISTRIK.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      let panelNama, panelHarga;
      if (kode === 'EL.02.01') { panelNama = 'Panel MDP (Main Distribution Panel)'; panelHarga = 35000000; }
      else if (kode === 'EL.02.02') { panelNama = 'Panel SDP (Sub Distribution Panel)'; panelHarga = 15000000; }
      else if (kode === 'EL.02.03') { panelNama = 'Panel Capacitor Bank'; panelHarga = 25000000; }
      else if (kode === 'EL.02.04') { panelNama = 'Panel ATS/AMF'; panelHarga = 20000000; }
      else if (kode === 'EL.02.05') { panelNama = 'Panel MCC (Motor Control Center)'; panelHarga = 45000000; }
      else { panelNama = 'Biaya Pemasangan & Wiring Panel'; panelHarga = 5000000; }
      const panel = await ensureMaterial(panelNama, 'unit', panelHarga);
      total += await insertCoeff(id, 'A', 'labor', tkListrik.id, kode === 'EL.02.06' ? 4.0 : 2.0, L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, tkListrik.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, kode === 'EL.02.06' ? 4.0 : 2.0, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', panel.id, 1.0, panelNama, 'unit', panel.harga);
    }

    // EL.03.xx - Kabel
    else if (kode.match(/EL\.03\.(01|02|03|04|05|06)/)) {
      const tkListrik = await ensureLabor(L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, L_TK_LISTRIK.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      let kabelNama, kabelHarga;
      if (kode === 'EL.03.01') { kabelNama = 'Kabel NYY 4x16mm2'; kabelHarga = 125000; }
      else if (kode === 'EL.03.02') { kabelNama = 'Kabel XLPE 4x95mm2'; kabelHarga = 650000; }
      else if (kode === 'EL.03.03') { kabelNama = 'Kabel NYY 4x4mm2'; kabelHarga = 45000; }
      else if (kode === 'EL.03.04') { kabelNama = 'Biaya Laying Kabel'; kabelHarga = 25000; }
      else if (kode === 'EL.03.05') { kabelNama = 'Terminasi Kabel Set'; kabelHarga = 500000; }
      else { kabelNama = 'Cable Gland'; kabelHarga = 85000; }
      const kabel = await ensureMaterial(kabelNama, kode === 'EL.03.05' ? 'set' : (kode === 'EL.03.06' ? 'bh' : 'm\''), kabelHarga);
      total += await insertCoeff(id, 'A', 'labor', tkListrik.id, kode === 'EL.03.05' ? 0.500 : 0.030, L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, tkListrik.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, kode === 'EL.03.05' ? 0.500 : 0.030, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', kabel.id, 1.050, kabelNama, kabel.satuan || 'm\'', kabel.harga);
    }

    // EL.04.xx - Cable Tray
    else if (kode.match(/EL\.04\.(01|02|03|04|05)/)) {
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const tkListrik = await ensureLabor(L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, L_TK_LISTRIK.harga);
      let trayNama, trayHarga;
      if (kode === 'EL.04.01') { trayNama = 'Cable Tray Ladder 300mm'; trayHarga = 250000; }
      else if (kode === 'EL.04.02') { trayNama = 'Cable Tray Perforated 300mm'; trayHarga = 185000; }
      else if (kode === 'EL.04.03') { trayNama = 'Conduit Rigid 1"'; trayHarga = 35000; }
      else if (kode === 'EL.04.04') { trayNama = 'Bracket Cable Tray'; trayHarga = 75000; }
      else { trayNama = 'Fitting Cable Tray (assorted)'; trayHarga = 45000; }
      const tray = await ensureMaterial(trayNama, kode === 'EL.04.04' || kode === 'EL.04.05' ? 'bh' : 'm\'', trayHarga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.050, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'A', 'labor', tkListrik.id, 0.050, L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, tkListrik.harga);
      total += await insertCoeff(id, 'B', 'material', tray.id, 1.050, trayNama, tray.satuan || 'm\'', tray.harga);
    }

    // EL.05.xx - Lighting & Power
    else if (kode.match(/EL\.05\.(01|02|03|04|05|06)/)) {
      const tkListrik = await ensureLabor(L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, L_TK_LISTRIK.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      let itemNama, itemHarga;
      if (kode === 'EL.05.01') { itemNama = 'Lampu LED Industrial 36W'; itemHarga = 350000; }
      else if (kode === 'EL.05.02') { itemNama = 'Lampu Emergency LED'; itemHarga = 250000; }
      else if (kode === 'EL.05.03') { itemNama = 'Lampu Explosion Proof'; itemHarga = 3500000; }
      else if (kode === 'EL.05.04') { itemNama = 'Stop Kontak Industrial 3P+N+E 32A'; itemHarga = 450000; }
      else if (kode === 'EL.05.05') { itemNama = 'Switch / Saklar Industrial'; itemHarga = 85000; }
      else { itemNama = 'Junction Box IP65'; itemHarga = 125000; }
      const item = await ensureMaterial(itemNama, 'bh', itemHarga);
      total += await insertCoeff(id, 'A', 'labor', tkListrik.id, 0.300, L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, tkListrik.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.200, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', item.id, 1.0, itemNama, 'bh', item.harga);
    }

    // EL.06.xx - Grounding & Lightning
    else if (kode.match(/EL\.06\.(01|02|03|04|05|06)/)) {
      const tkListrik = await ensureLabor(L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, L_TK_LISTRIK.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      let itemNama, itemHarga, itemSatuan;
      if (kode === 'EL.06.01') { itemNama = 'Grounding Rod Copper 5/8" x 2.4m'; itemHarga = 350000; itemSatuan = 'bh'; }
      else if (kode === 'EL.06.02') { itemNama = 'Kabel BC 50mm2'; itemHarga = 125000; itemSatuan = 'm\''; }
      else if (kode === 'EL.06.03') { itemNama = 'Grounding Bus Bar Copper'; itemHarga = 750000; itemSatuan = 'bh'; }
      else if (kode === 'EL.06.04') { itemNama = 'Penangkal Petir ESE (set)'; itemHarga = 15000000; itemSatuan = 'set'; }
      else if (kode === 'EL.06.05') { itemNama = 'Down Conductor Cable'; itemHarga = 95000; itemSatuan = 'm\''; }
      else { itemNama = 'Biaya Testing Grounding'; itemHarga = 500000; itemSatuan = 'titik'; }
      const item = await ensureMaterial(itemNama, itemSatuan, itemHarga);
      total += await insertCoeff(id, 'A', 'labor', tkListrik.id, kode === 'EL.06.06' ? 1.0 : 0.300, L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, tkListrik.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, kode === 'EL.06.06' ? 1.0 : 0.300, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', item.id, 1.0, itemNama, itemSatuan, item.harga);
    }

    // EL.07.xx - Instrumen
    else if (kode.match(/EL\.07\.(01|02|03|04|05)/)) {
      const tkListrik = await ensureLabor(L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, L_TK_LISTRIK.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      let itemNama, itemHarga, itemSatuan;
      if (kode === 'EL.07.01') { itemNama = 'Kabel Instrumen Shielded 2x1.5mm2'; itemHarga = 35000; itemSatuan = 'm\''; }
      else if (kode === 'EL.07.02') { itemNama = 'Instrument Cable Tray 100mm'; itemHarga = 125000; itemSatuan = 'm\''; }
      else if (kode === 'EL.07.03') { itemNama = 'Junction Box Instrumen IP65'; itemHarga = 350000; itemSatuan = 'bh'; }
      else if (kode === 'EL.07.04') { itemNama = 'Instrument (Sensor/Transmitter)'; itemHarga = 5000000; itemSatuan = 'bh'; }
      else { itemNama = 'Biaya Calibration Instrument'; itemHarga = 750000; itemSatuan = 'bh'; }
      const item = await ensureMaterial(itemNama, itemSatuan, itemHarga);
      total += await insertCoeff(id, 'A', 'labor', tkListrik.id, kode === 'EL.07.04' ? 1.0 : 0.050, L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, tkListrik.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, kode === 'EL.07.04' ? 1.0 : 0.050, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', item.id, 1.050, itemNama, itemSatuan, item.harga);
    }

    // EL.08.xx - Testing & Commissioning
    else if (kode.match(/EL\.08\.(01|02|03|04|05|06)/)) {
      const tkListrik = await ensureLabor(L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, L_TK_LISTRIK.harga);
      const ahli = await ensureLabor('Tenaga Ahli Pratama', 'OH', 210000);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const koefLabor = kode === 'EL.08.06' ? 5.0 : 0.500;
      total += await insertCoeff(id, 'A', 'labor', tkListrik.id, koefLabor, L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, tkListrik.harga);
      total += await insertCoeff(id, 'A', 'labor', ahli.id, koefLabor * 0.5, 'Tenaga Ahli Pratama', 'OH', ahli.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, koefLabor, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      if (kode.match(/EL\.08\.(01|02|03)/)) {
        const megger = await ensureEquipment('Megger / Insulation Tester', 'Jam', 100000);
        total += await insertCoeff(id, 'C', 'equipment', megger.id, 1.0, 'Megger / Insulation Tester', 'Jam', megger.harga);
      }
    }

    // ===================== ME (Mechanical) =====================
    // ME.02.xx - Material
    else if (kode.match(/ME\.02\.(01|02|03|04)/)) {
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      let itemNama, itemHarga, itemSatuan;
      if (kode === 'ME.02.01') { itemNama = 'Plat Baja SS400 t=10mm'; itemHarga = 14500; itemSatuan = 'kg'; }
      else if (kode === 'ME.02.02') { itemNama = 'Baut Mur Washer Set M16'; itemHarga = 8500; itemSatuan = 'kg'; }
      else if (kode === 'ME.02.03') { itemNama = 'Kawat Las / Elektroda E7018'; itemHarga = 32000; itemSatuan = 'kg'; }
      else { itemNama = 'Equipment/Machinery Supply'; itemHarga = 50000000; itemSatuan = 'unit'; }
      const item = await ensureMaterial(itemNama, itemSatuan, itemHarga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, kode === 'ME.02.04' ? 2.0 : 0.010, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', item.id, 1.050, itemNama, itemSatuan, item.harga);
    }

    // ME.03.xx - Fabrikasi
    else if (kode.match(/ME\.03\.(01|02|03|04|05|06|07)/)) {
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const tkLas = await ensureLabor(L_TK_LAS.name, L_TK_LAS.satuan, L_TK_LAS.harga);
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      if (kode === 'ME.03.04') {
        // Welding per cm
        const kawatLas = await ensureMaterial('Kawat Las / Elektroda E7018', 'kg', 32000);
        total += await insertCoeff(id, 'A', 'labor', tkLas.id, 0.020, L_TK_LAS.name, L_TK_LAS.satuan, tkLas.harga);
        total += await insertCoeff(id, 'B', 'material', kawatLas.id, 0.010, 'Kawat Las / Elektroda E7018', 'kg', kawatLas.harga);
      } else if (kode === 'ME.03.06' || kode === 'ME.03.07') {
        // Trial Assembly / QC - lump sum
        const ahli = await ensureLabor('Tenaga Ahli Pratama', 'OH', 210000);
        total += await insertCoeff(id, 'A', 'labor', mandor.id, 2.0, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
        total += await insertCoeff(id, 'A', 'labor', pekerja.id, 8.0, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
        total += await insertCoeff(id, 'A', 'labor', ahli.id, 2.0, 'Tenaga Ahli Pratama', 'OH', ahli.harga);
      } else {
        // Cutting, Drilling, Rolling, Assembly per kg
        const grindDisc = await ensureMaterial('Grinding Disc 4"', 'bh', 15000);
        total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.005, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
        total += await insertCoeff(id, 'A', 'labor', tkLas.id, 0.005, L_TK_LAS.name, L_TK_LAS.satuan, tkLas.harga);
        total += await insertCoeff(id, 'B', 'material', grindDisc.id, 0.010, 'Grinding Disc 4"', 'bh', grindDisc.harga);
      }
    }

    // ME.04.xx - Erection & Installation
    else if (kode.match(/ME\.04\.(01|02|03|04|05|06)/)) {
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const crane = await ensureEquipment('Crane', 'Jam', 593750);
      if (kode === 'ME.04.01') {
        total += await insertCoeff(id, 'A', 'labor', mandor.id, 0.100, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
        total += await insertCoeff(id, 'A', 'labor', pekerja.id, 1.000, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
        total += await insertCoeff(id, 'C', 'equipment', crane.id, 1.000, 'Crane', 'Jam', crane.harga);
      } else if (kode === 'ME.04.04') {
        const grout = await ensureMaterial('Epoxy Grout', 'kg', 125000);
        total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.200, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
        total += await insertCoeff(id, 'B', 'material', grout.id, 5.0, 'Epoxy Grout', 'kg', grout.harga);
      } else {
        const tkLas = await ensureLabor(L_TK_LAS.name, L_TK_LAS.satuan, L_TK_LAS.harga);
        total += await insertCoeff(id, 'A', 'labor', mandor.id, 0.050, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
        total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.500, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
        total += await insertCoeff(id, 'A', 'labor', tkLas.id, 0.300, L_TK_LAS.name, L_TK_LAS.satuan, tkLas.harga);
      }
    }

    // ME.05.xx - Piping Connection
    else if (kode.match(/ME\.05\.(01|02|03|04)/)) {
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const tkLas = await ensureLabor(L_TK_LAS.name, L_TK_LAS.satuan, L_TK_LAS.harga);
      if (kode === 'ME.05.01') {
        total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.500, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
        total += await insertCoeff(id, 'A', 'labor', tkLas.id, 0.500, L_TK_LAS.name, L_TK_LAS.satuan, tkLas.harga);
      } else {
        const pipa = await ensureMaterial(kode === 'ME.05.02' ? 'Pipa Carbon Steel SCH40 2"' : (kode === 'ME.05.03' ? 'Pipa Carbon Steel SCH40 4"' : 'Tubing SS316 1/2"'), 'm\'', kode === 'ME.05.04' ? 85000 : (kode === 'ME.05.03' ? 450000 : 185000));
        total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.100, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
        total += await insertCoeff(id, 'B', 'material', pipa.id, 1.050, pipa.name || 'Pipa', 'm\'', pipa.harga);
      }
    }

    // ME.06.xx - Electrical Connection
    else if (kode.match(/ME\.06\.(01|02|03|04)/)) {
      const tkListrik = await ensureLabor(L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, L_TK_LISTRIK.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      let itemNama, itemHarga, itemSatuan;
      if (kode === 'ME.06.01') { itemNama = 'Kabel NYY 4x16mm2'; itemHarga = 125000; itemSatuan = 'm\''; }
      else if (kode === 'ME.06.02') { itemNama = 'Kabel Instrumen Shielded 2x1.5mm2'; itemHarga = 35000; itemSatuan = 'm\''; }
      else if (kode === 'ME.06.03') { itemNama = 'Junction Box IP65'; itemHarga = 125000; itemSatuan = 'bh'; }
      else { itemNama = 'Local Panel'; itemHarga = 5000000; itemSatuan = 'unit'; }
      const item = await ensureMaterial(itemNama, itemSatuan, itemHarga);
      total += await insertCoeff(id, 'A', 'labor', tkListrik.id, kode === 'ME.06.04' ? 2.0 : 0.030, L_TK_LISTRIK.name, L_TK_LISTRIK.satuan, tkListrik.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, kode === 'ME.06.04' ? 2.0 : 0.030, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', item.id, 1.050, itemNama, itemSatuan, item.harga);
    }

    // ME.07.xx - Surface Treatment (01 and 03 handled above)
    else if (kode === 'ME.07.04') {
      // Fireproofing
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const fireproof = await ensureMaterial('Fireproofing Coating', 'kg', 175000);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.100, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'B', 'material', fireproof.id, 3.0, 'Fireproofing Coating', 'kg', fireproof.harga);
    }

    // ME.08.xx - Testing & Commissioning
    else if (kode.match(/ME\.08\.(01|02|03|04)/)) {
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      const ahli = await ensureLabor('Tenaga Ahli Pratama', 'OH', 210000);
      const koefBase = kode === 'ME.08.04' ? 3.0 : 1.0;
      total += await insertCoeff(id, 'A', 'labor', mandor.id, koefBase, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, koefBase * 2, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
      total += await insertCoeff(id, 'A', 'labor', ahli.id, koefBase, 'Tenaga Ahli Pratama', 'OH', ahli.harga);
    }

    // Catch-all for any remaining items
    else {
      console.log(`  ⚠ No specific handler for ${kode} (${h.name}) - using generic`);
      const mandor = await ensureLabor(L_MANDOR.name, L_MANDOR.satuan, L_MANDOR.harga);
      const pekerja = await ensureLabor(L_PEKERJA.name, L_PEKERJA.satuan, L_PEKERJA.harga);
      total += await insertCoeff(id, 'A', 'labor', mandor.id, 0.010, L_MANDOR.name, L_MANDOR.satuan, mandor.harga);
      total += await insertCoeff(id, 'A', 'labor', pekerja.id, 0.100, L_PEKERJA.name, L_PEKERJA.satuan, pekerja.harga);
    }

    return total;
  }

  // Main execution
  let processed = 0;
  let errors = 0;
  
  for (const h of headers) {
    try {
      // Check if already has items
      const [existing] = await conn.query('SELECT COUNT(*) as cnt FROM ahsp_items WHERE ahsp_id = ?', [h.id]);
      if (existing[0].cnt > 0) {
        console.log(`  Skip ${h.kode} - already has ${existing[0].cnt} items`);
        continue;
      }

      const total = await buildCoefficients(h);
      
      // Update harga_satuan
      await conn.query('UPDATE ahsp_headers SET harga_satuan = ? WHERE id = ?', [Math.round(total * 100) / 100, h.id]);
      
      processed++;
      if (processed % 20 === 0) console.log(`  Processed ${processed}/${headers.length}...`);
    } catch (err) {
      console.error(`  ERROR on ${h.kode}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\nDone! Processed: ${processed}, Errors: ${errors}`);
  
  // Verify
  const [verifyItems] = await conn.query(`SELECT COUNT(*) as cnt FROM ahsp_items WHERE ahsp_id IN (SELECT id FROM ahsp_headers WHERE kode LIKE 'CB.%' OR kode LIKE 'CS.%' OR kode LIKE 'PP.%' OR kode LIKE 'EL.%' OR kode LIKE 'ME.%')`);
  const [verifyPriced] = await conn.query(`SELECT COUNT(*) as cnt FROM ahsp_headers WHERE (kode LIKE 'CB.%' OR kode LIKE 'CS.%' OR kode LIKE 'PP.%' OR kode LIKE 'EL.%' OR kode LIKE 'ME.%') AND harga_satuan > 0`);
  console.log(`Total coefficient rows: ${verifyItems[0].cnt}`);
  console.log(`AHSP with prices: ${verifyPriced[0].cnt}/289`);

  await conn.end();
}

main().catch(err => { console.error(err); process.exit(1); });
