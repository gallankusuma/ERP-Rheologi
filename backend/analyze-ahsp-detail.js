const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'A1. AHSP Konstruksi bagian 1.xlsx');

console.log('📂 Reading Excel file:', filePath);
const workbook = xlsx.readFile(filePath);

// Analyze "A.1.1.Pekerjaan Persiapan" sheet to understand detail structure
const sheetName = 'A.1.1.Pekerjaan Persiapan';
console.log(`\n📋 Analyzing sheet: "${sheetName}"`);
const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

console.log(`Total rows: ${data.length}`);
console.log('\n=== First 50 rows to understand structure ===\n');

data.slice(0, 50).forEach((row, idx) => {
  // Only show rows that have some content
  const hasContent = row.some(cell => cell && cell.toString().trim() !== '');
  if (hasContent) {
    console.log(`Row ${idx}:`, JSON.stringify(row));
  }
});

// Try to find pattern - look for "TENAGA", "BAHAN", "PERALATAN" keywords
console.log('\n\n=== Searching for section markers (TENAGA/BAHAN/PERALATAN) ===\n');
data.forEach((row, idx) => {
  const rowStr = row.join(' ').toUpperCase();
  if (rowStr.includes('TENAGA KERJA') || rowStr.includes('BAHAN') || rowStr.includes('PERALATAN')) {
    console.log(`Row ${idx}: ${row.join(' | ')}`);
  }
});

// Look for AHSP code patterns (A.1.1.x)
console.log('\n\n=== Searching for AHSP codes (A.1.1.x pattern) ===\n');
data.forEach((row, idx) => {
  const rowStr = row.join(' ');
  if (/A\.1\.1\.\d+/.test(rowStr)) {
    console.log(`Row ${idx}: ${row.join(' | ')}`);
  }
});
