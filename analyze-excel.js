const XLSX = require('xlsx');
const path = require('path');

const file = 'A1. AHSP Konstruksi bagian 1.xlsx';
const filePath = path.join(__dirname, file);

try {
  const workbook = XLSX.readFile(filePath);
  
  console.log('📊 EXCEL FILE ANALYSIS');
  console.log('='.repeat(60));
  console.log(`File: ${file}\n`);
  
  // List all sheets
  console.log('📄 Sheets found:');
  workbook.SheetNames.forEach((name, idx) => {
    console.log(`   ${idx + 1}. ${name}`);
  });
  
  // Analyze first sheet
  console.log('\n📋 FIRST SHEET ANALYSIS:');
  console.log('='.repeat(60));
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  
  console.log(`Sheet Name: ${sheetName}`);
  console.log(`Total Rows: ${data.length}\n`);
  
  if (data.length > 0) {
    console.log('📝 Column Headers:');
    const headers = Object.keys(data[0]);
    headers.forEach((header, idx) => {
      console.log(`   ${idx + 1}. "${header}"`);
    });
    
    console.log('\n📄 First 3 rows sample:');
    console.log('='.repeat(60));
    data.slice(0, 3).forEach((row, idx) => {
      console.log(`\nRow ${idx + 1}:`);
      Object.keys(row).forEach(key => {
        const value = String(row[key]).substring(0, 50);
        console.log(`   ${key}: ${value}`);
      });
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
} catch (err) {
  console.error('❌ Error reading Excel file:', err.message);
  console.error('Make sure the file exists in the root folder.');
}
