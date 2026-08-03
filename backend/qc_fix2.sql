ALTER TABLE qc_specifications ADD COLUMN qc_type VARCHAR(50) DEFAULT 'Incoming';
ALTER TABLE qc_specifications ADD COLUMN uom VARCHAR(50);
SELECT 'qc_specifications fixed' as status;
