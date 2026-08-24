import express, { Request, Response } from 'express';
import { dbAll, dbGet, dbRun, dbTransaction } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import {
  createManualJournal, submitJournal, approveJournal,
  postJournal, reverseJournal
} from '../services/accounting-posting.service';
import {
  softClosePeriod, closePeriod, reopenPeriod
} from '../services/fiscal-period.service';

const router = express.Router();

// ===========================
// CHART OF ACCOUNTS (COA)
// ===========================

// GET /gl/coa — List all accounts (tree-ready)
router.get('/coa', authMiddleware, requirePermission('finance.coa', 'view'), async (req: Request, res: Response) => {
  try {
    const { type, active_only } = req.query;
    let sql = 'SELECT * FROM chart_of_accounts';
    const params: any[] = [];
    const conditions: string[] = [];

    if (type) {
      conditions.push('account_type = ?');
      params.push(type);
    }
    if (active_only === 'true') {
      conditions.push('is_active = 1');
    }
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY account_code ASC';

    const accounts = await dbAll(sql, params);
    res.json({ success: true, data: accounts });
  } catch (error) {
    console.error('Error fetching COA:', error);
    res.status(500).json({ error: 'Failed to fetch chart of accounts' });
  }
});

// GET /gl/coa/:id
router.get('/coa/:id', authMiddleware, requirePermission('finance.coa', 'view'), async (req: Request, res: Response) => {
  try {
    const account = await dbGet('SELECT * FROM chart_of_accounts WHERE id = ?', [req.params.id]);
    if (!account) return res.status(404).json({ error: 'Account not found' });
    res.json({ success: true, data: account });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});

// POST /gl/coa — Create account
router.post('/coa', authMiddleware, requirePermission('finance.coa', 'create'), async (req: Request, res: Response) => {
  try {
    const { account_code, account_name, account_type, parent_id, level, is_header, normal_balance,
            description, currency, is_control_account, control_subledger, financial_statement_section } = req.body;
    if (!account_code || !account_name || !account_type || !normal_balance) {
      return res.status(422).json({ error: 'account_code, account_name, account_type, and normal_balance are required', code: 'VALIDATION_ERROR' });
    }

    const existing = await dbGet('SELECT id FROM chart_of_accounts WHERE account_code = ?', [account_code]);
    if (existing) return res.status(409).json({ error: 'Account code already exists', code: 'DUPLICATE_ACCOUNT' });

    const isHeader = is_header || 0;
    const result = await dbRun(
      `INSERT INTO chart_of_accounts (account_code, account_name, account_type, parent_id, level,
       is_header, is_postable, normal_balance, description, currency,
       is_control_account, control_subledger, allow_manual_posting, financial_statement_section)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [account_code, account_name, account_type, parent_id || null, level || 1,
       isHeader, isHeader ? 0 : 1, normal_balance, description || null, currency || 'IDR',
       is_control_account || 0, control_subledger || null,
       is_control_account ? 0 : 1, financial_statement_section || null]
    );
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// PUT /gl/coa/:id
router.put('/coa/:id', authMiddleware, requirePermission('finance.coa', 'update'), async (req: Request, res: Response) => {
  try {
    const { account_name, account_type, parent_id, level, is_header, normal_balance, description, is_active, currency } = req.body;
    await dbRun(
      `UPDATE chart_of_accounts SET account_name = COALESCE(?, account_name), account_type = COALESCE(?, account_type),
       parent_id = ?, level = COALESCE(?, level), is_header = COALESCE(?, is_header),
       normal_balance = COALESCE(?, normal_balance), description = ?, is_active = COALESCE(?, is_active),
       currency = COALESCE(?, currency) WHERE id = ?`,
      [account_name, account_type, parent_id !== undefined ? parent_id : null, level, is_header, normal_balance, description, is_active, currency, req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// DELETE /gl/coa/:id
router.delete('/coa/:id', authMiddleware, requirePermission('finance.coa', 'deactivate'), async (req: Request, res: Response) => {
  // An account is deactivated, never removed. Deleting one would detach the history that
  // refers to it, and the account code is what past reports were built on. The verb stays
  // DELETE so already-deployed clients keep working.
  try {
    const account = await dbGet('SELECT id, account_code, is_active FROM chart_of_accounts WHERE id = ?', [
      req.params.id,
    ]) as any;
    if (!account) return res.status(404).json({ error: 'Account not found', code: 'ACCOUNT_NOT_FOUND' });

    if (Number(account.is_active) === 0) {
      return res.json({ success: true, deactivated: true, alreadyInactive: true });
    }

    await dbRun('UPDATE chart_of_accounts SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true, deactivated: true, account_code: account.account_code });
  } catch (error) {
    res.status(500).json({ error: 'Failed to deactivate account' });
  }
});

// ===========================
// FISCAL PERIODS
// ===========================

router.get('/fiscal-periods', authMiddleware, requirePermission('finance.general-ledger', 'view'), async (req: Request, res: Response) => {
  try {
    const { year } = req.query;
    let sql = 'SELECT * FROM fiscal_periods';
    const params: any[] = [];
    if (year) {
      sql += ' WHERE fiscal_year = ?';
      params.push(year);
    }
    sql += ' ORDER BY fiscal_year DESC, period_number ASC';
    const periods = await dbAll(sql, params);
    res.json({ success: true, data: periods });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch fiscal periods' });
  }
});

// period management endpoints
router.post('/fiscal-periods/:id/soft-close', authMiddleware, requirePermission('finance.general-ledger', 'period_close'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    await dbTransaction(async (conn: any) => {
      await softClosePeriod(conn, Number(req.params.id), userId);
    });
    res.json({ success: true, message: 'Period soft-closed' });
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message, code: error.code });
  }
});

router.post('/fiscal-periods/:id/close', authMiddleware, requirePermission('finance.general-ledger', 'period_close'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    await dbTransaction(async (conn: any) => {
      await closePeriod(conn, Number(req.params.id), userId);
    });
    res.json({ success: true, message: 'Period closed' });
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message, code: error.code });
  }
});

router.post('/fiscal-periods/:id/reopen', authMiddleware, requirePermission('finance.general-ledger', 'period_close'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { reason } = req.body;
    await dbTransaction(async (conn: any) => {
      await reopenPeriod(conn, Number(req.params.id), userId, reason);
    });
    res.json({ success: true, message: 'Period reopened' });
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message, code: error.code });
  }
});

// journal entries

// GET /gl/journal-entries
router.get('/journal-entries', authMiddleware, requirePermission('finance.general-ledger', 'view'), async (req: Request, res: Response) => {
  try {
    const { status, from_date, to_date, reference_type, limit: lim } = req.query;
    let sql = `
      SELECT je.*, u.full_name as created_by_name,
             (SELECT COUNT(*) FROM journal_lines WHERE journal_entry_id = je.id) as line_count
      FROM journal_entries je
      LEFT JOIN users u ON je.created_by = u.id`;
    const conditions: string[] = [];
    const params: any[] = [];

    if (status) { conditions.push('je.status = ?'); params.push(status); }
    if (from_date) { conditions.push('je.entry_date >= ?'); params.push(from_date); }
    if (to_date) { conditions.push('je.entry_date <= ?'); params.push(to_date); }
    if (reference_type) { conditions.push('je.reference_type = ?'); params.push(reference_type); }

    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY je.entry_date DESC, je.id DESC';
    if (lim) sql += ` LIMIT ${parseInt(lim as string) || 50}`;

    const entries = await dbAll(sql, params);
    res.json({ success: true, data: entries });
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    res.status(500).json({ error: 'Failed to fetch journal entries' });
  }
});

// GET /gl/journal-entries/:id — Detail with lines
router.get('/journal-entries/:id', authMiddleware, requirePermission('finance.general-ledger', 'view'), async (req: Request, res: Response) => {
  try {
    const entry = await dbGet(
      `SELECT je.*, u.full_name as created_by_name
       FROM journal_entries je LEFT JOIN users u ON je.created_by = u.id
       WHERE je.id = ?`,
      [req.params.id]
    );
    if (!entry) return res.status(404).json({ error: 'Journal entry not found' });

    const lines = await dbAll(
      `SELECT jl.*, coa.account_code, coa.account_name, coa.account_type
       FROM journal_lines jl
       JOIN chart_of_accounts coa ON jl.account_id = coa.id
       WHERE jl.journal_entry_id = ?
       ORDER BY jl.id ASC`,
      [req.params.id]
    );

    res.json({ success: true, data: { ...(entry as any), lines } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch journal entry' });
  }
});

// POST /gl/journal-entries — Create manual journal (transactional via AccountingPostingService)
router.post('/journal-entries', authMiddleware, requirePermission('finance.general-ledger', 'create'), async (req: Request, res: Response) => {
  try {
    const { entry_date, description, lines, transaction_currency } = req.body;
    const idempotencyKey = req.headers['idempotency-key'] as string || req.body.idempotency_key;
    const userId = (req as any).user?.userId;

    if (!entry_date || !description) {
      return res.status(422).json({ error: 'entry_date and description are required', code: 'VALIDATION_ERROR' });
    }
    if (!idempotencyKey) {
      return res.status(422).json({ error: 'Idempotency-Key header or idempotency_key body field is required', code: 'VALIDATION_ERROR' });
    }

    // map frontend field names to service input
    const mappedLines = (lines || []).map((l: any) => ({
      accountId: l.account_id || l.accountId,
      description: l.description,
      debit: String(l.debit || '0'),
      credit: String(l.credit || '0'),
      currency: l.currency,
      exchangeRate: l.exchange_rate ? String(l.exchange_rate) : undefined,
      costCenterId: l.cost_center_id,
      projectId: l.project_id,
      productId: l.product_id,
      warehouseId: l.warehouse_id,
      lotId: l.lot_id,
      vendorId: l.vendor_id,
      customerId: l.customer_id,
    }));

    const result = await dbTransaction(async (conn: any) => {
      return createManualJournal(conn, {
        entryDate: entry_date,
        description,
        lines: mappedLines,
        transactionCurrency: transaction_currency,
        idempotencyKey,
        userId,
      });
    });

    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error creating journal entry:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message, code: error.code });
  }
});

// POST /gl/journal-entries/:id/submit — Submit for approval (DRAFT -> PENDING_APPROVAL)
router.post('/journal-entries/:id/submit', authMiddleware, requirePermission('finance.general-ledger', 'submit'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const idempotencyKey = req.headers['idempotency-key'] as string || req.body.idempotency_key || `submit-${req.params.id}-${Date.now()}`;
    const result = await dbTransaction(async (conn: any) => {
      return submitJournal(conn, { journalId: Number(req.params.id), userId, idempotencyKey });
    });
    res.json({ success: true, data: result });
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message, code: error.code });
  }
});

// POST /gl/journal-entries/:id/approve — Approve (PENDING_APPROVAL -> APPROVED, SoD enforced)
router.post('/journal-entries/:id/approve', authMiddleware, requirePermission('finance.general-ledger', 'approve'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const idempotencyKey = req.headers['idempotency-key'] as string || req.body.idempotency_key || `approve-${req.params.id}-${Date.now()}`;
    const result = await dbTransaction(async (conn: any) => {
      return approveJournal(conn, { journalId: Number(req.params.id), userId, idempotencyKey });
    });
    res.json({ success: true, data: result });
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message, code: error.code });
  }
});

// POST /gl/journal-entries/:id/post — Post journal (APPROVED -> POSTED, SoD enforced)
router.post('/journal-entries/:id/post', authMiddleware, requirePermission('finance.general-ledger', 'post'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const idempotencyKey = req.headers['idempotency-key'] as string || req.body.idempotency_key;
    if (!idempotencyKey) {
      return res.status(422).json({ error: 'Idempotency-Key is required for posting', code: 'VALIDATION_ERROR' });
    }
    const result = await dbTransaction(async (conn: any) => {
      return postJournal(conn, { journalId: Number(req.params.id), userId, idempotencyKey });
    });
    res.json({ success: true, data: result });
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message, code: error.code });
  }
});

// keep legacy PUT route for backward compatibility
router.put('/journal-entries/:id/post', authMiddleware, requirePermission('finance.general-ledger', 'post'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const idempotencyKey = req.headers['idempotency-key'] as string || `legacy-post-${req.params.id}-${Date.now()}`;
    const result = await dbTransaction(async (conn: any) => {
      return postJournal(conn, { journalId: Number(req.params.id), userId, idempotencyKey });
    });
    res.json({ success: true, data: result });
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message, code: error.code });
  }
});

// POST /gl/journal-entries/:id/reverse — Immutable reversal (creates opposite journal)
router.post('/journal-entries/:id/reverse', authMiddleware, requirePermission('finance.general-ledger', 'reverse'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { reason } = req.body;
    const idempotencyKey = req.headers['idempotency-key'] as string || req.body.idempotency_key;
    if (!idempotencyKey) {
      return res.status(422).json({ error: 'Idempotency-Key is required for reversal', code: 'VALIDATION_ERROR' });
    }
    const result = await dbTransaction(async (conn: any) => {
      return reverseJournal(conn, { journalId: Number(req.params.id), userId, idempotencyKey, reason });
    });
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message, code: error.code });
  }
});

// legacy void route — redirects to reversal
router.put('/journal-entries/:id/void', authMiddleware, requirePermission('finance.general-ledger', 'reverse'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { reason } = req.body;
    const idempotencyKey = `legacy-void-${req.params.id}-${Date.now()}`;
    const result = await dbTransaction(async (conn: any) => {
      return reverseJournal(conn, { journalId: Number(req.params.id), userId, idempotencyKey, reason: reason || 'Voided via legacy endpoint' });
    });
    res.json({ success: true, data: result, message: 'Journal reversed (immutable reversal replaces void)' });
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message, code: error.code });
  }
});

// ===========================
// TRIAL BALANCE
// ===========================

router.get('/trial-balance', authMiddleware, requirePermission('finance.general-ledger', 'report'), async (req: Request, res: Response) => {
  try {
    const { as_of_date } = req.query;
    const asOf = as_of_date || new Date().toISOString().split('T')[0];

    // always derive from posted journals only (blueprint §19 rule: posted journals only)
    const sql = `
      SELECT coa.id, coa.account_code, coa.account_name, coa.account_type,
             coa.normal_balance, coa.is_header, coa.financial_statement_section,
             COALESCE(SUM(jl.base_debit), 0) as total_debit,
             COALESCE(SUM(jl.base_credit), 0) as total_credit,
             CASE WHEN coa.normal_balance = 'debit'
               THEN COALESCE(SUM(jl.base_debit), 0) - COALESCE(SUM(jl.base_credit), 0)
               ELSE COALESCE(SUM(jl.base_credit), 0) - COALESCE(SUM(jl.base_debit), 0)
             END as balance
      FROM chart_of_accounts coa
      LEFT JOIN journal_lines jl ON coa.id = jl.account_id
        AND jl.journal_entry_id IN (
          SELECT id FROM journal_entries WHERE status = 'posted' AND posting_date <= ?
        )
      WHERE coa.is_active = 1 AND coa.is_header = 0
      GROUP BY coa.id
      HAVING total_debit > 0 OR total_credit > 0
      ORDER BY coa.account_code ASC`;

    const accounts = await dbAll(sql, [asOf]);

    // compute TB totals
    let tbDebit = 0, tbCredit = 0;
    for (const a of accounts as any[]) {
      if ((a as any).normal_balance === 'debit') {
        tbDebit += Number((a as any).balance || 0);
      } else {
        tbCredit += Number((a as any).balance || 0);
      }
    }

    res.json({
      success: true,
      data: accounts,
      summary: {
        as_of_date: asOf,
        total_debit_balance: tbDebit,
        total_credit_balance: tbCredit,
        is_balanced: Math.abs(tbDebit - tbCredit) < 0.005,
      },
    });
  } catch (error) {
    console.error('Error fetching trial balance:', error);
    res.status(500).json({ error: 'Failed to fetch trial balance' });
  }
});

// ===========================
// FINANCIAL REPORTS
// ===========================

// GET /gl/reports/income-statement
router.get('/reports/income-statement', authMiddleware, requirePermission('finance.general-ledger', 'report'), async (req: Request, res: Response) => {
  try {
    const { from_date, to_date } = req.query;
    if (!from_date || !to_date) {
      return res.status(400).json({ error: 'from_date and to_date are required' });
    }

    // Revenue (4xxx)
     const revenue = await dbAll(`
      SELECT coa.account_code, coa.account_name,
             COALESCE(SUM(jl.base_credit), 0) - COALESCE(SUM(jl.base_debit), 0) as amount
      FROM chart_of_accounts coa
      LEFT JOIN (
        SELECT jl2.account_id, jl2.base_debit, jl2.base_credit FROM journal_lines jl2
        INNER JOIN journal_entries je2 ON jl2.journal_entry_id = je2.id AND je2.status = 'posted' AND je2.posting_date BETWEEN ? AND ?
      ) jl ON coa.id = jl.account_id
      WHERE coa.account_type = 'revenue' AND coa.is_header = 0
      GROUP BY coa.id ORDER BY coa.account_code`, [from_date, to_date]);

    // COGS (5xxx)
    const cogs = await dbAll(`
      SELECT coa.account_code, coa.account_name,
             COALESCE(SUM(jl.base_debit), 0) - COALESCE(SUM(jl.base_credit), 0) as amount
      FROM chart_of_accounts coa
      LEFT JOIN (
        SELECT jl2.account_id, jl2.base_debit, jl2.base_credit FROM journal_lines jl2
        INNER JOIN journal_entries je2 ON jl2.journal_entry_id = je2.id AND je2.status = 'posted' AND je2.posting_date BETWEEN ? AND ?
      ) jl ON coa.id = jl.account_id
      WHERE coa.account_type = 'cogs' AND coa.is_header = 0
      GROUP BY coa.id ORDER BY coa.account_code`, [from_date, to_date]);

    // Operating Expenses (6xxx)
    const expenses = await dbAll(`
      SELECT coa.account_code, coa.account_name,
             COALESCE(SUM(jl.base_debit), 0) - COALESCE(SUM(jl.base_credit), 0) as amount
      FROM chart_of_accounts coa
      LEFT JOIN (
        SELECT jl2.account_id, jl2.base_debit, jl2.base_credit FROM journal_lines jl2
        INNER JOIN journal_entries je2 ON jl2.journal_entry_id = je2.id AND je2.status = 'posted' AND je2.posting_date BETWEEN ? AND ?
      ) jl ON coa.id = jl.account_id
      WHERE coa.account_type = 'expense' AND coa.is_header = 0
      GROUP BY coa.id ORDER BY coa.account_code`, [from_date, to_date]);

    // Other Income/Expense (7xxx)
    const otherIncome = await dbAll(`
      SELECT coa.account_code, coa.account_name, coa.normal_balance,
             CASE WHEN coa.normal_balance = 'credit'
               THEN COALESCE(SUM(jl.base_credit), 0) - COALESCE(SUM(jl.base_debit), 0)
               ELSE -(COALESCE(SUM(jl.base_debit), 0) - COALESCE(SUM(jl.base_credit), 0))
             END as amount
      FROM chart_of_accounts coa
      LEFT JOIN (
        SELECT jl2.account_id, jl2.base_debit, jl2.base_credit FROM journal_lines jl2
        INNER JOIN journal_entries je2 ON jl2.journal_entry_id = je2.id AND je2.status = 'posted' AND je2.posting_date BETWEEN ? AND ?
      ) jl ON coa.id = jl.account_id
      WHERE coa.account_type = 'other_income' AND coa.is_header = 0
      GROUP BY coa.id ORDER BY coa.account_code`, [from_date, to_date]);

    // Tax (8xxx)
    const tax = await dbAll(`
      SELECT coa.account_code, coa.account_name,
             COALESCE(SUM(jl.base_debit), 0) - COALESCE(SUM(jl.base_credit), 0) as amount
      FROM chart_of_accounts coa
      LEFT JOIN (
        SELECT jl2.account_id, jl2.base_debit, jl2.base_credit FROM journal_lines jl2
        INNER JOIN journal_entries je2 ON jl2.journal_entry_id = je2.id AND je2.status = 'posted' AND je2.posting_date BETWEEN ? AND ?
      ) jl ON coa.id = jl.account_id
      WHERE coa.account_type = 'tax' AND coa.is_header = 0
      GROUP BY coa.id ORDER BY coa.account_code`, [from_date, to_date]);

    // Calculate totals
    const totalRevenue = (revenue as any[]).reduce((s, r) => s + Number(r.amount || 0), 0);
    const totalCogs = (cogs as any[]).reduce((s, r) => s + Number(r.amount || 0), 0);
    const grossProfit = totalRevenue - totalCogs;
    const totalExpenses = (expenses as any[]).reduce((s, r) => s + Number(r.amount || 0), 0);
    const operatingIncome = grossProfit - totalExpenses;
    const totalOtherIncome = (otherIncome as any[]).reduce((s, r) => s + Number(r.amount || 0), 0);
    const incomeBeforeTax = operatingIncome + totalOtherIncome;
    const totalTax = (tax as any[]).reduce((s, r) => s + Number(r.amount || 0), 0);
    const netIncome = incomeBeforeTax - totalTax;

    res.json({
      success: true,
      data: {
        period: { from: from_date, to: to_date },
        revenue, totalRevenue,
        cogs, totalCogs,
        grossProfit,
        expenses, totalExpenses,
        operatingIncome,
        otherIncome, totalOtherIncome,
        incomeBeforeTax,
        tax, totalTax,
        netIncome
      }
    });
  } catch (error) {
    console.error('Error generating income statement:', error);
    res.status(500).json({ error: 'Failed to generate income statement' });
  }
});

// GET /gl/reports/balance-sheet
router.get('/reports/balance-sheet', authMiddleware, requirePermission('finance.general-ledger', 'report'), async (req: Request, res: Response) => {
  try {
    const { as_of_date } = req.query;
    const asOf = as_of_date || new Date().toISOString().split('T')[0];

    const getBalances = async (type: string) => {
      return await dbAll(`
        SELECT coa.account_code, coa.account_name, coa.is_header, coa.normal_balance,
               coa.financial_statement_section,
               COALESCE(SUM(jl.base_debit), 0) as total_debit,
               COALESCE(SUM(jl.base_credit), 0) as total_credit,
               CASE WHEN coa.normal_balance = 'debit'
                 THEN COALESCE(SUM(jl.base_debit), 0) - COALESCE(SUM(jl.base_credit), 0)
                 ELSE COALESCE(SUM(jl.base_credit), 0) - COALESCE(SUM(jl.base_debit), 0)
               END as balance
        FROM chart_of_accounts coa
        LEFT JOIN (
          SELECT jl2.account_id, jl2.base_debit, jl2.base_credit FROM journal_lines jl2
          INNER JOIN journal_entries je2 ON jl2.journal_entry_id = je2.id AND je2.status = 'posted' AND je2.posting_date <= ?
        ) jl ON coa.id = jl.account_id
        WHERE coa.account_type = ? AND coa.is_active = 1 AND coa.is_header = 0
        GROUP BY coa.id ORDER BY coa.account_code`, [asOf, type]);
    };

    const assets = await getBalances('asset');
    const liabilities = await getBalances('liability');
    const equity = await getBalances('equity');

    const totalAssets = (assets as any[]).reduce((s, a) => s + Number(a.balance || 0), 0);
    const totalLiabilities = (liabilities as any[]).reduce((s, a) => s + Number(a.balance || 0), 0);
    const totalEquity = (equity as any[]).reduce((s, a) => s + Number(a.balance || 0), 0);

    res.json({
      success: true,
      data: {
        as_of_date: asOf,
        assets, totalAssets,
        liabilities, totalLiabilities,
        equity, totalEquity,
        totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
        isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01
      }
    });
  } catch (error) {
    console.error('Error generating balance sheet:', error);
    res.status(500).json({ error: 'Failed to generate balance sheet' });
  }
});

// GET /gl/reports/cash-flow — uses account roles instead of hardcoded codes
router.get('/reports/cash-flow', authMiddleware, requirePermission('finance.general-ledger', 'report'), async (req: Request, res: Response) => {
  try {
    const { from_date, to_date } = req.query;
    if (!from_date || !to_date) {
      return res.status(400).json({ error: 'from_date and to_date are required' });
    }

    // resolve cash/bank accounts from account_roles table
    const cashRoles = await dbAll(
      `SELECT DISTINCT ar.account_id FROM account_roles ar
       WHERE ar.role_code IN ('CASH_ON_HAND', 'BANK_OPERATING') AND ar.company_id = 1
         AND ar.effective_from <= ? AND (ar.effective_to IS NULL OR ar.effective_to >= ?)`,
      [to_date, from_date]
    ) as any[];

    // fallback to hardcoded if no roles configured yet
    let cashAccountFilter: string;
    let cashParams: any[] = [];
    if (cashRoles.length > 0) {
      const ids = cashRoles.map((r: any) => r.account_id);
      cashAccountFilter = `coa.id IN (${ids.map(() => '?').join(',')})`;
      cashParams = ids;
    } else {
      cashAccountFilter = `coa.account_code IN ('1110', '1111', '1112', '1113')`;
    }

    const cashFlow = await dbAll(`
      SELECT je.reference_type,
             COALESCE(SUM(jl.base_debit), 0) as cash_in,
             COALESCE(SUM(jl.base_credit), 0) as cash_out,
             COALESCE(SUM(jl.base_debit), 0) - COALESCE(SUM(jl.base_credit), 0) as net_flow
      FROM journal_lines jl
      INNER JOIN journal_entries je ON jl.journal_entry_id = je.id AND je.status = 'posted'
      JOIN chart_of_accounts coa ON jl.account_id = coa.id
      WHERE ${cashAccountFilter}
        AND je.posting_date BETWEEN ? AND ?
      GROUP BY je.reference_type
      ORDER BY net_flow DESC`, [...cashParams, from_date, to_date]);

    // opening cash balance from posted journals only
    const openingCash = await dbGet(`
      SELECT COALESCE(SUM(jl.base_debit - jl.base_credit), 0) as balance
      FROM journal_lines jl
      INNER JOIN journal_entries je ON jl.journal_entry_id = je.id AND je.status = 'posted' AND je.posting_date < ?
      JOIN chart_of_accounts coa ON jl.account_id = coa.id
      WHERE ${cashAccountFilter}`, [...cashParams, from_date]) as any;

    const totalNetFlow = (cashFlow as any[]).reduce((s: number, f: any) => s + Number(f.net_flow || 0), 0);

    res.json({
      success: true,
      data: {
        period: { from: from_date, to: to_date },
        openingBalance: Number(openingCash?.balance || 0),
        cashFlow,
        totalNetFlow,
        closingBalance: Number(openingCash?.balance || 0) + totalNetFlow
      }
    });
  } catch (error) {
    console.error('Error generating cash flow:', error);
    res.status(500).json({ error: 'Failed to generate cash flow' });
  }
});

// ===========================
// GL DASHBOARD
// ===========================

router.get('/dashboard', authMiddleware, requirePermission('finance.general-ledger', 'view'), async (req: Request, res: Response) => {
  try {
    const accountSummary = await dbGet(`
      SELECT
        (SELECT COUNT(*) FROM chart_of_accounts WHERE is_active = 1) as total_accounts,
        (SELECT COUNT(*) FROM journal_entries WHERE status = 'posted') as posted_entries,
        (SELECT COUNT(*) FROM journal_entries WHERE status = 'draft') as draft_entries,
        (SELECT COALESCE(SUM(total_debit), 0) FROM journal_entries WHERE status = 'posted') as total_debits,
        (SELECT COALESCE(SUM(total_credit), 0) FROM journal_entries WHERE status = 'posted') as total_credits
    `);

    // Current period
    const currentPeriod = await dbGet(
      `SELECT * FROM fiscal_periods WHERE CURDATE() BETWEEN start_date AND end_date LIMIT 1`
    );

    // Recent journal entries
    const recentEntries = await dbAll(`
      SELECT je.*, u.full_name as created_by_name
      FROM journal_entries je
      LEFT JOIN users u ON je.created_by = u.id
      ORDER BY je.created_at DESC LIMIT 10`
    );

    // account type summary derived from posted journals
    const typeSummary = await dbAll(`
      SELECT coa.account_type, COUNT(DISTINCT coa.id) as count,
             SUM(CASE WHEN coa.normal_balance = 'debit'
               THEN COALESCE(jl.base_debit, 0) - COALESCE(jl.base_credit, 0)
               ELSE COALESCE(jl.base_credit, 0) - COALESCE(jl.base_debit, 0)
             END) as total_balance
      FROM chart_of_accounts coa
      LEFT JOIN journal_lines jl ON coa.id = jl.account_id
        AND jl.journal_entry_id IN (SELECT id FROM journal_entries WHERE status = 'posted')
      WHERE coa.is_active = 1 AND coa.is_header = 0
      GROUP BY coa.account_type
      ORDER BY coa.account_type`
    );

    res.json({
      success: true,
      data: {
        summary: accountSummary,
        currentPeriod,
        recentEntries,
        typeSummary
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch GL dashboard' });
  }
});

export default router;
