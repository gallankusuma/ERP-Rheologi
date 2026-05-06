SET FOREIGN_KEY_CHECKS=0;

-- Master Data Injection from Master Data.xlsx
-- Generated: 2026-04-30T15:06:51.430Z

-- 1. PRODUCT TYPES
DELETE FROM product_types;
INSERT INTO product_types (code, name, description, active) VALUES ('RM', 'Raw Material', 'Raw materials and ingredients', 1);
INSERT INTO product_types (code, name, description, active) VALUES ('PM', 'Packaging Material', 'Packaging materials and containers', 1);
INSERT INTO product_types (code, name, description, active) VALUES ('FG', 'Finished Goods', 'Ready-to-sell finished products', 1);
INSERT INTO product_types (code, name, description, active) VALUES ('SR', 'Spare Part', 'Spare parts and components', 1);
INSERT INTO product_types (code, name, description, active) VALUES ('SV', 'Service Products', 'Service-related products', 1);
INSERT INTO product_types (code, name, description, active) VALUES ('OS', 'Others', 'Miscellaneous items', 1);

-- 2. UNITS OF MEASURE
INSERT IGNORE INTO uom (code, name, active) VALUES ('KG', 'Kilogram', 1);
INSERT IGNORE INTO uom (code, name, active) VALUES ('L', 'Liter', 1);
INSERT IGNORE INTO uom (code, name, active) VALUES ('PCS', 'Pieces', 1);

-- 3. CATEGORIES
INSERT IGNORE INTO categories (name, description, active) VALUES ('Raw Material', 'Raw Material', 1);
INSERT IGNORE INTO categories (name, description, active) VALUES ('Chemical', 'Chemical', 1);
INSERT IGNORE INTO categories (name, description, active) VALUES ('Packaging', 'Packaging', 1);
INSERT IGNORE INTO categories (name, description, active) VALUES ('Finished Product', 'Finished Product', 1);

-- 4. PRODUCTS (62 Master Items)
DELETE FROM products;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IRM1020001', 'Pellicle', 'Main component',
    (SELECT id FROM categories WHERE name = 'Raw Material' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'RM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'KG' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IRM1022002', 'Carboxymethyl cellulose', 'Thickener',
    (SELECT id FROM categories WHERE name = 'Chemical' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'RM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'KG' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IRM1022003', 'Carboxymethyl cellulose', 'Thickener',
    (SELECT id FROM categories WHERE name = 'Chemical' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'RM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'KG' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IRM1022004', 'Raw Water', 'Solvent',
    (SELECT id FROM categories WHERE name = 'Chemical' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'RM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'L' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IRM1022005', 'Bronopol', 'Preservative',
    (SELECT id FROM categories WHERE name = 'Chemical' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'RM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'KG' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IRM1022006', 'Kaporit', 'Desinfectant agent',
    (SELECT id FROM categories WHERE name = 'Chemical' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'RM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'KG' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IRM1022007', 'Emulan', 'Surfactant',
    (SELECT id FROM categories WHERE name = 'Chemical' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'RM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'L' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IRM1022008', 'Voxanol GA7', 'Surfactant',
    (SELECT id FROM categories WHERE name = 'Chemical' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'RM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'L' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IRM1022009', 'Sodium bisulfite', 'Cleaning agent of pellicle',
    (SELECT id FROM categories WHERE name = 'Chemical' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'RM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'KG' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IRM1022010', 'Sodium hydroxide', 'Cleaning agent of pellicle',
    (SELECT id FROM categories WHERE name = 'Chemical' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'RM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'KG' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223011', 'Label sticker karton box C2509', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223012', 'Label sticker karton box Cylo Bind', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223013', 'Label sticker karton box Cylo Plus', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223014', 'Label sticker Cylo Bind @2.5 gal (sisi depan)', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223015', 'Label sticker Cylo Bind @2.5 gal (sisi belakang)', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223016', 'Label sticker C2509 @100 ml, botol PE', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223017', 'Label sticker C2509 @500 ml, botol PE', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223018', 'Label sticker C2509 @ 1 L, botol PE', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223019', 'Label sticker C2509 @ 5 L, jerrycan', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223020', 'Label sticker C2509 @ 200 ltr, drum', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223021', 'Label sticker Cylo Bind @100 ml, botol PE', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223022', 'Label sticker Cylo Bind @500 ml, botol PE', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223023', 'Label sticker Cylo Bind @ 1 L, botol PE', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223024', 'Label sticker Cylo Bind @ 5 L, jerrycan', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223025', 'Label sticker Cylo Bind @ 200 ltr, drum', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223026', 'Label sticker Cylo plus @100 ml, botol PE', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223027', 'Label sticker Cylo plus @500 ml, botol PE', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223028', 'Label sticker Cylo plus @ 1 L, botol PE', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223029', 'Label sticker Cylo plus @ 5 L, jerrycan', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223030', 'Label sticker Cylo plus @ 200 ltr, drum', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223031', 'Botol PE white @ 100 ml dengan induction seal', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223032', 'Tutup botol PE @ 100 ml', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223033', 'Botol PE white @500 ml', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223034', 'Botol PE white @ 1 ltr', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223035', 'Tutup botol PE white @500 ml/1 ltr', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223036', 'Inner plug botol PE white', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223037', 'Jerrycan PE white @ 5 ltr', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223038', 'Cap Jerrycan PE white @ 5 ltr', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223039', 'Inner plug jerrycan PE white', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223040', 'Jerrycan PE white @2.5 gal', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223041', 'Cap Jerrycan PE white @2.5 gal', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223042', 'Drum PE Biru @ 200 ltr', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223043', 'Seal drum PE biru @ 200 ltr', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223044', 'Carboard box white (360×250×324 mm)', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223045', 'Clear packaging tape', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IPM1223046', 'Pallet (1100×1100 mm)', 'Packaging material',
    (SELECT id FROM categories WHERE name = 'Packaging' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'PM' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IFG1021047', 'C2509 @ 100 ml', 'Finish Good',
    (SELECT id FROM categories WHERE name = 'Finished Product' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'FG' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IFG1021048', 'C2509 @500 ml', 'Finish Good',
    (SELECT id FROM categories WHERE name = 'Finished Product' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'FG' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IFG1021049', 'C2509 @ 1 ltr', 'Finish Good',
    (SELECT id FROM categories WHERE name = 'Finished Product' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'FG' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IFG1021050', 'C2509 @ 5 ltr', 'Finish Good',
    (SELECT id FROM categories WHERE name = 'Finished Product' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'FG' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IFG1021051', 'C2509 @ 200 ltr', 'Finish Good',
    (SELECT id FROM categories WHERE name = 'Finished Product' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'FG' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IFG1021052', 'Cylo Bind @ 100 ml', 'Finish Good',
    (SELECT id FROM categories WHERE name = 'Finished Product' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'FG' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IFG1021053', 'Cylo Bind @500 ml', 'Finish Good',
    (SELECT id FROM categories WHERE name = 'Finished Product' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'FG' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IFG1021054', 'Cylo Bind @ 1 ltr', 'Finish Good',
    (SELECT id FROM categories WHERE name = 'Finished Product' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'FG' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IFG1021055', 'Cylo Bind @ 5 ltr', 'Finish Good',
    (SELECT id FROM categories WHERE name = 'Finished Product' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'FG' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IFG1021056', 'Cylo Bind @ 10 ltr', 'Finish Good',
    (SELECT id FROM categories WHERE name = 'Finished Product' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'FG' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IFG1021057', 'Cylo Plus @100 ml', 'Finish Good',
    (SELECT id FROM categories WHERE name = 'Finished Product' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'FG' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IFG1021058', 'Cylo plus @500 ml', 'Finish Good',
    (SELECT id FROM categories WHERE name = 'Finished Product' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'FG' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IFG1021059', 'Cylo plus @1 ltr', 'Finish Good',
    (SELECT id FROM categories WHERE name = 'Finished Product' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'FG' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IFG1021060', 'Cylo Plus @ 5 ltr', 'Finish Good',
    (SELECT id FROM categories WHERE name = 'Finished Product' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'FG' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IFG1021061', 'Cylo plus @ 10 ltr', 'Finish Good',
    (SELECT id FROM categories WHERE name = 'Finished Product' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'FG' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;
INSERT INTO products (sku, name, description, category_id, product_type_id, unit_of_measure_id, standard_cost, reorder_point, active)
  SELECT 'IFG1021062', 'Cylo plus @200 ltr', 'Finish Good',
    (SELECT id FROM categories WHERE name = 'Finished Product' LIMIT 1),
    (SELECT id FROM product_types WHERE code = 'FG' LIMIT 1),
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    0, 0, 1;

-- 5. BILL OF MATERIALS
DELETE FROM bom_details;
DELETE FROM bom_headers;

-- BOM: Cylo @200 ltr
INSERT INTO bom_headers (product_name, product_id, version, status, notes)
  SELECT 'Cylo @200 ltr',
    (SELECT id FROM products WHERE sku = 'IFG1021051' LIMIT 1),
    1, 'ACTIVE', 'BOM Cylo @200 ltr';
SET @bom_id = LAST_INSERT_ID();
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IRM1020001' LIMIT 1),
    100.7,
    (SELECT id FROM uom WHERE code = 'KG' LIMIT 1),
    1;
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IRM1022002' LIMIT 1),
    0.81,
    (SELECT id FROM uom WHERE code = 'KG' LIMIT 1),
    2;
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IRM1022004' LIMIT 1),
    902.62,
    (SELECT id FROM uom WHERE code = 'KG' LIMIT 1),
    3;
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IRM1022005' LIMIT 1),
    0.81,
    (SELECT id FROM uom WHERE code = 'KG' LIMIT 1),
    4;
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IRM1022006' LIMIT 1),
    0.05,
    (SELECT id FROM uom WHERE code = 'KG' LIMIT 1),
    5;
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IRM1022009' LIMIT 1),
    2.01,
    (SELECT id FROM uom WHERE code = 'KG' LIMIT 1),
    6;
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IPM1223020' LIMIT 1),
    1,
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    7;
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IPM1223042' LIMIT 1),
    1,
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    8;
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IPM1223043' LIMIT 1),
    1,
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    9;
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IPM1223046' LIMIT 1),
    1,
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    10;

-- BOM: Cylo Bind @2.5 gal
INSERT INTO bom_headers (product_name, product_id, version, status, notes)
  SELECT 'Cylo Bind @2.5 gal',
    (SELECT id FROM products WHERE sku = 'IFG1021056' LIMIT 1),
    1, 'ACTIVE', 'BOM Cylo Bind @2.5 gal';
SET @bom_id = LAST_INSERT_ID();
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IRM1020001' LIMIT 1),
    201.4,
    (SELECT id FROM uom WHERE code = 'KG' LIMIT 1),
    1;
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IRM1022002' LIMIT 1),
    0.81,
    (SELECT id FROM uom WHERE code = 'KG' LIMIT 1),
    2;
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IRM1022004' LIMIT 1),
    801.92,
    (SELECT id FROM uom WHERE code = 'KG' LIMIT 1),
    3;
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IRM1022005' LIMIT 1),
    0.81,
    (SELECT id FROM uom WHERE code = 'KG' LIMIT 1),
    4;
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IRM1022006' LIMIT 1),
    0.05,
    (SELECT id FROM uom WHERE code = 'KG' LIMIT 1),
    5;
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IRM1022009' LIMIT 1),
    2.01,
    (SELECT id FROM uom WHERE code = 'KG' LIMIT 1),
    6;
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IPM1223014' LIMIT 1),
    1,
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    7;
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IPM1223015' LIMIT 1),
    1,
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    8;
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IPM1223040' LIMIT 1),
    1,
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    9;
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IPM1223041' LIMIT 1),
    1,
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    10;
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IPM1223044' LIMIT 1),
    1,
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    11;
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IPM1223045' LIMIT 1),
    1,
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    12;
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IPM1223046' LIMIT 1),
    1,
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    13;

-- BOM: Cylo Plus @200 ltr
INSERT INTO bom_headers (product_name, product_id, version, status, notes)
  SELECT 'Cylo Plus @200 ltr',
    (SELECT id FROM products WHERE sku = 'IFG1021062' LIMIT 1),
    1, 'ACTIVE', 'BOM Cylo Plus @200 ltr';
SET @bom_id = LAST_INSERT_ID();
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IRM1020001' LIMIT 1),
    100.7,
    (SELECT id FROM uom WHERE code = 'KG' LIMIT 1),
    1;
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IRM1022002' LIMIT 1),
    0.81,
    (SELECT id FROM uom WHERE code = 'KG' LIMIT 1),
    2;
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IRM1022004' LIMIT 1),
    902.62,
    (SELECT id FROM uom WHERE code = 'KG' LIMIT 1),
    3;
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IRM1022005' LIMIT 1),
    0.81,
    (SELECT id FROM uom WHERE code = 'KG' LIMIT 1),
    4;
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IRM1022006' LIMIT 1),
    0.05,
    (SELECT id FROM uom WHERE code = 'KG' LIMIT 1),
    5;
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IRM1022009' LIMIT 1),
    2.01,
    (SELECT id FROM uom WHERE code = 'KG' LIMIT 1),
    6;
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IRM1022007' LIMIT 1),
    335.6666666666667,
    (SELECT id FROM uom WHERE code = 'L' LIMIT 1),
    7;
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IPM1223030' LIMIT 1),
    1,
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    8;
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IPM1223042' LIMIT 1),
    1,
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    9;
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IPM1223043' LIMIT 1),
    1,
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    10;
INSERT INTO bom_details (bom_header_id, raw_material_id, quantity, unit_of_measure_id, sequence)
  SELECT @bom_id,
    (SELECT id FROM products WHERE sku = 'IPM1223046' LIMIT 1),
    1,
    (SELECT id FROM uom WHERE code = 'PCS' LIMIT 1),
    11;

SET FOREIGN_KEY_CHECKS=1;

-- VERIFY:
SELECT 'product_types' as tbl, COUNT(*) as cnt FROM product_types
UNION SELECT 'categories', COUNT(*) FROM categories
UNION SELECT 'uom', COUNT(*) FROM uom
UNION SELECT 'products', COUNT(*) FROM products
UNION SELECT 'bom_headers', COUNT(*) FROM bom_headers
UNION SELECT 'bom_details', COUNT(*) FROM bom_details;
