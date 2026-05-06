const fs = require('fs');

const csvFilePath = 'c:\\Users\\GK\\Documents\\vendor.csv';

function parseCSV(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.split('\n').filter(line => line.trim());
  
  const vendors = new Map();
  
  // Skip header (first line)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const fields = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
        current += char;
      } else if (char === ',' && !inQuotes) {
        const cleaned = current.trim().replace(/^["']|["']$/g, '').trim();
        fields.push(cleaned);
        current = '';
      } else {
        current += char;
      }
    }
    const cleaned = current.trim().replace(/^["']|["']$/g, '').trim();
    fields.push(cleaned);
    
    const vendorName = fields[4]?.trim();
    const phone = fields[5]?.trim();
    
    if (vendorName && vendorName.length > 0) {
      if (!vendors.has(vendorName)) {
        vendors.set(vendorName, {
          name: vendorName,
          contact: phone && phone.length > 0 ? phone : null
        });
      }
    }
  }
  
  return Array.from(vendors.values());
}

console.log('📖 Reading CSV file...\n');
const vendors = parseCSV(csvFilePath);

console.log(`✅ Found ${vendors.length} unique vendors\n`);
console.log('📋 Vendor List:');
console.log('=' .repeat(80));

vendors.forEach((vendor, index) => {
  const code = `VENDOR-IMPORT-${String(index + 1).padStart(3, '0')}`;
  console.log(`${index + 1}. ${code} | ${vendor.name}`);
  if (vendor.contact) {
    console.log(`   Phone: ${vendor.contact}`);
  }
});

console.log('\n' + '=' .repeat(80));
console.log(`\n✨ Ready to import ${vendors.length} vendors into database!`);
console.log('\n📝 SQL INSERT statements preview:');
console.log('=' .repeat(80));

vendors.slice(0, 5).forEach((vendor, index) => {
  const code = `VENDOR-IMPORT-${String(index + 1).padStart(3, '0')}`;
  const sql = `INSERT INTO vendors (code, name, contact, is_active, created_at) VALUES ('${code}', '${vendor.name.replace(/'/g, "''")}', ${vendor.contact ? `'${vendor.contact.replace(/'/g, "''")}'` : 'NULL'}, 1, NOW());`;
  console.log(sql);
});

if (vendors.length > 5) {
  console.log(`... and ${vendors.length - 5} more vendors`);
}

console.log('\n' + '=' .repeat(80));
