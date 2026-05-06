const xlsx = require('xlsx');
const path = require('path');
const workbook = xlsx.readFile(path.join(__dirname, '..', 'A1. AHSP Konstruksi bagian 1.xlsx'));

const sheets = [
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

let totalAhsp = 0;

sheets.forEach(sheetName => {
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' });
  
  let count = 0;
  data.forEach((r, i) => {
    const c1 = r[1] ? r[1].toString().trim() : '';
    const c3 = r[3] ? r[3].toString().trim() : '';
    
    if (/^\d+$/.test(c1) && c3.length > 20 && !c3.toLowerCase().includes('uraian')) {
      count++;
      if (sheetName === 'A.1.1.Pekerjaan Persiapan' && count <= 20) {
        console.log(`  ${count}. Row ${i}: [${c1}] ${c3.substring(0, 50)}...`);
      }
    }
  });
  
  console.log(`${sheetName}: ${count} AHSP`);
  totalAhsp += count;
});

console.log(`\n✅ Total AHSP across all sheets: ${totalAhsp}`);
