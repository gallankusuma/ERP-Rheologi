const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const csvFilePath = 'c:\\Users\\GK\\Documents\\vendor.csv';

// Database config
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'erp_manufacturing',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

async function parseCSV(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.split('\n').filter(line => line.trim());
  
  const vendors = new Map(); // Use Map to track unique vendors
  
  // Skip header (first line)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Parse CSV line (handle quoted fields)
    const fields = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim().replace(/^'|'$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim().replace(/^'|'$/g, ''));
    
    // Extract vendor name (column 5 = index 4) and phone (column 6 = index 5)
    const vendorName = fields[4]?.trim();
    const phone = fields[5]?.trim();
    
    if (vendorName && vendorName.length > 0) {
      // Use vendor name as key to ensure uniqueness
      if (!vendors.has(vendorName)) {
        vendors.set(vendorName, {
          name: vendorName,
          contact: phone || null
        });
      }
    }
  }
  
  return Array.from(vendors.values());
}

async function generateVendorCode(connection, baseCode = 'VENDOR-IMPORT') {
  // Find max existing code like VENDOR-IMPORT-001, VENDOR-IMPORT-002, etc
  const [rows] = await connection.query(
    `SELECT MAX(CAST(SUBSTRING(code, ${baseCode.length + 2}) AS UNSIGNED)) AS max_no
     FROM vendors
     WHERE code LIKE ?`,
    [`${baseCode}-%`]
  );
  
  const nextNum = (rows[0]?.max_no || 0) + 1;
  return `${baseCode}-${String(nextNum).padStart(3, '0')}`;
}

async function importVendors() {
  let connection;
  
  try {
    console.log('📖 Reading CSV file...');
    const vendors = await parseCSV(csvFilePath);
    console.log(`✅ Found ${vendors.length} unique vendors`);
    
    console.log('\n🔗 Connecting to database...');
    const pool = mysql.createPool(dbConfig);
    connection = await pool.getConnection();
    console.log('✅ Connected to database');
    
    console.log('\n💾 Inserting vendors...');
    let inserted = 0;
    let duplicates = 0;
    
    for (const vendor of vendors) {
      const code = await generateVendorCode(connection, 'VENDOR-IMPORT');
      
      try {
        const [result] = await connection.query(
          `INSERT INTO vendors (code, name, contact, is_active, created_at)
           VALUES (?, ?, ?, 1, NOW())`,
          [code, vendor.name, vendor.contact]
        );
        
        if (result.affectedRows > 0) {
          inserted++;
          console.log(`  ✅ ${code} - ${vendor.name}`);
        }
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          duplicates++;
          console.log(`  ⚠️  DUPLICATE - ${vendor.name}`);
        } else {
          console.error(`  ❌ ERROR - ${vendor.name}: ${error.message}`);
        }
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`  ✅ Inserted: ${inserted}`);
    console.log(`  ⚠️  Duplicates: ${duplicates}`);
    console.log(`  📦 Total vendors in file: ${vendors.length}`);
    
    // Verify in database
    const [countResult] = await connection.query(
      `SELECT COUNT(*) as total FROM vendors WHERE code LIKE 'VENDOR-IMPORT-%'`
    );
    console.log(`  🗂️  Total VENDOR-IMPORT records in DB: ${countResult[0].total}`);
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run import
importVendors().then(() => {
  console.log('\n✨ Import completed!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
