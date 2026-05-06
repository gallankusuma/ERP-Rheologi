const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'A1. AHSP Konstruksi bagian 1.xlsx');

console.log('📂 Reading Excel file:', filePath);
const workbook = xlsx.readFile(filePath);

// Check DAFTAR ISI sheet
const sheetName = 'DAFTAR ISI';
console.log(`\n📋 Analyzing sheet: "${sheetName}"`);
const sheet = workbook.Sheets[sheetName];

// Get raw data with formulas
const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });

console.log(`Total rows: ${data.length}`);
console.log('\n=== Rows 1-100 to find structure ===\n');

data.slice(0, 100).forEach((row, idx) => {
  const hasContent = row.some(cell => cell && cell.toString().trim() !== '');
  if (hasContent) {
    console.log(`Row ${idx}:`, JSON.stringify(row));
  }
});

// Check for hyperlinks in sheet
console.log('\n\n=== Checking for hyperlinks ===\n');
const range = xlsx.utils.decode_range(sheet['!ref']);
let hyperlinks = [];

for (let R = range.s.r; R <= range.e.r && R < 100; ++R) {
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cellAddress = xlsx.utils.encode_cell({r: R, c: C});
    const cell = sheet[cellAddress];
    
    if (cell && cell.l) { // cell.l contains hyperlink info
      hyperlinks.push({
        row: R,
        col: C,
        address: cellAddress,
        value: cell.v,
        link: cell.l
      });
      
      if (hyperlinks.length <= 20) {
        console.log(`Cell ${cellAddress} (Row ${R}): "${cell.v}" → ${JSON.stringify(cell.l)}`);
      }
    }
  }
}

console.log(`\nTotal hyperlinks found: ${hyperlinks.length}`);

// Look for AHSP code patterns
console.log('\n\n=== Looking for AHSP codes ===\n');
let codesFound = 0;
data.forEach((row, idx) => {
  const rowStr = row.join(' ');
  if (/A\.1\.\d+\.\d+/.test(rowStr) && codesFound < 30) {
    console.log(`Row ${idx}: ${JSON.stringify(row)}`);
    codesFound++;
  }
});
console.log(`\nTotal rows with AHSP codes: ${codesFound}`);
