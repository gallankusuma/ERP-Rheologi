-- Add approval columns to bom_headers (matching PR/PO pattern)
ALTER TABLE bom_headers
  ADD COLUMN IF NOT EXISTS approval_status TINYINT DEFAULT 0 COMMENT '0=pending, 1=supervisor, 2=fully approved, -1=rejected',
  ADD COLUMN IF NOT EXISTS approved_by_supervisor_id INT NULL,
  ADD COLUMN IF NOT EXISTS approved_by_manager_id INT NULL,
  ADD COLUMN IF NOT EXISTS approved_at_supervisor TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS approved_at_manager TIMESTAMP NULL;

-- Set existing BOMs to pending
UPDATE bom_headers SET approval_status = 0 WHERE approval_status IS NULL;
