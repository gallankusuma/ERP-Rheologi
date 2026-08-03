-- Add product link to client_projects so MPS can pull from it
ALTER TABLE client_projects ADD COLUMN product_id INT NULL AFTER client_id;
ALTER TABLE client_projects ADD COLUMN quantity DECIMAL(15,2) DEFAULT 0 AFTER product_id;
ALTER TABLE client_projects ADD CONSTRAINT fk_cp_product FOREIGN KEY (product_id) REFERENCES products(id);

-- Update existing project with product link (CYLO-BIND = product_id 123)
UPDATE client_projects SET product_id = 123, quantity = 264 WHERE id = 8;

-- Insert 2 more projects for the other BOM products
INSERT INTO client_projects (client_id, project_number, project_name, description, start_date, end_date, status, product_id, quantity)
VALUES (1, 'PRJ-C2509', 'C2509', 'C2509 @ 200 ltr - 50 drum', '2026-05-01', '2026-05-31', 'open', 118, 50);

INSERT INTO client_projects (client_id, project_number, project_name, description, start_date, end_date, status, product_id, quantity)
VALUES (1, 'PRJ-CYLOPLUS', 'CYLO-PLUS', 'Cylo Plus @200 ltr - 30 drum', '2026-05-05', '2026-06-05', 'open', 129, 30);
