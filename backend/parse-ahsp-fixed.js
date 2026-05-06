const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = path.join(__dirname, '..', 'A1. AHSP Konstruksi bagian 1.xlsx');
console.log('📂 Reading:', filePath, '\n');

const workbook = xlsx.readFile(filePath);

// Parse DAFTAR ISI
console.log('📋 Step 1: Parsing DAFTAR ISI...');
const daftarIsiSheet = workbook.Sheets['DAFTAR ISI'];
const daftarIsiData = xlsx.utils.sheet_to_json(daftarIsiSheet, { header: 1, defval: '' });

const ahspList = [];
daftarIsiData.forEach((row) => {
  const kode = row[1] ? row[1].toString().trim() : '';
  const name = row[2] ? row[2].toString().trim() : '';
  
  if (/^A\.1\.\d+\.\d+$/.test(kode) && name) {
    ahspList.push({ kode, name });
  }
});

console.log(`✅ Found ${ahspList.length} AHSP in DAFTAR ISI\n`);

// Parse detail sheets
console.log('📋 Step 2: Parsing detail sheets...\n');
const detailSheets = [
  { name: 'A.1.1.Pekerjaan Persiapan', format: 'A' }, // Format A: col[1]=num, col[3]=name
  { name: 'A.1.2.Pekerjaan Bongkaran', format: 'B' },
  { name: 'A.1.3.Pekerjaan Tanah', format: 'B' }, // Format B: col[0]=num, col[1]=name
  { name: 'A.1.4.Pekerjaan Pondasi', format: 'B' },
  { name: 'A.1.5.Pekerjaan Pasangan', format: 'B' },
  { name: 'A.1.6.Pekerjaan Beton', format: 'B' },
  { name: 'A.1.7.Beton Pracetak', format: 'B' },
  { name: 'A.1.8.Pekerjaan Plesteran', format: 'B' },
  { name: 'A.1.9.Pek Penutup Dinding', format: 'B' },
  { name: 'A.1.10.Pek Konblok', format: 'B' }
];

const allDetails = {};

detailSheets.forEach(({ name: sheetName, format }) => {
  if (!workbook.Sheets[sheetName]) {
    console.log(`  ⚠️  Sheet "${sheetName}" not found`);
    return;
  }
  
  console.log(`  📄 ${sheetName} (Format ${format})`);
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  
  const prefix = sheetName.match(/A\.1\.\d+/)[0]; // e.g., A.1.1
  if (!allDetails[prefix]) allDetails[prefix] = [];
  
  let currentAhsp = null;
  let currentSection = null;
  
  data.forEach((row, idx) => {
    if (format === 'A') {
      // Format A: col[1]=number, col[3]=name
      const col1 = row[1] ? row[1].toString().trim() : '';
      const col2 = row[2] ? row[2].toString().trim() : '';
      const col3 = row[3] ? row[3].toString().trim() : '';
      
      // AHSP header
      if (/^\d+$/.test(col1) && col3.length > 20 && !col3.toLowerCase().includes('uraian')) {
        if (currentAhsp && currentAhsp.items.length > 0) {
          allDetails[prefix].push(currentAhsp);
        }
        currentAhsp = { number: parseInt(col1), name: col3, items: [] };
        currentSection = null;
        return;
      }
      
      // Section markers
      if (currentAhsp && ['A', 'B', 'C'].includes(col2)) {
        currentSection = col2;
        return;
      }
      
      // Resources
      if (currentAhsp && currentSection && /^\d+$/.test(col2)) {
        const name = col3 || '';
        const kode = row[4] ? row[4].toString().trim() : '';
        const satuan = row[5] ? row[5].toString().trim() : '';
        const koef = row[6];
        
        if (name && koef !== '') {
          currentAhsp.items.push({
            section: currentSection,
            name,
            kode,
            satuan,
            koefisien: typeof koef === 'number' ? koef : parseFloat(koef) || 0
          });
        }
      }
      
      // End markers
      if (currentAhsp && ['D', 'E', 'F'].includes(col2)) {
        if (col2 === 'F' && currentAhsp.items.length > 0) {
          allDetails[prefix].push(currentAhsp);
          currentAhsp = null;
        }
      }
      
    } else {
      // Format B: col[0]=number, col[1]=name
      const col0 = row[0] ? row[0].toString().trim() : '';
      const col1 = row[1] ? row[1].toString().trim() : '';
      const col2 = row[2] ? row[2].toString().trim() : '';
      
      // AHSP header
      if (/^\d+$/.test(col0) && col1.length > 20 && !col1.toLowerCase().includes('uraian')) {
        if (currentAhsp && currentAhsp.items.length > 0) {
          allDetails[prefix].push(currentAhsp);
        }
        currentAhsp = { number: parseInt(col0), name: col1, items: [] };
        currentSection = null;
        return;
      }
      
      // Section markers
      if (currentAhsp && ['A', 'B', 'C'].includes(col1)) {
        currentSection = col1;
        return;
      }
      
      // Resources
      if (currentAhsp && currentSection && col2 && col2.length > 1 && !col2.includes('JUMLAH')) {
        const name = col2 || '';
        const kode = row[3] ? row[3].toString().trim() : '';
        const satuan = row[4] ? row[4].toString().trim() : '';
        const koef = row[5];
        
        if (name && koef !== '' && typeof koef !== 'undefined') {
          currentAhsp.items.push({
            section: currentSection,
            name,
            kode,
            satuan,
            koefisien: typeof koef === 'number' ? koef : parseFloat(koef) || 0
          });
        }
      }
      
      // End markers
      if (currentAhsp && ['D', 'E', 'F'].includes(col1)) {
        if (col1 === 'F' && currentAhsp.items.length > 0) {
          allDetails[prefix].push(currentAhsp);
          currentAhsp = null;
        }
      }
    }
  });
  
  // Save last AHSP if exists
  if (currentAhsp && currentAhsp.items.length > 0) {
    allDetails[prefix].push(currentAhsp);
  }
  
  console.log(`    → ${allDetails[prefix].length} AHSP with details`);
});

// Count total
const totalDetails = Object.values(allDetails).reduce((sum, arr) => sum + arr.length, 0);
console.log(`\n✅ Total: ${totalDetails} AHSP with details\n`);

// Match with DAFTAR ISI codes
console.log('📋 Step 3: Matching codes with details...\n');
const matched = [];

ahspList.forEach(ahsp => {
  const prefix = ahsp.kode.match(/A\.1\.\d+/)[0];
  const number = parseInt(ahsp.kode.split('.').pop());
  
  const detail = allDetails[prefix] && allDetails[prefix].find(d => d.number === number);
  
  if (detail) {
    matched.push({
      kode: ahsp.kode,
      name: ahsp.name,
      satuan: 'm2', // Default
      items: detail.items
    });
  } else {
    // Header only
    matched.push({
      kode: ahsp.kode,
      name: ahsp.name,
      satuan: 'm2',
      items: []
    });
  }
});

console.log(`✅ Matched: ${matched.filter(m => m.items.length > 0).length} with details`);
console.log(`⚠️  Header only: ${matched.filter(m => m.items.length === 0).length}\n`);

// Generate CSV
console.log('📋 Step 4: Generating CSV...\n');
const csvRows = [
  ['kode', 'name', 'satuan', 'version', 'status', 'sub_discipline_id', 'section', 'resource_type', 'resource_id', 'resource_name', 'resource_satuan', 'koefisien', 'resource_harga']
];

matched.forEach(ahsp => {
  if (ahsp.items.length > 0) {
    ahsp.items.forEach(item => {
      csvRows.push([
        ahsp.kode,
        ahsp.name,
        ahsp.satuan,
        '28/2016',
        'active',
        '',
        item.section,
        '',
        0,
        item.name,
        item.satuan,
        item.koefisien,
        0
      ]);
    });
  } else {
    csvRows.push([ahsp.kode, ahsp.name, ahsp.satuan, '28/2016', 'active', '', '', '', 0, '', '', '', 0]);
  }
});

const csvContent = csvRows.map(row => 
  row.map(cell => {
    const str = cell ? cell.toString() : '';
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }).join(',')
).join('\n');

const outputPath = path.join(__dirname, 'ahsp_parsed_data.csv');
fs.writeFileSync(outputPath, csvContent, 'utf8');

console.log(`✅ CSV saved: ${outputPath}`);
console.log(`\n📊 Summary:`);
console.log(`   - Total AHSP: ${matched.length}`);
console.log(`   - With details: ${matched.filter(m => m.items.length > 0).length}`);
console.log(`   - Total resource items: ${matched.reduce((sum, m) => sum + m.items.length, 0)}`);
console.log(`   - CSV rows: ${csvRows.length}`);
console.log(`\n🚀 Ready to import!`);
