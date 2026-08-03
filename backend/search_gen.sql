-- All PR records
SELECT pr.id, pr.pr_number, pr.status, pr.notes FROM purchase_requests pr ORDER BY pr.id;

-- All PO records  
SELECT po.id, po.po_number, po.status, po.notes FROM purchase_orders po ORDER BY po.id;

-- All GRN records
SELECT gr.id, gr.grn_number, gr.status FROM goods_receipts gr ORDER BY gr.id;

-- Check audit_log for deleted PR/PO
SELECT id, entity_type, entity_id, action, old_values FROM audit_log WHERE action = 'DELETE' AND (entity_type LIKE '%purchase%' OR entity_type LIKE '%pr%' OR entity_type LIKE '%po%') ORDER BY id DESC LIMIT 20;
