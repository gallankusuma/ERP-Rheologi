-- P1-2: WO uniqueness constraint to prevent duplicate WOs for same MPS detail + week
-- Also includes year to prevent cross-year collisions

ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS year INT NULL;

-- unique index ensures one WO per MPS detail per week per year
CREATE UNIQUE INDEX IF NOT EXISTS uq_wo_mps_detail_week_year
  ON work_orders(mps_detail_id, week_number, year);
