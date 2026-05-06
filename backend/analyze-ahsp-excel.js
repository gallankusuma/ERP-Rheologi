const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'A1. AHSP Konstruksi bagian 1.xlsx');

console.log('📂 Reading Excel file:', filePath);
const workbook = xlsx.readFile(filePath);

console.log('\n📊 Sheet Names:');
console.log(workbook.SheetNames);
console.log(`\nTotal sheets: ${workbook.SheetNames.length}`);

// Analyze first sheet (likely the list)
const firstSheetName = workbook.SheetNames[0];
console.log(`\n📋 Analyzing first sheet: "${firstSheetName}"`);
const firstSheet = workbook.Sheets[firstSheetName];
const firstSheetData = xlsx.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });

console.log(`Rows in first sheet: ${firstSheetData.length}`);
console.log('\nFirst 5 rows:');
firstSheetData.slice(0, 5).forEach((row, idx) => {
  console.log(`Row ${idx}:`, row);
});

// Check if there are detail sheets
if (workbook.SheetNames.length > 1) {
  console.log(`\n📄 Analyzing second sheet: "${workbook.SheetNames[1]}"`);
  const secondSheet = workbook.Sheets[workbook.SheetNames[1]];
  const secondSheetData = xlsx.utils.sheet_to_json(secondSheet, { header: 1, defval: '' });
  
  console.log(`Rows in second sheet: ${secondSheetData.length}`);
  console.log('\nFirst 10 rows:');
  secondSheetData.slice(0, 10).forEach((row, idx) => {
    console.log(`Row ${idx}:`, row);
  });
}

// Sample 3 more sheets if available
if (workbook.SheetNames.length > 2) {
  console.log('\n📑 Sample of other sheet names:');
  workbook.SheetNames.slice(1, 6).forEach(name => {
    const sheet = workbook.Sheets[name];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    console.log(`  - "${name}" (${data.length} rows)`);
  });
}
