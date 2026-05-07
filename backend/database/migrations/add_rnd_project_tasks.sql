-- R&D Project Tasks (for per-project Kanban)
CREATE TABLE IF NOT EXISTS rnd_project_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'todo',
  priority ENUM('low','medium','high','critical') DEFAULT 'medium',
  assigned_to INT,
  due_date DATE,
  completed_date DATE,
  tags VARCHAR(255),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES rnd_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);
