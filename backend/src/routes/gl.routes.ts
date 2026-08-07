import express, { Request, Response } from 'express';
import { dbAll, dbGet, dbRun } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';

const router = express.Router();

// ===========================
// CHART OF ACCOUNTS (COA)
// ===========================

// GET /gl/coa — List all accounts (tree-ready)
router.get('/coa', authMiddleware, async (req: Request, res: Response) => {
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
router.get('/coa/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const account = await dbGet('SELECT * FROM chart_of_accounts WHERE id = ?', [req.params.id]);
    if (!account) return res.status(404).json({ error: 'Account not found' });
    res.json({ success: true, data: account });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});

// POST /gl/coa — Create account
router.post('/coa', authMiddleware, requirePermission('finance.general-ledger', 'create'), async (req: Request, res: Response) => {
  try {
    const { account_code, account_name, account_type, parent_id, level, is_header, normal_balance, description, opening_balance, currency } = req.body;
    if (!account_code || !account_name || !account_type || !normal_balance) {
      return res.status(400).json({ error: 'account_code, account_name, account_type, and normal_balance are required' });
    }

    const existing = await dbGet('SELECT id FROM chart_of_accounts WHERE account_code = ?', [account_code]);
    if (existing) return res.status(400).json({ error: 'Account code already exists' });

    const result = await dbRun(
      `INSERT INTO chart_of_accounts (account_code, account_name, account_type, parent_id, level, is_header, normal_balance, description, opening_balance, current_balance, currency)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [account_code, account_name, account_type, parent_id || null, level || 1, is_header || 0, normal_balance, description || null, opening_balance || 0, opening_balance || 0, currency || 'IDR']
    );
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// PUT /gl/coa/:id
router.put('/coa/:id', authMiddleware, requirePermission('finance.general-ledger', 'update'), async (req: Request, res: Response) => {
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
router.delete('/coa/:id', authMiddleware, requirePermission('finance.general-ledger', 'delete'), async (req: Request, res: Response) => {
  try {
    // Check if account has journal lines
    const hasEntries = await dbGet('SELECT COUNT(*) as cnt FROM journal_lines WHERE account_id = ?', [req.params.id]) as any;
    if (hasEntries?.cnt > 0) {
      return res.status(400).json({ error: 'Cannot delete account with journal entries. Deactivate instead.' });
    }
    await dbRun('DELETE FROM chart_of_accounts WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// ===========================
// FISCAL PERIODS
// ===========================

router.get('/fiscal-periods', authMiddleware, async (req: Request, res: Response) => {
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

// ===========================
// JOURNAL ENTRIES
// ===========================

const generateJournalNumber = () => {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `JE-${datePart}-${rand}`;
};

// GET /gl/journal-entries
router.get('/journal-entries', authMiddleware, async (req: Request, res: Response) => {
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
router.get('/journal-entries/:id', authMiddleware, async (req: Request, res: Response) => {
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

// POST /gl/journal-entries — Create manual journal entry
router.post('/journal-entries', authMiddleware, requirePermission('finance.general-ledger', 'create'), async (req: Request, res: Response) => {
  try {
    const { entry_date, description, reference_type, reference_id, reference_number, lines } = req.body;

    if (!entry_date || !description) {
      return res.status(400).json({ error: 'entry_date and description are required' });
    }
    if (!lines || !Array.isArray(lines) || lines.length < 2) {
      return res.status(400).json({ error: 'At least 2 journal lines required' });
    }

    // Validate debit = credit
    let totalDebit = 0, totalCredit = 0;
    for (const line of lines) {
      totalDebit += Number(line.debit || 0);
      totalCredit += Number(line.credit || 0);
    }
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({ error: `Debit (${totalDebit}) must equal Credit (${totalCredit})` });
    }

    // Find fiscal period
    const period = await dbGet(
      'SELECT id FROM fiscal_periods WHERE ? BETWEEN start_date AND end_date AND status = ?',
      [entry_date, 'open']
    ) as any;

    const entryNumber = generateJournalNumber();
    const userId = (req as any).user?.id || (req as any).user?.userId || null;

    const result = await dbRun(
      `INSERT INTO journal_entries (entry_number, entry_date, fiscal_period_id, description, reference_type, reference_id, reference_number, total_debit, total_credit, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
      [entryNumber, entry_date, period?.id || null, description, reference_type || null, reference_id || null, reference_number || null, totalDebit, totalCredit, userId]
    );
    const jeId = result.insertId;

    // Insert lines
    for (const line of lines) {
      const debit = Number(line.debit || 0);
      const credit = Number(line.credit || 0);
      const rate = Number(line.exchange_rate || 1);
      await dbRun(
        `INSERT INTO journal_lines (journal_entry_id, account_id, description, debit, credit, currency, exchange_rate, base_debit, base_credit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [jeId, line.account_id, line.description || null, debit, credit, line.currency || 'IDR', rate, debit * rate, credit * rate]
      );
    }

    res.status(201).json({ success: true, data: { id: jeId, entry_number: entryNumber } });
  } catch (error) {
    console.error('Error creating journal entry:', error);
    res.status(500).json({ error: 'Failed to create journal entry' });
  }
});

// PUT /gl/journal-entries/:id/post — Post journal entry (update account balances)
router.put('/journal-entries/:id/post', authMiddleware, requirePermission('finance.general-ledger', 'update'), async (req: Request, res: Response) => {
  try {
    const entry = await dbGet('SELECT * FROM journal_entries WHERE id = ?', [req.params.id]) as any;
    if (!entry) return res.status(404).json({ error: 'Journal entry not found' });
    if (entry.status !== 'draft') return res.status(400).json({ error: 'Only draft entries can be posted' });

    const lines = await dbAll('SELECT * FROM journal_lines WHERE journal_entry_id = ?', [req.params.id]) as any[];
    const userId = (req as any).user?.id || (req as any).user?.userId || null;

    // Update account balances
    for (const line of lines) {
      const account = await dbGet('SELECT * FROM chart_of_accounts WHERE id = ?', [line.account_id]) as any;
      if (!account) continue;

      // For debit-normal accounts (assets, expenses, COGS): debit increases, credit decreases
      // For credit-normal accounts (liabilities, equity, revenue): credit increases, debit decreases
      let balanceChange = 0;
      if (account.normal_balance === 'debit') {
        balanceChange = Number(line.base_debit || 0) - Number(line.base_credit || 0);
      } else {
        balanceChange = Number(line.base_credit || 0) - Number(line.base_debit || 0);
      }

      await dbRun(
        'UPDATE chart_of_accounts SET current_balance = current_balance + ? WHERE id = ?',
        [balanceChange, line.account_id]
      );
    }

    // Mark as posted
    await dbRun(
      `UPDATE journal_entries SET status = 'posted', posted_by = ?, posted_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [userId, req.params.id]
    );

    res.json({ success: true, message: 'Journal entry posted' });
  } catch (error) {
    console.error('Error posting journal entry:', error);
    res.status(500).json({ error: 'Failed to post journal entry' });
  }
});

// PUT /gl/journal-entries/:id/void — Void a posted journal entry (reverse balances)
router.put('/journal-entries/:id/void', authMiddleware, requirePermission('finance.general-ledger', 'update'), async (req: Request, res: Response) => {
  try {
    const entry = await dbGet('SELECT * FROM journal_entries WHERE id = ?', [req.params.id]) as any;
    if (!entry) return res.status(404).json({ error: 'Journal entry not found' });
    if (entry.status !== 'posted') return res.status(400).json({ error: 'Only posted entries can be voided' });

    const { reason } = req.body;
    const lines = await dbAll('SELECT * FROM journal_lines WHERE journal_entry_id = ?', [req.params.id]) as any[];
    const userId = (req as any).user?.id || (req as any).user?.userId || null;

    // Reverse account balances
    for (const line of lines) {
      const account = await dbGet('SELECT * FROM chart_of_accounts WHERE id = ?', [line.account_id]) as any;
      if (!account) continue;

      let balanceChange = 0;
      if (account.normal_balance === 'debit') {
        balanceChange = -(Number(line.base_debit || 0) - Number(line.base_credit || 0));
      } else {
        balanceChange = -(Number(line.base_credit || 0) - Number(line.base_debit || 0));
      }

      await dbRun(
        'UPDATE chart_of_accounts SET current_balance = current_balance + ? WHERE id = ?',
        [balanceChange, line.account_id]
      );
    }

    await dbRun(
      `UPDATE journal_entries SET status = 'voided', voided_by = ?, voided_at = CURRENT_TIMESTAMP, void_reason = ? WHERE id = ?`,
      [userId, reason || null, req.params.id]
    );

    res.json({ success: true, message: 'Journal entry voided' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to void journal entry' });
  }
});

// ===========================
// TRIAL BALANCE
// ===========================

router.get('/trial-balance', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { as_of_date } = req.query;

    let sql: string;
    let params: any[] = [];

    if (as_of_date) {
      // Calculate balances from posted journals up to date
      sql = `
        SELECT coa.id, coa.account_code, coa.account_name, coa.account_type,
               coa.normal_balance, coa.is_header, coa.opening_balance,
               COALESCE(SUM(jl.base_debit), 0) as total_debit,
               COALESCE(SUM(jl.base_credit), 0) as total_credit,
               coa.opening_balance + COALESCE(SUM(jl.base_debit), 0) - COALESCE(SUM(jl.base_credit), 0) as ending_balance_debit_basis
        FROM chart_of_accounts coa
        LEFT JOIN journal_lines jl ON coa.id = jl.account_id
        LEFT JOIN journal_entries je ON jl.journal_entry_id = je.id AND je.status = 'posted' AND je.entry_date <= ?
        WHERE coa.is_active = 1
        GROUP BY coa.id
        ORDER BY coa.account_code ASC`;
      params = [as_of_date];
    } else {
      // Use current_balance from COA
      sql = `
        SELECT id, account_code, account_name, account_type, normal_balance, is_header,
               opening_balance, current_balance,
               CASE WHEN normal_balance = 'debit' THEN current_balance ELSE 0 END as debit_balance,
               CASE WHEN normal_balance = 'credit' THEN current_balance ELSE 0 END as credit_balance
        FROM chart_of_accounts
        WHERE is_active = 1
        ORDER BY account_code ASC`;
    }

    const accounts = await dbAll(sql, params);
    res.json({ success: true, data: accounts });
  } catch (error) {
    console.error('Error fetching trial balance:', error);
    res.status(500).json({ error: 'Failed to fetch trial balance' });
  }
});

// ===========================
// FINANCIAL REPORTS
// ===========================

// GET /gl/reports/income-statement
router.get('/reports/income-statement', authMiddleware, async (req: Request, res: Response) => {
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
      LEFT JOIN journal_lines jl ON coa.id = jl.account_id
      LEFT JOIN journal_entries je ON jl.journal_entry_id = je.id AND je.status = 'posted' AND je.entry_date BETWEEN ? AND ?
      WHERE coa.account_type = 'revenue' AND coa.is_header = 0
      GROUP BY coa.id ORDER BY coa.account_code`, [from_date, to_date]);

    // COGS (5xxx)
    const cogs = await dbAll(`
      SELECT coa.account_code, coa.account_name,
             COALESCE(SUM(jl.base_debit), 0) - COALESCE(SUM(jl.base_credit), 0) as amount
      FROM chart_of_accounts coa
      LEFT JOIN journal_lines jl ON coa.id = jl.account_id
      LEFT JOIN journal_entries je ON jl.journal_entry_id = je.id AND je.status = 'posted' AND je.entry_date BETWEEN ? AND ?
      WHERE coa.account_type = 'cogs' AND coa.is_header = 0
      GROUP BY coa.id ORDER BY coa.account_code`, [from_date, to_date]);

    // Operating Expenses (6xxx)
    const expenses = await dbAll(`
      SELECT coa.account_code, coa.account_name,
             COALESCE(SUM(jl.base_debit), 0) - COALESCE(SUM(jl.base_credit), 0) as amount
      FROM chart_of_accounts coa
      LEFT JOIN journal_lines jl ON coa.id = jl.account_id
      LEFT JOIN journal_entries je ON jl.journal_entry_id = je.id AND je.status = 'posted' AND je.entry_date BETWEEN ? AND ?
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
      LEFT JOIN journal_lines jl ON coa.id = jl.account_id
      LEFT JOIN journal_entries je ON jl.journal_entry_id = je.id AND je.status = 'posted' AND je.entry_date BETWEEN ? AND ?
      WHERE coa.account_type = 'other_income' AND coa.is_header = 0
      GROUP BY coa.id ORDER BY coa.account_code`, [from_date, to_date]);

    // Tax (8xxx)
    const tax = await dbAll(`
      SELECT coa.account_code, coa.account_name,
             COALESCE(SUM(jl.base_debit), 0) - COALESCE(SUM(jl.base_credit), 0) as amount
      FROM chart_of_accounts coa
      LEFT JOIN journal_lines jl ON coa.id = jl.account_id
      LEFT JOIN journal_entries je ON jl.journal_entry_id = je.id AND je.status = 'posted' AND je.entry_date BETWEEN ? AND ?
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
router.get('/reports/balance-sheet', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { as_of_date } = req.query;
    const asOf = as_of_date || new Date().toISOString().split('T')[0];

    const getBalances = async (type: string) => {
      return await dbAll(`
        SELECT coa.account_code, coa.account_name, coa.is_header, coa.normal_balance,
               coa.opening_balance,
               COALESCE(SUM(jl.base_debit), 0) as total_debit,
               COALESCE(SUM(jl.base_credit), 0) as total_credit,
               CASE WHEN coa.normal_balance = 'debit'
                 THEN coa.opening_balance + COALESCE(SUM(jl.base_debit), 0) - COALESCE(SUM(jl.base_credit), 0)
                 ELSE coa.opening_balance + COALESCE(SUM(jl.base_credit), 0) - COALESCE(SUM(jl.base_debit), 0)
               END as balance
        FROM chart_of_accounts coa
        LEFT JOIN journal_lines jl ON coa.id = jl.account_id
        LEFT JOIN journal_entries je ON jl.journal_entry_id = je.id AND je.status = 'posted' AND je.entry_date <= ?
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

// GET /gl/reports/cash-flow
router.get('/reports/cash-flow', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { from_date, to_date } = req.query;
    if (!from_date || !to_date) {
      return res.status(400).json({ error: 'from_date and to_date are required' });
    }

    // Cash accounts movement (1110, 1111, 1112, 1113)
    const cashFlow = await dbAll(`
      SELECT je.reference_type,
             COALESCE(SUM(jl.base_debit), 0) as cash_in,
             COALESCE(SUM(jl.base_credit), 0) as cash_out,
             COALESCE(SUM(jl.base_debit), 0) - COALESCE(SUM(jl.base_credit), 0) as net_flow
      FROM journal_lines jl
      JOIN journal_entries je ON jl.journal_entry_id = je.id AND je.status = 'posted'
      JOIN chart_of_accounts coa ON jl.account_id = coa.id
      WHERE coa.account_code IN ('1110', '1111', '1112', '1113')
        AND je.entry_date BETWEEN ? AND ?
      GROUP BY je.reference_type
      ORDER BY net_flow DESC`, [from_date, to_date]);

    // Opening cash balance
    const openingCash = await dbGet(`
      SELECT COALESCE(SUM(
        CASE WHEN coa.normal_balance = 'debit'
          THEN coa.opening_balance + COALESCE(d.total_debit, 0) - COALESCE(d.total_credit, 0)
          ELSE coa.opening_balance + COALESCE(d.total_credit, 0) - COALESCE(d.total_debit, 0)
        END
      ), 0) as balance
      FROM chart_of_accounts coa
      LEFT JOIN (
        SELECT jl.account_id, SUM(jl.base_debit) as total_debit, SUM(jl.base_credit) as total_credit
        FROM journal_lines jl
        JOIN journal_entries je ON jl.journal_entry_id = je.id AND je.status = 'posted' AND je.entry_date < ?
        GROUP BY jl.account_id
      ) d ON coa.id = d.account_id
      WHERE coa.account_code IN ('1110', '1111', '1112', '1113')`, [from_date]) as any;

    const totalNetFlow = (cashFlow as any[]).reduce((s, f) => s + Number(f.net_flow || 0), 0);

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

router.get('/dashboard', authMiddleware, async (req: Request, res: Response) => {
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

    // Account type summary
    const typeSummary = await dbAll(`
      SELECT account_type, COUNT(*) as count,
             SUM(current_balance) as total_balance
      FROM chart_of_accounts
      WHERE is_active = 1 AND is_header = 0
      GROUP BY account_type
      ORDER BY account_type`
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
