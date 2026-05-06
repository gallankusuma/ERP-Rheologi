const XLSX = require('xlsx');
const path = require('path');

const wb = XLSX.readFile(path.join(__dirname, 'Master Data.xlsx'));
const wsItems = wb.Sheets['Item Code'];
const data = XLSX.utils.sheet_to_json(wsItems, { header: 1 });
data.forEach((row, i) => {
  if (row.some(v => v !== undefined && v !== null && v !== '')) {
    console.log(`[${i}] ${JSON.stringify(row)}`);
  }
});
