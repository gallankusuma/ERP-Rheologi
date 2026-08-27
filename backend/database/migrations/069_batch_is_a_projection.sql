-- A production batch stops being a second quantity authority and becomes what it describes:
-- the sum of the finished-goods lots that make it up.
--
-- Three things were wrong with it.
--
-- The quantity was whatever the first receipt happened to be. FG receipt looked the batch
-- number up, and if a row already existed it did nothing at all - so a second partial receipt
-- into the same batch left the header saying 100 when 250 had been received. Nothing ever
-- corrected it, because nothing else wrote that column.
--
-- The header had no idea which lots composed it. It carried a batch_number and so did the
-- lots, and the two were matched by text. A batch could not answer "what is in me", which is
-- exactly what a batch is for.
--
-- And batch_number was unique across the whole system, so two products could never carry the
-- same batch text - a real constraint in a plant that numbers batches per product line.

-- The link that makes the header a projection rather than a parallel record.
ALTER TABLE inventory_lots
  ADD COLUMN IF NOT EXISTS batch_id INT NULL
    COMMENT 'the production batch this lot belongs to; the batch quantity is the sum of these';

ALTER TABLE inventory_lots
  ADD INDEX IF NOT EXISTS idx_lots_batch (batch_id);

-- Match the lots that already exist to their batch by the text they were matched by until now,
-- and by product, so a text collision cannot attach a lot to the wrong product's batch.
UPDATE inventory_lots l
  JOIN batches b
    ON b.batch_number = l.batch_number
   AND b.product_id = l.product_id
   SET l.batch_id = b.id
 WHERE l.batch_id IS NULL AND l.batch_number IS NOT NULL;

ALTER TABLE inventory_lots
  ADD CONSTRAINT IF NOT EXISTS fk_lots_batch FOREIGN KEY (batch_id)
    REFERENCES batches(id) ON DELETE SET NULL;

-- A batch number identifies a batch of a product, not a batch in the universe. The replacement
-- index goes in before the old one comes out: the old unique key is the leftmost index on
-- batch_number and dropping it first would leave lookups without one.
ALTER TABLE batches
  ADD UNIQUE INDEX IF NOT EXISTS uq_batch_product_number (product_id, batch_number);

ALTER TABLE batches
  DROP INDEX IF EXISTS batch_number;

-- Bring the existing headers in line with the lots now attached to them, so the first read
-- after this migration already shows the projection rather than the old frozen figure. Batches
-- with no lots yet keep the quantity they were created with.
UPDATE batches b
   SET b.quantity = COALESCE((
         SELECT SUM(cl.quantity_received)
           FROM inventory_lots l
           JOIN inventory_cost_layers cl ON cl.lot_id = l.id
          WHERE l.batch_id = b.id
       ), b.quantity);
