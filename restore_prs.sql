-- Restore deleted PRs from 2026-05-12 testing session
-- PR-20260511-3599 by Ario Andrianto (id 100003), linked to project PRJ-1778554741694
INSERT INTO purchase_requests (pr_number, requestor_id, project_id, status, approval_status, notes, request_date, needed_by, created_at)
VALUES (
  'PR-20260511-3599', 
  100003, 
  NULL,
  'DRAFT', 
  0,
  '{"noteText":"","itemType":"inventory","items":[{"productId":null,"productName":"Induction sealer DGFY-500A","name":"Induction sealer DGFY-500A","qty":1,"uom":"PCS","specification":"","price":100000}],"estimatedTotal":100000}',
  '2026-05-11',
  NULL,
  '2026-05-11 10:00:00'
);

-- PR-20260512-8468 by Master Admin (id 99999)
INSERT INTO purchase_requests (pr_number, requestor_id, project_id, status, approval_status, notes, request_date, needed_by, created_at)
VALUES (
  'PR-20260512-8468', 
  99999, 
  NULL,
  'DRAFT', 
  0,
  '{"noteText":"","itemType":"inventory","items":[{"productId":null,"productName":"Induction sealer DGFY-500A","name":"Induction sealer DGFY-500A","qty":1,"uom":"PCS","specification":"","price":100000}],"estimatedTotal":100000}',
  '2026-05-12',
  NULL,
  '2026-05-12 00:08:00'
);

-- PR-20260512-2305 by Master Admin (id 99999), had needed_by 2026-05-30
INSERT INTO purchase_requests (pr_number, requestor_id, project_id, status, approval_status, notes, request_date, needed_by, created_at)
VALUES (
  'PR-20260512-2305', 
  99999, 
  NULL,
  'DRAFT', 
  0,
  '{"noteText":"","itemType":"inventory","items":[{"productId":null,"productName":"Induction sealer DGFY-500A","name":"Induction sealer DGFY-500A","qty":2,"uom":"PCS","specification":"","price":100000}],"estimatedTotal":200000}',
  '2026-05-15',
  '2026-05-30',
  '2026-05-12 00:23:05'
);
