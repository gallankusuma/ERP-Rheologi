const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'A1. AHSP Konstruksi bagian 1.xlsx');

console.log('📂 Reading Excel file:', filePath);
const workbook = xlsx.readFile(filePath);

// Check REKAP sheet
const sheetName = 'REKAP';
console.log(`\n📋 Analyzing sheet: "${sheetName}"`);
const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

console.log(`Total rows: ${data.length}`);
console.log('\n=== First 50 rows of REKAP ===\n');

data.slice(0, 50).forEach((row, idx) => {
  const hasContent = row.some(cell => cell && cell.toString().trim() !== '');
  if (hasContent) {
    console.log(`Row ${idx}:`, JSON.stringify(row));
  }
});

// Search for AHSP code patterns in entire REKAP
console.log('\n\n=== Searching for AHSP codes in REKAP ===\n');
let foundCodes = [];
data.forEach((row, idx) => {
  const rowStr = row.join(' ');
  if (/A\.1\.\d+\.\d+/.test(rowStr)) {
    foundCodes.push({ row: idx, content: row });
    if (foundCodes.length <= 20) {
      console.log(`Row ${idx}: ${JSON.stringify(row)}`);
    }
  }
});
console.log(`\nTotal rows with AHSP codes: ${foundCodes.length}`);

// Check if there are prices in REKAP
console.log('\n\n=== Checking for price data in REKAP ===\n');
let priceRows = 0;
data.forEach((row, idx) => {
  row.forEach((cell, colIdx) => {
    if (typeof cell === 'number' && cell > 1000 && colIdx > 5) {
      priceRows++;
      if (priceRows <= 10) {
        console.log(`Row ${idx}, Col ${colIdx}: ${cell} (Full row: ${JSON.stringify(row)})`);
      }
    }
  });
});
console.log(`\nTotal rows with price-like numbers: ${priceRows}`);
