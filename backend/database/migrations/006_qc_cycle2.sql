-- QC Cycle #2 — NCR/FPA/Rework integration columns

-- link NCR back to the FPA that triggered it
ALTER TABLE qc_ncr ADD COLUMN source_fpa_id INT NULL;
ALTER TABLE qc_ncr ADD COLUMN source_type VARCHAR(30) NULL DEFAULT 'manual';

-- link rework to re-test FPA
ALTER TABLE qc_rework_orders ADD COLUMN retest_fpa_id INT NULL;
