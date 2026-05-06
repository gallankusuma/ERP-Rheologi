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
    console.log('🚀 Creating project module tables...\n');
    const conn = await pool.getConnection();

    // 1. Project Members
    console.log('Creating project_members...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS project_members (
        id INT PRIMARY KEY AUTO_INCREMENT,
        project_id INT NOT NULL,
        user_id INT NOT NULL,
        role VARCHAR(50) DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES client_projects(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_project_user (project_id, user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 2. Project Milestones
    console.log('Creating project_milestones...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS project_milestones (
        id INT PRIMARY KEY AUTO_INCREMENT,
        project_id INT NOT NULL,
        title VARCHAR(150) NOT NULL,
        description TEXT,
        due_date DATE,
        status ENUM('pending', 'completed', 'overdue') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES client_projects(id) ON DELETE CASCADE,
        INDEX idx_project (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 3. Project Tasks
    console.log('Creating project_tasks...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS project_tasks (
        id INT PRIMARY KEY AUTO_INCREMENT,
        project_id INT NOT NULL,
        milestone_id INT,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status ENUM('Todo', 'In Progress', 'Review', 'Done') DEFAULT 'Todo',
        priority ENUM('Low', 'Medium', 'High', 'Urgent') DEFAULT 'Medium',
        start_date DATE,
        due_date DATE,
        assigned_to INT,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES client_projects(id) ON DELETE CASCADE,
        FOREIGN KEY (milestone_id) REFERENCES project_milestones(id) ON DELETE SET NULL,
        FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_project (project_id),
        INDEX idx_status (status),
        INDEX idx_assigned (assigned_to)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 4. Project Files
    console.log('Creating project_files...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS project_files (
        id INT PRIMARY KEY AUTO_INCREMENT,
        project_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        file_path VARCHAR(255) NOT NULL,
        file_type VARCHAR(50),
        file_size INT,
        uploaded_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES client_projects(id) ON DELETE CASCADE,
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_project (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 5. Project Activities (Log)
    console.log('Creating project_activities...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS project_activities (
        id INT PRIMARY KEY AUTO_INCREMENT,
        project_id INT NOT NULL,
        user_id INT,
        action VARCHAR(100) NOT NULL,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES client_projects(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_project (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    
    // 6. Project Notes
    console.log('Creating project_notes...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS project_notes (
        id INT PRIMARY KEY AUTO_INCREMENT,
        project_id INT NOT NULL,
        title VARCHAR(255),
        content TEXT,
        created_by INT,
        is_pinned BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES client_projects(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_project (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    conn.release();

    // Verify
    console.log('\n✅ All project tables created successfully!');
    const [tables] = await pool.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = '${process.env.DB_NAME || 'erp_manufacturing'}' 
      AND TABLE_NAME LIKE 'project%'
      ORDER BY TABLE_NAME
    `);
    
    console.log('\n📋 Created tables:');
    tables.forEach(t => console.log(`   ✓ ${t.TABLE_NAME}`));

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createTables()
  .then(() => {
    console.log('\n🎉 Project schema setup complete!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Failed:', err);
    process.exit(1);
  });
