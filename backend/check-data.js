const mysql = require('mysql2/promise');

async function checkData() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing',
  });

  try {
    const connection = await pool.getConnection();
    
    console.log('=== CHECKING SYSTEM DATA ===\n');

    // Check vendors
    const [vendors] = await connection.execute('SELECT COUNT(*) as count FROM vendors');
    console.log(`✓ Vendors: ${vendors[0].count}`);
    
    // Check products
    const [products] = await connection.execute('SELECT COUNT(*) as count FROM products');
    console.log(`✓ Products: ${products[0].count}`);

    // Check users
    const [users] = await connection.execute('SELECT COUNT(*) as count FROM users');
    console.log(`✓ Users: ${users[0].count}`);

    // Check purchase_requests
    const [prs] = await connection.execute('SELECT COUNT(*) as count FROM purchase_requests');
    console.log(`✓ Purchase Requests: ${prs[0].count}`);

    // Show sample data
    console.log('\n=== SAMPLE DATA ===\n');

    // Show vendors
    const [vendorList] = await connection.execute('SELECT id, code, name, supply FROM vendors LIMIT 3');
    console.log('Vendors:');
    vendorList.forEach(v => console.log(`  - ${v.name} (${v.code}) | Supply: ${v.supply}`));

    // Show products
    const [productList] = await connection.execute('SELECT id, sku, name FROM products LIMIT 3');
    console.log('\nProducts:');
    productList.forEach(p => console.log(`  - ${p.name} (${p.sku})`));

    // Show users
    const [userList] = await connection.execute('SELECT id, email, user_level FROM users LIMIT 3');
    console.log('\nUsers:');
    userList.forEach(u => console.log(`  - ${u.email} (Level: ${u.user_level})`));

    // Check if we need to add products
    if (products[0].count === 0) {
      console.log('\n⚠️ No products found. Adding test products...');
      
      const testProducts = [
        ['SKU001', 'Cat Duco Merah', 'raw_material', 'kg'],
        ['SKU002', 'Thinner', 'raw_material', 'L'],
        ['SKU003', 'Packaging Box', 'packaging', 'box'],
      ];

      for (const [sku, name, type, unit] of testProducts) {
        await connection.execute(
          'INSERT INTO products (sku, name, product_type, category, unit_of_measure) VALUES (?, ?, ?, ?, ?)',
          [sku, name, type, 'General', unit]
        );
        console.log(`  ✓ Added: ${name}`);
      }
    }

    connection.release();
    pool.end();

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkData();
