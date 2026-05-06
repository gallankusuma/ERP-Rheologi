-- R&D Milestones
CREATE TABLE IF NOT EXISTS rnd_milestones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  phase ENUM('literature_review','formulation_design','trial_batch','lab_testing','scale_up','stability_study','documentation','regulatory','production_transfer','completed') DEFAULT 'formulation_design',
  status ENUM('pending','in_progress','completed','skipped') DEFAULT 'pending',
  due_date DATE,
  completed_date DATE,
  assigned_to INT,
  deliverables TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES rnd_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

-- R&D Documents
CREATE TABLE IF NOT EXISTS rnd_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT,
  formulation_id INT,
  lab_test_id INT,
  stability_study_id INT,
  doc_type ENUM('protocol','lab_report','certificate','sds','specification','approval_letter','photo','raw_data','regulatory','other') DEFAULT 'other',
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_name VARCHAR(255),
  file_path VARCHAR(500),
  file_size INT DEFAULT 0,
  mime_type VARCHAR(100),
  version VARCHAR(20) DEFAULT '1.0',
  uploaded_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES rnd_projects(id) ON DELETE SET NULL,
  FOREIGN KEY (formulation_id) REFERENCES rnd_formulations(id) ON DELETE SET NULL,
  FOREIGN KEY (lab_test_id) REFERENCES rnd_lab_tests(id) ON DELETE SET NULL,
  FOREIGN KEY (stability_study_id) REFERENCES rnd_stability_studies(id) ON DELETE SET NULL,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);
