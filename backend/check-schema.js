const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'erp.db');
const db = new Database(dbPath);

console.log('📊 Checking purchase_requests schema in:', dbPath);
const columns = db.prepare("PRAGMA table_info(purchase_requests)").all();
console.log('\nColumns:');
columns.forEach(col => console.log(`  ${col.name} (${col.type})`));

const hasDepartment = columns.some(c => c.name === 'department');
const hasRequestDate = columns.some(c => c.name === 'request_date');
const hasNeededBy = columns.some(c => c.name === 'needed_by');
const hasReason = columns.some(c => c.name === 'reason');

console.log('\n✅ Required columns check:');
console.log('  department:', hasDepartment ? '✅' : '❌');
console.log('  request_date:', hasRequestDate ? '✅' : '❌');
console.log('  needed_by:', hasNeededBy ? '✅' : '❌');
console.log('  reason:', hasReason ? '✅' : '❌');

db.close();
