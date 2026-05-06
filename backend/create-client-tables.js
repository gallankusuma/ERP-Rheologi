const mysql = require('mysql2/promise');
require('dotenv').config();

async function createTables() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'erp_manufacturing'
  });

  try {
    console.log('🚀 Creating client module tables...\n');
    const conn = await pool.getConnection();

    // 1. Client Labels
    console.log('Creating client_labels...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS client_labels (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(50) NOT NULL UNIQUE,
        color VARCHAR(20) DEFAULT 'blue',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 2. Client Groups
    console.log('Creating client_groups...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS client_groups (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(50) NOT NULL UNIQUE,
        color VARCHAR(20) DEFAULT 'gray',
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 3. Clients
    console.log('Creating clients...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS clients (
        id INT PRIMARY KEY AUTO_INCREMENT,
        code VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        organization VARCHAR(255),
        address TEXT,
        city VARCHAR(100),
        province VARCHAR(100),
        postal_code VARCHAR(20),
        phone VARCHAR(50),
        website VARCHAR(255),
        client_group_id INT,
        primary_contact_id INT,
        total_invoiced DECIMAL(15,2) DEFAULT 0,
        payment_received DECIMAL(15,2) DEFAULT 0,
        due_amount DECIMAL(15,2) DEFAULT 0,
        is_active TINYINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_group (client_group_id),
        KEY idx_code (code),
        KEY idx_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 4. Client Label Map
    console.log('Creating client_label_map...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS client_label_map (
        id INT PRIMARY KEY AUTO_INCREMENT,
        client_id INT NOT NULL,
        label_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_client_label (client_id, label_id),
        KEY idx_client (client_id),
        KEY idx_label (label_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 5. Contacts
    console.log('Creating contacts...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INT PRIMARY KEY AUTO_INCREMENT,
        client_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        job_title VARCHAR(100),
        email VARCHAR(255),
        phone VARCHAR(50),
        mobile VARCHAR(50),
        is_primary TINYINT DEFAULT 0,
        avatar_url VARCHAR(255),
        last_login TIMESTAMP NULL,
        is_active TINYINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_client (client_id),
        KEY idx_email (email),
        KEY idx_primary (is_primary)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 6. Client Projects
    console.log('Creating client_projects...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS client_projects (
        id INT PRIMARY KEY AUTO_INCREMENT,
        client_id INT NOT NULL,
        project_number VARCHAR(50) NOT NULL UNIQUE,
        project_name VARCHAR(255) NOT NULL,
        description TEXT,
        start_date DATE,
        end_date DATE,
        budget DECIMAL(15,2),
        actual_cost DECIMAL(15,2) DEFAULT 0,
        status ENUM('draft', 'open', 'in_progress', 'completed', 'hold', 'canceled') DEFAULT 'open',
        progress_percentage TINYINT DEFAULT 0,
        assigned_to INT,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_client (client_id),
        KEY idx_status (status),
        KEY idx_dates (start_date, end_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 7. Client Invoices
    console.log('Creating client_invoices...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS client_invoices (
        id INT PRIMARY KEY AUTO_INCREMENT,
        client_id INT NOT NULL,
        invoice_number VARCHAR(50) NOT NULL UNIQUE,
        project_id INT,
        invoice_date DATE NOT NULL,
        due_date DATE,
        subtotal DECIMAL(15,2) NOT NULL,
        tax_amount DECIMAL(15,2) DEFAULT 0,
        total_amount DECIMAL(15,2) NOT NULL,
        paid_amount DECIMAL(15,2) DEFAULT 0,
        status ENUM('draft', 'sent', 'partial', 'paid', 'overdue', 'canceled') DEFAULT 'draft',
        payment_terms VARCHAR(100),
        notes TEXT,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_client (client_id),
        KEY idx_status (status),
        KEY idx_dates (invoice_date, due_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 8. Client Payments
    console.log('Creating client_payments...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS client_payments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        client_id INT NOT NULL,
        invoice_id INT,
        payment_date DATE NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        payment_method VARCHAR(50),
        reference_number VARCHAR(100),
        notes TEXT,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_client (client_id),
        KEY idx_invoice (invoice_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 9. Client Estimates
    console.log('Creating client_estimates...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS client_estimates (
        id INT PRIMARY KEY AUTO_INCREMENT,
        client_id INT NOT NULL,
        estimate_number VARCHAR(50) NOT NULL UNIQUE,
        estimate_date DATE NOT NULL,
        valid_until DATE,
        total_amount DECIMAL(15,2) NOT NULL,
        status ENUM('draft', 'sent', 'accepted', 'rejected', 'expired') DEFAULT 'draft',
        notes TEXT,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_client (client_id),
        KEY idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 10. Client Proposals
    console.log('Creating client_proposals...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS client_proposals (
        id INT PRIMARY KEY AUTO_INCREMENT,
        client_id INT NOT NULL,
        proposal_number VARCHAR(50) NOT NULL UNIQUE,
        title VARCHAR(255) NOT NULL,
        proposal_date DATE NOT NULL,
        total_amount DECIMAL(15,2),
        status ENUM('draft', 'sent', 'accepted', 'rejected', 'in_progress') DEFAULT 'draft',
        notes TEXT,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_client (client_id),
        KEY idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 11. Client Tickets
    console.log('Creating client_tickets...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS client_tickets (
        id INT PRIMARY KEY AUTO_INCREMENT,
        client_id INT NOT NULL,
        contact_id INT,
        ticket_number VARCHAR(50) NOT NULL UNIQUE,
        subject VARCHAR(255) NOT NULL,
        description TEXT,
        priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
        status ENUM('open', 'in_progress', 'waiting', 'closed') DEFAULT 'open',
        assigned_to INT,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_client (client_id),
        KEY idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 12. Client Orders
    console.log('Creating client_orders...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS client_orders (
        id INT PRIMARY KEY AUTO_INCREMENT,
        client_id INT NOT NULL,
        order_number VARCHAR(50) NOT NULL UNIQUE,
        order_date DATE NOT NULL,
        total_amount DECIMAL(15,2) NOT NULL,
        status ENUM('draft', 'confirmed', 'processing', 'shipped', 'delivered', 'canceled') DEFAULT 'draft',
        notes TEXT,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_client (client_id),
        KEY idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 13. Event Types
    console.log('Creating event_types...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS event_types (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(50) NOT NULL UNIQUE,
        color VARCHAR(20) DEFAULT 'blue',
        icon VARCHAR(50),
        is_system TINYINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 14. Client Events
    console.log('Creating client_events...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS client_events (
        id INT PRIMARY KEY AUTO_INCREMENT,
        client_id INT,
        contact_id INT,
        project_id INT,
        event_type_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        event_date DATE NOT NULL,
        start_time TIME,
        end_time TIME,
        location VARCHAR(255),
        attendees TEXT,
        reminder_minutes INT DEFAULT 0,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_client (client_id),
        KEY idx_date (event_date),
        KEY idx_type (event_type_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Insert initial data
    console.log('\n📊 Inserting initial data...');
    
    // Labels
    await conn.execute(`
      INSERT IGNORE INTO client_labels (name, color) VALUES
      ('Corporate', 'purple'),
      ('VIP', 'yellow'),
      ('Unsatisfied', 'cyan'),
      ('Referral', 'cyan'),
      ('Potential', 'blue'),
      ('Inactive', 'gray')
    `);

    // Groups
    await conn.execute(`
      INSERT IGNORE INTO client_groups (name, color, description) VALUES
      ('VIP', 'yellow', 'VIP clients with premium service'),
      ('Gold', 'yellow', 'Gold tier clients'),
      ('Silver', 'gray', 'Silver tier clients'),
      ('Bronze', 'orange', 'Bronze tier clients')
    `);

    // Event Types
    await conn.execute(`
      INSERT IGNORE INTO event_types (name, color, icon, is_system) VALUES
      ('Events', 'blue', '📅', 1),
      ('Leave', 'purple', '🌴', 1),
      ('Task start date', 'teal', '📋', 1),
      ('Task deadline', 'pink', '⏰', 1),
      ('Project start date', 'blue', '🚀', 1),
      ('Project deadline', 'orange', '🎯', 1),
      ('Meeting', 'green', '🤝', 0),
      ('Call', 'cyan', '📞', 0),
      ('Follow-up', 'indigo', '👁️', 0)
    `);

    conn.release();

    // Verify
    console.log('\n✅ All tables created successfully!');
    const [tables] = await pool.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = 'erp_manufacturing' 
      AND TABLE_NAME LIKE 'client%' OR TABLE_NAME = 'event_types'
      ORDER BY TABLE_NAME
    `);
    
    console.log('\n📋 Created tables:');
    tables.forEach(t => console.log(`   ✓ ${t.TABLE_NAME}`));

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

createTables()
  .then(() => {
    console.log('\n🎉 Schema setup complete!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Failed:', err);
    process.exit(1);
  });
