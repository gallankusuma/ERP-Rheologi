-- Zero-value inventory events must be recorded, not skipped.
--
-- A receipt with no cost cannot produce a balanced journal, because a journal line with
-- neither debit nor credit is invalid. Such an event is therefore recorded as a STATISTICAL
-- accounting event: it carries the source lineage and the posting profile that approved it,
-- but no journal lines. This keeps "every posted stock event has an accounting record" true
-- without fabricating a zero-amount journal.

ALTER TABLE accounting_events
  MODIFY COLUMN status ENUM('RECEIVED','VALIDATED','POSTED','STATISTICAL','FAILED','REVERSED') DEFAULT 'RECEIVED';

-- A zero-value posting is only permitted when an approved, active, effective posting profile
-- named ZERO_VALUE_ALLOWED exists for the event type. Nothing is seeded here on purpose:
-- the default is deny, and enabling it is a deliberate, attributable Finance decision.
ALTER TABLE posting_profiles
  ADD COLUMN IF NOT EXISTS zero_value_reason VARCHAR(255) NULL
    COMMENT 'why zero-value postings are permitted for this event type';
