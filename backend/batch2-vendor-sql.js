const fs = require('fs');
const csvFile = 'c:\\Users\\GK\\Documents\\vendor.csv';
const content = fs.readFileSync(csvFile, 'utf-8');
const lines = content.split('\n').filter(l => l.trim());
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
  
  const name = fields[4]?.trim();
  const phone = fields[5]?.trim();
  
  if (name && name.length > 0 && !vendors.has(name)) {
    vendors.set(name, phone && phone.length > 0 ? phone : null);
  }
}

let sql = '-- Vendor Import from CSV\n-- Total new vendors: ' + vendors.size + '\n\n';
let idx = 55;
for (const [name, phone] of vendors) {
  const code = 'VENDOR-IMPORT-' + String(idx).padStart(3, '0');
  const n = name.replace(/'/g, "''");
  const p = phone ? "'" + phone.replace(/'/g, "''") + "'" : 'NULL';
  sql += "INSERT INTO vendors (code, name, phone, is_active, created_at) VALUES ('" + code + "', '" + n + "', " + p + ", 1, NOW());\n";
  idx++;
}

fs.writeFileSync('import-vendors-batch2.sql', sql);
console.log('✅ Generated import-vendors-batch2.sql with ' + vendors.size + ' vendors');
