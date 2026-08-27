-- A work order's material requirement stops being whatever the BOM says today.
--
-- Materials were exploded from the live BOM whenever someone asked for them, and only lines
-- that did not already exist were inserted. So a BOM edited after a work order was planned
-- changed what that work order needed: a new line appeared, a changed quantity did not, and
-- nobody could tell afterwards which recipe the order had actually been costed and planned
-- against. For a plant that has already issued material against those numbers, that is the
-- plan moving under the work.
--
-- The explosion is now frozen once, with a hash of the exact BOM lines it was taken from, so
-- the same question asked later gets the same answer and drift against the live BOM becomes
-- something you can see rather than something that silently happens.

CREATE TABLE IF NOT EXISTS wo_bom_snapshots (
  id INT PRIMARY KEY AUTO_INCREMENT,
  wo_id INT NOT NULL,
  bom_id INT NOT NULL,

  -- the quantity the explosion was run for; a different quantity is a different plan
  production_qty DECIMAL(15,4) NOT NULL,

  -- sha256 over the BOM lines as they stood when this was frozen. Comparing it to the live
  -- BOM later answers "has the recipe changed since we planned this" without guessing.
  bom_hash CHAR(64) NOT NULL,
  line_count INT NOT NULL DEFAULT 0,

  frozen_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  frozen_by INT NULL,

  -- one frozen plan per work order: re-running the explosion returns this rather than
  -- rewriting it, which is what makes the snapshot immutable in practice and not just in name
  UNIQUE KEY uq_wo_bom_snapshot (wo_id),
  KEY idx_wo_bom_snapshot_bom (bom_id),
  CONSTRAINT fk_wo_snapshot_wo FOREIGN KEY (wo_id) REFERENCES work_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Each requirement line records what it was derived from, so a line can be traced back to the
-- recipe row and the per-unit figure that produced it rather than only carrying a total.
ALTER TABLE wo_materials
  ADD COLUMN IF NOT EXISTS snapshot_id INT NULL
    COMMENT 'the frozen explosion this line came from',
  ADD COLUMN IF NOT EXISTS qty_per_unit DECIMAL(20,8) NULL
    COMMENT 'requirement per unit of output, as the BOM stated it when frozen';

ALTER TABLE wo_materials
  ADD INDEX IF NOT EXISTS idx_wo_materials_snapshot (snapshot_id);

ALTER TABLE wo_materials
  ADD CONSTRAINT IF NOT EXISTS fk_wo_materials_snapshot FOREIGN KEY (snapshot_id)
    REFERENCES wo_bom_snapshots(id) ON DELETE SET NULL;

-- A work order needs one requirement line per material, and it had nothing saying so: only a
-- primary key on id. Two people generating materials at the same moment could each insert a
-- line for the same product, and the upsert that keeps a frozen plan in step needs a key to
-- conflict on. Production carries 26 rows and no duplicate pairs, so this constrains what is
-- already true.
ALTER TABLE wo_materials
  ADD UNIQUE INDEX IF NOT EXISTS uq_wo_material_product (wo_id, product_id);
