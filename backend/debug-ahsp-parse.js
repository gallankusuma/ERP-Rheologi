const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'A1. AHSP Konstruksi bagian 1.xlsx');
const workbook = xlsx.readFile(filePath);

// Debug: Check one sheet in detail
const sheetName = 'A.1.1.Pekerjaan Persiapan';
console.log(`\n🔍 Debugging sheet: ${sheetName}\n`);

const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

console.log('=== Looking for AHSP boundaries ===\n');

let ahspCount = 0;
data.forEach((row, idx) => {
  const col1 = row[1] ? row[1].toString().trim() : '';
  const col2 = row[2] ? row[2].toString().trim() : '';
  const col3 = row[3] ? row[3].toString().trim() : '';
  
  // Check different patterns
  const pattern1 = /^\d+$/.test(col1) && col3.length > 20; // Number in col1, name in col3
  const pattern2 = /^\d+$/.test(col1) && col2 === '' && col3.length > 0; // Number, empty, text
  const hasHeader = col2.toLowerCase().includes('uraian') || col3.toLowerCase().includes('uraian');
  const isSectionMarker = ['A', 'B', 'C', 'D', 'E', 'F'].includes(col2);
  
  if (pattern1 && !hasHeader) {
    ahspCount++;
    console.log(`AHSP ${ahspCount} at row ${idx}:`);
    console.log(`  Number: ${col1}`);
    console.log(`  Name: ${col3.substring(0, 60)}...`);
    
    // Show next 30 lines to see structure
    console.log(`  Next sections:`);
    for (let i = 1; i <= 30 && idx + i < data.length; i++) {
      const nextRow = data[idx + i];
      const nc2 = nextRow[2] ? nextRow[2].toString().trim() : '';
      const nc3 = nextRow[3] ? nextRow[3].toString().trim() : '';
      const nc6 = nextRow[6];
      
      if (nc2 === 'A' || nc2 === 'B' || nc2 === 'C') {
        console.log(`    Row ${idx + i}: Section ${nc2} - ${nc3}`);
      } else if (/^\d+$/.test(nc2) && nc3) {
        console.log(`      Row ${idx + i}: Item ${nc2} - ${nc3.substring(0, 40)}... (koef: ${nc6})`);
      } else if ((nc2 === 'D' || nc2 === 'E' || nc2 === 'F') && nc3) {
        console.log(`    Row ${idx + i}: ${nc2} - ${nc3.substring(0, 40)}...`);
      }
    }
    console.log('');
  }
});

console.log(`\n✅ Total AHSP detected: ${ahspCount}`);
