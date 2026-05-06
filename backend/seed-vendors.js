const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'erp.db');
const db = new Database(dbPath);

console.log('📦 Creating sample vendors...\n');

const vendors = [
  { code: 'VND001', name: 'GLOBALINDO INTI PERSADA, PT', contact: 'Rohiyan Evendi, Bp', email: 'info@globalindo.com', phone: '021-1234567', address: 'Jl. Raja Salira, Pulomeple, Serang, Banten-42455' },
  { code: 'VND002', name: 'INDO CHEMICAL SUPPLIER', contact: 'Budi Santoso', email: 'sales@indochem.com', phone: '021-8765432', address: 'Jl. Industri No. 10, Jakarta' },
  { code: 'VND003', name: 'ASIA PACKAGING CO.', contact: 'Andi Wijaya', email: 'order@asiapkg.com', phone: '021-5555555', address: 'Jl. Logistik Blok A, Tangerang' },
];

const stmt = db.prepare(`
  INSERT INTO vendors (code, name, contact, email, phone, address, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`);

vendors.forEach(v => {
  try {
    stmt.run(v.code, v.name, v.contact, v.email, v.phone, v.address);
    console.log('✅ Created:', v.name);
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      console.log('⏭️  Skipped:', v.name, '(already exists)');
    } else {
      console.error('❌ Error:', error.message);
    }
  }
});

// Verify
console.log('\n📊 Vendors in database:');
const allVendors = db.prepare('SELECT id, code, name FROM vendors').all();
console.log(`Total: ${allVendors.length}`);
allVendors.forEach((v) => console.log(`  #${v.id} | ${v.code} | ${v.name}`));

db.close();
console.log('\n✅ Done!');
