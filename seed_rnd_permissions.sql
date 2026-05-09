-- Seed R&D module permissions
INSERT INTO permissions (resource, action, module, name, description) VALUES
('rnd.rnd-projects', 'view', 'R&D - R&D Projects', 'R&D Projects view', 'View R&D Projects'),
('rnd.rnd-projects', 'create', 'R&D - R&D Projects', 'R&D Projects create', 'Create R&D Projects'),
('rnd.rnd-projects', 'edit', 'R&D - R&D Projects', 'R&D Projects edit', 'Edit R&D Projects'),
('rnd.rnd-projects', 'delete', 'R&D - R&D Projects', 'R&D Projects delete', 'Delete R&D Projects'),
('rnd.rnd-projects', 'approve', 'R&D - R&D Projects', 'R&D Projects approve', 'Approve R&D Projects'),
('rnd.rnd-projects', 'export', 'R&D - R&D Projects', 'R&D Projects export', 'Export R&D Projects'),

('rnd.rnd-kanban', 'view', 'R&D - Kanban Board', 'Kanban Board view', 'View Kanban Board'),
('rnd.rnd-kanban', 'create', 'R&D - Kanban Board', 'Kanban Board create', 'Create Kanban Board'),
('rnd.rnd-kanban', 'edit', 'R&D - Kanban Board', 'Kanban Board edit', 'Edit Kanban Board'),
('rnd.rnd-kanban', 'delete', 'R&D - Kanban Board', 'Kanban Board delete', 'Delete Kanban Board'),
('rnd.rnd-kanban', 'approve', 'R&D - Kanban Board', 'Kanban Board approve', 'Approve Kanban Board'),
('rnd.rnd-kanban', 'export', 'R&D - Kanban Board', 'Kanban Board export', 'Export Kanban Board'),

('rnd.rnd-formulations', 'view', 'R&D - Formulations', 'Formulations view', 'View Formulations'),
('rnd.rnd-formulations', 'create', 'R&D - Formulations', 'Formulations create', 'Create Formulations'),
('rnd.rnd-formulations', 'edit', 'R&D - Formulations', 'Formulations edit', 'Edit Formulations'),
('rnd.rnd-formulations', 'delete', 'R&D - Formulations', 'Formulations delete', 'Delete Formulations'),
('rnd.rnd-formulations', 'approve', 'R&D - Formulations', 'Formulations approve', 'Approve Formulations'),
('rnd.rnd-formulations', 'export', 'R&D - Formulations', 'Formulations export', 'Export Formulations'),

('rnd.rnd-lab-testing', 'view', 'R&D - Lab Testing', 'Lab Testing view', 'View Lab Testing'),
('rnd.rnd-lab-testing', 'create', 'R&D - Lab Testing', 'Lab Testing create', 'Create Lab Testing'),
('rnd.rnd-lab-testing', 'edit', 'R&D - Lab Testing', 'Lab Testing edit', 'Edit Lab Testing'),
('rnd.rnd-lab-testing', 'delete', 'R&D - Lab Testing', 'Lab Testing delete', 'Delete Lab Testing'),
('rnd.rnd-lab-testing', 'approve', 'R&D - Lab Testing', 'Lab Testing approve', 'Approve Lab Testing'),
('rnd.rnd-lab-testing', 'export', 'R&D - Lab Testing', 'Lab Testing export', 'Export Lab Testing'),

('rnd.rnd-stability', 'view', 'R&D - Stability Studies', 'Stability Studies view', 'View Stability Studies'),
('rnd.rnd-stability', 'create', 'R&D - Stability Studies', 'Stability Studies create', 'Create Stability Studies'),
('rnd.rnd-stability', 'edit', 'R&D - Stability Studies', 'Stability Studies edit', 'Edit Stability Studies'),
('rnd.rnd-stability', 'delete', 'R&D - Stability Studies', 'Stability Studies delete', 'Delete Stability Studies'),
('rnd.rnd-stability', 'approve', 'R&D - Stability Studies', 'Stability Studies approve', 'Approve Stability Studies'),
('rnd.rnd-stability', 'export', 'R&D - Stability Studies', 'Stability Studies export', 'Export Stability Studies');
