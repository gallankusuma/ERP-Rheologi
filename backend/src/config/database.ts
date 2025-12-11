import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcrypt';

const dbPath = path.join(__dirname, '..', '..', 'erp.db');

// Initialize database
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
export function initializeDatabase() {
  // Departments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      head_user_id INTEGER,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (head_user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Roles/Positions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      level INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Users table (extended with department & role)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      department_id INTEGER,
      role_id INTEGER,
      user_level INTEGER DEFAULT 1,
      phone TEXT,
      address TEXT,
      is_active INTEGER DEFAULT 1,
      last_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
    )
  `);

  // Permissions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      module TEXT,
      action TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Role Permissions (mapping)
  db.exec(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER NOT NULL,
      permission_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (role_id, permission_id),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    )
  `);

  // Products table
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      unit_of_measure TEXT,
      category TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Categories table
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Product Types table
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Bill of Materials (BOM) table
  db.exec(`
    CREATE TABLE IF NOT EXISTS bom (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      component_product_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (component_product_id) REFERENCES products(id)
    )
  `);

  // Work Orders table
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'normal',
      scheduled_start DATETIME,
      scheduled_end DATETIME,
      actual_start DATETIME,
      actual_end DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  // Inventory table
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      quantity_on_hand REAL DEFAULT 0,
      quantity_reserved REAL DEFAULT 0,
      quantity_available REAL DEFAULT 0,
      location TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  // Inventory Transactions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inventory_id INTEGER NOT NULL,
      transaction_type TEXT NOT NULL,
      quantity REAL NOT NULL,
      reference_type TEXT,
      reference_id INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE
    )
  `);

  // Warehouses
  db.exec(`
    CREATE TABLE IF NOT EXISTS warehouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Warehouse locations (Rack/Row/Bin)
  db.exec(`
    CREATE TABLE IF NOT EXISTS warehouse_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      warehouse_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(warehouse_id, code),
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE
    )
  `);

  // Batches (for traceability)
  db.exec(`
    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_number TEXT UNIQUE NOT NULL,
      product_id INTEGER NOT NULL,
      work_order_id INTEGER,
      quantity REAL DEFAULT 0,
      uom TEXT,
      mfg_date DATETIME,
      exp_date DATETIME,
      location_id INTEGER,
      status TEXT DEFAULT 'open',
      qc_status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
      FOREIGN KEY (location_id) REFERENCES warehouse_locations(id)
    )
  `);

  // Stock movements (supports batch/lot and FEFO/FIFO reference)
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      warehouse_id INTEGER NOT NULL,
      location_id INTEGER,
      batch_id INTEGER,
      movement_type TEXT NOT NULL,
      quantity REAL NOT NULL,
      uom TEXT,
      reference_type TEXT,
      reference_id INTEGER,
      notes TEXT,
      moved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
      FOREIGN KEY (location_id) REFERENCES warehouse_locations(id),
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    )
  `);

  // Vendors
  db.exec(`
    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      contact TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Purchase Requests (PR)
  db.exec(`
    CREATE TABLE IF NOT EXISTS purchase_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pr_number TEXT UNIQUE NOT NULL,
      requester_id INTEGER,
      status TEXT DEFAULT 'draft',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (requester_id) REFERENCES users(id)
    )
  `);

  // Purchase Orders (PO)
  db.exec(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_number TEXT UNIQUE NOT NULL,
      vendor_id INTEGER NOT NULL,
      pr_id INTEGER,
      status TEXT DEFAULT 'draft',
      expected_date DATETIME,
      currency TEXT DEFAULT 'IDR',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id),
      FOREIGN KEY (pr_id) REFERENCES purchase_requests(id)
    )
  `);

  // Purchase Order Items
  db.exec(`
    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      uom TEXT,
      unit_price REAL,
      currency TEXT DEFAULT 'IDR',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  // Goods Receipts (linked to PO)
  db.exec(`
    CREATE TABLE IF NOT EXISTS goods_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gr_number TEXT UNIQUE NOT NULL,
      po_id INTEGER,
      warehouse_id INTEGER,
      received_by INTEGER,
      status TEXT DEFAULT 'draft',
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id),
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
      FOREIGN KEY (received_by) REFERENCES users(id)
    )
  `);

  // Customers
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      contact TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Sales Orders (SO)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      so_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER NOT NULL,
      status TEXT DEFAULT 'draft',
      expected_ship_date DATETIME,
      currency TEXT DEFAULT 'IDR',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `);

  // Sales Order Items
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      so_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      uom TEXT,
      unit_price REAL,
      currency TEXT DEFAULT 'IDR',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (so_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  // Deliveries (DO)
  db.exec(`
    CREATE TABLE IF NOT EXISTS deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      do_number TEXT UNIQUE NOT NULL,
      so_id INTEGER,
      warehouse_id INTEGER,
      status TEXT DEFAULT 'draft',
      shipped_at DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (so_id) REFERENCES sales_orders(id),
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
    )
  `);

  // Invoices (linked to SO/DO)
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      so_id INTEGER,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'IDR',
      status TEXT DEFAULT 'unpaid',
      issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      due_at DATETIME,
      notes TEXT,
      FOREIGN KEY (so_id) REFERENCES sales_orders(id)
    )
  `);

  // QC Tests (master)
  db.exec(`
    CREATE TABLE IF NOT EXISTS qc_tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // QC Results (per batch)
  db.exec(`
    CREATE TABLE IF NOT EXISTS qc_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      test_id INTEGER NOT NULL,
      result TEXT,
      status TEXT DEFAULT 'pending',
      tested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      tester_id INTEGER,
      notes TEXT,
      FOREIGN KEY (batch_id) REFERENCES batches(id),
      FOREIGN KEY (test_id) REFERENCES qc_tests(id),
      FOREIGN KEY (tester_id) REFERENCES users(id)
    )
  `);

  // Roles
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Permissions
  db.exec(`
    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Role-Permission mapping
  db.exec(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER NOT NULL,
      permission_id INTEGER NOT NULL,
      PRIMARY KEY (role_id, permission_id),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    )
  `);

  // User roles mapping
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, role_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    )
  `);

  // Approval rules
  db.exec(`
    CREATE TABLE IF NOT EXISTS approval_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      module TEXT NOT NULL,
      min_amount REAL,
      max_amount REAL,
      approver_role_id INTEGER,
      sequence INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (approver_role_id) REFERENCES roles(id)
    )
  `);

  // Audit log
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      entity TEXT,
      entity_id INTEGER,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  seedDefaults();
}

function seedDefaults() {
  // Seed departments
  const deptCount = db.prepare('SELECT COUNT(*) as cnt FROM departments').get() as { cnt: number };
  if (!deptCount || deptCount.cnt === 0) {
    const departments = [
      { code: 'RD', name: 'Research & Development', description: 'R&D and innovation' },
      { code: 'PROD', name: 'Production', description: 'Manufacturing and production' },
      { code: 'QA', name: 'Quality Assurance', description: 'Quality control and testing' },
      { code: 'PROC', name: 'Procurement', description: 'Purchasing and supplier management' },
      { code: 'FIN', name: 'Finance', description: 'Financial management' },
      { code: 'SAL', name: 'Sales', description: 'Sales and customer management' },
      { code: 'HR', name: 'Human Resources', description: 'HR and administration' },
      { code: 'OPS', name: 'Operations', description: 'General operations' },
    ];
    const stmt = db.prepare('INSERT INTO departments (code, name, description, active) VALUES (?, ?, ?, 1)');
    const insertMany = db.transaction((rows: typeof departments) => {
      for (const d of rows) stmt.run(d.code, d.name, d.description);
    });
    insertMany(departments);
  }

  // Seed roles
  const roleCount = db.prepare('SELECT COUNT(*) as cnt FROM roles').get() as { cnt: number };
  if (!roleCount || roleCount.cnt === 0) {
    const roles = [
      { code: 'ADMIN', name: 'Administrator', description: 'System administrator', level: 5 },
      { code: 'DIR', name: 'Director', description: 'Department director', level: 4 },
      { code: 'MGR', name: 'Manager', description: 'Department manager', level: 3 },
      { code: 'SUP', name: 'Supervisor', description: 'Team supervisor', level: 2 },
      { code: 'OFF', name: 'Officer', description: 'Staff officer', level: 1 },
      { code: 'OPR', name: 'Operator', description: 'Machine/Process operator', level: 0 },
    ];
    const stmt = db.prepare('INSERT INTO roles (code, name, description, level, active) VALUES (?, ?, ?, ?, 1)');
    const insertMany = db.transaction((rows: typeof roles) => {
      for (const r of rows) stmt.run(r.code, r.name, r.description, r.level);
    });
    insertMany(roles);
  }

  // Seed permissions
  const permCount = db.prepare('SELECT COUNT(*) as cnt FROM permissions').get() as { cnt: number };
  if (!permCount || permCount.cnt === 0) {
    const permissions = [
      { code: 'user_create', name: 'Create User', module: 'users', action: 'create' },
      { code: 'user_read', name: 'View Users', module: 'users', action: 'read' },
      { code: 'user_update', name: 'Update User', module: 'users', action: 'update' },
      { code: 'user_delete', name: 'Delete User', module: 'users', action: 'delete' },
      { code: 'product_create', name: 'Create Product', module: 'products', action: 'create' },
      { code: 'product_read', name: 'View Products', module: 'products', action: 'read' },
      { code: 'product_update', name: 'Update Product', module: 'products', action: 'update' },
      { code: 'product_delete', name: 'Delete Product', module: 'products', action: 'delete' },
      { code: 'inventory_manage', name: 'Manage Inventory', module: 'inventory', action: 'manage' },
      { code: 'procurement_manage', name: 'Manage Procurement', module: 'procurement', action: 'manage' },
      { code: 'sales_manage', name: 'Manage Sales', module: 'sales', action: 'manage' },
      { code: 'quality_manage', name: 'Manage Quality', module: 'quality', action: 'manage' },
      { code: 'report_view', name: 'View Reports', module: 'reports', action: 'read' },
    ];
    const stmt = db.prepare('INSERT INTO permissions (code, name, module, action) VALUES (?, ?, ?, ?)');
    const insertMany = db.transaction((rows: typeof permissions) => {
      for (const p of rows) stmt.run(p.code, p.name, p.module, p.action);
    });
    insertMany(permissions);
  }

  // Map admin role to all permissions
  const adminRole = db.prepare('SELECT id FROM roles WHERE code = ?').get('ADMIN') as { id: number } | undefined;
  if (adminRole) {
    const existingPermCount = db.prepare('SELECT COUNT(*) as cnt FROM role_permissions WHERE role_id = ?').get(adminRole.id) as { cnt: number };
    if (existingPermCount.cnt === 0) {
      const permIds = db.prepare('SELECT id FROM permissions').all() as { id: number }[];
      const stmt = db.prepare('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
      const bindAll = db.transaction(() => {
        for (const p of permIds) stmt.run(adminRole.id, p.id);
      });
      bindAll();
    }
  }

  // Seed default admin user with department & role
  const adminUser = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@example.com');
  if (!adminUser) {
    const hashed = bcrypt.hashSync('Admin123!', 10);
    const adminDept = db.prepare('SELECT id FROM departments WHERE code = ?').get('HR') as { id: number } | undefined;
    const adminRole2 = db.prepare('SELECT id FROM roles WHERE code = ?').get('ADMIN') as { id: number } | undefined;
    
    const result = db.prepare(
      'INSERT INTO users (email, password, name, department_id, role_id, user_level, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)'
    ).run('admin@example.com', hashed, 'System Administrator', adminDept?.id || null, adminRole2?.id || null, 5);
  }

  // Seed sample users per department
  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
  if (userCount.cnt <= 1) {
    const departments = db.prepare('SELECT id, code FROM departments').all() as { id: number; code: string }[];
    const roles = db.prepare('SELECT id, code FROM roles WHERE code IN (?, ?, ?)').all('DIR', 'MGR', 'OFF') as { id: number; code: string }[];
    
    const sampleUsers = [
      { email: 'director.prod@company.com', name: 'John Director', dept: 'PROD', role: 'DIR', level: 4 },
      { email: 'manager.prod@company.com', name: 'Jane Manager', dept: 'PROD', role: 'MGR', level: 3 },
      { email: 'officer.qa@company.com', name: 'Mike Officer', dept: 'QA', role: 'OFF', level: 1 },
      { email: 'manager.sales@company.com', name: 'Sarah Sales', dept: 'SAL', role: 'MGR', level: 3 },
      { email: 'officer.proc@company.com', name: 'David Procurement', dept: 'PROC', role: 'OFF', level: 1 },
    ];

    const stmt = db.prepare(
      'INSERT INTO users (email, password, name, department_id, role_id, user_level, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)'
    );
    const insertMany = db.transaction((users: typeof sampleUsers) => {
      for (const user of users) {
        const dept = departments.find(d => d.code === user.dept);
        const role = roles.find(r => r.code === user.role);
        const hashed = bcrypt.hashSync('Password123!', 10);
        stmt.run(user.email, hashed, user.name, dept?.id || null, role?.id || null, user.level);
      }
    });
    insertMany(sampleUsers);
  }

  // Seed warehouses
  const whCount = db.prepare('SELECT COUNT(*) as cnt FROM warehouses').get() as { cnt: number };
  if (!whCount || whCount.cnt === 0) {
    const warehouses = [
      { code: 'WH-A', name: 'Central Warehouse', address: 'Main Site - Raw & Packaging' },
      { code: 'WH-B', name: 'Finished Goods Warehouse', address: 'Dispatch Area - FG' },
    ];
    const stmt = db.prepare('INSERT INTO warehouses (code, name, address) VALUES (?, ?, ?)');
    const insertMany = db.transaction((rows: typeof warehouses) => {
      for (const w of rows) stmt.run(w.code, w.name, w.address);
    });
    insertMany(warehouses);
  }

  // Seed warehouse locations
  const locCount = db.prepare('SELECT COUNT(*) as cnt FROM warehouse_locations').get() as { cnt: number };
  if (!locCount || locCount.cnt === 0) {
    const whA = db.prepare('SELECT id FROM warehouses WHERE code = ?').get('WH-A') as { id: number } | undefined;
    const whB = db.prepare('SELECT id FROM warehouses WHERE code = ?').get('WH-B') as { id: number } | undefined;
    if (whA && whB) {
      const locations = [
        { warehouse_id: whA.id, code: 'A-RA-01', description: 'Raw Material - Bulk' },
        { warehouse_id: whA.id, code: 'A-PK-01', description: 'Packaging' },
        { warehouse_id: whA.id, code: 'A-QC-01', description: 'QC Hold' },
        { warehouse_id: whB.id, code: 'B-FG-01', description: 'Finished Goods - Pallet' },
        { warehouse_id: whB.id, code: 'B-FG-02', description: 'Finished Goods - Reserve' },
      ];
      const stmt = db.prepare(
        'INSERT INTO warehouse_locations (warehouse_id, code, description) VALUES (?, ?, ?)',
      );
      const insertMany = db.transaction((rows: typeof locations) => {
        for (const l of rows) stmt.run(l.warehouse_id, l.code, l.description);
      });
      insertMany(locations);
    }
  }

  // Seed products
  const prodCount = db.prepare('SELECT COUNT(*) as cnt FROM products').get() as { cnt: number };
  if (!prodCount || prodCount.cnt === 0) {
    const products = [
      { sku: 'RM-GLUCOSE', name: 'Glucose Syrup', uom: 'KG', category: 'Ingredients' },
      { sku: 'RM-ETHANOL', name: 'Ethanol 96%', uom: 'L', category: 'Ingredients' },
      { sku: 'PK-BOTTLE500', name: 'Bottle 500ml', uom: 'PCS', category: 'Packaging' },
      { sku: 'FG-ENERGY-500', name: 'Energy Drink 500ml', uom: 'PCS', category: 'Finished Goods' },
    ];
    const stmt = db.prepare(
      'INSERT INTO products (sku, name, unit_of_measure, category) VALUES (?, ?, ?, ?)',
    );
    const insertMany = db.transaction((rows: typeof products) => {
      for (const p of rows) stmt.run(p.sku, p.name, p.uom, p.category);
    });
    insertMany(products);
  }

  // Seed categories
  const catCount = db.prepare('SELECT COUNT(*) as cnt FROM categories').get() as { cnt: number };
  if (!catCount || catCount.cnt === 0) {
    const categories = [
      { name: 'Raw Materials', description: 'Basic raw materials and ingredients' },
      { name: 'Ingredients', description: 'Food and beverage ingredients' },
      { name: 'Packaging', description: 'Packaging materials and supplies' },
      { name: 'Finished Goods', description: 'Ready-to-sell finished products' },
      { name: 'Semi-Finished', description: 'Work in progress or sub-assemblies' },
    ];
    const stmt = db.prepare('INSERT INTO categories (name, description, active) VALUES (?, ?, 1)');
    const insertMany = db.transaction((rows: typeof categories) => {
      for (const c of rows) stmt.run(c.name, c.description);
    });
    insertMany(categories);
  }

  // Seed product types
  const typeCount = db.prepare('SELECT COUNT(*) as cnt FROM product_types').get() as { cnt: number };
  if (!typeCount || typeCount.cnt === 0) {
    const types = [
      { code: 'RM', name: 'Raw Material', description: 'Raw materials and ingredients' },
      { code: 'FG', name: 'Finished Goods', description: 'Ready-to-sell finished products' },
      { code: 'PK', name: 'Packaging', description: 'Packaging materials and containers' },
      { code: 'SF', name: 'Semi-Finished', description: 'Work in progress or sub-assemblies' },
    ];
    const stmt = db.prepare('INSERT INTO product_types (code, name, description, active) VALUES (?, ?, ?, 1)');
    const insertMany = db.transaction((rows: typeof types) => {
      for (const t of rows) stmt.run(t.code, t.name, t.description);
    });
    insertMany(types);
  }

  // Seed batches
  const batchCount = db.prepare('SELECT COUNT(*) as cnt FROM batches').get() as { cnt: number };
  if (!batchCount || batchCount.cnt === 0) {
    const products = db.prepare('SELECT sku, id FROM products').all() as { sku: string; id: number }[];
    const whLocA = db.prepare('SELECT id, warehouse_id FROM warehouse_locations WHERE code = ?').get('A-RA-01') as
      | { id: number; warehouse_id: number }
      | undefined;
    const whLocB = db.prepare('SELECT id, warehouse_id FROM warehouse_locations WHERE code = ?').get('B-FG-01') as
      | { id: number; warehouse_id: number }
      | undefined;
    const findProd = (sku: string) => products.find((p) => p.sku === sku)?.id;
    const batches = [
      {
        batch_number: 'RM-GLU-2401',
        product_id: findProd('RM-GLUCOSE'),
        quantity: 500,
        uom: 'KG',
        mfg_date: '2024-11-15',
        exp_date: '2025-11-15',
        status: 'released',
        qc_status: 'passed',
        location_id: whLocA?.id,
      },
      {
        batch_number: 'RM-ETH-2402',
        product_id: findProd('RM-ETHANOL'),
        quantity: 800,
        uom: 'L',
        mfg_date: '2024-11-20',
        exp_date: '2025-05-20',
        status: 'released',
        qc_status: 'passed',
        location_id: whLocA?.id,
      },
      {
        batch_number: 'FG-ENE-500-2403',
        product_id: findProd('FG-ENERGY-500'),
        quantity: 1200,
        uom: 'PCS',
        mfg_date: '2024-12-01',
        exp_date: '2025-12-01',
        status: 'released',
        qc_status: 'passed',
        location_id: whLocB?.id,
      },
    ].filter((b) => b.product_id !== undefined);

    if (batches.length > 0) {
      const stmt = db.prepare(
        'INSERT INTO batches (batch_number, product_id, quantity, uom, mfg_date, exp_date, status, qc_status, location_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      );
      const insertMany = db.transaction((rows: typeof batches) => {
        for (const b of rows) {
          stmt.run(b.batch_number, b.product_id, b.quantity, b.uom, b.mfg_date, b.exp_date, b.status, b.qc_status, b.location_id || null);
        }
      });
      insertMany(batches);
    }
  }

  // Seed inventory
  const invCount = db.prepare('SELECT COUNT(*) as cnt FROM inventory').get() as { cnt: number };
  if (!invCount || invCount.cnt === 0) {
    const getId = (table: string, where: string, value: string) =>
      db.prepare(`SELECT id FROM ${table} WHERE ${where} = ?`).get(value) as { id: number } | undefined;
    const entries = [
      {
        product_sku: 'RM-GLUCOSE',
        batch_number: 'RM-GLU-2401',
        location_code: 'A-RA-01',
        quantity: 500,
        minimum_quantity: 200,
      },
      {
        product_sku: 'RM-ETHANOL',
        batch_number: 'RM-ETH-2402',
        location_code: 'A-RA-01',
        quantity: 800,
        minimum_quantity: 300,
      },
      {
        product_sku: 'FG-ENERGY-500',
        batch_number: 'FG-ENE-500-2403',
        location_code: 'B-FG-01',
        quantity: 1200,
        minimum_quantity: 300,
      },
    ];

    const stmt = db.prepare(
      'INSERT INTO inventory (product_id, quantity_on_hand, quantity_reserved, quantity_available, location) VALUES (?, ?, ?, ?, ?)',
    );
    const insertMany = db.transaction((rows: typeof entries) => {
      for (const e of rows) {
        const product = getId('products', 'sku', e.product_sku);
        if (product) {
          const quantityOnHand = e.quantity;
          const quantityReserved = 0;
          const quantityAvailable = quantityOnHand - quantityReserved;
          stmt.run(product.id, quantityOnHand, quantityReserved, quantityAvailable, e.location_code);
        }
      }
    });
    insertMany(entries);
  }

  // Seed stock movements
  const mvCount = db.prepare('SELECT COUNT(*) as cnt FROM stock_movements').get() as { cnt: number };
  if (!mvCount || mvCount.cnt === 0) {
    const movements = [
      {
        product_sku: 'RM-GLUCOSE',
        batch_number: 'RM-GLU-2401',
        location_code: 'A-RA-01',
        movement_type: 'IN',
        quantity: 500,
        uom: 'KG',
        reference_type: 'GRN',
      },
      {
        product_sku: 'RM-ETHANOL',
        batch_number: 'RM-ETH-2402',
        location_code: 'A-RA-01',
        movement_type: 'IN',
        quantity: 800,
        uom: 'L',
        reference_type: 'GRN',
      },
      {
        product_sku: 'FG-ENERGY-500',
        batch_number: 'FG-ENE-500-2403',
        location_code: 'B-FG-01',
        movement_type: 'IN',
        quantity: 1200,
        uom: 'PCS',
        reference_type: 'Production',
      },
    ];

    const stmt = db.prepare(
      'INSERT INTO stock_movements (product_id, warehouse_id, location_id, batch_id, movement_type, quantity, uom, reference_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    );
    const insertMany = db.transaction((rows: typeof movements) => {
      for (const m of rows) {
        const product = db.prepare('SELECT id FROM products WHERE sku = ?').get(m.product_sku) as { id: number } | undefined;
        const batch = db.prepare('SELECT id FROM batches WHERE batch_number = ?').get(m.batch_number) as { id: number } | undefined;
        const loc = db
          .prepare('SELECT id, warehouse_id FROM warehouse_locations WHERE code = ?')
          .get(m.location_code) as { id: number; warehouse_id: number } | undefined;
        if (product && batch && loc) {
          stmt.run(product.id, loc.warehouse_id, loc.id, batch.id, m.movement_type, m.quantity, m.uom, m.reference_type);
        }
      }
    });
    insertMany(movements);
  }
}

console.log('✅ Database initialized successfully');

export default db;