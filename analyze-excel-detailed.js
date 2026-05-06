const XLSX = require('xlsx');
const path = require('path');

const file = 'A1. AHSP Konstruksi bagian 1.xlsx';
const filePath = path.join(__dirname, file);

try {
  const workbook = XLSX.readFile(filePath);
  
  // Check TENAGA sheet (labor/material pricing)
  const sheetName = 'TENAGA';
  
  if (!workbook.SheetNames.includes(sheetName)) {
    console.log(`Sheet "${sheetName}" not found. Available sheets:`);
    workbook.SheetNames.forEach(name => console.log(`  - ${name}`));
    process.exit(1);
  }
  
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { defval: '', header: 1 });
  
  console.log('📊 TENAGA SHEET ANALYSIS');
  console.log('='.repeat(80));
  console.log(`Sheet: ${sheetName}`);
  console.log(`Total Rows: ${data.length}\n`);
  
  // Show first 10 rows
  console.log('📄 First 10 rows:');
  console.log('='.repeat(80));
  data.slice(0, 15).forEach((row, idx) => {
    console.log(`Row ${idx + 1}:`, row.slice(0, 8).join(' | '));
  });
  
  console.log('\n' + '='.repeat(80));
  
  // Also check one work sheet
  console.log('\n📊 SAMPLE WORK SHEET ANALYSIS');
  console.log('='.repeat(80));
  
  const workSheet = 'A.1.6.Pekerjaan Beton';
  if (workbook.SheetNames.includes(workSheet)) {
    const ws = workbook.Sheets[workSheet];
    const workData = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 });
    
    console.log(`Sheet: ${workSheet}`);
    console.log(`Total Rows: ${workData.length}\n`);
    
    console.log('📄 First 15 rows:');
    console.log('='.repeat(80));
    workData.slice(0, 15).forEach((row, idx) => {
      console.log(`Row ${idx + 1}:`, row.slice(0, 10).join(' | '));
    });
  }
  
} catch (err) {
  console.error('❌ Error:', err.message);
}
