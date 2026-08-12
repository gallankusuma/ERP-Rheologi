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
    // Persistent daily production schedule.
    //
    // The Planning grid auto-spread WO quantity across work days from machine
    // capacity, let the user edit Planned/Actual, and had nowhere to put the
    // result — no save endpoint existed, so every edit lived in a frontend
    // object until the next refresh recomputed it away. The review's choice was
    // explicit: an operational schedule, not a read-only simulation, so it has
    // to survive a reload.
    //
    // One row per (WO, day). The capacity auto-spread remains the SEED for a WO
    // that has no saved rows; once a row exists it is the operator's number and
    // is never silently recomputed over.
    `CREATE TABLE IF NOT EXISTS wo_daily_schedule (
      id INT PRIMARY KEY AUTO_INCREMENT,
      wo_id INT NOT NULL,
      schedule_date DATE NOT NULL,
      planned_qty DECIMAL(15,2) NOT NULL DEFAULT 0,
      actual_qty DECIMAL(15,2) NULL,
      notes VARCHAR(255) NULL,
      updated_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_wo_day (wo_id, schedule_date),
      KEY idx_schedule_date (schedule_date),
      CONSTRAINT fk_wo_daily_schedule_wo FOREIGN KEY (wo_id) REFERENCES work_orders(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
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
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_price DECIMAL(15,2) DEFAULT 0`,
    `ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS client_id INT NULL`,
    `ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS lead_id INT NULL`,
    `ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS project_id INT NULL`,
    `ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS expected_ship_date DATE NULL`,
    `ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NULL DEFAULT 'IDR'`,
    `ALTER TABLE sales_orders MODIFY COLUMN customer_id INT NULL`,
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

// ==================== R&D MODULE SCHEMA ====================
const ensureCrmSchema = async (connection: any) => {
  await execSchemaEnsure(connection, `ALTER TABLE prospects ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'IDR'`);

  // Carry Prospect qualification/contact context through to Lead (Review.md P1 #6)
  await execSchemaEnsure(connection, `ALTER TABLE leads ADD COLUMN IF NOT EXISTS contact_title VARCHAR(150) NULL`);
  await execSchemaEnsure(connection, `ALTER TABLE leads ADD COLUMN IF NOT EXISTS industry VARCHAR(100) NULL`);
  await execSchemaEnsure(connection, `ALTER TABLE leads ADD COLUMN IF NOT EXISTS website VARCHAR(255) NULL`);
  await execSchemaEnsure(connection, `ALTER TABLE leads ADD COLUMN IF NOT EXISTS address TEXT NULL`);
  await execSchemaEnsure(connection, `ALTER TABLE leads ADD COLUMN IF NOT EXISTS city VARCHAR(100) NULL`);
  await execSchemaEnsure(connection, `ALTER TABLE leads ADD COLUMN IF NOT EXISTS country VARCHAR(100) NULL`);
  await execSchemaEnsure(connection, `ALTER TABLE leads ADD COLUMN IF NOT EXISTS temperature VARCHAR(20) NULL`);
  await execSchemaEnsure(connection, `ALTER TABLE leads ADD COLUMN IF NOT EXISTS interest TEXT NULL`);
  await execSchemaEnsure(connection, `ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_follow_up DATE NULL`);
  // Carry Prospect's currency through to Lead, and Lead's through to any Sales Order created
  // from it — was previously lost/hardcoded to IDR at every step (Review.md P0-2)
  await execSchemaEnsure(connection, `ALTER TABLE leads ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'IDR'`);

  // Carry Lead's company context through to Client (Review.md P1 #6)
  await execSchemaEnsure(connection, `ALTER TABLE clients ADD COLUMN IF NOT EXISTS industry VARCHAR(100) NULL`);

  // Sample Requests (Sales <-> R&D) — table never existed, frontend was already built against
  // a /api/sample-requests contract that had no backend at all (404 on every call)
  await execSchemaEnsure(connection, `
    CREATE TABLE IF NOT EXISTS sample_requests (
      id INT PRIMARY KEY AUTO_INCREMENT,
      request_number VARCHAR(50) NOT NULL UNIQUE,
      client_id INT NOT NULL,
      sales_user_id INT NULL,
      product_name VARCHAR(255) NOT NULL,
      specifications TEXT NULL,
      quantity DECIMAL(15,2) NOT NULL DEFAULT 1,
      unit VARCHAR(20) NULL DEFAULT 'pcs',
      target_delivery_date DATE NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'Requested',
      delivery_tracking VARCHAR(255) NULL,
      client_feedback TEXT NULL,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (sales_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_sr_client (client_id),
      INDEX idx_sr_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // two-way discussion thread between Sales and R&D on a Sample Request
  await execSchemaEnsure(connection, `
    CREATE TABLE IF NOT EXISTS sample_request_comments (
      id INT PRIMARY KEY AUTO_INCREMENT,
      sample_request_id INT NOT NULL,
      user_id INT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sample_request_id) REFERENCES sample_requests(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_src_request (sample_request_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // categorized document uploads (Foto / Tanda Terima / COA) on a Sample Request
  await execSchemaEnsure(connection, `
    CREATE TABLE IF NOT EXISTS sample_request_files (
      id INT PRIMARY KEY AUTO_INCREMENT,
      sample_request_id INT NOT NULL,
      category VARCHAR(50) NOT NULL DEFAULT 'foto',
      file_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      file_size INT NULL,
      uploaded_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sample_request_id) REFERENCES sample_requests(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_srf_request (sample_request_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

const ensureRnDSchema = async (connection: any) => {
  const statements = [
    // 1. R&D Projects (core table)
    `CREATE TABLE IF NOT EXISTS rnd_projects (
      id INT AUTO_INCREMENT PRIMARY KEY,
      project_code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      project_type VARCHAR(50) DEFAULT 'new_product',
      category VARCHAR(50) DEFAULT 'chemical',
      description TEXT,
      objectives TEXT,
      expected_output TEXT,
      status ENUM('draft','active','on_hold','completed','cancelled') DEFAULT 'draft',
      priority ENUM('low','medium','high','critical') DEFAULT 'medium',
      risk_level VARCHAR(50) DEFAULT 'medium',
      confidentiality VARCHAR(50) DEFAULT 'internal',
      regulatory_requirements TEXT,
      target_market TEXT,
      target_product TEXT,
      project_leader_id INT,
      department_id INT,
      start_date DATE,
      target_end_date DATE,
      actual_end_date DATE,
      budget DECIMAL(15,2) DEFAULT 0,
      spent DECIMAL(15,2) DEFAULT 0,
      tags TEXT,
      notes TEXT,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (project_leader_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Ensure missing columns on rnd_projects (may exist from old migration)
    `ALTER TABLE rnd_projects ADD COLUMN IF NOT EXISTS project_type VARCHAR(50) DEFAULT 'new_product'`,
    `ALTER TABLE rnd_projects ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'chemical'`,
    `ALTER TABLE rnd_projects ADD COLUMN IF NOT EXISTS expected_output TEXT`,
    `ALTER TABLE rnd_projects ADD COLUMN IF NOT EXISTS risk_level VARCHAR(50) DEFAULT 'medium'`,
    `ALTER TABLE rnd_projects ADD COLUMN IF NOT EXISTS confidentiality VARCHAR(50) DEFAULT 'internal'`,
    `ALTER TABLE rnd_projects ADD COLUMN IF NOT EXISTS regulatory_requirements TEXT`,
    `ALTER TABLE rnd_projects ADD COLUMN IF NOT EXISTS target_market TEXT`,
    `ALTER TABLE rnd_projects ADD COLUMN IF NOT EXISTS target_product TEXT`,
    `ALTER TABLE rnd_projects ADD COLUMN IF NOT EXISTS tags TEXT`,

    // 2. Formulations
    `CREATE TABLE IF NOT EXISTS rnd_formulations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      formula_code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      version VARCHAR(20) DEFAULT '1.0',
      project_id INT,
      product_type_id INT,
      status ENUM('draft','testing','approved','revision','obsolete') DEFAULT 'draft',
      target_specs TEXT,
      description TEXT,
      notes TEXT,
      approved_by INT,
      approved_at DATETIME,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES rnd_projects(id) ON DELETE SET NULL,
      FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // 2b. Formulation Ingredients
    `CREATE TABLE IF NOT EXISTS rnd_formulation_ingredients (
      id INT AUTO_INCREMENT PRIMARY KEY,
      formulation_id INT NOT NULL,
      product_id INT,
      ingredient_name VARCHAR(255) NOT NULL,
      quantity DECIMAL(15,4) NOT NULL DEFAULT 0,
      unit VARCHAR(50) DEFAULT 'kg',
      percentage DECIMAL(8,4),
      function_role VARCHAR(100),
      notes TEXT,
      sort_order INT DEFAULT 0,
      FOREIGN KEY (formulation_id) REFERENCES rnd_formulations(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // 3. Lab Tests
    `CREATE TABLE IF NOT EXISTS rnd_lab_tests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      test_code VARCHAR(50) NOT NULL UNIQUE,
      test_name VARCHAR(255) NOT NULL,
      formulation_id INT,
      project_id INT,
      batch_number VARCHAR(100),
      test_type ENUM('physical','chemical','microbiological','stability','performance','other') DEFAULT 'chemical',
      method VARCHAR(255),
      equipment VARCHAR(255),
      status ENUM('scheduled','in_progress','completed','failed','cancelled') DEFAULT 'scheduled',
      test_date DATE,
      tested_by INT,
      parameters TEXT,
      results TEXT,
      conclusion ENUM('pass','fail','conditional','pending') DEFAULT 'pending',
      attachments TEXT,
      notes TEXT,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (formulation_id) REFERENCES rnd_formulations(id) ON DELETE SET NULL,
      FOREIGN KEY (project_id) REFERENCES rnd_projects(id) ON DELETE SET NULL,
      FOREIGN KEY (tested_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // 4. Stability Studies
    `CREATE TABLE IF NOT EXISTS rnd_stability_studies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      study_code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      formulation_id INT,
      batch_number VARCHAR(100),
      status ENUM('planned','active','completed','cancelled') DEFAULT 'planned',
      storage_condition VARCHAR(255) DEFAULT '25°C / 60% RH',
      duration_months INT DEFAULT 12,
      start_date DATE,
      end_date DATE,
      protocol TEXT,
      conclusion TEXT,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (formulation_id) REFERENCES rnd_formulations(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // 4b. Stability Checkpoints
    `CREATE TABLE IF NOT EXISTS rnd_stability_checkpoints (
      id INT AUTO_INCREMENT PRIMARY KEY,
      study_id INT NOT NULL,
      checkpoint_month INT NOT NULL DEFAULT 0,
      scheduled_date DATE,
      actual_date DATE,
      status ENUM('pending','completed','skipped') DEFAULT 'pending',
      parameters TEXT,
      results TEXT,
      pass_fail ENUM('pass','fail','pending') DEFAULT 'pending',
      tested_by INT,
      notes TEXT,
      FOREIGN KEY (study_id) REFERENCES rnd_stability_studies(id) ON DELETE CASCADE,
      FOREIGN KEY (tested_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // 5. Milestones
    `CREATE TABLE IF NOT EXISTS rnd_milestones (
      id INT AUTO_INCREMENT PRIMARY KEY,
      project_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      phase VARCHAR(50) DEFAULT 'formulation_design',
      status VARCHAR(20) DEFAULT 'pending',
      due_date DATE,
      completed_date DATE,
      assigned_to INT,
      deliverables TEXT,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES rnd_projects(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // 6. Project Tasks (Kanban)
    `CREATE TABLE IF NOT EXISTS rnd_project_tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      project_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      status VARCHAR(50) DEFAULT 'todo',
      priority VARCHAR(20) DEFAULT 'medium',
      assigned_to INT,
      due_date DATE,
      completed_date DATE,
      tags TEXT,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES rnd_projects(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // 7. Document Folders
    `CREATE TABLE IF NOT EXISTS rnd_document_folders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      project_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      color VARCHAR(20) DEFAULT '#3B82F6',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES rnd_projects(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // 8. Documents
    `CREATE TABLE IF NOT EXISTS rnd_documents (
      id INT AUTO_INCREMENT PRIMARY KEY,
      project_id INT,
      formulation_id INT,
      lab_test_id INT,
      stability_study_id INT,
      doc_type VARCHAR(50) DEFAULT 'other',
      title VARCHAR(255) NOT NULL,
      description TEXT,
      file_name VARCHAR(255),
      file_path VARCHAR(500),
      file_size INT DEFAULT 0,
      mime_type VARCHAR(100),
      version VARCHAR(20) DEFAULT '1.0',
      folder_id INT,
      uploaded_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES rnd_projects(id) ON DELETE SET NULL,
      FOREIGN KEY (formulation_id) REFERENCES rnd_formulations(id) ON DELETE SET NULL,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Ensure folder_id column on rnd_documents
    `ALTER TABLE rnd_documents ADD COLUMN IF NOT EXISTS folder_id INT NULL`,

    // Fix ENUM → VARCHAR on tables created by old migrations
    // (CREATE TABLE IF NOT EXISTS won't alter existing tables)
    `ALTER TABLE rnd_milestones MODIFY COLUMN phase VARCHAR(50) DEFAULT 'formulation_design'`,
    `ALTER TABLE rnd_milestones MODIFY COLUMN status VARCHAR(20) DEFAULT 'pending'`,
    `ALTER TABLE rnd_documents MODIFY COLUMN doc_type VARCHAR(50) DEFAULT 'other'`,
  ];

  for (const statement of statements) {
    await execSchemaEnsure(connection, statement);
  }
  console.log('✅ R&D module schema ensured');
};

const ensureQcSchema = async (connection: any) => {
  // create base QC tables so a fresh DB can bootstrap from code alone
  const baseTableStatements = [
    `CREATE TABLE IF NOT EXISTS qc_parameters (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      code VARCHAR(50) DEFAULT NULL,
      param_type VARCHAR(20) DEFAULT 'quantitative',
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS qc_methods (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS qc_instruments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      calibration_date DATE,
      next_calibration_date DATE,
      status VARCHAR(30) DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS qc_sampling_areas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS qc_user_areas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      area_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_area (user_id, area_id)
    )`,
    `CREATE TABLE IF NOT EXISTS qc_specifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT NOT NULL,
      qc_type VARCHAR(30) DEFAULT 'Incoming',
      parameter_id INT NOT NULL,
      method_id INT,
      standard_value VARCHAR(100),
      min_value DECIMAL(15,4),
      max_value DECIMAL(15,4),
      uom VARCHAR(50),
      is_required TINYINT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS qc_analysis_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      fpa_number VARCHAR(100) NOT NULL,
      type VARCHAR(50) DEFAULT 'LP',
      reference_id INT,
      reference_number VARCHAR(100),
      product_id INT NOT NULL,
      sampling_area_id INT,
      batch_no VARCHAR(100),
      quantity DECIMAL(15,4),
      supplier_id INT,
      status VARCHAR(50) DEFAULT 'Pending',
      result VARCHAR(50) DEFAULT NULL,
      notes TEXT,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      reviewed_by INT,
      reviewed_at TIMESTAMP NULL,
      review_notes TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      sampling_run INT DEFAULT 1,
      parent_fpa_id INT,
      approved_by_1 INT,
      approved_at_1 TIMESTAMP NULL,
      approved_by_2 INT,
      approved_at_2 TIMESTAMP NULL,
      needs_resampling TINYINT DEFAULT 0,
      disposition VARCHAR(50),
      data_complete TINYINT DEFAULT 0,
      analysis_notes TEXT,
      wo_id INT,
      specification_doc VARCHAR(100),
      sampling_point VARCHAR(255),
      sampling_qty DECIMAL(15,4),
      sampling_unit VARCHAR(50),
      process_type VARCHAR(100),
      sample_type VARCHAR(100),
      process_date TIMESTAMP NULL
    )`,
    `CREATE TABLE IF NOT EXISTS qc_analysis_results (
      id INT AUTO_INCREMENT PRIMARY KEY,
      fpa_id INT NOT NULL,
      parameter_id INT NOT NULL,
      instrument_id INT,
      method_id INT,
      standard_value VARCHAR(255),
      min_value FLOAT,
      max_value FLOAT,
      actual_value VARCHAR(255),
      is_pass TINYINT(1) DEFAULT NULL,
      saplo FLOAT,
      duplo FLOAT,
      analyst_id INT,
      notes TEXT,
      uom VARCHAR(50),
      qc_type VARCHAR(30),
      specification_id INT,
      is_required TINYINT DEFAULT 1,
      param_type VARCHAR(20) DEFAULT 'quantitative',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
  ];
  for (const stmt of baseTableStatements) {
    await execSchemaEnsure(connection, stmt);
  }

  // ensure all Cycle #1 columns exist (idempotent via IF NOT EXISTS / column check)
  const addCol = async (table: string, col: string, def: string) => {
    try {
      const [rows] = await connection.execute(
        `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, col]
      );
      if (rows[0].cnt === 0) {
        await connection.execute(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
      }
    } catch (e: any) {
      if (!e.message?.includes('Duplicate column')) {
        console.error(`Schema warning: ${table}.${col}: ${e.message}`);
      }
    }
  };

  // qc_parameters additions
  await addCol('qc_parameters', 'code', "VARCHAR(50) DEFAULT NULL");
  await addCol('qc_parameters', 'param_type', "VARCHAR(20) DEFAULT 'quantitative'");

  // qc_analysis_requests workflow columns
  await addCol('qc_analysis_requests', 'sampling_run', 'INT DEFAULT 1');
  await addCol('qc_analysis_requests', 'parent_fpa_id', 'INT');
  await addCol('qc_analysis_requests', 'approved_by_1', 'INT');
  await addCol('qc_analysis_requests', 'approved_at_1', 'TIMESTAMP NULL');
  await addCol('qc_analysis_requests', 'approved_by_2', 'INT');
  await addCol('qc_analysis_requests', 'approved_at_2', 'TIMESTAMP NULL');
  await addCol('qc_analysis_requests', 'needs_resampling', 'TINYINT DEFAULT 0');
  await addCol('qc_analysis_requests', 'disposition', 'VARCHAR(50)');
  await addCol('qc_analysis_requests', 'data_complete', 'TINYINT DEFAULT 0');
  await addCol('qc_analysis_requests', 'analysis_notes', 'TEXT');
  await addCol('qc_analysis_requests', 'wo_id', 'INT');
  await addCol('qc_analysis_requests', 'specification_doc', 'VARCHAR(100)');
  await addCol('qc_analysis_requests', 'sampling_point', 'VARCHAR(255)');
  await addCol('qc_analysis_requests', 'sampling_qty', 'DECIMAL(15,4)');
  await addCol('qc_analysis_requests', 'sampling_unit', 'VARCHAR(50)');
  await addCol('qc_analysis_requests', 'process_type', 'VARCHAR(100)');
  await addCol('qc_analysis_requests', 'sample_type', 'VARCHAR(100)');
  await addCol('qc_analysis_requests', 'process_date', 'TIMESTAMP NULL');

  // qc_analysis_results snapshot + operational columns
  await addCol('qc_analysis_results', 'method_id', 'INT');
  await addCol('qc_analysis_results', 'standard_value', 'VARCHAR(255)');
  await addCol('qc_analysis_results', 'min_value', 'FLOAT');
  await addCol('qc_analysis_results', 'max_value', 'FLOAT');
  await addCol('qc_analysis_results', 'uom', 'VARCHAR(50)');
  await addCol('qc_analysis_results', 'qc_type', 'VARCHAR(30)');
  await addCol('qc_analysis_results', 'specification_id', 'INT');
  await addCol('qc_analysis_results', 'is_required', 'TINYINT DEFAULT 1');
  await addCol('qc_analysis_results', 'param_type', "VARCHAR(20) DEFAULT 'quantitative'");
  await addCol('qc_analysis_results', 'saplo', 'FLOAT');
  await addCol('qc_analysis_results', 'duplo', 'FLOAT');
  await addCol('qc_analysis_results', 'analyst_id', 'INT');
  await addCol('qc_analysis_results', 'notes', 'TEXT');
  await addCol('qc_analysis_results', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

  // batches audit columns
  await addCol('batches', 'qc_status', 'VARCHAR(50)');
  await addCol('batches', 'released_by', 'INT');
  await addCol('batches', 'released_at', 'TIMESTAMP NULL');

  // cycle #2: NCR ↔ FPA linkage
  await addCol('qc_ncr', 'source_fpa_id', 'INT NULL');
  await addCol('qc_ncr', 'source_type', "VARCHAR(30) NULL DEFAULT 'manual'");
  await addCol('qc_rework_orders', 'retest_fpa_id', 'INT NULL');

  console.log('QC module schema ensured');
};

const ensurePpicSchema = async (connection: any) => {
  const statements = [
    `CREATE TABLE IF NOT EXISTS mps_detail_sources (
      id INT AUTO_INCREMENT PRIMARY KEY,
      mps_detail_id INT NOT NULL,
      source_type ENUM('SO_ITEM','PROJECT') NOT NULL,
      so_item_id INT NULL,
      project_id INT NULL,
      quantity DECIMAL(15,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_so_item (so_item_id),
      UNIQUE KEY uq_project (project_id),
      KEY idx_detail (mps_detail_id)
    )`,
    `CREATE TABLE IF NOT EXISTS mrp_material_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      material_id INT NOT NULL,
      lead_time INT DEFAULT 2,
      first_stock DECIMAL(15,2) DEFAULT 0,
      order_quantity DECIMAL(15,2) DEFAULT 0,
      UNIQUE KEY uq_material (material_id)
    )`,
    `ALTER TABLE line_processes ADD COLUMN IF NOT EXISTS working_hours_per_week DECIMAL(5,1) DEFAULT 40`,
    `ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS week_number INT NULL`,
  ];

  for (const statement of statements) {
    await execSchemaEnsure(connection, statement);
  }
  console.log('PPIC module schema ensured');
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

/**
 * Execute multiple queries within a single database transaction.
 * Provides BEGIN/COMMIT/ROLLBACK semantics with automatic cleanup.
 * 
 * Usage:
 *   await dbTransaction(async (conn) => {
 *     await conn.execute('SELECT ... FOR UPDATE', [id]); // row lock
 *     await conn.execute('UPDATE ...', [newQty, id]);
 *     await conn.execute('INSERT INTO stock_movements ...', [...]);
 *   });
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

// ==================== APPROVAL 2-STAGE PERMISSIONS ====================
const ensureApprovalPermissions = async (connection: any) => {
  // Ensure permissions table has module/name columns (production has them, dev may not)
  await execSchemaEnsure(connection, `ALTER TABLE permissions ADD COLUMN IF NOT EXISTS module VARCHAR(100) NULL`);
  await execSchemaEnsure(connection, `ALTER TABLE permissions ADD COLUMN IF NOT EXISTS name VARCHAR(200) NULL`);

  // Define modules that need 2-stage approval permissions
  const approvalModules = [
    { resource: 'procurement.purchase-requests', module: 'Procurement - Purchase Requests', label: 'Purchase Requests' },
    { resource: 'procurement.spec-approval', module: 'Procurement - Spec Approval', label: 'Spec Approval' },
    { resource: 'procurement.purchase-orders', module: 'Procurement - Purchase Orders', label: 'Purchase Orders' },
    { resource: 'procurement.grn', module: 'Procurement - Goods Receipt (GRN)', label: 'Goods Receipt' },
    { resource: 'finance.fund-requests', module: 'Finance - Fund Requests', label: 'Fund Requests' },
    { resource: 'finance.ap', module: 'Finance - Accounts Payable', label: 'Accounts Payable' },
    { resource: 'finance.ar', module: 'Finance - Accounts Receivable', label: 'Accounts Receivable' },
    { resource: 'quality.batch-release', module: 'Quality - Batch Release', label: 'Batch Release' },
    { resource: 'quality.ncr', module: 'Quality - Non-Conformance', label: 'Non-Conformance' },
    { resource: 'production.workorders', module: 'Production - Work Orders', label: 'Work Orders' },
    { resource: 'production.fg-receipt', module: 'Production - FG Receipt', label: 'FG Receipt' },
    { resource: 'inventory.stock-adjustment', module: 'Inventory - Stock Adjustment', label: 'Stock Adjustment' },
    { resource: 'inventory.stock-transfer', module: 'Inventory - Stock Transfer', label: 'Stock Transfer' },
    { resource: 'master_data.bom', module: 'Master Data - Bill of Materials', label: 'BOM' },
    { resource: 'rnd.rnd-projects', module: 'R&D - R&D Projects', label: 'R&D Projects' },
    { resource: 'rnd.rnd-formulations', module: 'R&D - Formulations', label: 'R&D Formulations' },
  ];

  for (const mod of approvalModules) {
    // approve_1 = Supervisor Approval (step 1)
    await execSchemaEnsure(connection,
      `INSERT IGNORE INTO permissions (resource, action, module, name, description)
       VALUES ('${mod.resource}', 'approve_1', '${mod.module}', '${mod.label} Approve Level 1',
               'Supervisor-level approval (step 1 of 2)')`
    );
    // approve_2 = Manager/Final Approval (step 2)
    await execSchemaEnsure(connection,
      `INSERT IGNORE INTO permissions (resource, action, module, name, description)
       VALUES ('${mod.resource}', 'approve_2', '${mod.module}', '${mod.label} Approve Level 2',
               'Manager-level final approval (step 2 of 2)')`
    );
  }

  // Spec Approval needs a 'view' permission so it appears as a full row in the UI
  await execSchemaEnsure(connection,
    `INSERT IGNORE INTO permissions (resource, action, module, name, description)
     VALUES ('procurement.spec-approval', 'view', 'Procurement - Spec Approval', 'Spec Approval View',
             'View spec approval status on PR items')`
  );

  console.log('✅ Approval 2-stage permissions ensured');
};

// ==================== FULL MENU PERMISSIONS (RBAC coverage for every sidebar menu) ====================
// Mirrors the menu/submenu tree in frontend/src/components/Layout.vue so every
// navigable page has an assignable permission in the Roles & Permissions UI.
interface MenuPermModule {
  resource: string;
  module: string;
  label: string;
  actions?: string[]; // defaults to DEFAULT_MENU_ACTIONS
}

const DEFAULT_MENU_ACTIONS = ['view', 'create', 'update', 'delete'];

const ACTION_LABELS: Record<string, string> = {
  view: 'View',
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
  export: 'Export',
  issue_material: 'Issue Material',
};

const menuPermissionModules: MenuPermModule[] = [
  // CRM
  { resource: 'crm.dashboard', module: 'CRM - Dashboard', label: 'CRM Dashboard', actions: ['view'] },
  { resource: 'crm.clients', module: 'CRM - Clients', label: 'Clients' },
  { resource: 'crm.projects', module: 'CRM - Projects', label: 'Projects' },
  { resource: 'crm.sample-requests', module: 'CRM - Sample Requests', label: 'Sample Requests' },
  { resource: 'crm.events', module: 'CRM - Events', label: 'Events' },
  { resource: 'crm.tasks', module: 'CRM - Tasks', label: 'Tasks' },
  { resource: 'crm.notes', module: 'CRM - Notes', label: 'Notes' },
  { resource: 'crm.messages', module: 'CRM - Messages', label: 'Messages', actions: ['view'] },
  { resource: 'crm.sales', module: 'CRM - Sales', label: 'Sales' },

  // Dashboard (read-only KPI views)
  { resource: 'dashboard.overview', module: 'Dashboard - Overview', label: 'Overview', actions: ['view'] },
  { resource: 'dashboard.production', module: 'Dashboard - Production KPI', label: 'Production KPI', actions: ['view'] },
  { resource: 'dashboard.inventory', module: 'Dashboard - Inventory KPI', label: 'Inventory KPI', actions: ['view'] },
  { resource: 'dashboard.sales', module: 'Dashboard - Sales KPI', label: 'Sales KPI', actions: ['view'] },
  { resource: 'dashboard.approvals', module: 'Dashboard - Approval Summary', label: 'Approval Summary', actions: ['view'] },
  { resource: 'dashboard.alerts', module: 'Dashboard - Alerts', label: 'Alerts', actions: ['view'] },

  // Estimator
  { resource: 'estimator.proposals', module: 'Estimator - Proposal', label: 'Proposal' },
  { resource: 'estimator.ahsp', module: 'Estimator - AHSP', label: 'AHSP' },
  { resource: 'estimator.masters', module: 'Estimator - Satuan Dasar Harga', label: 'Satuan Dasar Harga' },

  // R&D (rnd.rnd-projects / rnd.rnd-formulations already have approve_1/2 from ensureApprovalPermissions)
  { resource: 'rnd.rnd-projects', module: 'R&D - R&D Projects', label: 'R&D Projects' },
  { resource: 'rnd.kanban', module: 'R&D - Kanban Board', label: 'Kanban Board', actions: ['view'] },
  { resource: 'rnd.rnd-formulations', module: 'R&D - Formulations', label: 'Formulations' },
  { resource: 'rnd.specifications', module: 'R&D - Specifications', label: 'Specifications' },

  // PPIC
  { resource: 'ppic.forecast', module: 'PPIC - Sales Forecast', label: 'Sales Forecast' },
  { resource: 'ppic.mps', module: 'PPIC - MPS', label: 'MPS' },
  { resource: 'ppic.mrp', module: 'PPIC - MRP', label: 'MRP' },
  { resource: 'ppic.capacity', module: 'PPIC - Capacity Planning', label: 'Capacity Planning' },
  { resource: 'ppic.reports', module: 'PPIC - Stock Reports', label: 'Stock Reports', actions: ['view'] },

  // Procurement (purchase-requests / purchase-orders / grn already have approve_1/2)
  { resource: 'procurement.dashboard', module: 'Procurement - Overview', label: 'Overview', actions: ['view'] },
  { resource: 'procurement.purchase-requests', module: 'Procurement - Purchase Requests', label: 'Purchase Requests' },
  { resource: 'procurement.purchase-orders', module: 'Procurement - Purchase Orders', label: 'Purchase Orders' },
  { resource: 'procurement.grn', module: 'Procurement - Goods Receipt (GRN)', label: 'Goods Receipt' },
  { resource: 'procurement.vendor-price-list', module: 'Procurement - Vendor Price List', label: 'Vendor Price List' },
  { resource: 'procurement.material-price-comparison', module: 'Procurement - Material Price Comparison', label: 'Material Price Comparison', actions: ['view'] },
  { resource: 'procurement.history', module: 'Procurement - History', label: 'History', actions: ['view'] },

  // Inventory (stock-adjustment / stock-transfer already have approve_1/2)
  { resource: 'inventory.dashboard', module: 'Inventory - Overview', label: 'Overview' },
  { resource: 'inventory.stock-card', module: 'Inventory - Stock Card', label: 'Stock Card', actions: ['view', 'create'] },
  { resource: 'inventory.stock-transfer', module: 'Inventory - Stock Transfer', label: 'Stock Transfer' },
  { resource: 'inventory.stock-adjustment', module: 'Inventory - Stock Adjustment', label: 'Stock Adjustment' },
  { resource: 'inventory.stock-opname', module: 'Inventory - Stock Opname', label: 'Stock Opname' },
  { resource: 'inventory.batch-tracking', module: 'Inventory - Batch / Lot Tracking', label: 'Batch / Lot Tracking' },
  { resource: 'inventory.expiry-monitoring', module: 'Inventory - Expiry Monitoring', label: 'Expiry Monitoring', actions: ['view'] },

  // Production (workorders / fg-receipt already have approve_1/2)
  { resource: 'production.planning', module: 'Production - Planning', label: 'Planning' },
  { resource: 'production.mrp', module: 'Production - Material Requirement', label: 'Material Requirement', actions: ['view'] },
  { resource: 'production.workorders', module: 'Production - Work Orders', label: 'Work Orders' },
  { resource: 'production.workorders', module: 'Production - Work Orders', label: 'Issue Material', actions: ['issue_material'] },
  { resource: 'production.execution', module: 'Production - Execution', label: 'Execution' },
  { resource: 'production.yield-scrap', module: 'Production - Yield & Scrap', label: 'Yield & Scrap' },
  { resource: 'production.fg-receipt', module: 'Production - FG Receipt', label: 'FG Receipt' },
  { resource: 'production.history', module: 'Production - History', label: 'History', actions: ['view'] },

  // Quality (batch-release / ncr already have approve_1/2)
  { resource: 'quality.qc-master', module: 'Quality - QC Master Data', label: 'QC Master Data' },
  { resource: 'quality.qc-fpa', module: 'Quality - QC FPA', label: 'QC FPA' },
  { resource: 'quality.test-methods', module: 'Quality - Test Methods', label: 'Test Methods' },
  { resource: 'quality.sampling', module: 'Quality - Sampling', label: 'Sampling' },
  { resource: 'quality.results', module: 'Quality - Results', label: 'Results' },
  { resource: 'quality.batch-release', module: 'Quality - Batch Release', label: 'Batch Release' },
  { resource: 'quality.ncr', module: 'Quality - Non-Conformance', label: 'Non-Conformance' },
  { resource: 'quality.rework', module: 'Quality - Rework', label: 'Rework' },
  { resource: 'quality.reports', module: 'Quality - QC Reports', label: 'QC Reports', actions: ['view'] },

  // Finance (fund-requests / ap / ar already have approve_1/2)
  { resource: 'finance.general-ledger', module: 'Finance - General Ledger', label: 'General Ledger' },
  { resource: 'finance.cogs', module: 'Finance - COGS Calculation', label: 'COGS Calculation', actions: ['view'] },
  { resource: 'finance.ap', module: 'Finance - Accounts Payable', label: 'Accounts Payable' },
  { resource: 'finance.ar', module: 'Finance - Accounts Receivable', label: 'Accounts Receivable' },
  { resource: 'finance.cost-analysis', module: 'Finance - Cost Analysis', label: 'Cost Analysis', actions: ['view'] },
  { resource: 'finance.margin-analysis', module: 'Finance - Margin Analysis', label: 'Margin Analysis', actions: ['view'] },
  { resource: 'finance.financial-summary', module: 'Finance - Financial Summary', label: 'Financial Summary', actions: ['view'] },
  { resource: 'finance.fund-requests', module: 'Finance - Fund Requests', label: 'Fund Requests' },

  // Approval
  { resource: 'approval.inbox', module: 'Approval - My Approval Inbox', label: 'My Approval Inbox', actions: ['view'] },
  { resource: 'approval.history', module: 'Approval - Approval History', label: 'Approval History', actions: ['view'] },
  { resource: 'approval.rules', module: 'Approval - Approval Rules', label: 'Approval Rules' },
  { resource: 'approval.delegation', module: 'Approval - Delegation', label: 'Delegation' },
  { resource: 'approval.escalation', module: 'Approval - Escalation Rules', label: 'Escalation Rules' },

  // Reports
  { resource: 'reports.production', module: 'Reports - Production Reports', label: 'Production Reports', actions: ['view', 'export'] },
  { resource: 'reports.inventory', module: 'Reports - Inventory Reports', label: 'Inventory Reports', actions: ['view', 'export'] },
  { resource: 'reports.procurement', module: 'Reports - Procurement Reports', label: 'Procurement Reports', actions: ['view', 'export'] },
  { resource: 'reports.qc', module: 'Reports - QC Reports', label: 'QC Reports', actions: ['view', 'export'] },
  { resource: 'reports.sales', module: 'Reports - Sales Reports', label: 'Sales Reports', actions: ['view', 'export'] },
  { resource: 'reports.finance', module: 'Reports - Finance Reports', label: 'Finance Reports', actions: ['view', 'export'] },
  { resource: 'reports.custom', module: 'Reports - Custom Reports', label: 'Custom Reports', actions: ['view', 'create', 'export'] },
  { resource: 'reports.export', module: 'Reports - Export Data', label: 'Export Data', actions: ['view', 'export'] },

  // Master Data (bom already has approve_1/2; warehouses/warehouse-locations shared with Inventory menu links)
  { resource: 'master_data.units', module: 'Master Data - Units of Measure', label: 'Units of Measure' },
  { resource: 'master_data.items', module: 'Master Data - Items', label: 'Items' },
  { resource: 'master_data.item-types', module: 'Master Data - Item Types', label: 'Item Types' },
  { resource: 'master_data.categories', module: 'Master Data - Item Categories', label: 'Item Categories' },
  { resource: 'master_data.line-processes', module: 'Master Data - Line Processes', label: 'Line Processes' },
  { resource: 'master_data.bom', module: 'Master Data - Bill of Materials', label: 'Bill of Materials' },
  { resource: 'master_data.warehouses', module: 'Master Data - Warehouses', label: 'Warehouses' },
  { resource: 'master_data.warehouse-locations', module: 'Master Data - Warehouse Locations', label: 'Warehouse Locations' },
  { resource: 'master_data.suppliers', module: 'Master Data - Vendors', label: 'Vendors' },
  { resource: 'master_data.customers', module: 'Master Data - Customers', label: 'Customers' },
  { resource: 'master_data.departments', module: 'Master Data - Departments', label: 'Departments' },
  { resource: 'master_data.client-categories', module: 'Master Data - Client Categories', label: 'Client Categories' },
  { resource: 'master_data.forecast-brands', module: 'Master Data - Forecast Brands', label: 'Forecast Brands' },

  // Admin (system.roles/system.permissions already cover the "Roles & Permissions" submenu;
  // admin.users is shared with the Master Data "Employees" menu link, which points to the same /users page)
  { resource: 'admin.users', module: 'Admin - Users', label: 'Users' },
  { resource: 'admin.settings', module: 'Admin - System Settings', label: 'System Settings', actions: ['view', 'update'] },
  { resource: 'admin.approval-config', module: 'Admin - Approval Config', label: 'Approval Config' },
  { resource: 'admin.audit-log', module: 'Admin - Audit Log', label: 'Audit Log', actions: ['view', 'delete'] },
  { resource: 'admin.notifications', module: 'Admin - Notification Settings', label: 'Notification Settings', actions: ['view', 'update'] },
  { resource: 'admin.integration', module: 'Admin - Integration Settings', label: 'Integration Settings', actions: ['view', 'update'] },
  { resource: 'admin.document-control', module: 'Admin - Document Control', label: 'Document Control' },
  { resource: 'admin.backup', module: 'Admin - Backup & Restore', label: 'Backup & Restore', actions: ['view', 'create'] },
];

const ensureMenuPermissions = async (connection: any) => {
  for (const mod of menuPermissionModules) {
    const actions = mod.actions || DEFAULT_MENU_ACTIONS;
    for (const action of actions) {
      const actionLabel = ACTION_LABELS[action] || action;
      const name = `${actionLabel} ${mod.label}`;
      await execSchemaEnsure(connection,
        `INSERT IGNORE INTO permissions (resource, action, module, name, description)
         VALUES (${connection.escape(mod.resource)}, ${connection.escape(action)}, ${connection.escape(mod.module)}, ${connection.escape(name)}, ${connection.escape(name)})`
      );
    }
  }

  // Auto-assign every menu permission to the Admin role (code='ADM') so the Roles & Permissions
  // UI shows them as granted for Admin (requirePermission already bypasses role_id=1 functionally,
  // this just keeps the checkbox state consistent — same pattern as seedSystemPermissions).
  try {
    const [adminRows]: any = await connection.execute("SELECT id FROM roles WHERE code = 'ADM' LIMIT 1");
    const adminRole = Array.isArray(adminRows) && adminRows[0];
    if (adminRole) {
      const resources = [...new Set(menuPermissionModules.map(m => m.resource))];
      const placeholders = resources.map(() => '?').join(',');
      const [permRows]: any = await connection.execute(
        `SELECT id FROM permissions WHERE resource IN (${placeholders})`,
        resources
      );
      for (const perm of permRows as any[]) {
        await execSchemaEnsure(connection, `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (${adminRole.id}, ${perm.id})`);
      }
    }
  } catch (e: any) {
    console.warn('Menu permissions admin auto-assign skipped:', e.message?.substring(0, 120));
  }

  console.log('✅ Full menu permissions ensured');
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
    await ensureRnDSchema(connection);
    await ensureCrmSchema(connection);
    await ensurePpicSchema(connection);
    await ensureQcSchema(connection);
    await ensureEmailSchema(connection);
    await ensureApprovalPermissions(connection);
    await ensureMenuPermissions(connection);

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

async function ensureEmailSchema(connection: any) {
  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS email_accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        email_address VARCHAR(255) NOT NULL,
        display_name VARCHAR(255) DEFAULT NULL,
        imap_host VARCHAR(255) DEFAULT 'imap.gmail.com',
        imap_port INT DEFAULT 993,
        smtp_host VARCHAR(255) DEFAULT 'smtp.gmail.com',
        smtp_port INT DEFAULT 465,
        password_encrypted TEXT NOT NULL,
        is_active TINYINT(1) DEFAULT 1,
        last_synced_at DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_email_user (user_id)
      )
    `);
    console.log('email_accounts table ensured');
  } catch (err: any) {
    if (!err.message?.includes('already exists')) {
      console.warn('ensureEmailSchema warning:', err.message);
    }
  }
}
