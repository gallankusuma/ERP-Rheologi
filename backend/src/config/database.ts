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

// helper functions for async/await query execution
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

/**
 * Execute multiple queries within a single database transaction.
 * Provides BEGIN/COMMIT/ROLLBACK semantics with automatic cleanup.
 */
export const dbTransaction = async <T>(callback: (conn: any) => Promise<T>): Promise<T> => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const BASELINE_PATH = path.join(__dirname, '..', '..', 'database', 'schema_mysql.sql');
export const MIGRATION_DIR = path.join(__dirname, '..', '..', 'database', 'migrations');

// initialize database schema
export async function initializeDatabase() {
  const connection = await pool.getConnection();
  try {
    console.log(`Connected to MySQL database: ${activeDatabaseName}`);

    const { bootstrapSchema, verifySchema } = await import('../lib/schemaBootstrap');

    // schema changes are a deliberate release step in production: startup verifies but
    // never issues DDL, so a bad migration cannot take a live server down on restart
    const isProduction = process.env.NODE_ENV === 'production';
    const autoMigrate = process.env.DB_AUTO_MIGRATE
      ? process.env.DB_AUTO_MIGRATE === 'true'
      : !isProduction;

    if (autoMigrate) {
      const result = await bootstrapSchema(connection, {
        baselinePath: BASELINE_PATH,
        migrationDir: MIGRATION_DIR,
      });
      console.log(
        `Schema ready: baseline ${result.baseline}, migrations ${result.migrations.newlyApplied} new / ${result.migrations.alreadyApplied} existing`
      );
    } else {
      const result = await verifySchema(connection, {
        baselinePath: BASELINE_PATH,
        migrationDir: MIGRATION_DIR,
      });
      console.log(`Schema verified: ${result.applied} migrations applied, none pending`);
    }
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  } finally {
    connection.release();
  }

  await seedDatabase();
}

async function seedDatabase() {
  try {
    const adminRole = await dbRun(
      'INSERT IGNORE INTO roles (name, description) VALUES (?, ?)',
      ['Admin', 'System Administrator']
    );

    const adminUser = await dbGet('SELECT id FROM users WHERE username = ?', ['admin']);
    if (!adminUser) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await dbRun(
        `INSERT INTO users (username, email, password, full_name, role_id, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
        ['admin', 'admin@erp.local', hashedPassword, 'System Administrator', adminRole.insertId || 1, 1]
      );
      console.log('Default admin user created');
    }

    const masterUser = await dbGet('SELECT id FROM users WHERE email = ?', ['master@admin.com']);
    if (!masterUser) {
      const masterPassword = await bcrypt.hash('master', 10);
      await dbRun(
        `INSERT INTO users (username, email, password, full_name, role_id, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
        ['master', 'master@admin.com', masterPassword, 'Super Administrator', adminRole.insertId || 1, 1]
      );
      console.log('Super admin user created');
    }

    const deptCount = await dbGet('SELECT COUNT(*) as cnt FROM departments');
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
        await dbRun('INSERT INTO departments (name, description) VALUES (?, ?)', [dept.name, dept.description]);
      }
      console.log('Default departments created');
    }

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
      console.log('Default categories created');
    }

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
      console.log('Default UOMs created');
    }

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
      console.log('Default product types created');
    }

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
        console.log('Default item types created');
      }
    } catch (e) {
      console.log('Skipping item_types seed (table may not exist)');
    }

    const whCount = await dbGet('SELECT COUNT(*) as cnt FROM warehouses');
    if (!whCount || (whCount as any).cnt === 0) {
      await dbRun('INSERT IGNORE INTO warehouses (code, name, address, is_active) VALUES (?, ?, ?, 1)', ['WH-MAIN', 'Main Warehouse', 'Factory Complex A']);
      await dbRun('INSERT IGNORE INTO warehouses (code, name, address, is_active) VALUES (?, ?, ?, 1)', ['WH-RM', 'Raw Material Store', 'Factory Complex B']);
      console.log('Default warehouses created');
    }

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
      console.log('Default system settings created');
    }
  } catch (error) {
    console.error('Database seeding warning:', error);
  }
}

export default pool;
