const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = path.join(__dirname, '..', 'A1. AHSP Konstruksi bagian 1.xlsx');

console.log('📂 Reading Excel file:', filePath);
const workbook = xlsx.readFile(filePath);

// Step 1: Parse DAFTAR ISI to get AHSP codes and names
console.log('\n📋 Step 1: Parsing DAFTAR ISI...');
const daftarIsiSheet = workbook.Sheets['DAFTAR ISI'];
const daftarIsiData = xlsx.utils.sheet_to_json(daftarIsiSheet, { header: 1, defval: '' });

const ahspList = [];
daftarIsiData.forEach((row, idx) => {
  const kode = row[1] ? row[1].toString().trim() : '';
  const name = row[2] ? row[2].toString().trim() : '';
  
  // Match AHSP code pattern A.1.x.x
  if (/^A\.1\.\d+\.\d+$/.test(kode) && name) {
    ahspList.push({
      kode,
      name,
      rowIndex: idx
    });
  }
});

console.log(`Found ${ahspList.length} AHSP items in DAFTAR ISI`);
console.log('Sample:', ahspList.slice(0, 5).map(a => `${a.kode} - ${a.name.substring(0, 50)}...`));

// Step 2: Parse detail sheets to extract breakdowns
console.log('\n📋 Step 2: Parsing detail sheets...');
const detailSheets = [
  'A.1.1.Pekerjaan Persiapan',
  'A.1.2.Pekerjaan Bongkaran',
  'A.1.3.Pekerjaan Tanah',
  'A.1.4.Pekerjaan Pondasi',
  'A.1.5.Pekerjaan Pasangan',
  'A.1.6.Pekerjaan Beton',
  'A.1.7.Beton Pracetak',
  'A.1.8.Pekerjaan Plesteran',
  'A.1.9.Pek Penutup Dinding',
  'A.1.10.Pek Konblok'
];

const allDetails = [];
let ahspCounter = 0;

detailSheets.forEach(sheetName => {
  if (!workbook.Sheets[sheetName]) {
    console.log(`  ⚠️  Sheet "${sheetName}" not found, skipping...`);
    return;
  }
  
  console.log(`\n  📄 Parsing sheet: ${sheetName}`);
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  
  let currentAhsp = null;
  let currentSection = null;
  let ahspNumber = null;
  
  data.forEach((row, idx) => {
    // Detect AHSP header: Row with number in col[1] and name in col[3]
    const col1 = row[1] ? row[1].toString().trim() : '';
    const col3 = row[3] ? row[3].toString().trim() : '';
    
    // Check if this is AHSP header row (number + long name)
    if (/^\d+$/.test(col1) && col3.length > 20 && !col3.includes('No') && !col3.includes('Uraian')) {
      // New AHSP found
      ahspCounter++;
      ahspNumber = parseInt(col1);
      currentAhsp = {
        number: ahspNumber,
        name: col3,
        sheet: sheetName,
        items: []
      };
      currentSection = null;
      return;
    }
    
    // Detect section markers
    if (currentAhsp) {
      const rowStr = row.join(' ').toUpperCase();
      
      if (row[2] === 'A' && rowStr.includes('TENAGA')) {
        currentSection = 'A';
        return;
      }
      if (row[2] === 'B' && rowStr.includes('BAHAN')) {
        currentSection = 'B';
        return;
      }
      if (row[2] === 'C' && rowStr.includes('PERALATAN')) {
        currentSection = 'C';
        return;
      }
      
      // Detect end markers
      if (rowStr.includes('JUMLAH') && (rowStr.includes('TENAGA') || rowStr.includes('BAHAN') || rowStr.includes('ALAT'))) {
        // End of current section
        return;
      }
      
      if (row[2] === 'D' || row[2] === 'E' || row[2] === 'F') {
        // End of AHSP, save it
        if (currentAhsp && currentAhsp.items.length > 0) {
          allDetails.push(currentAhsp);
        }
        currentAhsp = null;
        currentSection = null;
        return;
      }
      
      // Parse resource items
      if (currentSection && /^\d+$/.test(row[2] ? row[2].toString().trim() : '')) {
        const resourceNum = row[2].toString().trim();
        const resourceName = row[3] ? row[3].toString().trim() : '';
        const resourceKode = row[4] ? row[4].toString().trim() : '';
        const resourceSatuan = row[5] ? row[5].toString().trim() : '';
        const koefisien = row[6];
        
        if (resourceName && koefisien !== '') {
          currentAhsp.items.push({
            section: currentSection,
            number: resourceNum,
            name: resourceName,
            kode: resourceKode,
            satuan: resourceSatuan,
            koefisien: typeof koefisien === 'number' ? koefisien : parseFloat(koefisien) || 0
          });
        }
      }
    }
  });
  
  console.log(`    Found ${allDetails.length - (ahspCounter - parseInt(sheetName.match(/\d+/)[0])) + 1} AHSP items with details in this sheet`);
});

console.log(`\n✅ Total AHSP with details parsed: ${allDetails.length}`);

// Step 3: Match DAFTAR ISI codes with detail items
console.log('\n📋 Step 3: Matching codes with details...');

// Group details by sheet prefix (A.1.1, A.1.2, etc)
const groupedDetails = {};
detailSheets.forEach((sheetName, sheetIdx) => {
  const prefix = sheetName.match(/A\.1\.\d+/)[0];
  if (!groupedDetails[prefix]) {
    groupedDetails[prefix] = [];
  }
  
  allDetails.forEach(detail => {
    if (detail.sheet === sheetName) {
      groupedDetails[prefix].push(detail);
    }
  });
});

// Match by sequence number within each group
const matched = [];
ahspList.forEach(ahsp => {
  const prefix = ahsp.kode.match(/A\.1\.\d+/)[0]; // e.g., A.1.1
  const number = parseInt(ahsp.kode.split('.').pop()); // e.g., 1 from A.1.1.1
  
  if (groupedDetails[prefix] && groupedDetails[prefix][number - 1]) {
    const detail = groupedDetails[prefix][number - 1];
    matched.push({
      kode: ahsp.kode,
      name: ahsp.name,
      satuan: 'm2', // Default, bisa diadjust manual nanti
      items: detail.items
    });
  } else {
    // AHSP without details - add header only
    matched.push({
      kode: ahsp.kode,
      name: ahsp.name,
      satuan: 'm2',
      items: []
    });
  }
});

console.log(`✅ Matched ${matched.filter(m => m.items.length > 0).length} AHSP with details`);
console.log(`⚠️  ${matched.filter(m => m.items.length === 0).length} AHSP without details (header only)`);

// Step 4: Generate CSV rows
console.log('\n📋 Step 4: Generating CSV data...');
const csvRows = [];

// Add header
csvRows.push([
  'kode',
  'name',
  'satuan',
  'version',
  'status',
  'sub_discipline_id',
  'section',
  'resource_type',
  'resource_id',
  'resource_name',
  'resource_satuan',
  'koefisien',
  'resource_harga'
]);

matched.forEach(ahsp => {
  if (ahsp.items.length > 0) {
    // Add detail rows
    ahsp.items.forEach(item => {
      csvRows.push([
        ahsp.kode,
        ahsp.name,
        ahsp.satuan,
        '28/2016', // Version from file
        'active',
        '', // sub_discipline_id - empty for now
        item.section,
        '', // resource_type - empty
        0, // resource_id - 0 means snapshot mode
        item.name,
        item.satuan,
        item.koefisien,
        0 // resource_harga - 0 for now, fill manual later
      ]);
    });
  } else {
    // Header only row
    csvRows.push([
      ahsp.kode,
      ahsp.name,
      ahsp.satuan,
      '28/2016',
      'active',
      '',
      '',
      '',
      0,
      '',
      '',
      '',
      0
    ]);
  }
});

console.log(`✅ Generated ${csvRows.length - 1} CSV rows (including header)`);

// Save to CSV
const csvContent = csvRows.map(row => 
  row.map(cell => {
    const str = cell ? cell.toString() : '';
    // Escape commas and quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }).join(',')
).join('\n');

const outputPath = path.join(__dirname, 'ahsp_parsed_data.csv');
fs.writeFileSync(outputPath, csvContent, 'utf8');

console.log(`\n✅ CSV file saved to: ${outputPath}`);
console.log(`\n📊 Summary:`);
console.log(`   - Total AHSP: ${matched.length}`);
console.log(`   - With details: ${matched.filter(m => m.items.length > 0).length}`);
console.log(`   - Header only: ${matched.filter(m => m.items.length === 0).length}`);
console.log(`   - Total items: ${matched.reduce((sum, m) => sum + m.items.length, 0)}`);
console.log(`\n🚀 Ready to import! Use: POST /api/import/import/ahsp with this CSV file`);
