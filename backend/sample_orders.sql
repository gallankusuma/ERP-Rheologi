-- Create sample customer
INSERT INTO customers (code, name, contact_person, email, phone, address, city, country, is_active)
VALUES ('CUST-001', 'PT Agro Mandiri Sejahtera', 'Budi Santoso', 'budi@agromandiri.co.id', '021-55512345', 'Jl. Industri Raya No. 88', 'Jakarta', 'Indonesia', 1);

INSERT INTO customers (code, name, contact_person, email, phone, address, city, country, is_active)
VALUES ('CUST-002', 'PT Perkebunan Nusantara', 'Sari Dewi', 'sari@ptpn.co.id', '021-77789012', 'Jl. Tebet Raya No. 25', 'Bogor', 'Indonesia', 1);

-- Create Sales Order 1 (2 items)
INSERT INTO sales_orders (so_number, customer_id, so_date, status, total_amount, notes)
VALUES ('SO-2026-0001', (SELECT id FROM customers WHERE code='CUST-001'), '2026-05-15', 'OPEN', 85000000, 'Order C2509 dan Cylo Bind');

INSERT INTO so_items (so_id, product_id, quantity, unit_price, line_total, notes)
VALUES (
  (SELECT id FROM sales_orders WHERE so_number='SO-2026-0001'),
  118, -- C2509 @ 200 ltr
  50,
  1000000,
  50000000,
  'C2509 @ 200 ltr - 50 drum'
);

INSERT INTO so_items (so_id, product_id, quantity, unit_price, line_total, notes)
VALUES (
  (SELECT id FROM sales_orders WHERE so_number='SO-2026-0001'),
  123, -- Cylo Bind @ 10 ltr
  200,
  175000,
  35000000,
  'Cylo Bind @ 10 ltr - 200 pcs'
);

-- Create Sales Order 2 (1 item - different customer)
INSERT INTO sales_orders (so_number, customer_id, so_date, status, total_amount, notes)
VALUES ('SO-2026-0002', (SELECT id FROM customers WHERE code='CUST-002'), '2026-05-18', 'OPEN', 60000000, 'Order Cylo Plus');

INSERT INTO so_items (so_id, product_id, quantity, unit_price, line_total, notes)
VALUES (
  (SELECT id FROM sales_orders WHERE so_number='SO-2026-0002'),
  129, -- Cylo plus @200 ltr
  30,
  2000000,
  60000000,
  'Cylo Plus @200 ltr - 30 drum'
);

SELECT 'DONE' as result;
