const mysql = require('mysql2/promise');

async function testVendorPrice() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'erp_manufacturing'
  });

  try {
    // First, check existing vendors
    const [vendors] = await connection.execute('SELECT id, name FROM vendors LIMIT 5');
    console.log('Vendors:', vendors);

    // Check existing products
    const [products] = await connection.execute('SELECT id, name FROM products LIMIT 5');
    console.log('Products:', products);

    // Test insert
    const vendorId = vendors[0]?.id || 1;
    const productId = products[0]?.id || 1;
    
    console.log('\nAttempting to insert vendor price...');
    console.log('vendor_id:', vendorId);
    console.log('product_id:', productId);
    
    const [result] = await connection.execute(`
      INSERT INTO vendor_prices 
      (vendor_id, product_id, price, currency, effective_date, valid_until, min_order_qty, lead_time_days, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      vendorId,
      productId,
      25000,
      'IDR',
      '2026-02-10',
      '2026-02-28',
      0,
      0,
      null,
      1
    ]);
    
    console.log('✓ Insert successful, ID:', result.insertId);
    
    // Verify
    const [prices] = await connection.execute('SELECT * FROM vendor_prices WHERE id = ?', [result.insertId]);
    console.log('Inserted record:', prices[0]);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  } finally {
    await connection.end();
  }
}

testVendorPrice();
