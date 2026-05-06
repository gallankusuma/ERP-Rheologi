const xlsx = require('xlsx');
const path = require('path');

const workbook = xlsx.readFile(path.join(__dirname, '..', 'A1. AHSP Konstruksi bagian 1.xlsx'));

console.log('\n=== Checking A.1.3.Pekerjaan Tanah structure ===\n');
const sheet = workbook.Sheets['A.1.3.Pekerjaan Tanah'];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

data.slice(0, 50).forEach((r, i) => {
  if (r.some(c => c && c.toString().trim() !== '')) {
    console.log(`Row ${i}:`, JSON.stringify(r));
  }
});

console.log('\n=== Checking A.1.5.Pekerjaan Pasangan structure ===\n');
const sheet2 = workbook.Sheets['A.1.5.Pekerjaan Pasangan'];
const data2 = xlsx.utils.sheet_to_json(sheet2, { header: 1, defval: '' });

data2.slice(0, 50).forEach((r, i) => {
  if (r.some(c => c && c.toString().trim() !== '')) {
    console.log(`Row ${i}:`, JSON.stringify(r));
  }
});
