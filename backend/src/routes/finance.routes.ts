import express, { Request, Response } from 'express';
import { dbAll, dbGet, dbRun } from '../config/database';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

const generateFinanceCode = (prefix: string) => {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${datePart}-${rand}`;
};

// Recompute parent fund_request.status from child item statuses.
// Rules:
//  - any pending → 'submitted' (still under review)
//  - none pending, all approved → 'approved'
//  - none pending, all rejected → 'rejected'
//  - none pending, mix approved+rejected → 'partially_approved'
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

router.get('/cogs', authMiddleware, async (req: Request, res: Response) => {
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

router.get('/cogs/:id', authMiddleware, async (req: Request, res: Response) => {
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

router.post('/cogs', authMiddleware, async (req: Request, res: Response) => {
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

router.get('/profitability', authMiddleware, async (req: Request, res: Response) => {
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

router.post('/profitability', authMiddleware, async (req: Request, res: Response) => {
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

router.get('/accounts-payable', authMiddleware, async (req: Request, res: Response) => {
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

router.post('/accounts-payable', authMiddleware, async (req: Request, res: Response) => {
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

router.get('/accounts-receivable', authMiddleware, async (req: Request, res: Response) => {
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

router.post('/accounts-receivable', authMiddleware, async (req: Request, res: Response) => {
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

router.get('/financial-summary', authMiddleware, async (req: Request, res: Response) => {
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

router.get('/cost-analysis', authMiddleware, async (req: Request, res: Response) => {
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

router.get('/cost-analysis/trends', authMiddleware, async (req: Request, res: Response) => {
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

router.get('/margin-analysis', authMiddleware, async (req: Request, res: Response) => {
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

router.get('/margin-analysis/summary', authMiddleware, async (req: Request, res: Response) => {
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
// ===== FUND REQUESTS =====

router.get('/fund-requests', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT fr.*, po.po_number, v.name as vendor_name,
             ps.schedule_no, ps.label as schedule_label, ps.trigger_type,
             cp.project_name, cp.project_number,
             (SELECT COUNT(*) FROM fund_request_items fri WHERE fri.fund_request_id = fr.id) AS item_count,
             (SELECT COUNT(*) FROM fund_request_items fri WHERE fri.fund_request_id = fr.id AND fri.status = 'pending') AS pending_count,
             (SELECT COUNT(*) FROM fund_request_items fri WHERE fri.fund_request_id = fr.id AND fri.status = 'approved') AS approved_count,
             (SELECT COUNT(*) FROM fund_request_items fri WHERE fri.fund_request_id = fr.id AND fri.status = 'rejected') AS rejected_count
      FROM fund_requests fr
      LEFT JOIN purchase_orders po ON fr.po_id = po.id
      LEFT JOIN vendors v ON fr.vendor_id = v.id
      LEFT JOIN purchase_order_payment_schedules ps ON fr.po_schedule_id = ps.id
      LEFT JOIN client_projects cp ON fr.project_id = cp.id
      WHERE 1 = 1
    `;
    const params: any[] = [];

    if (status) {
      sql += ' AND fr.status = ?';
      params.push(String(status));
    }

    const { project_id } = req.query;
    if (project_id) {
      sql += ' AND fr.project_id = ?';
      params.push(Number(project_id));
    }

    sql += ' ORDER BY fr.created_at DESC';
    const rows = await dbAll(sql, params);
    res.json({ data: rows });
  } catch (error) {
    console.error('Error fetching fund requests:', error);
    res.status(500).json({ error: 'Failed to fetch fund requests' });
  }
});

router.get('/fund-requests/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const row = await dbGet(
      `SELECT fr.*, po.po_number, v.name as vendor_name,
              ps.schedule_no, ps.label as schedule_label, ps.trigger_type,
              cp.project_name, cp.project_number
       FROM fund_requests fr
       LEFT JOIN purchase_orders po ON fr.po_id = po.id
       LEFT JOIN vendors v ON fr.vendor_id = v.id
       LEFT JOIN purchase_order_payment_schedules ps ON fr.po_schedule_id = ps.id
       LEFT JOIN client_projects cp ON fr.project_id = cp.id
       WHERE fr.id = ?`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ error: 'Fund request not found' });
    const items = await dbAll(
      `SELECT fri.*, po.po_number, v.name as vendor_name,
              ps.schedule_no, ps.label as schedule_label, ps.trigger_type
       FROM fund_request_items fri
       LEFT JOIN purchase_orders po ON fri.po_id = po.id
       LEFT JOIN vendors v ON fri.vendor_id = v.id
       LEFT JOIN purchase_order_payment_schedules ps ON fri.po_schedule_id = ps.id
       WHERE fri.fund_request_id = ?
       ORDER BY fri.id ASC`,
      [req.params.id]
    );
    res.json({ data: { ...row, items } });
  } catch (error) {
    console.error('Error fetching fund request detail:', error);
    res.status(500).json({ error: 'Failed to fetch fund request' });
  }
});

router.post('/fund-requests', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || null;
    const {
      po_id,
      po_schedule_id,
      vendor_id,
      project_id,
      amount,
      needed_date,
      purpose,
      notes,
      status,
      request_date,
      cash_account,
      cash_account_note,
      items,
    } = req.body;

    if (!needed_date) return res.status(400).json({ error: 'needed_date is required' });
    if (!purpose || !String(purpose).trim()) {
      return res.status(400).json({ error: 'purpose is required' });
    }

    // Build normalized items list. Accept either `items[]` (multi-line) or single legacy fields.
    const rawItems: any[] = Array.isArray(items) && items.length > 0
      ? items
      : [{ po_id, po_schedule_id, vendor_id, amount, description: purpose }];

    const normalizedItems: Array<{
      po_id: number | null;
      po_schedule_id: number | null;
      vendor_id: number | null;
      amount: number;
      description: string | null;
    }> = [];

    for (const it of rawItems) {
      const itAmount = Number(it.amount);
      if (!Number.isFinite(itAmount) || itAmount <= 0) {
        return res.status(400).json({ error: 'Each item must have a valid positive amount' });
      }
      let itPoId = it.po_id || null;
      let itVendorId = it.vendor_id || null;
      const itScheduleId = it.po_schedule_id || null;

      if (itScheduleId) {
        if (normalizedItems.some(n => n.po_schedule_id === itScheduleId)) {
          return res.status(400).json({ error: 'Terdapat duplikasi Termin PO yang sama di dalam satu pengajuan.' });
        }

        const sched = await dbGet(
          `SELECT ps.po_id, po.vendor_id
           FROM purchase_order_payment_schedules ps
           LEFT JOIN purchase_orders po ON ps.po_id = po.id
           WHERE ps.id = ?`,
          [itScheduleId]
        ) as any;
        if (!sched) return res.status(400).json({ error: `Invalid po_schedule_id: ${itScheduleId}` });

        const existing = await dbGet(
          `SELECT fr.request_number
           FROM fund_request_items fri
           JOIN fund_requests fr ON fri.fund_request_id = fr.id
           WHERE fri.po_schedule_id = ? 
             AND fri.status != 'rejected' 
             AND fr.status != 'rejected'`,
          [itScheduleId]
        ) as any;
        if (existing) {
          return res.status(400).json({ error: `Termin PO ini sudah pernah diajukan pada request ${existing.request_number}.` });
        }

        if (!itPoId) itPoId = sched.po_id;
        if (!itVendorId) itVendorId = sched.vendor_id;
      }

      normalizedItems.push({
        po_id: itPoId,
        po_schedule_id: itScheduleId,
        vendor_id: itVendorId,
        amount: itAmount,
        description: it.description ? String(it.description).trim() : null,
      });
    }

    const totalAmount = normalizedItems.reduce((sum, it) => sum + it.amount, 0);
    if (totalAmount <= 0) {
      return res.status(400).json({ error: 'Total amount must be greater than zero' });
    }

    // Header-level summary references: take first item's references for backward compat
    const headerPoId = normalizedItems[0].po_id;
    const headerScheduleId = normalizedItems[0].po_schedule_id;
    const headerVendorId = normalizedItems[0].vendor_id;

    const number = generateFinanceCode('FR');
    const result = await dbRun(
      `INSERT INTO fund_requests (
         request_number, request_date, po_id, po_schedule_id, vendor_id, project_id, amount, needed_date,
         purpose, status, requester_id, notes, cash_account, cash_account_note
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        number,
        request_date || new Date().toISOString().slice(0, 10),
        headerPoId,
        headerScheduleId,
        headerVendorId,
        project_id || null,
        totalAmount,
        needed_date,
        String(purpose).trim(),
        status || 'draft',
        userId,
        notes || null,
        cash_account ? String(cash_account).trim() : null,
        cash_account_note ? String(cash_account_note).trim() : null,
      ]
    );

    const fundRequestId = result.insertId;
    for (const it of normalizedItems) {
      await dbRun(
        `INSERT INTO fund_request_items (fund_request_id, po_id, po_schedule_id, vendor_id, description, amount)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [fundRequestId, it.po_id, it.po_schedule_id, it.vendor_id, it.description, it.amount]
      );
    }

    res.status(201).json({
      message: 'Fund request created',
      data: { id: fundRequestId, request_number: number, total_amount: totalAmount, item_count: normalizedItems.length },
    });
  } catch (error) {
    console.error('Error creating fund request:', error);
    res.status(500).json({ error: 'Failed to create fund request' });
  }
});

router.put('/fund-requests/:id/submit', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || null;
    const row = await dbGet('SELECT * FROM fund_requests WHERE id = ?', [req.params.id]) as any;
    if (!row) return res.status(404).json({ error: 'Fund request not found' });
    if (!['draft', 'rejected'].includes(row.status)) {
      return res.status(400).json({ error: 'Only draft or rejected request can be submitted' });
    }

    await dbRun(
      'UPDATE fund_requests SET status = ?, submitted_at = CURRENT_TIMESTAMP, requester_id = ?, rejection_reason = NULL WHERE id = ?',
      ['submitted', userId, req.params.id]
    );

    try {
      const approvalNumber = generateFinanceCode('APR');
      await dbRun(
        `INSERT INTO approval_requests (request_number, module, entity_type, entity_id, requester_id, current_step, status, notes)
         VALUES (?, ?, ?, ?, ?, 1, 'pending', ?)`,
        [approvalNumber, 'finance', 'fund_request', req.params.id, userId, `Fund request ${row.request_number}`]
      );
    } catch (approvalError) {
      console.warn('Approval request insert warning:', (approvalError as any)?.message || approvalError);
    }

    res.json({ success: true, message: 'Fund request submitted' });
  } catch (error) {
    console.error('Error submitting fund request:', error);
    res.status(500).json({ error: 'Failed to submit fund request' });
  }
});

router.put('/fund-requests/:id/approve', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || null;
    const userLevel = Number((req as any).user?.userLevel || 0);
    if (userLevel < 4) {
      return res.status(403).json({ error: 'Only admin or above can approve fund requests' });
    }

    const row = await dbGet('SELECT * FROM fund_requests WHERE id = ?', [req.params.id]) as any;
    if (!row) return res.status(404).json({ error: 'Fund request not found' });
    if (row.status !== 'submitted' && row.status !== 'partially_approved') {
      return res.status(400).json({ error: 'Only submitted or partially approved request can be approved' });
    }

    // Bulk-approve: mark all pending items as approved by this admin
    const pendingItems = await dbAll(
      `SELECT id, po_id FROM fund_request_items WHERE fund_request_id = ? AND status = 'pending'`,
      [req.params.id]
    ) as Array<{ id: number, po_id: number | null }>;

    // GRN Verification
    for (const it of pendingItems) {
      if (it.po_id) {
        const grn = await dbGet('SELECT id FROM goods_receipts WHERE po_id = ?', [it.po_id]);
        if (!grn) {
          return res.status(400).json({ error: `Cannot approve: GRN has not been created for PO ID #${it.po_id}` });
        }
      }
    }

    await dbRun(
      `UPDATE fund_request_items
       SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP, rejection_reason = NULL
       WHERE fund_request_id = ? AND status = 'pending'`,
      [userId, req.params.id]
    );

    // Auto-record AP payment for each newly approved item that's linked to a PO schedule
    const payments: any[] = [];
    for (const it of pendingItems) {
      const r = await autoPayApFromFundRequestItem(it.id);
      if (r.recorded) payments.push({ item_id: it.id, ...r });
    }

    await recomputeFundRequestStatus(Number(req.params.id), userId);

    res.json({ success: true, message: 'Fund request approved (all pending items)', auto_payments: payments });
  } catch (error) {
    console.error('Error approving fund request:', error);
    res.status(500).json({ error: 'Failed to approve fund request' });
  }
});

router.put('/fund-requests/:id/reject', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userLevel = Number((req as any).user?.userLevel || 0);
    if (userLevel < 4) {
      return res.status(403).json({ error: 'Only admin or above can reject fund requests' });
    }

    const { reason } = req.body;
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'reason is required' });
    }

    const row = await dbGet('SELECT * FROM fund_requests WHERE id = ?', [req.params.id]) as any;
    if (!row) return res.status(404).json({ error: 'Fund request not found' });
    if (row.status !== 'submitted' && row.status !== 'partially_approved') {
      return res.status(400).json({ error: 'Only submitted or partially approved request can be rejected' });
    }

    // Reject all pending items with the same reason
    await dbRun(
      `UPDATE fund_request_items
       SET status = 'rejected', rejection_reason = ?
       WHERE fund_request_id = ? AND status = 'pending'`,
      [String(reason).trim(), req.params.id]
    );

    await dbRun(
      'UPDATE fund_requests SET rejection_reason = ? WHERE id = ?',
      [String(reason).trim(), req.params.id]
    );

    await recomputeFundRequestStatus(Number(req.params.id), null);

    res.json({ success: true, message: 'Fund request rejected (all pending items)' });
  } catch (error) {
    console.error('Error rejecting fund request:', error);
    res.status(500).json({ error: 'Failed to reject fund request' });
  }
});

// Per-item approval endpoints
router.put('/fund-requests/:id/items/:itemId/approve', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || null;
    const userLevel = Number((req as any).user?.userLevel || 0);
    if (userLevel < 4) {
      return res.status(403).json({ error: 'Only admin or above can approve fund request items' });
    }

    const fr = await dbGet('SELECT * FROM fund_requests WHERE id = ?', [req.params.id]) as any;
    if (!fr) return res.status(404).json({ error: 'Fund request not found' });
    if (fr.status !== 'submitted' && fr.status !== 'partially_approved') {
      return res.status(400).json({ error: 'Fund request is not in an approvable state' });
    }

    const item = await dbGet(
      'SELECT * FROM fund_request_items WHERE id = ? AND fund_request_id = ?',
      [req.params.itemId, req.params.id]
    ) as any;
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.status !== 'pending') {
      return res.status(400).json({ error: `Item already ${item.status}` });
    }

    // GRN Verification
    if (item.po_id) {
      const grn = await dbGet('SELECT id FROM goods_receipts WHERE po_id = ?', [item.po_id]);
      if (!grn) {
        return res.status(400).json({ error: `Cannot approve: GRN has not been created for PO ID #${item.po_id}` });
      }
    }

    await dbRun(
      `UPDATE fund_request_items
       SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP, rejection_reason = NULL
       WHERE id = ?`,
      [userId, req.params.itemId]
    );

    const payment = await autoPayApFromFundRequestItem(Number(req.params.itemId));
    await recomputeFundRequestStatus(Number(req.params.id), userId);

    res.json({ success: true, message: 'Item approved', auto_payment: payment });
  } catch (error) {
    console.error('Error approving fund request item:', error);
    res.status(500).json({ error: 'Failed to approve item' });
  }
});

router.put('/fund-requests/:id/items/:itemId/reject', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userLevel = Number((req as any).user?.userLevel || 0);
    if (userLevel < 4) {
      return res.status(403).json({ error: 'Only admin or above can reject fund request items' });
    }
    const { reason } = req.body;
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'reason is required' });
    }

    const fr = await dbGet('SELECT * FROM fund_requests WHERE id = ?', [req.params.id]) as any;
    if (!fr) return res.status(404).json({ error: 'Fund request not found' });
    if (fr.status !== 'submitted' && fr.status !== 'partially_approved') {
      return res.status(400).json({ error: 'Fund request is not in an approvable state' });
    }

    const item = await dbGet(
      'SELECT * FROM fund_request_items WHERE id = ? AND fund_request_id = ?',
      [req.params.itemId, req.params.id]
    ) as any;
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.status !== 'pending') {
      return res.status(400).json({ error: `Item already ${item.status}` });
    }

    await dbRun(
      `UPDATE fund_request_items
       SET status = 'rejected', rejection_reason = ?
       WHERE id = ?`,
      [String(reason).trim(), req.params.itemId]
    );

    await recomputeFundRequestStatus(Number(req.params.id), null);

    res.json({ success: true, message: 'Item rejected' });
  } catch (error) {
    console.error('Error rejecting fund request item:', error);
    res.status(500).json({ error: 'Failed to reject item' });
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

export default router;
