ALTER TABLE rnd_milestones MODIFY COLUMN phase VARCHAR(50) DEFAULT 'formulation_design';
ALTER TABLE rnd_milestones MODIFY COLUMN status VARCHAR(20) DEFAULT 'pending';
