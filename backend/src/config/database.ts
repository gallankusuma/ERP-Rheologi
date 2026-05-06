import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// MySQL Connection Pool Configuration
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'erp_manufacturing',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

const activeDatabaseName = process.env.DB_NAME || 'erp_manufacturing';

// MySQL 8 doesn't support `ADD COLUMN IF NOT EXISTS` (MariaDB extension).
// Fallback: detect that syntax error, look up the column in INFORMATION_SCHEMA,
// and re-issue the ALTER without `IF NOT EXISTS` only if the column is missing.
const tryFallbackAddColumn = async (connection: any, sql: string): Promise<boolean> => {
  const m = sql.match(/^\s*ALTER\s+TABLE\s+`?(\w+)`?\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+`?(\w+)`?\s+([\s\S]+)$/i);
  if (!m) return false;
  const [, table, column, definition] = m;
  try {
    const [rows]: any = await connection.execute(
      `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [activeDatabaseName, table, column]
    );
    const exists = Array.isArray(rows) && rows[0] && Number(rows[0].c) > 0;
    if (exists) return true;
    await connection.execute(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    return true;
  } catch (err: any) {
    console.warn('Schema fallback ALTER failed:', table, column, '-', err.message.substring(0, 120));
    return true; // handled (logged) — do not surface original error
  }
};

const execSchemaEnsure = async (connection: any, sql: string) => {
  try {
    await connection.execute(sql);
  } catch (err: any) {
    // MySQL 8 syntax error on `ADD COLUMN IF NOT EXISTS` — try fallback path
    const code = err && (err.code || err.errno);
    if (code === 'ER_PARSE_ERROR' || err.errno === 1064) {
      const handled = await tryFallbackAddColumn(connection, sql);
      if (handled) return;
    }
    console.warn('Schema ensure warning:', err.message.substring(0, 120));
  }
};

const ensureProcurementPaymentSchema = async (connection: any) => {
  const statements = [
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS project_id INT NULL`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approval_status INT NOT NULL DEFAULT 0`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS expected_date DATE NULL`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NULL DEFAULT 'IDR'`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_term VARCHAR(100) NULL`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_term_2 VARCHAR(255) NULL`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS address TEXT NULL`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS type VARCHAR(50) NULL`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS contact_person VARCHAR(100) NULL`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS delivery_to TEXT NULL`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS advance_payment DECIMAL(15,2) NOT NULL DEFAULT 0`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS ppn_percent DECIMAL(5,2) NOT NULL DEFAULT 11`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS po_date DATE NULL`,
    `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS purchase_order_id INT NULL`,
    `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS po_id INT NULL`,
    `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS uom VARCHAR(50) NULL`,
    `ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NULL DEFAULT 'IDR'`,
    `ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS po_schedule_id INT NULL`,
    `ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS invoice_date DATE NULL`,
    `CREATE TABLE IF NOT EXISTS client_projects (
      id INT PRIMARY KEY AUTO_INCREMENT,
      project_number VARCHAR(100) NULL,
      project_name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS fund_requests (
      id INT PRIMARY KEY AUTO_INCREMENT,
      request_number VARCHAR(100) UNIQUE NOT NULL,
      request_date DATE NOT NULL,
      po_id INT NULL,
      po_schedule_id INT NULL,
      vendor_id INT NULL,
      amount DECIMAL(15,2) NOT NULL,
      needed_date DATE NOT NULL,
      purpose TEXT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'draft',
      requester_id INT NULL,
      submitted_at TIMESTAMP NULL,
      approved_by INT NULL,
      approved_at TIMESTAMP NULL,
      rejection_reason TEXT NULL,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_fund_requests_status (status),
      KEY idx_fund_requests_needed_date (needed_date),
      KEY idx_fund_requests_po (po_id),
      KEY idx_fund_requests_schedule (po_schedule_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS approval_requests (
      id INT PRIMARY KEY AUTO_INCREMENT,
      request_number VARCHAR(100) UNIQUE NOT NULL,
      module VARCHAR(100) NOT NULL,
      entity_type VARCHAR(100) NOT NULL,
      entity_id INT NOT NULL,
      requester_id INT NULL,
      current_step INT DEFAULT 1,
      status VARCHAR(50) DEFAULT 'pending',
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP NULL,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_approval_requests_module_status (module, status),
      KEY idx_approval_requests_entity (entity_type, entity_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS purchase_order_payment_schedules (
      id INT PRIMARY KEY AUTO_INCREMENT,
      po_id INT NOT NULL,
      schedule_no INT NOT NULL,
      label VARCHAR(100) NOT NULL,
      trigger_type VARCHAR(50) NOT NULL DEFAULT 'manual',
      percentage DECIMAL(7,2) NOT NULL DEFAULT 0,
      amount DECIMAL(15,2) NOT NULL DEFAULT 0,
      due_date DATE NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'open',
      paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
      ap_id INT NULL,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_po_schedule_no (po_id, schedule_no),
      KEY idx_po_schedule_due_date (due_date),
      KEY idx_po_schedule_status (status),
      CONSTRAINT fk_po_schedule_po FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS fund_request_items (
      id INT PRIMARY KEY AUTO_INCREMENT,
      fund_request_id INT NOT NULL,
      po_id INT NULL,
      po_schedule_id INT NULL,
      vendor_id INT NULL,
      description TEXT NULL,
      amount DECIMAL(15,2) NOT NULL DEFAULT 0,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      approved_by INT NULL,
      approved_at TIMESTAMP NULL,
      rejection_reason TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_fri_fr (fund_request_id),
      KEY idx_fri_po (po_id),
      KEY idx_fri_schedule (po_schedule_id),
      KEY idx_fri_status (status),
      CONSTRAINT fk_fri_fr FOREIGN KEY (fund_request_id) REFERENCES fund_requests(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `ALTER TABLE fund_requests ADD COLUMN IF NOT EXISTS cash_account VARCHAR(255) NULL`,
    `ALTER TABLE fund_requests ADD COLUMN IF NOT EXISTS cash_account_note TEXT NULL`,
    `ALTER TABLE fund_request_items ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'pending'`,
    `ALTER TABLE fund_request_items ADD COLUMN IF NOT EXISTS approved_by INT NULL`,
    `ALTER TABLE fund_request_items ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP NULL`,
    `ALTER TABLE fund_request_items ADD COLUMN IF NOT EXISTS rejection_reason TEXT NULL`,
    `ALTER TABLE fund_request_items ADD COLUMN IF NOT EXISTS ap_id INT NULL`,
    `ALTER TABLE fund_request_items ADD COLUMN IF NOT EXISTS payment_recorded_at TIMESTAMP NULL`,
    `CREATE TABLE IF NOT EXISTS approval_rules (
      id INT PRIMARY KEY AUTO_INCREMENT,
      module VARCHAR(100) NOT NULL,
      name VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_approval_rules_module (module)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS approval_rule_steps (
      id INT PRIMARY KEY AUTO_INCREMENT,
      rule_id INT NOT NULL,
      step_order INT NOT NULL,
      approver_user_id INT NULL,
      approver_role_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_approval_rule_steps_rule (rule_id),
      CONSTRAINT fk_ars_rule FOREIGN KEY (rule_id) REFERENCES approval_rules(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS approval_actions (
      id INT PRIMARY KEY AUTO_INCREMENT,
      request_id INT NOT NULL,
      step_order INT NOT NULL,
      approver_id INT NULL,
      action VARCHAR(50) NOT NULL,
      comments TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_approval_actions_request (request_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS user_level INT NOT NULL DEFAULT 1`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50) NULL`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT NULL`,
  ];

  for (const statement of statements) {
    await execSchemaEnsure(connection, statement);
  }

  await execSchemaEnsure(
    connection,
    `UPDATE purchase_order_items SET po_id = purchase_order_id WHERE po_id IS NULL AND purchase_order_id IS NOT NULL`
  );
  await execSchemaEnsure(
    connection,
    `UPDATE purchase_order_items SET purchase_order_id = po_id WHERE purchase_order_id IS NULL AND po_id IS NOT NULL`
  );
};

// Helper functions for async/await query execution
export const dbQuery = async (sql: string, params: any[] = []): Promise<any> => {
  const connection = await pool.getConnection();
  try {
    const [results] = await connection.execute(sql, params);
    return results;
  } finally {
    connection.release();
  }
};

export const dbGet = async (sql: string, params: any[] = []): Promise<any> => {
  const results = await dbQuery(sql, params);
  return Array.isArray(results) ? results[0] : results;
};

export const dbAll = async (sql: string, params: any[] = []): Promise<any[]> => {
  const results = await dbQuery(sql, params);
  return Array.isArray(results) ? results : [results];
};

export const dbRun = async (sql: string, params: any[] = []): Promise<{ insertId: number; affectedRows: number }> => {
  const connection = await pool.getConnection();
  try {
    const [result] = await connection.execute(sql, params);
    return {
      insertId: (result as any).insertId,
      affectedRows: (result as any).affectedRows,
    };
  } finally {
    connection.release();
  }
};

// Initialize database schema
export async function initializeDatabase() {
  try {
    const connection = await pool.getConnection();
    console.log(`🔗 Connected to MySQL database: ${activeDatabaseName}`);

    // Read and execute schema
    const fs = await import('fs').then(m => m.promises);
    const path = await import('path');
    const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema_mysql.sql');

    try {
      const schema = await fs.readFile(schemaPath, 'utf-8');
      const statements = schema
        .split(';')
        .filter(s => s.trim().length > 0)
        .filter(s => !s.trim().startsWith('--'));

      for (const statement of statements) {
        if (statement.trim().length > 0) {
          try {
            await connection.execute(statement);
          } catch (err: any) {
            // Ignore duplicate key errors from INSERT IGNORE
            if (!err.message.includes('duplicate')) {
              console.warn('Schema execution warning:', err.message.substring(0, 100));
            }
          }
        }
      }

      console.log('✅ Database schema initialized successfully');
    } catch (fileErr) {
      console.log('⚠️ Schema file not found, using existing database');
    }

    await ensureProcurementPaymentSchema(connection);

    connection.release();

    // Seed initial data
    await seedDatabase();

  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
}

// Seed database with default data
async function seedDatabase() {
  try {
    // Insert or ensure admin role exists
    const adminRole = await dbRun(
      'INSERT IGNORE INTO roles (name, description) VALUES (?, ?)',
      ['Admin', 'System Administrator']
    );

    // Create default admin user (admin@erp.local)
    const adminUser = await dbGet(
      'SELECT id FROM users WHERE username = ?',
      ['admin']
    );

    if (!adminUser) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await dbRun(
        `INSERT INTO users (username, email, password, full_name, role_id, is_active)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['admin', 'admin@erp.local', hashedPassword, 'System Administrator', adminRole.insertId || 1, 1]
      );
      console.log('✅ Default admin user created (username: admin, password: admin123)');
    }

    // Create super admin user (master@admin.com) - Hardcoded
    const masterUser = await dbGet(
      'SELECT id FROM users WHERE email = ?',
      ['master@admin.com']
    );

    if (!masterUser) {
      const masterPassword = await bcrypt.hash('master', 10);
      await dbRun(
        `INSERT INTO users (username, email, password, full_name, role_id, is_active)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['master', 'master@admin.com', masterPassword, 'Super Administrator', adminRole.insertId || 1, 1]
      );
      console.log('✅ Super admin user created (email: master@admin.com, password: master)');
    }

    // Check and seed departments if empty
    const deptCount = await dbGet(
      'SELECT COUNT(*) as cnt FROM departments'
    );

    if (!deptCount || (deptCount as any).cnt === 0) {
      const departments = [
        { name: 'Production', description: 'Manufacturing & Production Department' },
        { name: 'Warehouse', description: 'Inventory & Warehouse Management' },
        { name: 'Quality', description: 'Quality Control & Assurance' },
        { name: 'Finance', description: 'Finance & Accounting' },
        { name: 'Sales', description: 'Sales & Distribution' },
        { name: 'HR', description: 'Human Resources' },
      ];

      for (const dept of departments) {
        await dbRun(
          'INSERT INTO departments (name, description) VALUES (?, ?)',
          [dept.name, dept.description]
        );
      }
      console.log('✅ Default departments created');
    }

    // Check and seed categories
    const catCount = await dbGet('SELECT COUNT(*) as cnt FROM categories');
    if (!catCount || (catCount as any).cnt === 0) {
      const categories = [
        { name: 'Raw Materials', description: 'Basic raw materials and ingredients' },
        { name: 'Packaging', description: 'Packaging materials and supplies' },
        { name: 'Finished Goods', description: 'Ready-to-sell finished products' },
        { name: 'Semi-Finished', description: 'Work in progress or sub-assemblies' },
        { name: 'Spare Parts', description: 'Maintenance spare parts' },
        { name: 'Office Supplies', description: 'General office supplies' }
      ];

      for (const cat of categories) {
        await dbRun('INSERT IGNORE INTO categories (name, description, active) VALUES (?, ?, 1)', [cat.name, cat.description]);
      }
      console.log('✅ Default categories created');
    }

    // Check and seed UOM
    const uomCount = await dbGet('SELECT COUNT(*) as cnt FROM uom');
    if (!uomCount || (uomCount as any).cnt === 0) {
      const uoms = [
        { code: 'kg', name: 'Kilogram', category: 'Weight' },
        { code: 'g', name: 'Gram', category: 'Weight' },
        { code: 'l', name: 'Liter', category: 'Volume' },
        { code: 'ml', name: 'Milliliter', category: 'Volume' },
        { code: 'pcs', name: 'Pieces', category: 'Count' },
        { code: 'box', name: 'Box', category: 'Count' },
        { code: 'roll', name: 'Roll', category: 'Length' },
        { code: 'm', name: 'Meter', category: 'Length' }
      ];

      for (const u of uoms) {
        await dbRun('INSERT IGNORE INTO uom (code, name, category, active) VALUES (?, ?, ?, 1)', [u.code, u.name, u.category]);
      }
      console.log('✅ Default UOMs created');
    }

    // Check and seed Product Types
    const ptCount = await dbGet('SELECT COUNT(*) as cnt FROM product_types');
    if (!ptCount || (ptCount as any).cnt === 0) {
      const types = [
        { code: 'RM', name: 'Raw Material' },
        { code: 'FG', name: 'Finished Product' },
        { code: 'WIP', name: 'Work In Progress' },
        { code: 'PKG', name: 'Packaging' },
        { code: 'SVC', name: 'Service' },
        { code: 'AST', name: 'Asset' }
      ];

      for (const t of types) {
        await dbRun('INSERT IGNORE INTO product_types (code, name, active) VALUES (?, ?, 1)', [t.code, t.name]);
      }
      console.log('✅ Default product types created');
    }

    // Check and seed Item Types (if table exists)
    try {
      const itCount = await dbGet('SELECT COUNT(*) as cnt FROM item_types');
      if (!itCount || (itCount as any).cnt === 0) {
        const types = [
          { code: 'INV', name: 'Inventory Item', track_inventory: 1 },
          { code: 'NON', name: 'Non-Inventory', track_inventory: 0 },
          { code: 'SVC', name: 'Service', track_inventory: 0 },
          { code: 'ASM', name: 'Assembly', track_inventory: 1 }
        ];

        for (const t of types) {
          await dbRun('INSERT IGNORE INTO item_types (code, name, track_inventory) VALUES (?, ?, ?)', [t.code, t.name, t.track_inventory]);
        }
        console.log('✅ Default item types created');
      }
    } catch (e) {
      // Table might not exist yet in some schema versions
      console.log('ℹ️  Skipping item_types seed (table may not exist)');
    }

    // Check and seed Warehouses
    const whCount = await dbGet('SELECT COUNT(*) as cnt FROM warehouses');
    if (!whCount || (whCount as any).cnt === 0) {
      await dbRun('INSERT IGNORE INTO warehouses (code, name, address, is_active) VALUES (?, ?, ?, 1)', ['WH-MAIN', 'Main Warehouse', 'Factory Complex A']);
      await dbRun('INSERT IGNORE INTO warehouses (code, name, address, is_active) VALUES (?, ?, ?, 1)', ['WH-RM', 'Raw Material Store', 'Factory Complex B']);
      console.log('✅ Default warehouses created');
    }

    // Check and seed System Settings
    const setCount = await dbGet('SELECT COUNT(*) as cnt FROM system_settings');
    if (!setCount || (setCount as any).cnt === 0) {
      const settings = [
        { key: 'company_name', value: 'My ERP Company', category: 'general', type: 'string' },
        { key: 'currency', value: 'IDR', category: 'finance', type: 'string' },
        { key: 'timezone', value: 'Asia/Jakarta', category: 'general', type: 'string' }
      ];

      for (const s of settings) {
        await dbRun(
          'INSERT IGNORE INTO system_settings (setting_key, setting_value, category, data_type) VALUES (?, ?, ?, ?)',
          [s.key, s.value, s.category, s.type]
        );
      }
      console.log('✅ Default system settings created');
    }
  } catch (error) {
    console.error('⚠️ Database seeding warning:', error);
  }
}

export default pool;
