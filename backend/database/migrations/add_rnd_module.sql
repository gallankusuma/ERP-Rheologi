-- =============================================
-- R&D Module Tables for Rheologi Chemical Mfg
-- =============================================

-- 1. R&D Projects
CREATE TABLE IF NOT EXISTS rnd_projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  objectives TEXT,
  status ENUM('draft','active','on_hold','completed','cancelled') DEFAULT 'draft',
  priority ENUM('low','medium','high','critical') DEFAULT 'medium',
  project_leader_id INT,
  department_id INT,
  start_date DATE,
  target_end_date DATE,
  actual_end_date DATE,
  budget DECIMAL(15,2) DEFAULT 0,
  spent DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_leader_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

-- 2. Formulations / Recipes
CREATE TABLE IF NOT EXISTS rnd_formulations (
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
);

-- 2b. Formulation Ingredients
CREATE TABLE IF NOT EXISTS rnd_formulation_ingredients (
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
  FOREIGN KEY (formulation_id) REFERENCES rnd_formulations(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- 3. Lab Tests
CREATE TABLE IF NOT EXISTS rnd_lab_tests (
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
);

-- 4. Stability Studies
CREATE TABLE IF NOT EXISTS rnd_stability_studies (
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
);

-- 4b. Stability Checkpoints
CREATE TABLE IF NOT EXISTS rnd_stability_checkpoints (
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
);
