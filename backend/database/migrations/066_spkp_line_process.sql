-- The execution board becomes a picture of the shop floor.
--
-- Its columns were statuses, so the board answered "how far along is this work order". The
-- question people actually stand in front of the board asking is "what is on each tank right
-- now", and that is a different axis: one column per production line, cards moving across the
-- floor rather than through a lifecycle.
--
-- So an SPKP gains a line of its own rather than borrowing the work order's. A work order can
-- then be split across two tanks, or moved to a free one for a day, without rewriting the work
-- order itself. It also gains the step it is currently on, which is what turns a card from
-- "somewhere on tank 1" into "on tank 1, homogenising".
--
-- Status does not go away; it becomes a badge on the card, which is why spkp_stages stays.

ALTER TABLE spkp
  ADD COLUMN IF NOT EXISTS line_process_id INT NULL
    COMMENT 'the line this SPKP runs on; its own, not inherited from the work order',
  ADD COLUMN IF NOT EXISTS current_step_id INT NULL
    COMMENT 'which step of that line it is on right now',
  ADD COLUMN IF NOT EXISTS step_started_at TIMESTAMP NULL
    COMMENT 'when the current step began, so elapsed time can be read against the standard';

ALTER TABLE spkp
  ADD INDEX IF NOT EXISTS idx_spkp_line (line_process_id),
  ADD INDEX IF NOT EXISTS idx_spkp_step (current_step_id);

-- Start from the line the work order is already assigned to. Anything whose work order has no
-- line stays NULL and shows up in the board's unassigned column rather than disappearing.
UPDATE spkp s
  JOIN work_orders w ON w.id = s.wo_id
   SET s.line_process_id = w.line_process_id
 WHERE s.line_process_id IS NULL AND w.line_process_id IS NOT NULL;

-- A step belongs to exactly one line, so pointing at a step from another line would describe
-- something that cannot happen. The service checks this on write; the constraints keep the two
-- columns pointing at rows that exist.
ALTER TABLE spkp
  ADD CONSTRAINT IF NOT EXISTS fk_spkp_line_process FOREIGN KEY (line_process_id)
    REFERENCES line_processes(id) ON DELETE SET NULL;

ALTER TABLE spkp
  ADD CONSTRAINT IF NOT EXISTS fk_spkp_current_step FOREIGN KEY (current_step_id)
    REFERENCES line_process_steps(id) ON DELETE SET NULL;
