import express, { Request, Response } from 'express';
import { dbAll, dbGet, dbRun } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { postApPayment, postVendorInvoice } from '../services/payables.service';
import { reverseVendorInvoice, reverseCustomerInvoice, reverseShipment } from '../services/reversal.service';
import { respondWithDomainError } from '../errors/domain.error';
import { requirePermission } from '../middleware/permission';
import { money, moneyRound, toDbString } from '../lib/decimal';

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

// When an approved fund request item is linked to a payment schedule, settle the payable.
//
// This used to move money on its own: three loose UPDATEs, no transaction, float arithmetic,
// no overpayment check, and - the part that matters - no journal at all. The subledger said
// the vendor had been paid while the ledger still showed the full liability and cash untouched,
// so the two drifted apart with every disbursement.
//
// A fund request is an authorisation, not an economic event. Approving it does not move money;
// it permits the payment, and the payment is what posts. So this now delegates to the payables
// service, which writes the payment and its journal (Dr accounts payable, Cr bank) in one
// transaction, refuses to pay more than is owed, and settles once on a retry.
const autoPayApFromFundRequestItem = async (itemId: number, approvedBy: number | null) => {
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
    'SELECT * FROM accounts_payable WHERE po_schedule_id = ? AND superseded_seq = 0 ORDER BY id DESC LIMIT 1',
    [item.po_schedule_id]
  ) as any;
  if (!ap) {
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

  // the day the money was authorised to move, so the journal carries the business date rather
  // than whenever this code happened to run
  const paymentDate = (item.approved_at ? new Date(item.approved_at) : new Date())
    .toISOString().slice(0, 10);

  try {
    const payment = await postApPayment({
      apId: ap.id,
      amount: item.amount,
      paymentDate,
      reference: `Fund request item ${itemId}`,
      // stable and derived from the item, never a timestamp: approving twice settles once
      idempotencyKey: `fund-request-item-${itemId}`,
      userId: approvedBy ?? 0,
    });

    await dbRun(
      'UPDATE fund_request_items SET ap_id = ?, payment_recorded_at = CURRENT_TIMESTAMP WHERE id = ?',
      [ap.id, itemId]
    );

    return {
      recorded: true,
      ap_id: ap.id,
      payment_id: payment.payment_id,
      journal_id: payment.journal_id,
      paid_amount: payment.paid_amount,
      status: payment.status,
    };
  } catch (error: any) {
    // The approval already happened and stands. The payment did not, and the reason travels
    // back to the caller rather than turning an approval into a 500 or, worse, being swallowed.
    return { recorded: false, reason: error?.code || 'payment failed', detail: error?.message };
  }
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
// ===== AP PAYMENT =====

// Recognise a vendor invoice: Dr GRNI, Cr Accounts Payable.
// This is what clears the liability raised at goods receipt. Creating a payable without it
// leaves GRNI growing forever and the vendor balance invisible to the ledger.
router.post('/accounts-payable/invoice', authMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      po_id, po_schedule_id, grn_id, vendor_id, invoice_number, invoice_date, due_date, amount, notes,
      lines, variance_approval,
    } = req.body;
    if (!vendor_id || !invoice_number || !amount) {
      return res.status(422).json({ error: 'vendor_id, invoice_number and amount are required', code: 'VALIDATION_ERROR' });
    }

    // Only the receipt line, the quantity and the price are taken from the caller. The product
    // and the PO line are read from the receipt, so an invoice cannot rename what it is billing.
    let billedLines;
    if (lines !== undefined) {
      if (!Array.isArray(lines)) {
        return res.status(422).json({ error: 'lines must be an array of billed receipt lines', code: 'VALIDATION_ERROR' });
      }
      billedLines = lines.map((line: any) => ({
        grnLineId: Number(line.grn_line_id ?? line.grnLineId),
        quantity: line.quantity,
        unitPrice: line.unit_price ?? line.unitPrice,
      }));
      if (billedLines.some((line: any) => !Number.isFinite(line.grnLineId) || line.grnLineId <= 0)) {
        return res.status(422).json({ error: 'every billed line needs a grn_line_id', code: 'VALIDATION_ERROR' });
      }
    }

    const result = await postVendorInvoice({
      poId: po_id || null,
      poScheduleId: po_schedule_id || null,
      grnId: grn_id || null,
      vendorId: Number(vendor_id),
      invoiceNumber: String(invoice_number),
      invoiceDate: (invoice_date || new Date().toISOString().slice(0, 10)).slice(0, 10),
      dueDate: due_date || null,
      amount,
      notes: notes || null,
      lines: billedLines,
      // an approval is only ever the signed-in user's; the body cannot nominate someone else
      varianceApproval: variance_approval?.reason
        ? { reason: String(variance_approval.reason), authorizedBy: (req as any).user?.userId }
        : null,
      userId: (req as any).user?.userId,
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (respondWithDomainError(error, res)) return;
    console.error('Error posting vendor invoice:', error);
    res.status(500).json({ error: 'Failed to post vendor invoice' });
  }
});

router.put('/accounts-payable/:id/pay', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { amount } = req.body;
    const paymentAmount = Number(amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Positive payment amount required' });
    }
    const paymentDate = (req.body.payment_date || new Date().toISOString().slice(0, 10)).slice(0, 10);

    // A client that sends no key still gets replay protection: the same payable, the same
    // amount, on the same day, with the same reference is the same payment. Callers should
    // send an explicit key so two genuinely separate identical payments stay distinct.
    const idempotencyKey =
      req.body.idempotency_key ||
      `ap-${req.params.id}-${paymentDate}-${paymentAmount}-${req.body.reference || 'noref'}`;

    const result = await postApPayment({
      apId: Number(req.params.id),
      amount: paymentAmount,
      paymentDate,
      paymentAccountRole: req.body.payment_account_role === 'CASH_ON_HAND' ? 'CASH_ON_HAND' : 'BANK_OPERATING',
      reference: req.body.reference || null,
      idempotencyKey,
      userId: (req as any).user?.userId,
    });

    res.json({ success: true, message: 'Payment recorded', data: result });
  } catch (error) {
    if (respondWithDomainError(error, res)) return;
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

// GET /fund-requests — list all fund requests with item counts
router.get('/fund-requests', authMiddleware, async (req: Request, res: Response) => {
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

// GET /fund-requests/:id — detail with items
router.get('/fund-requests/:id', authMiddleware, async (req: Request, res: Response) => {
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

// POST /fund-requests — create new fund request with items
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
    const userId = (req as any).user?.userId || null;

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

// PUT /fund-requests/:id — update draft fund request
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

// PUT /fund-requests/:id/submit — submit for approval
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
        [req.params.id, (req as any).user?.userId || null]
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

// PUT /fund-requests/:id/approve — approve all pending items
router.put('/fund-requests/:id/approve', authMiddleware, async (req: Request, res: Response) => {
  try {
    const fr = await dbGet('SELECT * FROM fund_requests WHERE id = ?', [req.params.id]) as any;
    if (!fr) return res.status(404).json({ error: 'Fund request not found' });
    if (fr.status !== 'submitted' && fr.status !== 'partially_approved') {
      return res.status(400).json({ error: 'Only submitted requests can be approved' });
    }

    const approverId = (req as any).user?.userId || null;

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
      await autoPayApFromFundRequestItem(item.id, approverId);
    }

    await recomputeFundRequestStatus(Number(req.params.id), approverId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error approving fund request:', error);
    res.status(500).json({ error: 'Failed to approve fund request' });
  }
});

// PUT /fund-requests/:id/reject — reject all pending items
router.put('/fund-requests/:id/reject', authMiddleware, async (req: Request, res: Response) => {
  try {
    const fr = await dbGet('SELECT * FROM fund_requests WHERE id = ?', [req.params.id]) as any;
    if (!fr) return res.status(404).json({ error: 'Fund request not found' });
    if (fr.status !== 'submitted' && fr.status !== 'partially_approved') {
      return res.status(400).json({ error: 'Only submitted requests can be rejected' });
    }

    const { reason } = req.body;
    const approverId = (req as any).user?.userId || null;

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

// PUT /fund-requests/:id/items/:itemId/approve — approve single item
router.put('/fund-requests/:id/items/:itemId/approve', authMiddleware, async (req: Request, res: Response) => {
  try {
    const item = await dbGet(
      'SELECT * FROM fund_request_items WHERE id = ? AND fund_request_id = ?',
      [req.params.itemId, req.params.id]
    ) as any;
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.status !== 'pending') return res.status(400).json({ error: 'Item is not pending' });

    const approverId = (req as any).user?.userId || null;
    await dbRun(
      `UPDATE fund_request_items SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [approverId, req.params.itemId]
    );

    const disbursement = await autoPayApFromFundRequestItem(Number(req.params.itemId), approverId);
    await recomputeFundRequestStatus(Number(req.params.id), approverId);
    // The approval stands either way, but whether the payment posted is not something the
    // caller should have to guess at.
    res.json({ success: true, disbursement });
  } catch (error) {
    console.error('Error approving fund request item:', error);
    res.status(500).json({ error: 'Failed to approve item' });
  }
});

// PUT /fund-requests/:id/items/:itemId/reject — reject single item
router.put('/fund-requests/:id/items/:itemId/reject', authMiddleware, async (req: Request, res: Response) => {
  try {
    const item = await dbGet(
      'SELECT * FROM fund_request_items WHERE id = ? AND fund_request_id = ?',
      [req.params.itemId, req.params.id]
    ) as any;
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.status !== 'pending') return res.status(400).json({ error: 'Item is not pending' });

    const { reason } = req.body;
    const approverId = (req as any).user?.userId || null;
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

// DELETE /fund-requests/:id — delete draft fund request
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

// ===== PAYMENT SCHEDULE =====
//
// One view of everything falling due, drawn from the places an obligation can arise: the
// termin on a purchase order, an approved project expense, and a vendor invoice that is not
// tied to a termin. From here the selected rows become a fund request.
//
// Each row also says whether the ledger has recognised it. That distinction matters here more
// than anywhere else in the system: a payment schedule is a plan to pay, and a plan is not a
// liability. A row the ledger has never seen cannot be paid — postApPayment refuses a payable
// with no journal behind it — so the screen shows that plainly rather than letting someone
// build a fund request that could never settle.

interface DueRow {
  id: number;
  source: 'po' | 'expense' | 'invoice';
  label: string;
  ref_number: string | null;
  vendor_name: string | null;
  project_id: number | null;
  amount: string;
  paid_amount: string;
  outstanding: string;
  due_date: string | null;
  status: string;
  ledger_recognised: boolean | null;
  ap_id: number | null;
}

router.get(
  '/payment-schedule',
  authMiddleware,
  requirePermission('finance.fund-requests', 'view'),
  async (req: Request, res: Response) => {
    try {
      const { year, month, period, project_id, status, source } = req.query;
      const now = new Date();
      const yr = parseInt(String(year || now.getFullYear()), 10);
      const mo = parseInt(String(month || now.getMonth() + 1), 10);
      // 'monthly' spans the whole year; anything else narrows to the one month
      const wholeYear = String(period || 'monthly') === 'monthly';
      const today = now.toISOString().slice(0, 10);

      const rows: DueRow[] = [];

      // 1. purchase order termin
      if (!source || source === 'po') {
        const params: any[] = [];
        let sql = `
          SELECT ps.id, ps.po_id, ps.label, ps.amount, ps.due_date, ps.status,
                 COALESCE(ps.paid_amount, 0) AS paid_amount, ps.ap_id,
                 po.po_number AS ref_number, po.project_id,
                 v.name AS vendor_name,
                 ap.journal_entry_id
            FROM purchase_order_payment_schedules ps
            JOIN purchase_orders po ON po.id = ps.po_id
            LEFT JOIN vendors v ON v.id = po.vendor_id
            LEFT JOIN accounts_payable ap ON ap.id = ps.ap_id AND ap.superseded_seq = 0
           WHERE ps.amount > 0
             AND (po.approval_status >= 1 OR UPPER(po.status) = 'APPROVED')`;
        if (project_id) { sql += ' AND po.project_id = ?'; params.push(project_id); }
        if (status === 'overdue') { sql += ' AND ps.due_date < ? AND ps.status <> ?'; params.push(today, 'paid'); }
        else if (status) { sql += ' AND ps.status = ?'; params.push(status); }
        sql += wholeYear ? ' AND YEAR(ps.due_date) = ?' : ' AND YEAR(ps.due_date) = ? AND MONTH(ps.due_date) = ?';
        params.push(yr);
        if (!wholeYear) params.push(mo);

        for (const r of (await dbAll(sql, params)) as any[]) {
          const amount = moneyRound(money(String(r.amount || 0)));
          const paid = moneyRound(money(String(r.paid_amount || 0)));
          rows.push({
            id: r.id, source: 'po', label: r.label, ref_number: r.ref_number,
            vendor_name: r.vendor_name, project_id: r.project_id,
            amount: toDbString(amount), paid_amount: toDbString(paid),
            outstanding: toDbString(moneyRound(amount.minus(paid))),
            due_date: r.due_date, status: r.status,
            // a termin whose payable carries no journal is still only a plan
            ledger_recognised: r.ap_id ? !!r.journal_entry_id : false,
            ap_id: r.ap_id ?? null,
          });
        }
      }

      // 2. approved project expenses
      if (!source || source === 'expense') {
        const params: any[] = [];
        let sql = `
          SELECT e.id, e.project_id, e.description AS label, e.amount, e.expense_date AS due_date,
                 e.status, e.expense_number AS ref_number, v.name AS vendor_name
            FROM project_expenses e
            LEFT JOIN vendors v ON v.id = e.vendor_id
           WHERE e.status = 'approved' AND e.amount > 0`;
        if (project_id) { sql += ' AND e.project_id = ?'; params.push(project_id); }
        sql += wholeYear ? ' AND YEAR(e.expense_date) = ?' : ' AND YEAR(e.expense_date) = ? AND MONTH(e.expense_date) = ?';
        params.push(yr);
        if (!wholeYear) params.push(mo);

        for (const r of (await dbAll(sql, params)) as any[]) {
          const amount = moneyRound(money(String(r.amount || 0)));
          rows.push({
            id: r.id, source: 'expense', label: r.label, ref_number: r.ref_number,
            vendor_name: r.vendor_name, project_id: r.project_id,
            amount: toDbString(amount), paid_amount: '0.0000', outstanding: toDbString(amount),
            due_date: r.due_date, status: r.status,
            ledger_recognised: null, ap_id: null,
          });
        }
      }

      // 3. vendor invoices with no termin behind them, so nothing is listed twice
      if (!source || source === 'invoice') {
        const params: any[] = [];
        let sql = `
          SELECT ap.id, ap.po_id, ap.invoice_number AS ref_number,
                 COALESCE(ap.invoice_number, po.po_number, CONCAT('AP-', ap.id)) AS label,
                 ap.amount, ap.due_date, ap.status, ap.journal_entry_id,
                 COALESCE(ap.paid_amount, 0) AS paid_amount,
                 COALESCE(ap.debit_note_amount, 0) AS debit_note_amount,
                 v.name AS vendor_name, po.project_id
            FROM accounts_payable ap
            LEFT JOIN purchase_orders po ON po.id = ap.po_id
            LEFT JOIN vendors v ON v.id = ap.vendor_id
           WHERE ap.amount > 0 AND ap.status <> 'paid'
             AND ap.superseded_seq = 0
             AND ap.po_schedule_id IS NULL`;
        if (project_id) { sql += ' AND po.project_id = ?'; params.push(project_id); }
        sql += wholeYear ? ' AND YEAR(ap.due_date) = ?' : ' AND YEAR(ap.due_date) = ? AND MONTH(ap.due_date) = ?';
        params.push(yr);
        if (!wholeYear) params.push(mo);

        for (const r of (await dbAll(sql, params)) as any[]) {
          const amount = moneyRound(money(String(r.amount || 0)));
          const settled = moneyRound(
            money(String(r.paid_amount || 0)).plus(money(String(r.debit_note_amount || 0)))
          );
          rows.push({
            id: r.id, source: 'invoice', label: r.label, ref_number: r.ref_number,
            vendor_name: r.vendor_name, project_id: r.project_id,
            amount: toDbString(amount), paid_amount: toDbString(settled),
            outstanding: toDbString(moneyRound(amount.minus(settled))),
            due_date: r.due_date, status: r.status,
            ledger_recognised: !!r.journal_entry_id,
            ap_id: r.id,
          });
        }
      }

      rows.sort((a, b) => String(a.due_date || '9999').localeCompare(String(b.due_date || '9999')));

      let due = money('0');
      let recognised = money('0');
      let unrecognised = money('0');
      let overdue = money('0');
      for (const r of rows) {
        const out = money(r.outstanding);
        due = due.plus(out);
        if (r.ledger_recognised === true) recognised = recognised.plus(out);
        else if (r.ledger_recognised === false) unrecognised = unrecognised.plus(out);
        if (r.due_date && String(r.due_date).slice(0, 10) < today && r.status !== 'paid') {
          overdue = overdue.plus(out);
        }
      }

      res.json({
        success: true,
        data: rows,
        summary: {
          count: rows.length,
          total_outstanding: toDbString(moneyRound(due)),
          // what the ledger actually carries as a liability
          recognised: toDbString(moneyRound(recognised)),
          // planned, but nothing in the ledger says we owe it yet
          not_recognised: toDbString(moneyRound(unrecognised)),
          overdue: toDbString(moneyRound(overdue)),
        },
      });
    } catch (error) {
      console.error('Error fetching payment schedule:', error);
      res.status(500).json({ error: 'Failed to fetch payment schedule' });
    }
  }
);

// Turn selected rows into one fund request.
//
// A row already covered by a live fund request is skipped rather than requested twice, and so
// is a row the ledger has never recognised: approving that one could never pay, because
// postApPayment refuses a payable with no journal. Both are reported back by name, so what was
// left out and why is visible rather than silently dropped.
router.post(
  '/payment-schedule/generate-fund-request',
  authMiddleware,
  requirePermission('finance.fund-requests', 'create'),
  async (req: Request, res: Response) => {
    try {
      const { ids, needed_date, purpose } = req.body as {
        ids: Array<{ id: number; source: string }>;
        needed_date?: string;
        purpose?: string;
      };
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(422).json({ error: 'ids required', code: 'VALIDATION_ERROR' });
      }

      const userId = (req as any).user?.userId || null;
      const items: any[] = [];
      const skipped: string[] = [];
      let total = money('0');

      for (const entry of ids) {
        const id = Number(entry?.id);
        const source = String(entry?.source || 'po');
        if (!Number.isFinite(id)) continue;

        if (source === 'po') {
          const sched = await dbGet(
            `SELECT ps.*, po.vendor_id, po.po_number, ap.journal_entry_id
               FROM purchase_order_payment_schedules ps
               JOIN purchase_orders po ON po.id = ps.po_id
               LEFT JOIN accounts_payable ap ON ap.id = ps.ap_id AND ap.superseded_seq = 0
              WHERE ps.id = ?`,
            [id]
          ) as any;
          if (!sched) continue;

          const existing = await dbGet(
            `SELECT fr.request_number FROM fund_request_items fri
               JOIN fund_requests fr ON fr.id = fri.fund_request_id
              WHERE fri.po_schedule_id = ? AND fr.status <> 'rejected' LIMIT 1`,
            [id]
          ) as any;
          if (existing) {
            skipped.push(sched.po_number + ' — ' + sched.label + ': sudah ada di ' + existing.request_number);
            continue;
          }
          if (!sched.ap_id || !sched.journal_entry_id) {
            skipped.push(
              sched.po_number + ' — ' + sched.label +
                ': belum diakui di buku besar, tagihan vendornya belum diposting'
            );
            continue;
          }

          const amount = moneyRound(money(String(sched.amount || 0)));
          total = total.plus(amount);
          items.push({
            po_id: sched.po_id, po_schedule_id: sched.id, vendor_id: sched.vendor_id,
            description: sched.po_number + ' — ' + sched.label, amount: toDbString(amount),
          });
        } else if (source === 'invoice') {
          const ap = await dbGet(
            'SELECT * FROM accounts_payable WHERE id = ? AND superseded_seq = 0',
            [id]
          ) as any;
          if (!ap) continue;
          const name = ap.invoice_number || 'AP-' + ap.id;
          if (!ap.journal_entry_id) {
            skipped.push(name + ': belum diakui di buku besar');
            continue;
          }
          const outstanding = moneyRound(
            money(String(ap.amount || 0))
              .minus(money(String(ap.paid_amount || 0)))
              .minus(money(String(ap.debit_note_amount || 0)))
          );
          if (outstanding.lessThanOrEqualTo(0)) {
            skipped.push(name + ': sudah lunas');
            continue;
          }
          total = total.plus(outstanding);
          items.push({
            po_id: ap.po_id, po_schedule_id: ap.po_schedule_id, vendor_id: ap.vendor_id,
            description: 'Invoice ' + name, amount: toDbString(outstanding),
          });
        } else if (source === 'expense') {
          const e = await dbGet('SELECT * FROM project_expenses WHERE id = ?', [id]) as any;
          if (!e) continue;
          const amount = moneyRound(money(String(e.amount || 0)));
          total = total.plus(amount);
          items.push({
            po_id: null, po_schedule_id: null, vendor_id: e.vendor_id,
            description: 'Expense: ' + e.description, amount: toDbString(amount),
          });
        }
      }

      if (items.length === 0) {
        return res.status(409).json({
          error: 'Tidak ada baris yang bisa dijadikan fund request.',
          code: 'NOTHING_TO_REQUEST',
          skipped,
        });
      }

      const requestNumber = generateFinanceCode('FR');
      const today = new Date().toISOString().slice(0, 10);
      const frResult = await dbRun(
        `INSERT INTO fund_requests
         (request_number, request_date, amount, needed_date, purpose, status, requester_id)
         VALUES (?, ?, ?, ?, ?, 'submitted', ?)`,
        [
          requestNumber, today, toDbString(moneyRound(total)),
          (needed_date || today).slice(0, 10),
          purpose || 'Dibuat dari jadwal pembayaran', userId,
        ]
      );
      const frId = frResult.insertId;

      for (const item of items) {
        await dbRun(
          `INSERT INTO fund_request_items
           (fund_request_id, po_id, po_schedule_id, vendor_id, description, amount, status)
           VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
          [frId, item.po_id, item.po_schedule_id, item.vendor_id, item.description, item.amount]
        );
      }

      res.status(201).json({
        success: true,
        data: {
          fund_request_id: frId,
          request_number: requestNumber,
          item_count: items.length,
          total_amount: toDbString(moneyRound(total)),
          skipped,
        },
      });
    } catch (error) {
      if (respondWithDomainError(error, res)) return;
      console.error('Error generating fund request:', error);
      res.status(500).json({ error: 'Failed to generate fund request' });
    }
  }
);

// ===== DOCUMENT REVERSAL =====

// Undo a posted document that should never have existed -- wrong amount, wrong lot, posted
// twice. This is not a return: nothing physically moved. The original journal is kept and a
// mirror entry is posted against it, and the operational effect is undone as well, so the
// corrected document can be posted afterwards.
//
// Nothing here reverses a document something downstream has already relied on. A payment, a
// receipt, a debit note or a customer return all mean somebody has since acted on the figure.

const reversalGate = [authMiddleware, requirePermission('finance.document-reversal', 'reverse')];

router.post('/reversals/vendor-invoice/:apId', ...reversalGate, async (req: Request, res: Response) => {
  try {
    const { reason, idempotency_key } = req.body;
    if (!idempotency_key) {
      return res.status(422).json({ error: 'idempotency_key is required', code: 'VALIDATION_ERROR' });
    }
    const result = await reverseVendorInvoice({
      apId: Number(req.params.apId),
      reason: String(reason || ''),
      idempotencyKey: String(idempotency_key),
      userId: (req as any).user?.userId,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    if (respondWithDomainError(error, res)) return;
    console.error('Error reversing vendor invoice:', error);
    res.status(500).json({ error: 'Failed to reverse vendor invoice' });
  }
});

router.post('/reversals/customer-invoice/:invoiceId', ...reversalGate, async (req: Request, res: Response) => {
  try {
    const { reason, idempotency_key } = req.body;
    if (!idempotency_key) {
      return res.status(422).json({ error: 'idempotency_key is required', code: 'VALIDATION_ERROR' });
    }
    const result = await reverseCustomerInvoice({
      invoiceId: Number(req.params.invoiceId),
      reason: String(reason || ''),
      idempotencyKey: String(idempotency_key),
      userId: (req as any).user?.userId,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    if (respondWithDomainError(error, res)) return;
    console.error('Error reversing customer invoice:', error);
    res.status(500).json({ error: 'Failed to reverse customer invoice' });
  }
});

router.post('/reversals/shipment/:deliveryId', ...reversalGate, async (req: Request, res: Response) => {
  try {
    const { reason, idempotency_key } = req.body;
    if (!idempotency_key) {
      return res.status(422).json({ error: 'idempotency_key is required', code: 'VALIDATION_ERROR' });
    }
    const result = await reverseShipment({
      deliveryId: Number(req.params.deliveryId),
      reason: String(reason || ''),
      idempotencyKey: String(idempotency_key),
      userId: (req as any).user?.userId,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    if (respondWithDomainError(error, res)) return;
    console.error('Error reversing shipment:', error);
    res.status(500).json({ error: 'Failed to reverse shipment' });
  }
});

export default router;
