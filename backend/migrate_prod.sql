-- Schema-only migration for production (NO DATA CHANGES)
-- Adds missing columns needed by the new MPS module

-- 1. Add so_numbers column to mps_details (for merged SO references)
ALTER TABLE mps_details ADD COLUMN so_numbers TEXT DEFAULT NULL;

-- 2. Add production_qty column to mps_week_data (for rec. production per week)
ALTER TABLE mps_week_data ADD COLUMN production_qty DECIMAL(15,2) DEFAULT 0.00;
