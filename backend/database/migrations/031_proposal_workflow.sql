-- Migration: Update proposal status workflow & link proposals to projects
-- Statuses: draft → review → submitted → deal / no_deal

-- Add proposal_id to client_projects (so we can trace which proposal created the project)
ALTER TABLE client_projects ADD COLUMN IF NOT EXISTS proposal_id INT NULL AFTER client_id;
ALTER TABLE client_projects ADD CONSTRAINT IF NOT EXISTS fk_project_proposal FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_project_proposal ON client_projects(proposal_id);

-- Add submitted_at and deal_at timestamps to proposals
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP NULL AFTER approved_at;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS deal_at TIMESTAMP NULL AFTER submitted_at;

-- Add client_id reference to proposals (for auto-creating project with correct client link)
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS client_id INT NULL AFTER client;
ALTER TABLE proposals ADD CONSTRAINT IF NOT EXISTS fk_proposal_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

-- Add project_id to proposals (back-reference when deal creates project)
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS project_id INT NULL AFTER client_id;
ALTER TABLE proposals ADD CONSTRAINT IF NOT EXISTS fk_proposal_project FOREIGN KEY (project_id) REFERENCES client_projects(id) ON DELETE SET NULL;

-- Update existing proposal to set client_id from client name
-- the two columns do not share a collation in every deployment, so the comparison is made
-- explicit; without it the join fails with "illegal mix of collations"
UPDATE proposals p
JOIN clients c ON c.name COLLATE utf8mb4_general_ci = p.client COLLATE utf8mb4_general_ci
SET p.client_id = c.id
WHERE p.client IS NOT NULL AND p.client_id IS NULL;
