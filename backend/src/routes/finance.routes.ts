import express, { Request, Response } from 'express';
import { dbAll, dbGet, dbRun } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';

const router = express.Router();

const generateFinanceCode = (prefix: string) => {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${datePart}-${rand}`;
};

// Recompute parent fund_request.status from child item statuses.
// Rules:
//  - any pending â†’ 'submitted' (still under review)
//  - none pending, all approved â†’ 'approved'
//  - none pending, all rejected â†’ 'rejected'
//  - none pending, mix approved+rejected â†’ 'partially_approved'
const recomputeFundRequestStatus = async (fundRequestId: number, approverId: number | null) => {
  const items = await dbAll(
    'SELECT status FROM fund_request_items WHERE fund_request_id = ?',
    [fundRequestId]
  ) as Array<{ status: string }>;
  if (!items.length) return;

  const pending = items.filter(i => i.status === 'pending').length;
  const approved = items.filter(i => i.status === 'approved').length;
  const rejected = items.filter(i => i.status === 'rejected').length;

  let newStatus = 'submitted';
  if (pending === 0) {
    if (approved > 0 && rejected === 0) newStatus = 'approved';
    else if (rejected > 0 && approved === 0) newStatus = 'rejected';
    else newStatus = 'partially_approved';
  }

  if (newStatus === 'approved' || newStatus === 'partially_approved') {
    await dbRun(
      `UPDATE fund_requests
       SET status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newStatus, approverId, fundRequestId]
    );
  } else {
    await dbRun('UPDATE fund_requests SET status = ? WHERE id = ?', [newStatus, fundRequestId]);
  }

  if (pending === 0) {
    const apStatus = newStatus === 'rejected' ? 'rejected' : 'approved';
    await dbRun(
      `UPDATE approval_requests
       SET status = ?, completed_at = CURRENT_TIMESTAMP
       WHERE entity_type = 'fund_request' AND entity_id = ? AND status = 'pending'`,
      [apStatus, fundRequestId]
    );
  }
};

// When an FR item linked to a po_schedule_id gets approved, auto-record AP payment.
// Idempotent via fund_request_items.payment_recorded_at.
const autoPayApFromFundRequestItem = async (itemId: number) => {
  const item = await dbGet(
    'SELECT * FROM fund_request_items WHERE id = ?',
    [itemId]
  ) as any;
  if (!item) return { recorded: false, reason: 'item not found' };
  if (item.status !== 'approved') return { recorded: false, reason: 'item not approved' };
  if (item.payment_recorded_at) return { recorded: false, reason: 'already recorded' };
  if (!item.po_schedule_id) return { recorded: false, reason: 'no linked schedule' };

  // Find AP linked to schedule (preferred) or to po_id+schedule
  let ap = await dbGet(
    'SELECT * FROM accounts_payable WHERE po_schedule_id = ? ORDER BY id DESC LIMIT 1',
    [item.po_schedule_id]
  ) as any;
  if (!ap) {
    // Fallback: schedule may have ap_id
    const sched = await dbGet(
      'SELECT * FROM purchase_order_payment_schedules WHERE id = ?',
      [item.po_schedule_id]
    ) as any;
    if (sched && sched.ap_id) {
      ap = await dbGet('SELECT * FROM accounts_payable WHERE id = ?', [sched.ap_id]) as any;
    }
  }
  if (!ap) return { recorded: false, reason: 'no AP linked to schedule' };

  const payAmount = Number(item.amount || 0);
  if (!Number.isFinite(payAmount) || payAmount <= 0) {
    return { recorded: false, reason: 'invalid amount' };
  }
  const newPaid = Number(ap.paid_amount || 0) + payAmount;
  const newStatus = newPaid >= Number(ap.amount || 0) ? 'paid' : 'partial';

  await dbRun(
    'UPDATE accounts_payable SET paid_amount = ?, status = ? WHERE id = ?',
    [newPaid, newStatus, ap.id]
  );
  await dbRun(
    'UPDATE purchase_order_payment_schedules SET paid_amount = ?, status = ?, ap_id = ? WHERE id = ?',
    [newPaid, newStatus, ap.id, item.po_schedule_id]
  );
  await dbRun(
    'UPDATE fund_request_items SET ap_id = ?, payment_recorded_at = CURRENT_TIMESTAMP WHERE id = ?',
    [ap.id, itemId]
  );

  return { recorded: true, ap_id: ap.id, paid_amount: newPaid, status: newStatus };
};

// ===== COGS TRACKING =====

router.get('/cogs', authMiddleware, requirePermission('finance.cogs', 'view'), async (req: Request, res: Response) => {
  try {
    const cogs = await dbAll(
      `SELECT c.*, b.batch_number, p.sku, p.name as product_name
       FROM cogs_tracking c
       LEFT JOIN batches b ON c.batch_id = b.id
       LEFT JOIN products p ON c.product_id = p.id
       ORDER BY c.created_at DESC`
    );
    res.json({ data: cogs });
  } catch (error) {
    console.error('Error fetching COGS:', error);
    res.status(500).json({ error: 'Failed to fetch COGS' });
  }
});

router.get('/cogs/:id', authMiddleware, requirePermission('finance.cogs', 'view'), async (req: Request, res: Response) => {
  try {
    const cogs = await dbGet(
      `SELECT c.*, b.batch_number, p.sku, p.name as product_name
       FROM cogs_tracking c
       LEFT JOIN batches b ON c.batch_id = b.id
       LEFT JOIN products p ON c.product_id = p.id
       WHERE c.id = ?`,
      [req.params.id]
    );
    if (!cogs) return res.status(404).json({ error: 'COGS record not found' });
    res.json({ data: cogs });
  } catch (error) {
    console.error('Error fetching COGS:', error);
    res.status(500).json({ error: 'Failed to fetch COGS' });
  }
});

router.post('/cogs', authMiddleware, requirePermission('finance.cogs', 'create'), async (req: Request, res: Response) => {
  try {
    const {
      batch_id,
      product_id,
      raw_material_cost,
      labor_cost,
      overhead_cost,
      total_cost,
      quantity_produced,
      cost_per_unit,
      notes,
    } = req.body;

    if (!batch_id || !product_id || total_cost === undefined) {
      return res
        .status(400)
        .json({
          error: 'batch_id, product_id, and total_cost are required',
        });
    }

    const result = await dbRun(
      `INSERT INTO cogs_tracking (batch_id, product_id, raw_material_cost, labor_cost, 
       overhead_cost, total_cost, quantity_produced, cost_per_unit, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        batch_id,
        product_id,
        raw_material_cost || 0,
        labor_cost || 0,
        overhead_cost || 0,
        total_cost,
        quantity_produced || 0,
        cost_per_unit || 0,
        notes || null,
      ]
    );

    res.status(201).json({
      message: 'COGS record created',
      data: { id: result.insertId },
    });
  } catch (error) {
    console.error('Error creating COGS:', error);
    res.status(500).json({ error: 'Failed to create COGS record' });
  }
});

// ===== PROFITABILITY =====

router.get('/profitability', authMiddleware, requirePermission('finance.cost-analysis', 'view'), async (req: Request, res: Response) => {
  try {
    const profitability = await dbAll(
      `SELECT p.*, pr.sku, pr.name as product_name
       FROM profitability_tracking p
       LEFT JOIN products pr ON p.product_id = pr.id
       ORDER BY p.period_date DESC`
    );
    res.json({ data: profitability });
  } catch (error) {
    console.error('Error fetching profitability:', error);
    res.status(500).json({ error: 'Failed to fetch profitability' });
  }
});

router.post('/profitability', authMiddleware, requirePermission('finance.cost-analysis', 'create'), async (req: Request, res: Response) => {
  try {
    const {
      product_id,
      period,
      total_revenue,
      total_cogs,
      gross_profit,
      gross_margin_pct,
      notes,
    } = req.body;

    if (
      !product_id ||
      !period ||
      total_revenue === undefined ||
      total_cogs === undefined
    ) {
      return res.status(400).json({
        error:
          'product_id, period, total_revenue, and total_cogs are required',
      });
    }

    const result = await dbRun(
      `INSERT INTO profitability_tracking (product_id, period, total_revenue, total_cogs, 
       gross_profit, gross_margin_pct, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        product_id,
        period,
        total_revenue,
        total_cogs,
        gross_profit || total_revenue - total_cogs,
        gross_margin_pct || ((total_revenue - total_cogs) / total_revenue) * 100,
        notes || null,
      ]
    );

    res.status(201).json({
      message: 'Profitability record created',
      data: { id: result.insertId },
    });
  } catch (error) {
    console.error('Error creating profitability:', error);
    res.status(500).json({ error: 'Failed to create profitability record' });
  }
});

// ===== ACCOUNTS PAYABLE (AP) =====

router.get('/accounts-payable', authMiddleware, requirePermission('finance.ap', 'view'), async (req: Request, res: Response) => {
  try {
    const ap = await dbAll(
      `SELECT ap.*, po.po_number, v.name as vendor_name, po.total_amount,
              ps.schedule_no, ps.label as schedule_label, ps.trigger_type
       FROM accounts_payable ap
       LEFT JOIN purchase_orders po ON ap.po_id = po.id
       LEFT JOIN purchase_order_payment_schedules ps ON ap.po_schedule_id = ps.id
       LEFT JOIN vendors v ON po.vendor_id = v.id
       ORDER BY ap.due_date ASC`
    );
    res.json({ data: ap });
  } catch (error) {
    console.error('Error fetching AP:', error);
    res.status(500).json({ error: 'Failed to fetch accounts payable' });
  }
});

router.post('/accounts-payable', authMiddleware, requirePermission('finance.ap', 'create'), async (req: Request, res: Response) => {
  try {
    const {
      po_id,
      vendor_id,
      po_schedule_id,
      invoice_number,
      invoice_date,
      due_date,
      amount,
      paid_amount,
      status,
      notes,
    } = req.body;

    if (!po_id || !amount) {
      return res
        .status(400)
        .json({ error: 'po_id and amount are required' });
    }

    let effectiveVendorId = vendor_id || null;
    if (!effectiveVendorId && po_id) {
      const poRow = await dbGet('SELECT vendor_id FROM purchase_orders WHERE id = ?', [po_id]) as any;
      effectiveVendorId = poRow?.vendor_id || null;
    }

    const result = await dbRun(
      `INSERT INTO accounts_payable (po_id, vendor_id, po_schedule_id, invoice_number, invoice_date, due_date, 
       amount, paid_amount, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        po_id,
        effectiveVendorId,
        po_schedule_id || null,
        invoice_number || null,
        invoice_date || new Date().toISOString(),
        due_date || null,
        amount,
        paid_amount || 0,
        status || 'open',
        notes || null,
      ]
    );

    if (po_schedule_id) {
      await dbRun('UPDATE purchase_order_payment_schedules SET ap_id = ?, status = ? WHERE id = ?', [result.insertId, status || 'open', po_schedule_id]);
    }

    res.status(201).json({
      message: 'AP record created',
      data: { id: result.insertId },
    });
  } catch (error) {
    console.error('Error creating AP:', error);
    res.status(500).json({ error: 'Failed to create accounts payable record' });
  }
});

// ===== ACCOUNTS RECEIVABLE (AR) =====

router.get('/accounts-receivable', authMiddleware, requirePermission('finance.ar', 'view'), async (req: Request, res: Response) => {
  try {
    const ar = await dbAll(
      `SELECT ar.*, inv.invoice_number, inv.total_amount as amount
       FROM accounts_receivable ar
       LEFT JOIN invoices inv ON ar.invoice_id = inv.id
       ORDER BY ar.due_date ASC`
    );
    res.json({ data: ar });
  } catch (error) {
    console.error('Error fetching AR:', error);
    res.status(500).json({ error: 'Failed to fetch accounts receivable' });
  }
});

router.post('/accounts-receivable', authMiddleware, requirePermission('finance.ar', 'create'), async (req: Request, res: Response) => {
  try {
    const {
      invoice_id,
      due_date,
      amount,
      paid_amount,
      status,
      notes,
    } = req.body;

    if (!invoice_id || !amount) {
      return res
        .status(400)
        .json({ error: 'invoice_id and amount are required' });
    }

    const result = await dbRun(
      `INSERT INTO accounts_receivable (invoice_id, due_date, amount, paid_amount, status, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        invoice_id,
        due_date || null,
        amount,
        paid_amount || 0,
        status || 'open',
        notes || null,
      ]
    );

    res.status(201).json({
      message: 'AR record created',
      data: { id: result.insertId },
    });
  } catch (error) {
    console.error('Error creating AR:', error);
    res.status(500).json({
      error: 'Failed to create accounts receivable record',
    });
  }
});

// ===== FINANCIAL SUMMARY =====

router.get('/financial-summary', authMiddleware, requirePermission('finance.financial-summary', 'view'), async (req: Request, res: Response) => {
  try {
    const summary = await dbAll(
      `SELECT fs.*, 
              (SELECT SUM(total_cost) FROM cogs_tracking) as total_cogs,
              (SELECT SUM(total_amount) FROM sales_orders) as total_revenue
       FROM financial_summary fs
       ORDER BY fs.period_date DESC`
    );
    res.json({ data: summary });
  } catch (error) {
    console.error('Error fetching financial summary:', error);
    res
      .status(500)
      .json({ error: 'Failed to fetch financial summary' });
  }
});

// ===== COST ANALYSIS =====

router.get('/cost-analysis', authMiddleware, requirePermission('finance.cost-analysis', 'view'), async (req: Request, res: Response) => {
  try {
    // Per-product cost breakdown with standard vs actual comparison
    const analysis = await dbAll(
      `SELECT p.id as product_id, p.name as product_name, p.sku,
              COUNT(c.id) as batch_count,
              ROUND(AVG(c.raw_material_cost), 2) as avg_material_cost,
              ROUND(AVG(c.labor_cost), 2) as avg_labor_cost,
              ROUND(AVG(c.overhead_cost), 2) as avg_overhead_cost,
              ROUND(AVG(c.total_cost), 2) as avg_total_cost,
              ROUND(AVG(c.cost_per_unit), 2) as avg_cost_per_unit,
              ROUND(MIN(c.cost_per_unit), 2) as min_cost_per_unit,
              ROUND(MAX(c.cost_per_unit), 2) as max_cost_per_unit,
              ROUND(SUM(c.total_cost), 2) as total_cost_sum,
              ROUND(SUM(c.quantity_produced), 0) as total_qty_produced
       FROM products p
       LEFT JOIN cogs_tracking c ON p.id = c.product_id
       GROUP BY p.id, p.name, p.sku
       HAVING batch_count > 0
       ORDER BY total_cost_sum DESC`
    );
    res.json({ success: true, data: analysis });
  } catch (error) {
    console.error('Error fetching cost analysis:', error);
    res.status(500).json({ error: 'Failed to fetch cost analysis' });
  }
});

router.get('/cost-analysis/trends', authMiddleware, requirePermission('finance.cost-analysis', 'view'), async (req: Request, res: Response) => {
  try {
    const trends = await dbAll(
      `SELECT DATE_FORMAT(c.created_at, '%Y-%m') as period,
              ROUND(AVG(c.cost_per_unit), 2) as avg_cost_per_unit,
              ROUND(SUM(c.total_cost), 2) as total_cost,
              COUNT(c.id) as batch_count
       FROM cogs_tracking c
       GROUP BY period
       ORDER BY period DESC
       LIMIT 12`
    );
    res.json({ success: true, data: trends });
  } catch (error) {
    console.error('Error fetching cost trends:', error);
    res.status(500).json({ error: 'Failed to fetch cost trends' });
  }
});

// ===== MARGIN ANALYSIS =====

router.get('/margin-analysis', authMiddleware, requirePermission('finance.margin-analysis', 'view'), async (req: Request, res: Response) => {
  try {
    const margins = await dbAll(
      `SELECT pt.*, pr.name as product_name, pr.sku,
              ROUND(pt.gross_profit, 2) as gross_profit,
              ROUND(pt.gross_margin_pct, 1) as gross_margin_pct
       FROM profitability_tracking pt
       LEFT JOIN products pr ON pt.product_id = pr.id
       ORDER BY pt.gross_margin_pct DESC`
    );
    res.json({ success: true, data: margins });
  } catch (error) {
    console.error('Error fetching margin analysis:', error);
    res.status(500).json({ error: 'Failed to fetch margin analysis' });
  }
});

router.get('/margin-analysis/summary', authMiddleware, requirePermission('finance.margin-analysis', 'view'), async (req: Request, res: Response) => {
  try {
    const summary = await dbAll(
      `SELECT DATE_FORMAT(CONCAT(pt.period, '-01'), '%Y-%m') as period,
              ROUND(SUM(pt.total_revenue), 2) as total_revenue,
              ROUND(SUM(pt.total_cogs), 2) as total_cogs,
              ROUND(SUM(pt.gross_profit), 2) as gross_profit,
              ROUND(AVG(pt.gross_margin_pct), 1) as avg_margin_pct
       FROM profitability_tracking pt
       GROUP BY period
       ORDER BY period DESC
       LIMIT 12`
    );
    const topProducts = await dbAll(
      `SELECT pr.name as product_name, pr.sku,
              ROUND(SUM(pt.total_revenue), 2) as total_revenue,
              ROUND(SUM(pt.gross_profit), 2) as gross_profit,
              ROUND(AVG(pt.gross_margin_pct), 1) as avg_margin_pct
       FROM profitability_tracking pt
       LEFT JOIN products pr ON pt.product_id = pr.id
       GROUP BY pt.product_id, pr.name, pr.sku
       ORDER BY gross_profit DESC
       LIMIT 10`
    );
    res.json({ success: true, data: { periods: summary, topProducts } });
  } catch (error) {
    console.error('Error fetching margin summary:', error);
    res.status(500).json({ error: 'Failed to fetch margin summary' });
  }
});
// ===== AP PAYMENT =====

router.put('/accounts-payable/:id/pay', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { amount } = req.body;
    const paymentAmount = Number(amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Positive payment amount required' });
    }
    
    const ap: any = await dbGet('SELECT * FROM accounts_payable WHERE id = ?', [req.params.id]);
    if (!ap) return res.status(404).json({ error: 'AP record not found' });
    
    const newPaid = Number(ap.paid_amount || 0) + paymentAmount;
    const newStatus = newPaid >= ap.amount ? 'paid' : 'partial';
    
    await dbRun('UPDATE accounts_payable SET paid_amount = ?, status = ? WHERE id = ?', [newPaid, newStatus, req.params.id]);
    if (ap.po_schedule_id) {
      await dbRun(
        'UPDATE purchase_order_payment_schedules SET paid_amount = ?, status = ?, ap_id = ? WHERE id = ?',
        [newPaid, newStatus, req.params.id, ap.po_schedule_id]
      );
    }
    res.json({ success: true, message: 'Payment recorded', data: { paid_amount: newPaid, status: newStatus } });
  } catch (error) {
    console.error('Error recording AP payment:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// ===== AR PAYMENT =====

router.put('/accounts-receivable/:id/pay', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { amount } = req.body;
    const paymentAmount = Number(amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Positive payment amount required' });
    }
    
    const ar: any = await dbGet('SELECT * FROM accounts_receivable WHERE id = ?', [req.params.id]);
    if (!ar) return res.status(404).json({ error: 'AR record not found' });
    
    const newPaid = Number(ar.paid_amount || 0) + paymentAmount;
    const newStatus = newPaid >= ar.amount ? 'paid' : 'partial';
    
    await dbRun('UPDATE accounts_receivable SET paid_amount = ?, status = ? WHERE id = ?', [newPaid, newStatus, req.params.id]);
    res.json({ success: true, message: 'Payment recorded', data: { paid_amount: newPaid, status: newStatus } });
  } catch (error) {
    console.error('Error recording AR payment:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// ===== FUND REQUESTS =====

// GET /fund-requests â€” list all fund requests with item counts
router.get('/fund-requests', authMiddleware, requirePermission('finance.fund-requests', 'view'), async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT fr.*,
             u.full_name as submitter_name,
             (SELECT COUNT(*) FROM fund_request_items WHERE fund_request_id = fr.id) as item_count,
             (SELECT COUNT(*) FROM fund_request_items WHERE fund_request_id = fr.id AND status = 'pending') as pending_count,
             (SELECT COUNT(*) FROM fund_request_items WHERE fund_request_id = fr.id AND status = 'approved') as approved_count,
             (SELECT COUNT(*) FROM fund_request_items WHERE fund_request_id = fr.id AND status = 'rejected') as rejected_count,
             po.po_number, v.name as vendor_name
      FROM fund_requests fr
      LEFT JOIN users u ON fr.requester_id = u.id
      LEFT JOIN purchase_orders po ON fr.po_id = po.id
      LEFT JOIN vendors v ON fr.vendor_id = v.id`;
    const params: any[] = [];
    if (status && status !== 'all') {
      sql += ' WHERE fr.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY fr.created_at DESC';
    const rows = await dbAll(sql, params);
    res.json({ data: rows });
  } catch (error) {
    console.error('Error fetching fund requests:', error);
    res.status(500).json({ error: 'Failed to fetch fund requests' });
  }
});

// GET /fund-requests/:id â€” detail with items
router.get('/fund-requests/:id', authMiddleware, requirePermission('finance.fund-requests', 'view'), async (req: Request, res: Response) => {
  try {
    const fr = await dbGet(
      `SELECT fr.*, u.full_name as submitter_name,
              po.po_number, v.name as vendor_name
       FROM fund_requests fr
       LEFT JOIN users u ON fr.requester_id = u.id
       LEFT JOIN purchase_orders po ON fr.po_id = po.id
       LEFT JOIN vendors v ON fr.vendor_id = v.id
       WHERE fr.id = ?`,
      [req.params.id]
    );
    if (!fr) return res.status(404).json({ error: 'Fund request not found' });

    const items = await dbAll(
      `SELECT fri.*,
              po.po_number,
              v.name as vendor_name,
              ps.schedule_no, ps.label as schedule_label, ps.trigger_type
       FROM fund_request_items fri
       LEFT JOIN purchase_orders po ON fri.po_id = po.id
       LEFT JOIN vendors v ON fri.vendor_id = v.id
       LEFT JOIN purchase_order_payment_schedules ps ON fri.po_schedule_id = ps.id
       WHERE fri.fund_request_id = ?
       ORDER BY fri.id ASC`,
      [req.params.id]
    );

    res.json({ data: { ...(fr as any), items } });
  } catch (error) {
    console.error('Error fetching fund request detail:', error);
    res.status(500).json({ error: 'Failed to fetch fund request' });
  }
});

// POST /fund-requests â€” create new fund request with items
router.post('/fund-requests', authMiddleware, requirePermission('finance.fund-requests', 'create'), async (req: Request, res: Response) => {
  try {
    const { purpose, needed_date, notes, cash_account, cash_account_note, items } = req.body;
    if (!purpose || !needed_date) {
      return res.status(400).json({ error: 'purpose and needed_date are required' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one transaction item is required' });
    }

    const requestNumber = generateFinanceCode('FR');
    const totalAmount = items.reduce((s: number, it: any) => s + Number(it.amount || 0), 0);
    const userId = (req as any).user?.id || null;

    // Use first item's po_id/vendor_id as header defaults
    const headerPoId = items[0]?.po_id || null;
    const headerVendorId = items[0]?.vendor_id || null;
    const headerScheduleId = items.length === 1 ? (items[0]?.po_schedule_id || null) : null;

    const result = await dbRun(
      `INSERT INTO fund_requests 
       (request_number, request_date, po_id, po_schedule_id, vendor_id, amount, needed_date, purpose, status, requester_id, notes, cash_account, cash_account_note)
       VALUES (?, CURDATE(), ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
      [requestNumber, headerPoId, headerScheduleId, headerVendorId, totalAmount, needed_date, purpose, userId, notes || null, cash_account || null, cash_account_note || null]
    );
    const frId = result.insertId;

    // Insert items
    for (const item of items) {
      await dbRun(
        `INSERT INTO fund_request_items (fund_request_id, po_id, po_schedule_id, vendor_id, description, amount, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [frId, item.po_id || null, item.po_schedule_id || null, item.vendor_id || null, item.description || null, Number(item.amount || 0)]
      );
    }

    res.json({ data: { id: frId, request_number: requestNumber } });
  } catch (error) {
    console.error('Error creating fund request:', error);
    res.status(500).json({ error: 'Failed to create fund request' });
  }
});

// PUT /fund-requests/:id â€” update draft fund request
router.put('/fund-requests/:id', authMiddleware, requirePermission('finance.fund-requests', 'update'), async (req: Request, res: Response) => {
  try {
    const fr = await dbGet('SELECT * FROM fund_requests WHERE id = ?', [req.params.id]) as any;
    if (!fr) return res.status(404).json({ error: 'Fund request not found' });
    if (fr.status !== 'draft') return res.status(400).json({ error: 'Only draft requests can be edited' });

    const { purpose, needed_date, notes, cash_account, cash_account_note, items } = req.body;
    const totalAmount = (items || []).reduce((s: number, it: any) => s + Number(it.amount || 0), 0);
    const headerPoId = items?.[0]?.po_id || null;
    const headerVendorId = items?.[0]?.vendor_id || null;

    await dbRun(
      `UPDATE fund_requests SET purpose = ?, needed_date = ?, notes = ?, cash_account = ?, cash_account_note = ?,
       po_id = ?, vendor_id = ?, amount = ?
       WHERE id = ?`,
      [purpose, needed_date, notes || null, cash_account || null, cash_account_note || null, headerPoId, headerVendorId, totalAmount, req.params.id]
    );

    // Replace items
    if (items && Array.isArray(items)) {
      await dbRun('DELETE FROM fund_request_items WHERE fund_request_id = ?', [req.params.id]);
      for (const item of items) {
        await dbRun(
          `INSERT INTO fund_request_items (fund_request_id, po_id, po_schedule_id, vendor_id, description, amount, status)
           VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
          [req.params.id, item.po_id || null, item.po_schedule_id || null, item.vendor_id || null, item.description || null, Number(item.amount || 0)]
        );
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating fund request:', error);
    res.status(500).json({ error: 'Failed to update fund request' });
  }
});

// PUT /fund-requests/:id/submit â€” submit for approval
router.put('/fund-requests/:id/submit', authMiddleware, async (req: Request, res: Response) => {
  try {
    const fr = await dbGet('SELECT * FROM fund_requests WHERE id = ?', [req.params.id]) as any;
    if (!fr) return res.status(404).json({ error: 'Fund request not found' });
    if (fr.status !== 'draft') return res.status(400).json({ error: 'Only draft requests can be submitted' });

    await dbRun(
      `UPDATE fund_requests SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [req.params.id]
    );

    // Create approval request
    try {
      await dbRun(
        `INSERT INTO approval_requests (entity_type, entity_id, requester_id, status, created_at)
         VALUES ('fund_request', ?, ?, 'pending', CURRENT_TIMESTAMP)`,
        [req.params.id, (req as any).user?.id || null]
      );
    } catch (e) {
      console.warn('Could not create approval_request for FR:', e);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error submitting fund request:', error);
    res.status(500).json({ error: 'Failed to submit fund request' });
  }
});

// PUT /fund-requests/:id/approve â€” approve all pending items
router.put('/fund-requests/:id/approve', authMiddleware, async (req: Request, res: Response) => {
  try {
    const fr = await dbGet('SELECT * FROM fund_requests WHERE id = ?', [req.params.id]) as any;
    if (!fr) return res.status(404).json({ error: 'Fund request not found' });
    if (fr.status !== 'submitted' && fr.status !== 'partially_approved') {
      return res.status(400).json({ error: 'Only submitted requests can be approved' });
    }

    const approverId = (req as any).user?.id || null;

    // Approve all pending items
    const pendingItems = await dbAll(
      'SELECT id FROM fund_request_items WHERE fund_request_id = ? AND status = ?',
      [req.params.id, 'pending']
    ) as Array<{ id: number }>;

    for (const item of pendingItems) {
      await dbRun(
        `UPDATE fund_request_items SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [approverId, item.id]
      );
      await autoPayApFromFundRequestItem(item.id);
    }

    await recomputeFundRequestStatus(Number(req.params.id), approverId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error approving fund request:', error);
    res.status(500).json({ error: 'Failed to approve fund request' });
  }
});

// PUT /fund-requests/:id/reject â€” reject all pending items
router.put('/fund-requests/:id/reject', authMiddleware, async (req: Request, res: Response) => {
  try {
    const fr = await dbGet('SELECT * FROM fund_requests WHERE id = ?', [req.params.id]) as any;
    if (!fr) return res.status(404).json({ error: 'Fund request not found' });
    if (fr.status !== 'submitted' && fr.status !== 'partially_approved') {
      return res.status(400).json({ error: 'Only submitted requests can be rejected' });
    }

    const { reason } = req.body;
    const approverId = (req as any).user?.id || null;

    await dbRun(
      `UPDATE fund_request_items SET status = 'rejected', rejection_reason = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP
       WHERE fund_request_id = ? AND status = 'pending'`,
      [reason || 'Rejected', approverId, req.params.id]
    );

    await recomputeFundRequestStatus(Number(req.params.id), approverId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error rejecting fund request:', error);
    res.status(500).json({ error: 'Failed to reject fund request' });
  }
});

// PUT /fund-requests/:id/items/:itemId/approve â€” approve single item
router.put('/fund-requests/:id/items/:itemId/approve', authMiddleware, async (req: Request, res: Response) => {
  try {
    const item = await dbGet(
      'SELECT * FROM fund_request_items WHERE id = ? AND fund_request_id = ?',
      [req.params.itemId, req.params.id]
    ) as any;
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.status !== 'pending') return res.status(400).json({ error: 'Item is not pending' });

    const approverId = (req as any).user?.id || null;
    await dbRun(
      `UPDATE fund_request_items SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [approverId, req.params.itemId]
    );

    await autoPayApFromFundRequestItem(Number(req.params.itemId));
    await recomputeFundRequestStatus(Number(req.params.id), approverId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error approving fund request item:', error);
    res.status(500).json({ error: 'Failed to approve item' });
  }
});

// PUT /fund-requests/:id/items/:itemId/reject â€” reject single item
router.put('/fund-requests/:id/items/:itemId/reject', authMiddleware, async (req: Request, res: Response) => {
  try {
    const item = await dbGet(
      'SELECT * FROM fund_request_items WHERE id = ? AND fund_request_id = ?',
      [req.params.itemId, req.params.id]
    ) as any;
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.status !== 'pending') return res.status(400).json({ error: 'Item is not pending' });

    const { reason } = req.body;
    const approverId = (req as any).user?.id || null;
    await dbRun(
      `UPDATE fund_request_items SET status = 'rejected', rejection_reason = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [reason || 'Rejected', approverId, req.params.itemId]
    );

    await recomputeFundRequestStatus(Number(req.params.id), approverId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error rejecting fund request item:', error);
    res.status(500).json({ error: 'Failed to reject item' });
  }
});

// DELETE /fund-requests/:id â€” delete draft fund request
router.delete('/fund-requests/:id', authMiddleware, requirePermission('finance.fund-requests', 'delete'), async (req: Request, res: Response) => {
  try {
    const fr = await dbGet('SELECT * FROM fund_requests WHERE id = ?', [req.params.id]) as any;
    if (!fr) return res.status(404).json({ error: 'Fund request not found' });
    if (fr.status !== 'draft') return res.status(400).json({ error: 'Only draft requests can be deleted' });

    await dbRun('DELETE FROM fund_request_items WHERE fund_request_id = ?', [req.params.id]);
    await dbRun('DELETE FROM fund_requests WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting fund request:', error);
    res.status(500).json({ error: 'Failed to delete fund request' });
  }
});

export default router;
