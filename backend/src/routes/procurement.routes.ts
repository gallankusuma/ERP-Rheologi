import { Router, Request, Response } from 'express';
import db from '../config/database';
import { authMiddleware } from '../middleware/auth';

const router = Router();

const generateCode = (prefix: string) => {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${datePart}-${rand}`;
};

// Vendors CRUD
router.get('/vendors', authMiddleware, (req: Request, res: Response) => {
  try {
    const vendors = db.prepare('SELECT * FROM vendors ORDER BY name ASC').all();
    res.json({ data: vendors });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

router.get('/vendors/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    res.json({ data: vendor });
  } catch (error) {
    console.error('Error fetching vendor:', error);
    res.status(500).json({ error: 'Failed to fetch vendor' });
  }
});

router.post('/vendors', authMiddleware, (req: Request, res: Response) => {
  try {
    const { code, name, contact, phone, email, address } = req.body;
    if (!code || !name) return res.status(400).json({ error: 'code and name are required' });

    const result = db
      .prepare('INSERT INTO vendors (code, name, contact, phone, email, address) VALUES (?, ?, ?, ?, ?, ?)')
      .run(code, name, contact || null, phone || null, email || null, address || null);

    res.status(201).json({ message: 'Vendor created', data: { id: result.lastInsertRowid, code, name } });
  } catch (error: any) {
    console.error('Error creating vendor:', error);
    if (error.message?.includes('UNIQUE')) return res.status(400).json({ error: 'Vendor code must be unique' });
    res.status(500).json({ error: 'Failed to create vendor' });
  }
});

router.put('/vendors/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const { code, name, contact, phone, email, address } = req.body;
    db.prepare(
      'UPDATE vendors SET code = ?, name = ?, contact = ?, phone = ?, email = ?, address = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(code, name, contact, phone, email, address, req.params.id);
    res.json({ message: 'Vendor updated' });
  } catch (error) {
    console.error('Error updating vendor:', error);
    res.status(500).json({ error: 'Failed to update vendor' });
  }
});

router.delete('/vendors/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    db.prepare('DELETE FROM vendors WHERE id = ?').run(req.params.id);
    res.json({ message: 'Vendor deleted' });
  } catch (error) {
    console.error('Error deleting vendor:', error);
    res.status(500).json({ error: 'Failed to delete vendor' });
  }
});

// Purchase Requests
router.get('/purchase-requests', authMiddleware, (req: Request, res: Response) => {
  try {
    const prs = db
      .prepare(
        `SELECT pr.*, u.name as requester_name
         FROM purchase_requests pr
         LEFT JOIN users u ON pr.requester_id = u.id
         ORDER BY pr.created_at DESC`
      )
      .all();
    res.json({ data: prs });
  } catch (error) {
    console.error('Error fetching purchase requests:', error);
    res.status(500).json({ error: 'Failed to fetch purchase requests' });
  }
});

router.get('/purchase-requests/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const pr = db
      .prepare(
        `SELECT pr.*, u.name as requester_name
         FROM purchase_requests pr
         LEFT JOIN users u ON pr.requester_id = u.id
         WHERE pr.id = ?`
      )
      .get(req.params.id);
    if (!pr) return res.status(404).json({ error: 'Purchase request not found' });
    res.json({ data: pr });
  } catch (error) {
    console.error('Error fetching purchase request:', error);
    res.status(500).json({ error: 'Failed to fetch purchase request' });
  }
});

router.post('/purchase-requests', authMiddleware, (req: Request, res: Response) => {
  try {
    const { pr_number, requester_id, status, notes } = req.body;
    const number = pr_number || generateCode('PR');
    const requester = requester_id || (req as any).userId || null;

    const result = db
      .prepare('INSERT INTO purchase_requests (pr_number, requester_id, status, notes) VALUES (?, ?, ?, ?)')
      .run(number, requester, status || 'draft', notes || null);

    res.status(201).json({ message: 'Purchase request created', data: { id: result.lastInsertRowid, pr_number: number } });
  } catch (error: any) {
    console.error('Error creating purchase request:', error);
    if (error.message?.includes('UNIQUE')) return res.status(400).json({ error: 'PR number must be unique' });
    res.status(500).json({ error: 'Failed to create purchase request' });
  }
});

router.put('/purchase-requests/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const { status, notes } = req.body;
    db.prepare('UPDATE purchase_requests SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
      status,
      notes,
      req.params.id
    );
    res.json({ message: 'Purchase request updated' });
  } catch (error) {
    console.error('Error updating purchase request:', error);
    res.status(500).json({ error: 'Failed to update purchase request' });
  }
});

// Purchase Orders with items
router.get('/purchase-orders', authMiddleware, (req: Request, res: Response) => {
  try {
    const orders = db
      .prepare(
        `SELECT po.*, v.name as vendor_name,
                (SELECT COUNT(*) FROM purchase_order_items i WHERE i.po_id = po.id) as item_count
         FROM purchase_orders po
         LEFT JOIN vendors v ON po.vendor_id = v.id
         ORDER BY po.created_at DESC`
      )
      .all();
    res.json({ data: orders });
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    res.status(500).json({ error: 'Failed to fetch purchase orders' });
  }
});

router.get('/purchase-orders/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const order = db
      .prepare(
        `SELECT po.*, v.name as vendor_name, pr.pr_number
         FROM purchase_orders po
         LEFT JOIN vendors v ON po.vendor_id = v.id
         LEFT JOIN purchase_requests pr ON po.pr_id = pr.id
         WHERE po.id = ?`
      )
      .get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Purchase order not found' });

    const items = db
      .prepare(
        `SELECT i.*, p.sku, p.name as product_name
         FROM purchase_order_items i
         JOIN products p ON i.product_id = p.id
         WHERE i.po_id = ?`
      )
      .all(req.params.id);

    res.json({ data: { ...order, items } });
  } catch (error) {
    console.error('Error fetching purchase order:', error);
    res.status(500).json({ error: 'Failed to fetch purchase order' });
  }
});

router.post('/purchase-orders', authMiddleware, (req: Request, res: Response) => {
  try {
    const { po_number, vendor_id, pr_id, status, expected_date, currency, notes, items } = req.body;
    if (!vendor_id) return res.status(400).json({ error: 'vendor_id is required' });
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items are required' });
    }

    const number = po_number || generateCode('PO');
    const insertOrder = db.prepare(
      'INSERT INTO purchase_orders (po_number, vendor_id, pr_id, status, expected_date, currency, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const insertItem = db.prepare(
      'INSERT INTO purchase_order_items (po_id, product_id, quantity, uom, unit_price, currency, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    const tx = db.transaction(() => {
      const orderResult = insertOrder.run(
        number,
        vendor_id,
        pr_id || null,
        status || 'draft',
        expected_date || null,
        currency || 'IDR',
        notes || null
      );
      const poId = Number(orderResult.lastInsertRowid);
      for (const item of items) {
        insertItem.run(poId, item.product_id, item.quantity, item.uom || null, item.unit_price || 0, item.currency || currency || 'IDR', item.notes || null);
      }
      return poId;
    });

    const poId = tx();
    res.status(201).json({ message: 'Purchase order created', data: { id: poId, po_number: number } });
  } catch (error: any) {
    console.error('Error creating purchase order:', error);
    if (error.message?.includes('UNIQUE')) return res.status(400).json({ error: 'PO number must be unique' });
    res.status(500).json({ error: 'Failed to create purchase order' });
  }
});

router.put('/purchase-orders/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const { vendor_id, pr_id, status, expected_date, currency, notes, items } = req.body;
    const updateOrder = db.prepare(
      'UPDATE purchase_orders SET vendor_id = ?, pr_id = ?, status = ?, expected_date = ?, currency = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    );
    const deleteItems = db.prepare('DELETE FROM purchase_order_items WHERE po_id = ?');
    const insertItem = db.prepare(
      'INSERT INTO purchase_order_items (po_id, product_id, quantity, uom, unit_price, currency, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    const tx = db.transaction(() => {
      updateOrder.run(vendor_id, pr_id || null, status, expected_date || null, currency || 'IDR', notes || null, req.params.id);
      if (items && Array.isArray(items)) {
        deleteItems.run(req.params.id);
        for (const item of items) {
          insertItem.run(
            req.params.id,
            item.product_id,
            item.quantity,
            item.uom || null,
            item.unit_price || 0,
            item.currency || currency || 'IDR',
            item.notes || null
          );
        }
      }
    });

    tx();
    res.json({ message: 'Purchase order updated' });
  } catch (error) {
    console.error('Error updating purchase order:', error);
    res.status(500).json({ error: 'Failed to update purchase order' });
  }
});

// Goods Receipts
router.get('/goods-receipts', authMiddleware, (req: Request, res: Response) => {
  try {
    const receipts = db
      .prepare(
        `SELECT gr.*, po.po_number, w.name as warehouse_name
         FROM goods_receipts gr
         LEFT JOIN purchase_orders po ON gr.po_id = po.id
         LEFT JOIN warehouses w ON gr.warehouse_id = w.id
         ORDER BY gr.received_at DESC`
      )
      .all();
    res.json({ data: receipts });
  } catch (error) {
    console.error('Error fetching goods receipts:', error);
    res.status(500).json({ error: 'Failed to fetch goods receipts' });
  }
});

router.get('/goods-receipts/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const receipt = db
      .prepare(
        `SELECT gr.*, po.po_number, w.name as warehouse_name, u.name as received_by_name
         FROM goods_receipts gr
         LEFT JOIN purchase_orders po ON gr.po_id = po.id
         LEFT JOIN warehouses w ON gr.warehouse_id = w.id
         LEFT JOIN users u ON gr.received_by = u.id
         WHERE gr.id = ?`
      )
      .get(req.params.id);
    if (!receipt) return res.status(404).json({ error: 'Goods receipt not found' });
    res.json({ data: receipt });
  } catch (error) {
    console.error('Error fetching goods receipt:', error);
    res.status(500).json({ error: 'Failed to fetch goods receipt' });
  }
});

router.post('/goods-receipts', authMiddleware, (req: Request, res: Response) => {
  try {
    const { gr_number, po_id, warehouse_id, status, received_at, notes, received_by } = req.body;
    if (!po_id) return res.status(400).json({ error: 'po_id is required' });

    const number = gr_number || generateCode('GR');
    const receiver = received_by || (req as any).userId || null;

    const result = db
      .prepare(
        'INSERT INTO goods_receipts (gr_number, po_id, warehouse_id, received_by, status, received_at, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(number, po_id, warehouse_id || null, receiver, status || 'draft', received_at || null, notes || null);

    res.status(201).json({ message: 'Goods receipt created', data: { id: result.lastInsertRowid, gr_number: number } });
  } catch (error: any) {
    console.error('Error creating goods receipt:', error);
    if (error.message?.includes('UNIQUE')) return res.status(400).json({ error: 'GR number must be unique' });
    res.status(500).json({ error: 'Failed to create goods receipt' });
  }
});

export default router;
