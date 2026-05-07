-- Upgrade R&D Projects with professional LIMS-grade fields
ALTER TABLE rnd_projects 
  ADD COLUMN project_type ENUM('new_product','reformulation','cost_reduction','process_improvement','raw_material_evaluation','custom_request','regulatory','other') DEFAULT 'new_product' AFTER name,
  ADD COLUMN category ENUM('chemical','polymer','coating','adhesive','additive','surfactant','agrochemical','pharmaceutical','other') DEFAULT 'chemical' AFTER project_type,
  ADD COLUMN regulatory_requirements VARCHAR(255) DEFAULT NULL AFTER category,
  ADD COLUMN target_market VARCHAR(255) DEFAULT NULL AFTER regulatory_requirements,
  ADD COLUMN target_product VARCHAR(255) DEFAULT NULL AFTER target_market,
  ADD COLUMN expected_output TEXT DEFAULT NULL AFTER target_product,
  ADD COLUMN risk_level ENUM('low','medium','high') DEFAULT 'medium' AFTER expected_output,
  ADD COLUMN confidentiality ENUM('public','internal','confidential','highly_confidential') DEFAULT 'internal' AFTER risk_level,
  ADD COLUMN team_members TEXT DEFAULT NULL AFTER confidentiality,
  ADD COLUMN tags VARCHAR(500) DEFAULT NULL AFTER team_members;
