-- User-defined columns for the SPKP execution board.
--
-- The board's three columns were hardcoded in the frontend, so a plant that works in more
-- steps than draft/released/completed had nowhere to put them.
--
-- The Lead pipeline deliberately refuses custom stages: a lead stage carries transition rules,
-- and an unknown stage can dead-end a lead (Review.md P0 #3). SPKP is different, and it was
-- worth checking rather than assuming - nothing in the backend branches on spkp.status. It is
-- stored, filtered and displayed, never decided upon. So the set of columns can belong to the
-- user without putting a work order into a state the system cannot reason about.

-- The spkp table itself was never in the migration stream. It exists in production because
-- somebody created it there by hand, which means a fresh install has no SPKP feature at all and
-- the two databases have quietly disagreed ever since. Adopted here, matching production's
-- definition exactly, so the stream and the live schema describe the same system.

CREATE TABLE IF NOT EXISTS spkp (
  id INT NOT NULL AUTO_INCREMENT,
  wo_id INT NOT NULL,
  spkp_number VARCHAR(50) NOT NULL,
  schedule_date DATE NOT NULL,
  planned_qty DECIMAL(15,2) NOT NULL DEFAULT '0.00',
  actual_qty DECIMAL(15,2) DEFAULT NULL,
  operator_name VARCHAR(150) DEFAULT NULL,
  supervisor_name VARCHAR(150) DEFAULT NULL,
  notes VARCHAR(255) DEFAULT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  printed_at TIMESTAMP NULL DEFAULT NULL,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_spkp_number (spkp_number),
  UNIQUE KEY uq_wo_date (wo_id, schedule_date),
  KEY idx_wo_id (wo_id),
  KEY idx_schedule_date (schedule_date),
  KEY idx_status (status),
  CONSTRAINT fk_spkp_wo FOREIGN KEY (wo_id) REFERENCES work_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS spkp_stages (
  id INT PRIMARY KEY AUTO_INCREMENT,

  -- What spkp.status actually holds. Kept separate from the label so renaming a column is a
  -- display change and nothing more: if the two were one field, a rename would strand every
  -- card still carrying the old value, which is the trap the lead pipeline has to live with.
  stage_key VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(50) NOT NULL DEFAULT '#6b7280',
  sort_order INT NOT NULL DEFAULT 0,

  -- the three the board has always had, and that existing rows already point at; they may be
  -- renamed, recoloured and reordered, but not deleted
  is_system TINYINT(1) NOT NULL DEFAULT 0,

  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_spkp_stage_key (stage_key),
  KEY idx_spkp_stage_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seeded to match what the board already showed and what existing SPKP rows already carry, so
-- the first load after this migration looks exactly like the last load before it.
INSERT IGNORE INTO spkp_stages (stage_key, name, color, sort_order, is_system) VALUES
('draft',     'Draft',     '#9ca3af', 0, 1),
('released',  'Released',  '#3b82f6', 1, 1),
('completed', 'Completed', '#22c55e', 2, 1);

-- Any SPKP whose status does not match a stage would vanish from the board entirely, so
-- anything unrecognised is pulled back to the first column rather than left invisible.
UPDATE spkp SET status = 'draft'
 WHERE status IS NULL OR status NOT IN (SELECT stage_key FROM spkp_stages);

INSERT IGNORE INTO permissions (resource, action, module, name, description) VALUES
('production.execution', 'configure', 'Production - Execution', 'Configure Execution Board',
 'Add, rename, recolour, reorder and remove the columns of the SPKP board');

-- granted to whoever may already change the board's contents
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, target.id
  FROM role_permissions rp
  JOIN permissions src    ON src.id = rp.permission_id
  JOIN permissions target ON target.resource = 'production.execution' AND target.action = 'configure'
 WHERE src.resource = 'production.execution' AND src.action = 'create';
