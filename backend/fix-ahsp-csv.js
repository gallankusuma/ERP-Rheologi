const fs = require('fs');
const XLSX = require('xlsx');

// Read CSV
const wb = XLSX.readFile('ahsp_parsed_data.csv');
const ws = wb.Sheets[wb.SheetNames[0]];
let data = XLSX.utils.sheet_to_json(ws);

console.log(`📊 Original rows: ${data.length}`);

// Filter out rows with invalid data
const before = data.length;
data = data.filter((row, idx) => {
  const section = (row.section || '').toString().trim();
  
  // If row has section, must have koefisien
  if (section && ['A', 'B', 'C'].includes(section.toUpperCase())) {
    if (row.koefisien === undefined || row.koefisien === null || row.koefisien === '') {
      console.log(`❌ Removing row ${idx + 2} - kode: ${row.kode}, resource: ${row.resource_name} (no koefisien)`);
      return false;
    }
  }
  
  // Clean newlines in resource_name
  if (row.resource_name && typeof row.resource_name === 'string') {
    row.resource_name = row.resource_name.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  }
  
  return true;
});

const removed = before - data.length;
console.log(`\n✅ Removed ${removed} invalid rows`);
console.log(`📊 Final rows: ${data.length}`);

// Write back to CSV
const newWs = XLSX.utils.json_to_sheet(data);
const newWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(newWb, newWs, 'Sheet1');
XLSX.writeFile(newWb, 'ahsp_parsed_data_clean.csv');

console.log('💾 Saved to: ahsp_parsed_data_clean.csv');
