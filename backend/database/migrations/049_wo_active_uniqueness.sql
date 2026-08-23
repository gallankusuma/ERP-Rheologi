-- fix WO uniqueness: allow new WO for same mps_detail_id/week/year after CANCELLED
-- MySQL doesn't support partial unique indexes, so we use a generated column
-- that is NULL for terminal states (unique ignores NULLs)

ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS active_uniqueness_key VARCHAR(50)
  GENERATED ALWAYS AS (
    CASE WHEN UPPER(status) IN ('CANCELLED', 'SUPERSEDED') THEN NULL
         -- a work order not generated from an MPS detail has no planning slot to be
         -- unique within; folding those to NULL keeps them out of the constraint instead
         -- of collapsing every one of them onto the same key
         WHEN mps_detail_id IS NULL THEN NULL
         ELSE CONCAT(mps_detail_id, '-', IFNULL(week_number,''), '-', IFNULL(year,''))
    END
  ) STORED;

-- drop the old blocking constraint
DROP INDEX IF EXISTS uq_wo_mps_detail_week_year ON work_orders;

-- new unique: only enforced for non-terminal WOs
CREATE UNIQUE INDEX IF NOT EXISTS uq_wo_active_detail_week
  ON work_orders(active_uniqueness_key);
