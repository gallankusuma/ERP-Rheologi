-- migration: add mps_detail_id FK column to purchase_request_items for lineage tracking
-- replaces the JSON string mps_detail_ids with a proper FK for single-detail PRs

ALTER TABLE purchase_request_items
  ADD COLUMN IF NOT EXISTS mps_detail_id INT NULL;

-- note: existing mps_detail_ids column (JSON string) is preserved for backward compat
-- new code should use mps_detail_id (FK) when available
-- legacy records with only mps_detail_ids JSON are not migrated (per Review.md rule #10:
-- "don't silently repair business data in migration")
