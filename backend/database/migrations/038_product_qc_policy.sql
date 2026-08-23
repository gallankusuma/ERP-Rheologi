-- PLAY-NEXT-P0-3: add explicit QC policy to product master
-- absence of this column defaults to REQUIRED (fail closed)
ALTER TABLE products ADD COLUMN IF NOT EXISTS qc_policy ENUM('REQUIRED', 'NOT_REQUIRED') NULL DEFAULT NULL;
-- NULL = not explicitly set = treated as REQUIRED by the service layer
