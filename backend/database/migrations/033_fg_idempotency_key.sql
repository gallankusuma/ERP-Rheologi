-- P1-6: explicit idempotency key column for stock_movements
-- replaces notes LIKE '%key%' pattern with proper unique constraint

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100) NULL;

-- unique index ensures one event per idempotency key
CREATE UNIQUE INDEX IF NOT EXISTS uq_sm_idempotency_key ON stock_movements(idempotency_key);
