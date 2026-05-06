const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new Database(dbPath);

console.log('🌱 Seeding simulation data...');

try {
  // Check if products exist
  const existingProducts = db.prepare('SELECT COUNT(*) as count FROM products').get();
  console.log(`📦 Existing products: ${existingProducts.count}`);

  // Get item types and product types
  const invItemType = db.prepare('SELECT id FROM item_types WHERE code = ?').get('INV');
  const rmProductType = db.prepare('SELECT id FROM product_types WHERE code = ?').get('RM');
  const fgProductType = db.prepare('SELECT id FROM product_types WHERE code = ?').get('FG');
  
  // Seed required products if they don't exist
  const seedProduct = db.prepare(`
    INSERT OR IGNORE INTO products (sku, name, product_type, description, unit_of_measure, item_type_id, product_type_id, standard_cost, is_active, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'active')
  `);

  const products = [
    ['RM-GLUCOSE', 'Glucose Powder', 'raw_material', 'Raw material for biochemical production', 'KG', invItemType.id, rmProductType.id, 50.00],
    ['RM-ETHANOL', 'Ethanol 95%', 'raw_material', 'Industrial ethanol for production', 'L', invItemType.id, rmProductType.id, 30.00],
    ['FG-ENERGY-500', 'Energy Drink 500ml', 'finished_goods', 'Ready to ship energy drink', 'PCS', invItemType.id, fgProductType.id, 15.00],
  ];

  products.forEach(p => {
    const result = seedProduct.run(...p);
    if (result.changes > 0) {
      console.log(`✅ Created product: ${p[1]}`);
    } else {
      console.log(`⏭️  Product already exists: ${p[1]}`);
    }
  });

  // Check warehouses
  const existingWarehouses = db.prepare('SELECT * FROM warehouses').all();
  console.log(`🏭 Existing warehouses: ${existingWarehouses.length}`);

  let warehouseA, warehouseB;

  if (existingWarehouses.length === 0) {
    // Create warehouses
    const seedWarehouse = db.prepare(`
      INSERT INTO warehouses (code, name, address)
      VALUES (?, ?, ?)
    `);
    
    const whA = seedWarehouse.run('WH-A', 'Warehouse A - Raw Materials', 'Building A, Zone 1');
    const whB = seedWarehouse.run('WH-B', 'Warehouse B - Finished Goods', 'Building B, Zone 2');
    
    warehouseA = whA.lastInsertRowid;
    warehouseB = whB.lastInsertRowid;
    
    console.log(`✅ Created Warehouse A (ID: ${warehouseA})`);
    console.log(`✅ Created Warehouse B (ID: ${warehouseB})`);
  } else {
    warehouseA = existingWarehouses[0].id;
    warehouseB = existingWarehouses.length > 1 ? existingWarehouses[1].id : warehouseA;
    console.log(`⏭️  Using existing warehouse A (ID: ${warehouseA})`);
    console.log(`⏭️  Using existing warehouse B (ID: ${warehouseB})`);
  }

  // Seed warehouse locations
  const seedLocation = db.prepare(`
    INSERT OR IGNORE INTO warehouse_locations (warehouse_id, location_code, rack, row, bin, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const locations = [
    [warehouseA, 'A-RA-01', 'A', 'RA', '01', 'Raw materials rack A row 01'],
    [warehouseB, 'B-FG-01', 'B', 'FG', '01', 'Finished goods rack B row 01'],
  ];

  locations.forEach(loc => {
    const result = seedLocation.run(...loc);
    if (result.changes > 0) {
      console.log(`✅ Created location: ${loc[1]}`);
    } else {
      console.log(`⏭️  Location already exists: ${loc[1]}`);
    }
  });

  // Seed batches
  const seedBatch = db.prepare(`
    INSERT OR IGNORE INTO batches (batch_number, product_id, quantity, mfg_date, exp_date, status, qc_status)
    VALUES (?, (SELECT id FROM products WHERE sku = ?), ?, ?, ?, 'active', 'passed')
  `);

  const today = new Date();
  const mfgDate = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0];
  const expDate = new Date(today.getFullYear() + 1, today.getMonth(), 1).toISOString().split('T')[0];

  const batches = [
    ['RM-GLU-2401', 'RM-GLUCOSE', 500, mfgDate, expDate],
    ['RM-ETH-2402', 'RM-ETHANOL', 300, mfgDate, expDate],
    ['FG-ENE-500-2403', 'FG-ENERGY-500', 1000, mfgDate, expDate],
  ];

  batches.forEach(b => {
    const result = seedBatch.run(...b);
    if (result.changes > 0) {
      console.log(`✅ Created batch: ${b[0]}`);
    } else {
      console.log(`⏭️  Batch already exists: ${b[0]}`);
    }
  });

  // Create initial inventory for simulation products
  const seedInventory = db.prepare(`
    INSERT OR IGNORE INTO inventory (product_id, warehouse_id, quantity)
    SELECT id, ?, 200 FROM products WHERE sku IN ('RM-GLUCOSE', 'RM-ETHANOL', 'FG-ENERGY-500')
  `);

  const invResult = seedInventory.run(warehouseA);
  if (invResult.changes > 0) {
    console.log(`✅ Created initial inventory (${invResult.changes} records)`);
  } else {
    console.log(`⏭️  Inventory already exists`);
  }

  console.log('\n✅ Simulation data seeding completed!');
  console.log('🚀 You can now run: POST /api/simulate/run');

} catch (error) {
  console.error('❌ Error seeding data:', error);
  process.exit(1);
} finally {
  db.close();
}
