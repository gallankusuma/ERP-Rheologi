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

// Customers CRUD
router.get('/customers', authMiddleware, (req: Request, res: Response) => {
  try {
    const customers = db.prepare('SELECT * FROM customers ORDER BY name ASC').all();
    res.json({ data: customers });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

router.get('/customers/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json({ data: customer });
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

router.post('/customers', authMiddleware, (req: Request, res: Response) => {
  try {
    const { code, name, contact, phone, email, address } = req.body;
    if (!code || !name) return res.status(400).json({ error: 'code and name are required' });

    const result = db
      .prepare('INSERT INTO customers (code, name, contact, phone, email, address) VALUES (?, ?, ?, ?, ?, ?)')
      .run(code, name, contact || null, phone || null, email || null, address || null);

    res.status(201).json({ message: 'Customer created', data: { id: result.lastInsertRowid, code, name } });
  } catch (error: any) {
    console.error('Error creating customer:', error);
    if (error.message?.includes('UNIQUE')) return res.status(400).json({ error: 'Customer code must be unique' });
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

router.put('/customers/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const { code, name, contact, phone, email, address } = req.body;
    db.prepare(
      'UPDATE customers SET code = ?, name = ?, contact = ?, phone = ?, email = ?, address = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(code, name, contact, phone, email, address, req.params.id);
    res.json({ message: 'Customer updated' });
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

router.delete('/customers/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
    res.json({ message: 'Customer deleted' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

// Sales Orders
router.get('/sales-orders', authMiddleware, (req: Request, res: Response) => {
  try {
    const orders = db
      .prepare(
        `SELECT so.*, c.name as customer_name,
                (SELECT COUNT(*) FROM sales_order_items i WHERE i.so_id = so.id) as item_count
         FROM sales_orders so
         LEFT JOIN customers c ON so.customer_id = c.id
         ORDER BY so.created_at DESC`
      )
      .all();
    res.json({ data: orders });
  } catch (error) {
    console.error('Error fetching sales orders:', error);
    res.status(500).json({ error: 'Failed to fetch sales orders' });
  }
});

router.get('/sales-orders/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const order = db
      .prepare(
        `SELECT so.*, c.name as customer_name
         FROM sales_orders so
         LEFT JOIN customers c ON so.customer_id = c.id
         WHERE so.id = ?`
      )
      .get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Sales order not found' });

    const items = db
      .prepare(
        `SELECT i.*, p.sku, p.name as product_name
         FROM sales_order_items i
         JOIN products p ON i.product_id = p.id
         WHERE i.so_id = ?`
      )
      .all(req.params.id);

    res.json({ data: { ...order, items } });
  } catch (error) {
    console.error('Error fetching sales order:', error);
    res.status(500).json({ error: 'Failed to fetch sales order' });
  }
});

router.post('/sales-orders', authMiddleware, (req: Request, res: Response) => {
  try {
    const { so_number, customer_id, status, expected_ship_date, currency, notes, items } = req.body;
    if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items are required' });
    }

    const number = so_number || generateCode('SO');
    const insertOrder = db.prepare(
      'INSERT INTO sales_orders (so_number, customer_id, status, expected_ship_date, currency, notes) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const insertItem = db.prepare(
      'INSERT INTO sales_order_items (so_id, product_id, quantity, uom, unit_price, currency, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    const tx = db.transaction(() => {
      const orderResult = insertOrder.run(number, customer_id, status || 'draft', expected_ship_date || null, currency || 'IDR', notes || null);
      const soId = Number(orderResult.lastInsertRowid);
      for (const item of items) {
        insertItem.run(soId, item.product_id, item.quantity, item.uom || null, item.unit_price || 0, item.currency || currency || 'IDR', item.notes || null);
      }
      return soId;
    });

    const soId = tx();
    res.status(201).json({ message: 'Sales order created', data: { id: soId, so_number: number } });
  } catch (error: any) {
    console.error('Error creating sales order:', error);
    if (error.message?.includes('UNIQUE')) return res.status(400).json({ error: 'SO number must be unique' });
    res.status(500).json({ error: 'Failed to create sales order' });
  }
});

router.put('/sales-orders/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const { customer_id, status, expected_ship_date, currency, notes, items } = req.body;
    const updateOrder = db.prepare(
      'UPDATE sales_orders SET customer_id = ?, status = ?, expected_ship_date = ?, currency = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    );
    const deleteItems = db.prepare('DELETE FROM sales_order_items WHERE so_id = ?');
    const insertItem = db.prepare(
      'INSERT INTO sales_order_items (so_id, product_id, quantity, uom, unit_price, currency, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    const tx = db.transaction(() => {
      updateOrder.run(customer_id, status, expected_ship_date || null, currency || 'IDR', notes || null, req.params.id);
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
    res.json({ message: 'Sales order updated' });
  } catch (error) {
    console.error('Error updating sales order:', error);
    res.status(500).json({ error: 'Failed to update sales order' });
  }
});

// Deliveries
router.get('/deliveries', authMiddleware, (req: Request, res: Response) => {
  try {
    const deliveries = db
      .prepare(
        `SELECT d.*, so.so_number, w.name as warehouse_name
         FROM deliveries d
         LEFT JOIN sales_orders so ON d.so_id = so.id
         LEFT JOIN warehouses w ON d.warehouse_id = w.id
         ORDER BY d.created_at DESC`
      )
      .all();
    res.json({ data: deliveries });
  } catch (error) {
    console.error('Error fetching deliveries:', error);
    res.status(500).json({ error: 'Failed to fetch deliveries' });
  }
});

router.get('/deliveries/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const delivery = db
      .prepare(
        `SELECT d.*, so.so_number, w.name as warehouse_name
         FROM deliveries d
         LEFT JOIN sales_orders so ON d.so_id = so.id
         LEFT JOIN warehouses w ON d.warehouse_id = w.id
         WHERE d.id = ?`
      )
      .get(req.params.id);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
    res.json({ data: delivery });
  } catch (error) {
    console.error('Error fetching delivery:', error);
    res.status(500).json({ error: 'Failed to fetch delivery' });
  }
});

router.post('/deliveries', authMiddleware, (req: Request, res: Response) => {
  try {
    const { do_number, so_id, warehouse_id, status, shipped_at, notes } = req.body;
    if (!so_id) return res.status(400).json({ error: 'so_id is required' });

    const number = do_number || generateCode('DO');
    const result = db
      .prepare('INSERT INTO deliveries (do_number, so_id, warehouse_id, status, shipped_at, notes) VALUES (?, ?, ?, ?, ?, ?)')
      .run(number, so_id, warehouse_id || null, status || 'draft', shipped_at || null, notes || null);

    res.status(201).json({ message: 'Delivery created', data: { id: result.lastInsertRowid, do_number: number } });
  } catch (error: any) {
    console.error('Error creating delivery:', error);
    if (error.message?.includes('UNIQUE')) return res.status(400).json({ error: 'DO number must be unique' });
    res.status(500).json({ error: 'Failed to create delivery' });
  }
});

// Invoices
router.get('/invoices', authMiddleware, (req: Request, res: Response) => {
  try {
    const invoices = db
      .prepare(
        `SELECT i.*, so.so_number
         FROM invoices i
         LEFT JOIN sales_orders so ON i.so_id = so.id
         ORDER BY i.issued_at DESC`
      )
      .all();
    res.json({ data: invoices });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

router.get('/invoices/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const invoice = db
      .prepare(
        `SELECT i.*, so.so_number
         FROM invoices i
         LEFT JOIN sales_orders so ON i.so_id = so.id
         WHERE i.id = ?`
      )
      .get(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ data: invoice });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

router.post('/invoices', authMiddleware, (req: Request, res: Response) => {
  try {
    const { invoice_number, so_id, amount, currency, status, issued_at, due_at, notes } = req.body;
    if (!so_id || amount === undefined) return res.status(400).json({ error: 'so_id and amount are required' });

    const number = invoice_number || generateCode('INV');
    const result = db
      .prepare('INSERT INTO invoices (invoice_number, so_id, amount, currency, status, issued_at, due_at, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(number, so_id, amount, currency || 'IDR', status || 'unpaid', issued_at || null, due_at || null, notes || null);

    res.status(201).json({ message: 'Invoice created', data: { id: result.lastInsertRowid, invoice_number: number } });
  } catch (error: any) {
    console.error('Error creating invoice:', error);
    if (error.message?.includes('UNIQUE')) return res.status(400).json({ error: 'Invoice number must be unique' });
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

router.put('/invoices/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const { so_id, amount, currency, status, issued_at, due_at, notes } = req.body;
    db.prepare(
      'UPDATE invoices SET so_id = ?, amount = ?, currency = ?, status = ?, issued_at = COALESCE(?, issued_at), due_at = COALESCE(?, due_at), notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(so_id, amount, currency || 'IDR', status, issued_at || null, due_at || null, notes || null, req.params.id);
    res.json({ message: 'Invoice updated' });
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

export default router;
