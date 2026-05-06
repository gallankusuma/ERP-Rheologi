const fs = require('fs');

const csvFilePath = 'c:\\Users\\GK\\Documents\\vendor.csv';

function parseCSV(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.split('\n').filter(line => line.trim());
  
  const vendors = new Map();
  
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

const vendors = parseCSV(csvFilePath);

// Generate SQL statements
let sql = `-- Vendor Import from CSV
-- Generated: ${new Date().toISOString()}
-- Total Vendors: ${vendors.length}

`;

vendors.forEach((vendor, index) => {
  const code = `VENDOR-IMPORT-${String(index + 1).padStart(3, '0')}`;
  const name = vendor.name.replace(/'/g, "''");
  const contact = vendor.contact ? `'${vendor.contact.replace(/'/g, "''")}'` : 'NULL';
  
  sql += `INSERT INTO vendors (code, name, contact, is_active, created_at) VALUES ('${code}', '${name}', ${contact}, 1, NOW());\n`;
});

// Write to file
const outputPath = 'import-vendors.sql';
fs.writeFileSync(outputPath, sql);

console.log(`✅ Generated ${outputPath}`);
console.log(`📊 Total vendors: ${vendors.length}`);
console.log('\n📋 Sample vendors:');
vendors.slice(0, 5).forEach((vendor, index) => {
  const code = `VENDOR-IMPORT-${String(index + 1).padStart(3, '0')}`;
  console.log(`  ${code}: ${vendor.name}${vendor.contact ? ` (${vendor.contact})` : ''}`);
});

if (vendors.length > 5) {
  console.log(`  ... and ${vendors.length - 5} more vendors`);
}

console.log(`\n📂 File saved to: ${process.cwd()}/${outputPath}`);
console.log(`\n💡 Run this SQL in your database when it\'s ready:`);
console.log(`   > mysql -u root erp_manufacturing < ${outputPath}`);
