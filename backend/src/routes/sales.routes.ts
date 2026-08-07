import { Router, Request, Response } from 'express';
import { dbAll, dbGet, dbRun } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';

const router = Router();

const generateCode = (prefix: string) => {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${datePart}-${rand}`;
};

// Customers CRUD
router.get('/customers', authMiddleware, async (req: Request, res: Response) => {
  try {
    const customers = await dbAll('SELECT * FROM customers ORDER BY name ASC', []);
    res.json({ data: customers });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

router.get('/customers/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const customer = await dbGet('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json({ data: customer });
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

router.post('/customers', authMiddleware, requirePermission('crm.sales', 'create'), async (req: Request, res: Response) => {
  try {
    const { code, name, contact, phone, email, address } = req.body;
    if (!code || !name) return res.status(400).json({ error: 'code and name are required' });

    const result = await dbRun(
      'INSERT INTO customers (code, name, contact, phone, email, address) VALUES (?, ?, ?, ?, ?, ?)',
      [code, name, contact || null, phone || null, email || null, address || null]
    );

    res.status(201).json({ message: 'Customer created', data: { id: result.insertId, code, name } });
  } catch (error: any) {
    console.error('Error creating customer:', error);
    if (error.message?.includes('Duplicate entry')) return res.status(400).json({ error: 'Customer code must be unique' });
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

router.put('/customers/:id', authMiddleware, requirePermission('crm.sales', 'update'), async (req: Request, res: Response) => {
  try {
    const { code, name, contact, phone, email, address } = req.body;
    await dbRun(
      'UPDATE customers SET code = ?, name = ?, contact = ?, phone = ?, email = ?, address = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [code, name, contact || null, phone || null, email || null, address || null, req.params.id]
    );
    res.json({ message: 'Customer updated' });
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

router.delete('/customers/:id', authMiddleware, requirePermission('crm.sales', 'delete'), async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM customers WHERE id = ?', [req.params.id]);
    res.json({ message: 'Customer deleted' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

// GET /crm-clients - List CRM clients for SO dropdown
router.get('/crm-clients', authMiddleware, async (req: Request, res: Response) => {
  try {
    const clients = await dbAll(
      `SELECT id, code, name, organization, phone, address FROM clients WHERE is_active = 1 ORDER BY name ASC`
    );
    res.json({ data: clients });
  } catch (error) {
    console.error('Error fetching CRM clients:', error);
    res.status(500).json({ error: 'Failed to fetch CRM clients' });
  }
});

// Sales Orders
router.get('/sales-orders', authMiddleware, requirePermission('sales.sales-orders-list', 'view'), async (req: Request, res: Response) => {
  try {
    const orders = await dbAll(
      `SELECT so.*,
              COALESCE(cl.name, c.name) as customer_name,
              cl.name as client_name,
              c.name as legacy_customer_name,
              l.company as lead_company,
              (SELECT COUNT(*) FROM so_items i WHERE i.so_id = so.id) as item_count
         FROM sales_orders so
         LEFT JOIN customers c ON so.customer_id = c.id
         LEFT JOIN clients cl ON so.client_id = cl.id
         LEFT JOIN leads l ON so.lead_id = l.id
         ORDER BY so.created_at DESC`
    );
    res.json({ data: orders });
  } catch (error) {
    console.error('Error fetching sales orders:', error);
    res.status(500).json({ error: 'Failed to fetch sales orders' });
  }
});

router.get('/sales-orders/:id', authMiddleware, requirePermission('sales.sales-orders-list', 'view'), async (req: Request, res: Response) => {
  try {
    const order = await dbGet(
      `SELECT so.*,
              COALESCE(cl.name, c.name) as customer_name,
              cl.name as client_name, cl.code as client_code,
              l.company as lead_company, l.stage as lead_stage,
              cp.project_name, cp.project_number, cp.status as project_status
         FROM sales_orders so
         LEFT JOIN customers c ON so.customer_id = c.id
         LEFT JOIN clients cl ON so.client_id = cl.id
         LEFT JOIN leads l ON so.lead_id = l.id
         LEFT JOIN client_projects cp ON so.project_id = cp.id
         WHERE so.id = ?`,
      [req.params.id]
    );
    if (!order) return res.status(404).json({ error: 'Sales order not found' });

    const items = await dbAll(
      `SELECT i.*, p.sku, p.name as product_name, u.code as uom
         FROM so_items i
         JOIN products p ON i.product_id = p.id
         LEFT JOIN uom u ON p.unit_of_measure_id = u.id
         WHERE i.so_id = ?`,
      [req.params.id]
    );

    res.json({ data: { ...order, items } });
  } catch (error) {
    console.error('Error fetching sales order:', error);
    res.status(500).json({ error: 'Failed to fetch sales order' });
  }
});

router.post('/sales-orders', authMiddleware, requirePermission('crm.sales', 'create'), async (req: Request, res: Response) => {
  try {
    const { so_number, customer_id, client_id, lead_id, status, expected_ship_date, currency, notes, items } = req.body;
    
    // Must have either customer_id (legacy) or client_id (CRM)
    if (!customer_id && !client_id) return res.status(400).json({ error: 'customer_id or client_id is required' });
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items are required' });
    }

    const number = so_number || generateCode('SO');
    const soDate = new Date().toISOString().split('T')[0];
    // Sanitize date: MySQL DATE column needs YYYY-MM-DD, not ISO timestamp
    const shipDate = expected_ship_date ? expected_ship_date.toString().split('T')[0] : null;

    const orderResult = await dbRun(
      `INSERT INTO sales_orders (so_number, customer_id, client_id, lead_id, so_date, status, expected_ship_date, currency, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [number, customer_id || null, client_id || null, lead_id || null, soDate, status || 'draft', shipDate, currency || 'IDR', notes || null]
    );
    const soId = orderResult.insertId;

    let totalAmount = 0;
    for (const item of items) {
      const lineTotal = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
      totalAmount += lineTotal;
      await dbRun(
        'INSERT INTO so_items (so_id, product_id, quantity, unit_price, line_total, notes) VALUES (?, ?, ?, ?, ?, ?)',
        [soId, item.product_id, item.quantity, item.unit_price || 0, lineTotal, item.notes || null]
      );
    }

    // Update total_amount on SO header
    await dbRun('UPDATE sales_orders SET total_amount = ? WHERE id = ?', [totalAmount, soId]);

    res.status(201).json({ message: 'Sales order created', data: { id: soId, so_number: number } });
  } catch (error: any) {
    console.error('Error creating sales order:', error);
    if (error.message?.includes('UNIQUE')) return res.status(400).json({ error: 'SO number must be unique' });
    res.status(500).json({ error: 'Failed to create sales order' });
  }
});

router.put('/sales-orders/:id', authMiddleware, requirePermission('crm.sales', 'update'), async (req: Request, res: Response) => {
  try {
    const { customer_id, client_id, lead_id, status, expected_ship_date, currency, notes, items } = req.body;
    // Sanitize date: MySQL DATE column needs YYYY-MM-DD, not ISO timestamp
    const shipDate = expected_ship_date ? expected_ship_date.toString().split('T')[0] : null;

    await dbRun(
      `UPDATE sales_orders SET customer_id = ?, client_id = COALESCE(?, client_id), lead_id = COALESCE(?, lead_id),
       status = ?, expected_ship_date = ?, currency = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [customer_id || null, client_id || null, lead_id || null, status, shipDate, currency || 'IDR', notes || null, req.params.id]
    );

    if (items && Array.isArray(items)) {
      await dbRun('DELETE FROM so_items WHERE so_id = ?', [req.params.id]);
      let totalAmount = 0;
      for (const item of items) {
        const lineTotal = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
        totalAmount += lineTotal;
        await dbRun(
          'INSERT INTO so_items (so_id, product_id, quantity, unit_price, line_total, notes) VALUES (?, ?, ?, ?, ?, ?)',
          [req.params.id, item.product_id, item.quantity, item.unit_price || 0, lineTotal, item.notes || null]
        );
      }
      await dbRun('UPDATE sales_orders SET total_amount = ? WHERE id = ?', [totalAmount, req.params.id]);
    }

    res.json({ message: 'Sales order updated' });
  } catch (error) {
    console.error('Error updating sales order:', error);
    res.status(500).json({ error: 'Failed to update sales order' });
  }
});

// Deliveries
router.get('/deliveries', authMiddleware, requirePermission('sales.sales-orders-list', 'view'), async (req: Request, res: Response) => {
  try {
    const deliveries = await dbAll(
      `SELECT d.*, so.so_number
         FROM deliveries d
         LEFT JOIN sales_orders so ON d.so_id = so.id
         ORDER BY d.created_at DESC`
    );
    res.json({ data: deliveries });
  } catch (error) {
    console.error('Error fetching deliveries:', error);
    res.status(500).json({ error: 'Failed to fetch deliveries' });
  }
});

router.get('/deliveries/:id', authMiddleware, requirePermission('sales.sales-orders-list', 'view'), async (req: Request, res: Response) => {
  try {
    const delivery = await dbGet(
      `SELECT d.*, so.so_number
         FROM deliveries d
         LEFT JOIN sales_orders so ON d.so_id = so.id
         WHERE d.id = ?`,
      [req.params.id]
    );
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
    res.json({ data: delivery });
  } catch (error) {
    console.error('Error fetching delivery:', error);
    res.status(500).json({ error: 'Failed to fetch delivery' });
  }
});

router.post('/deliveries', authMiddleware, requirePermission('crm.sales', 'create'), async (req: Request, res: Response) => {
  try {
    const { do_number, so_id, warehouse_id, status, shipped_at, notes } = req.body;
    if (!so_id) return res.status(400).json({ error: 'so_id is required' });

    const number = do_number || generateCode('DO');
    const result = await dbRun(
      'INSERT INTO deliveries (do_number, so_id, warehouse_id, status, shipped_at, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [number, so_id, warehouse_id || null, status || 'draft', shipped_at || null, notes || null]
    );

    res.status(201).json({ message: 'Delivery created', data: { id: result.insertId, do_number: number } });
  } catch (error: any) {
    console.error('Error creating delivery:', error);
    if (error.message?.includes('UNIQUE')) return res.status(400).json({ error: 'DO number must be unique' });
    res.status(500).json({ error: 'Failed to create delivery' });
  }
});

// Invoices
router.get('/invoices', authMiddleware, requirePermission('sales.sales-invoices', 'view'), async (req: Request, res: Response) => {
  try {
    const invoices = await dbAll(
      `SELECT i.*, so.so_number
         FROM invoices i
         LEFT JOIN sales_orders so ON i.so_id = so.id
         ORDER BY i.created_at DESC`
    );
    res.json({ data: invoices });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

router.get('/invoices/:id', authMiddleware, requirePermission('sales.sales-invoices', 'view'), async (req: Request, res: Response) => {
  try {
    const invoice = await dbGet(
      `SELECT i.*, so.so_number
         FROM invoices i
         LEFT JOIN sales_orders so ON i.so_id = so.id
         WHERE i.id = ?`,
      [req.params.id]
    );
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ data: invoice });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

router.post('/invoices', authMiddleware, requirePermission('crm.sales', 'create'), async (req: Request, res: Response) => {
  try {
    const { invoice_number, so_id, amount, status, issued_at, due_at, notes } = req.body;
    if (!so_id || amount === undefined) return res.status(400).json({ error: 'so_id and amount are required' });

    const number = invoice_number || generateCode('INV');
    const result = await dbRun(
      'INSERT INTO invoices (invoice_number, so_id, total_amount, status, invoice_date, due_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [number, so_id, amount, status || 'unpaid', issued_at || null, due_at || null, notes || null]
    );

    res.status(201).json({ message: 'Invoice created', data: { id: result.insertId, invoice_number: number } });
  } catch (error: any) {
    console.error('Error creating invoice:', error);
    if (error.message?.includes('UNIQUE')) return res.status(400).json({ error: 'Invoice number must be unique' });
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

router.put('/invoices/:id', authMiddleware, requirePermission('crm.sales', 'update'), async (req: Request, res: Response) => {
  try {
    const { so_id, amount, status, issued_at, due_at, notes } = req.body;
    await dbRun(
      'UPDATE invoices SET so_id = ?, total_amount = ?, status = ?, invoice_date = COALESCE(?, invoice_date), due_date = COALESCE(?, due_date), notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [so_id, amount, status, issued_at || null, due_at || null, notes || null, req.params.id]
    );
    res.json({ message: 'Invoice updated' });
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

// ===== SO APPROVAL =====

router.get('/approval', authMiddleware, async (req: Request, res: Response) => {
  try {
    const rows = await dbAll(
      `SELECT so.*, c.name as customer_name,
              COALESCE(SUM(soi.quantity * soi.unit_price), 0) as total_amount
       FROM sales_orders so
       LEFT JOIN customers c ON so.customer_id = c.id
       LEFT JOIN sales_order_items soi ON soi.so_id = so.id
       WHERE so.status = 'draft'
       GROUP BY so.id
       ORDER BY so.created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching SO for approval:', error);
    res.status(500).json({ error: 'Failed to fetch approvals' });
  }
});

router.put('/approval/:id/approve', authMiddleware, requirePermission('crm.sales', 'update'), async (req: Request, res: Response) => {
  try {
    const so: any = await dbGet('SELECT * FROM sales_orders WHERE id = ?', [req.params.id]);
    if (!so) return res.status(404).json({ error: 'SO not found' });
    await dbRun('UPDATE sales_orders SET status = ? WHERE id = ?', ['open', req.params.id]);
    res.json({ success: true, message: 'SO approved' });
  } catch (error) {
    console.error('Error approving SO:', error);
    res.status(500).json({ error: 'Failed to approve SO' });
  }
});

router.put('/approval/:id/reject', authMiddleware, requirePermission('crm.sales', 'update'), async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    await dbRun('UPDATE sales_orders SET status = ?, notes = CONCAT(COALESCE(notes, \'\'), ?) WHERE id = ?',
      ['cancelled', `\n[REJECTED] ${reason || 'No reason provided'}`, req.params.id]);
    res.json({ success: true, message: 'SO rejected' });
  } catch (error) {
    console.error('Error rejecting SO:', error);
    res.status(500).json({ error: 'Failed to reject SO' });
  }
});

// ===== PRICE LIST =====

router.get('/price-list', authMiddleware, async (req: Request, res: Response) => {
  try {
    const rows = await dbAll(
      `SELECT p.id, p.sku, p.name, p.description,
              p.selling_price as base_price, u.code as unit
       FROM products p
       LEFT JOIN uom u ON p.unit_of_measure_id = u.id
       ORDER BY p.name`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching price list:', error);
    res.status(500).json({ error: 'Failed to fetch price list' });
  }
});

router.put('/price-list/:id', authMiddleware, requirePermission('crm.sales', 'update'), async (req: Request, res: Response) => {
  try {
    const { selling_price } = req.body;
    if (selling_price === undefined || selling_price < 0) return res.status(400).json({ error: 'Valid price required' });
    await dbRun('UPDATE products SET selling_price = ? WHERE id = ?', [selling_price, req.params.id]);
    res.json({ success: true, message: 'Price updated' });
  } catch (error) {
    console.error('Error updating price:', error);
    res.status(500).json({ error: 'Failed to update price' });
  }
});

// ===== SALES HISTORY =====

router.get('/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { status, from, to, search } = req.query;
    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (status && status !== 'all') { where += ' AND so.status = ?'; params.push(status); }
    if (from) { where += ' AND so.created_at >= ?'; params.push(from); }
    if (to) { where += ' AND so.created_at <= ?'; params.push(to + ' 23:59:59'); }
    if (search) { where += ' AND (so.so_number LIKE ? OR c.name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    const rows = await dbAll(
      `SELECT so.*, c.name as customer_name,
              COALESCE(SUM(soi.quantity * soi.unit_price), 0) as total_amount,
              (SELECT COUNT(*) FROM deliveries d WHERE d.so_id = so.id) as delivery_count,
              (SELECT COUNT(*) FROM invoices inv WHERE inv.so_id = so.id) as invoice_count
       FROM sales_orders so
       LEFT JOIN customers c ON so.customer_id = c.id
       LEFT JOIN sales_order_items soi ON soi.so_id = so.id
       ${where}
       GROUP BY so.id
       ORDER BY so.created_at DESC`, params
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching sales history:', error);
    res.status(500).json({ error: 'Failed to fetch sales history' });
  }
});

router.get('/history/stats', authMiddleware, async (req: Request, res: Response) => {
  try {
    const stats = await dbGet(
      `SELECT
         COUNT(*) as total_orders,
         SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_orders,
         SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_orders,
         SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
       FROM sales_orders`
    );
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching sales stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// POST /sales-orders/:id/create-project - Create a client project from SO
router.post('/sales-orders/:id/create-project', authMiddleware, requirePermission('crm.sales', 'create'), async (req: Request, res: Response) => {
  try {
    const soId = req.params.id;
    const userId = (req as any).user?.id || null;

    const so = await dbGet(`
      SELECT so.*, COALESCE(cl.name, c.name) as customer_name,
             so.client_id, so.customer_id, so.lead_id,
             c.name as cust_name, c.contact_person as cust_contact, c.phone as cust_phone,
             c.email as cust_email, c.address as cust_address
      FROM sales_orders so
      LEFT JOIN customers c ON so.customer_id = c.id
      LEFT JOIN clients cl ON so.client_id = cl.id
      WHERE so.id = ?
    `, [soId]) as any;

    if (!so) return res.status(404).json({ error: 'Sales order not found' });
    if (so.project_id) return res.status(400).json({ error: 'Project already exists for this SO' });

    // Resolve client_id — if SO has no client, auto-create one from customer
    let clientId = so.client_id;
    if (!clientId && so.customer_id) {
      // Check if client already exists for this customer name
      const existingClient = await dbGet(
        'SELECT id FROM clients WHERE name = ? LIMIT 1',
        [so.cust_name]
      ) as any;

      if (existingClient) {
        clientId = existingClient.id;
      } else {
        // Create client from customer data (matching actual clients table schema)
        const clientCode = `CLI-${String(so.customer_id).padStart(4, '0')}`;
        const clientResult = await dbRun(
          `INSERT INTO clients (code, name, organization, phone, address, is_active) VALUES (?, ?, ?, ?, ?, 1)`,
          [clientCode, so.cust_name, so.cust_name, so.cust_phone || null, so.cust_address || null]
        );
        clientId = clientResult.insertId;
      }
      // Link client back to SO
      await dbRun('UPDATE sales_orders SET client_id = ? WHERE id = ?', [clientId, soId]);
    }

    if (!clientId) {
      return res.status(400).json({ error: 'No customer or client linked to this SO. Please assign a customer first.' });
    }

    // Get first SO item for product linking
    const firstItem = await dbGet(`
      SELECT si.*, p.name as product_name, u.name as uom_name
      FROM so_items si
      LEFT JOIN products p ON si.product_id = p.id
      LEFT JOIN uom u ON p.unit_of_measure_id = u.id
      WHERE si.so_id = ? LIMIT 1
    `, [soId]) as any;

    // Generate project number
    const count = await dbGet('SELECT COUNT(*) as cnt FROM client_projects') as any;
    const projNum = `PRJ-${String((count?.cnt || 0) + 1).padStart(5, '0')}`;

    // Create client project (matching actual table schema)
    const result = await dbRun(`
      INSERT INTO client_projects (
        client_id, so_id, project_number, project_name, description, budget,
        product_id, quantity, uom, status, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, NOW())
    `, [
      clientId,
      soId,
      projNum,
      `${so.customer_name || 'Customer'} — ${so.so_number}`,
      `Auto-created from Sales Order ${so.so_number}`,
      so.total_amount || 0,
      firstItem?.product_id || null,
      firstItem?.quantity || 0,
      firstItem?.uom_name || 'pcs',
      userId
    ]);

    // Link project back to SO
    await dbRun('UPDATE sales_orders SET project_id = ? WHERE id = ?', [result.insertId, soId]);

    res.json({
      message: 'Project created',
      data: { id: result.insertId, project_number: projNum }
    });
  } catch (error) {
    console.error('Error creating project from SO:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// GET /orders - Alias for /sales-orders (used by SalesOrders.vue, Deliveries.vue)
router.get('/orders', authMiddleware, async (req: Request, res: Response) => {
  try {
    const orders = await dbAll(`
      SELECT so.*, c.name as customer_name
      FROM sales_orders so
      LEFT JOIN customers c ON so.customer_id = c.id
      ORDER BY so.created_at DESC
    `, []);
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// POST /orders - Create sales order
router.post('/orders', authMiddleware, requirePermission('crm.sales', 'create'), async (req: Request, res: Response) => {
  try {
    const { customer_id, items, notes, delivery_date } = req.body;
    const soNumber = generateCode('SO');
    const result = await dbRun(
      'INSERT INTO sales_orders (so_number, customer_id, notes, delivery_date, status) VALUES (?, ?, ?, ?, ?)',
      [soNumber, customer_id, notes || null, delivery_date || null, 'Draft']
    );
    if (items && Array.isArray(items)) {
      for (const item of items) {
        await dbRun(
          'INSERT INTO sales_order_items (sales_order_id, product_id, qty, unit_price, total) VALUES (?, ?, ?, ?, ?)',
          [result.insertId, item.product_id, item.qty, item.unit_price, (item.qty * item.unit_price)]
        );
      }
    }
    res.json({ id: result.insertId, so_number: soNumber });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// GET /payments - List all payments
router.get('/payments', authMiddleware, requirePermission('sales.sales-payments', 'view'), async (_req: Request, res: Response) => {
  try {
    const payments = await dbAll(`
      SELECT sp.*, c.name as customer_name,
             si.invoice_number
      FROM sales_payments sp
      LEFT JOIN customers c ON sp.customer_id = c.id
      LEFT JOIN sales_invoices si ON sp.invoice_id = si.id
      ORDER BY sp.payment_date DESC
    `, []);
    res.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// POST /payments - Record a payment
router.post('/payments', authMiddleware, requirePermission('crm.sales', 'create'), async (req: Request, res: Response) => {
  try {
    const { invoice_id, customer_id, amount, payment_date, payment_method, reference_number, notes } = req.body;
    const result = await dbRun(
      'INSERT INTO sales_payments (invoice_id, customer_id, payment_date, amount, payment_method, reference_number, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [invoice_id, customer_id, payment_date, amount, payment_method || 'bank_transfer', reference_number || null, notes || null, 'confirmed']
    );
    // update invoice paid amount
    if (invoice_id) {
      await dbRun(`
        UPDATE sales_invoices SET paid_amount = COALESCE(paid_amount, 0) + ?,
        status = CASE WHEN COALESCE(paid_amount, 0) + ? >= total_amount THEN 'paid' ELSE 'partial' END
        WHERE id = ?
      `, [amount, amount, invoice_id]);
    }
    res.json({ id: result.insertId, message: 'Payment recorded' });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// GET /payments/summary - Payment summary stats
router.get('/payments/summary', authMiddleware, requirePermission('sales.sales-payments', 'view'), async (_req: Request, res: Response) => {
  try {
    const totalReceived = await dbGet('SELECT COALESCE(SUM(amount), 0) as total FROM sales_payments WHERE status = ?', ['confirmed']) as any;
    const pendingInvoices = await dbGet("SELECT COUNT(*) as count, COALESCE(SUM(total_amount - COALESCE(paid_amount, 0)), 0) as total FROM sales_invoices WHERE status IN ('sent', 'partial')") as any;
    const overdueInvoices = await dbGet("SELECT COUNT(*) as count FROM sales_invoices WHERE status IN ('sent', 'partial') AND due_date < CURDATE()") as any;
    res.json({
      total_received: Number(totalReceived?.total || 0),
      pending_count: pendingInvoices?.count || 0,
      pending_amount: Number(pendingInvoices?.total || 0),
      overdue_count: overdueInvoices?.count || 0,
    });
  } catch (error) {
    console.error('Error fetching payment summary:', error);
    res.status(500).json({ error: 'Failed to fetch payment summary' });
  }
});

export default router;
