import express, { Request, Response } from 'express';
import { dbQuery, dbGet, dbAll, dbRun, dbTransaction } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';

const router = express.Router();

// ── Ensure prospects table exists ──
const ensureProspectsTable = async () => {
  try {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS prospects (
        id INT PRIMARY KEY AUTO_INCREMENT,
        code VARCHAR(50) NOT NULL UNIQUE,
        company_name VARCHAR(255) NOT NULL,
        contact_name VARCHAR(255),
        contact_title VARCHAR(100),
        email VARCHAR(255),
        phone VARCHAR(50),
        industry VARCHAR(150),
        website VARCHAR(255),
        address TEXT,
        city VARCHAR(100),
        country VARCHAR(100) DEFAULT 'Indonesia',
        source VARCHAR(50) DEFAULT 'other',
        temperature VARCHAR(20) DEFAULT 'cold',
        status VARCHAR(50) DEFAULT 'new',
        interest TEXT,
        estimated_value DECIMAL(15,2) DEFAULT 0,
        next_follow_up DATE,
        last_contacted_at TIMESTAMP NULL,
        assigned_to INT,
        notes TEXT,
        converted_to_client_id INT,
        converted_to_lead_id INT,
        converted_at TIMESTAMP NULL,
        is_archived TINYINT(1) DEFAULT 0,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_temperature (temperature),
        INDEX idx_status (status),
        INDEX idx_source (source),
        INDEX idx_next_follow_up (next_follow_up),
        INDEX idx_assigned_to (assigned_to),
        INDEX idx_is_archived (is_archived)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    // Ensure is_archived column exists on old tables
    try {
      await dbRun(`ALTER TABLE prospects ADD COLUMN is_archived TINYINT(1) DEFAULT 0`);
    } catch { /* column already exists */ }
    console.log('✅ Prospects table ensured');
  } catch (err) {
    console.error('Prospects table error:', err);
  }
};
ensureProspectsTable();

// ========================================
// PROSPECT STATE MACHINE
// ========================================
const PROSPECT_TRANSITIONS: Record<string, string[]> = {
  'new':          ['contacted', 'qualified', 'disqualified'],
  'contacted':    ['qualified', 'disqualified'],
  'qualified':    ['converted', 'disqualified'],
  'converted':    [],  // terminal
  'disqualified': ['new'],  // can reactivate
};

function validateProspectTransition(current: string, next: string): { valid: boolean; error?: string } {
  const allowed = PROSPECT_TRANSITIONS[current];
  if (!allowed) return { valid: false, error: `Unknown prospect status '${current}'` };
  if (!allowed.includes(next)) {
    return { valid: false, error: `Cannot transition prospect from '${current}' to '${next}'. Allowed: [${allowed.join(', ')}]` };
  }
  return { valid: true };
}

// ── Helper: generate next prospect code (concurrency-safe) ──
const generateProspectCode = async (conn?: any): Promise<string> => {
  const executor = conn || { execute: async (sql: string, params: any[]) => { const r = await dbGet(sql, params); return [[r]]; } };
  // Use FOR UPDATE to prevent race condition
  if (conn) {
    const [rows] = await conn.execute(
      `SELECT code FROM prospects WHERE code LIKE 'PSP-%' ORDER BY id DESC LIMIT 1 FOR UPDATE`
    );
    const row = rows[0];
    if (!row) return 'PSP-0001';
    const lastNum = parseInt(row.code.replace('PSP-', ''), 10);
    return `PSP-${String(lastNum + 1).padStart(4, '0')}`;
  }
  const row = await dbGet(`SELECT code FROM prospects WHERE code LIKE 'PSP-%' ORDER BY id DESC LIMIT 1`);
  if (!row) return 'PSP-0001';
  const lastNum = parseInt(row.code.replace('PSP-', ''), 10);
  return `PSP-${String(lastNum + 1).padStart(4, '0')}`;
};

// ── Helper: Log prospect activity ──
const logProspectActivity = async (prospectId: number | string, userId: number | null, action: string, details: string) => {
  try {
    await dbRun(
      'INSERT INTO lead_activities (lead_id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [prospectId, userId, `prospect_${action}`, details]
    );
  } catch { /* table might not exist */ }
};

// ── Helper: Duplicate detection ──
const checkDuplicate = async (companyName: string, email?: string | null, excludeId?: number): Promise<any[]> => {
  const duplicates: any[] = [];
  if (companyName) {
    const byCompany = await dbAll(
      `SELECT id, code, company_name, email, status FROM prospects WHERE company_name = ? AND is_archived = 0${excludeId ? ' AND id != ?' : ''}`,
      excludeId ? [companyName, excludeId] : [companyName]
    );
    duplicates.push(...byCompany.map((d: any) => ({ ...d, match_type: 'company_name' })));
  }
  if (email) {
    const byEmail = await dbAll(
      `SELECT id, code, company_name, email, status FROM prospects WHERE email = ? AND is_archived = 0${excludeId ? ' AND id != ?' : ''}`,
      excludeId ? [email, excludeId] : [email]
    );
    duplicates.push(...byEmail.filter((d: any) => !duplicates.some(dup => dup.id === d.id)).map((d: any) => ({ ...d, match_type: 'email' })));
  }
  return duplicates;
};

// ========================================
// CRUD ENDPOINTS — ALL WITH AUTH
// ========================================

// ── GET / — List with filters + ownership ──
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { search, temperature, status, source, assigned_to,
      sort_by = 'created_at', sort_dir = 'DESC',
      page = '1', limit = '25', show_archived } = req.query;

    const user = (req as any).user;
    let where = 'p.is_archived = 0';
    const params: any[] = [];

    // Show archived if explicitly requested
    if (show_archived === '1' || show_archived === 'true') {
      where = '1=1';
    }

    // Ownership filter: non-admin users only see their own or unassigned
    if (user.roleId !== 1) {
      where += ` AND (p.assigned_to = ? OR p.assigned_to IS NULL OR p.created_by = ?)`;
      params.push(user.userId, user.userId);
    }

    if (search) {
      where += ` AND (p.company_name LIKE ? OR p.contact_name LIKE ? OR p.email LIKE ? OR p.code LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (temperature) { where += ` AND p.temperature = ?`; params.push(temperature); }
    if (status) { where += ` AND p.status = ?`; params.push(status); }
    if (source) { where += ` AND p.source = ?`; params.push(source); }
    if (assigned_to) { where += ` AND p.assigned_to = ?`; params.push(assigned_to); }

    const countRow = await dbGet(`SELECT COUNT(*) as total FROM prospects p WHERE ${where}`, params);
    const total = countRow?.total || 0;

    const validSorts = ['created_at', 'updated_at', 'company_name', 'temperature', 'status', 'estimated_value', 'next_follow_up'];
    const sortCol = validSorts.includes(sort_by as string) ? sort_by : 'created_at';
    const sortDirection = (sort_dir as string).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const offset = (pageNum - 1) * limitNum;

    const rows = await dbAll(`
      SELECT p.*, u.full_name as assigned_to_name, cb.full_name as created_by_name
      FROM prospects p
      LEFT JOIN users u ON p.assigned_to = u.id
      LEFT JOIN users cb ON p.created_by = cb.id
      WHERE ${where}
      ORDER BY p.${sortCol} ${sortDirection}
      LIMIT ${limitNum} OFFSET ${offset}
    `, params);

    res.json({
      data: rows,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) }
    });
  } catch (error: any) {
    console.error('Error fetching prospects:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── GET /stats ──
router.get('/stats', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const tempStats = await dbAll(`
      SELECT temperature, COUNT(*) as count FROM prospects WHERE status NOT IN ('converted','disqualified') AND is_archived = 0 GROUP BY temperature
    `);
    const statusStats = await dbAll(`SELECT status, COUNT(*) as count FROM prospects WHERE is_archived = 0 GROUP BY status`);
    const summary = await dbGet(`
      SELECT SUM(estimated_value) as total_value, COUNT(*) as total_count,
        SUM(CASE WHEN status NOT IN ('converted','disqualified') THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted_count,
        SUM(CASE WHEN next_follow_up <= CURDATE() AND status NOT IN ('converted','disqualified') THEN 1 ELSE 0 END) as overdue_followups
      FROM prospects WHERE is_archived = 0
    `);
    res.json({ temperature: tempStats, status: statusStats, summary: summary || {} });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /:id ──
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const row = await dbGet(`
      SELECT p.*, u.full_name as assigned_to_name, cb.full_name as created_by_name
      FROM prospects p LEFT JOIN users u ON p.assigned_to = u.id LEFT JOIN users cb ON p.created_by = cb.id
      WHERE p.id = ?
    `, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Prospect not found' });
    res.json({ data: row });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST / — Create with duplicate detection ──
router.post('/', authMiddleware, requirePermission('crm.prospects', 'create'), async (req: Request, res: Response) => {
  try {
    const { company_name, contact_name, contact_title, email, phone, industry, website, address, city, country,
      source, temperature, interest, estimated_value, next_follow_up, assigned_to, notes } = req.body;

    if (!company_name) return res.status(400).json({ error: 'Company name is required' });

    // Duplicate detection (warning, not blocking)
    const duplicates = await checkDuplicate(company_name, email);

    const userId = (req as any).user?.userId || null;
    const code = await generateProspectCode();

    const result = await dbRun(`
      INSERT INTO prospects (code, company_name, contact_name, contact_title, email, phone, industry, website,
        address, city, country, source, temperature, status, interest, estimated_value, next_follow_up, assigned_to, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?)
    `, [code, company_name, contact_name||null, contact_title||null, email||null, phone||null,
        industry||null, website||null, address||null, city||null, country||'Indonesia',
        source||'other', temperature||'cold', interest||null,
        estimated_value||0, next_follow_up||null, assigned_to||null, notes||null, userId]);

    await logProspectActivity(result.insertId, userId, 'created', `Prospect ${code} created: ${company_name}`);

    res.status(201).json({
      data: { id: result.insertId, code },
      message: 'Prospect created',
      warnings: duplicates.length > 0 ? { duplicates, message: `Potential duplicate(s) found: ${duplicates.map(d => d.company_name).join(', ')}` } : undefined
    });
  } catch (error: any) {
    console.error('Error creating prospect:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── PUT /:id — Update with state machine validation ──
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { company_name, contact_name, contact_title, email, phone, industry, website, address, city, country,
      source, temperature, status, interest, estimated_value, next_follow_up, assigned_to, notes } = req.body;

    const current = await dbGet('SELECT * FROM prospects WHERE id = ?', [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Prospect not found' });

    // Ownership check: non-admin can only edit own prospects
    const user = (req as any).user;
    if (user.roleId !== 1 && current.assigned_to !== user.userId && current.created_by !== user.userId) {
      return res.status(403).json({ error: 'You can only edit your own prospects' });
    }

    // State machine validation if status is changing
    if (status && status !== current.status) {
      const transition = validateProspectTransition(current.status, status);
      if (!transition.valid) {
        return res.status(400).json({ error: transition.error });
      }
    }

    const userId = user?.userId || null;

    await dbRun(`
      UPDATE prospects SET company_name=?, contact_name=?, contact_title=?, email=?, phone=?,
        industry=?, website=?, address=?, city=?, country=?, source=?, temperature=?, status=?,
        interest=?, estimated_value=?, next_follow_up=?, assigned_to=?, notes=?
      WHERE id = ?
    `, [
      company_name ?? current.company_name,
      contact_name ?? current.contact_name,
      contact_title ?? current.contact_title,
      email ?? current.email,
      phone ?? current.phone,
      industry ?? current.industry,
      website ?? current.website,
      address ?? current.address,
      city ?? current.city,
      country ?? current.country ?? 'Indonesia',
      source ?? current.source ?? 'other',
      temperature ?? current.temperature ?? 'cold',
      status ?? current.status ?? 'new',
      interest ?? current.interest,
      estimated_value ?? current.estimated_value ?? 0,
      next_follow_up || current.next_follow_up || null,
      assigned_to ?? current.assigned_to,
      notes ?? current.notes,
      req.params.id
    ]);

    // Log assignment changes
    if (assigned_to && assigned_to !== current.assigned_to) {
      await logProspectActivity(req.params.id as string, userId, 'assigned', `Assigned to user #${assigned_to}`);
    }
    if (status && status !== current.status) {
      await logProspectActivity(req.params.id as string, userId, 'status_changed', `Status: ${current.status} → ${status}`);
    }

    res.json({ message: 'Prospect updated' });
  } catch (error: any) {
    console.error('Error updating prospect:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── DELETE /:id — Soft delete (archive) ──
router.delete('/:id', authMiddleware, requirePermission('crm.prospects', 'delete'), async (req: Request, res: Response) => {
  try {
    const prospect = await dbGet('SELECT * FROM prospects WHERE id = ?', [req.params.id]);
    if (!prospect) return res.status(404).json({ error: 'Prospect not found' });

    // Converted prospects cannot be deleted
    if (prospect.status === 'converted') {
      return res.status(400).json({ error: 'Cannot delete a converted prospect. It is part of the conversion history.' });
    }

    // Soft delete: archive instead of hard delete
    await dbRun('UPDATE prospects SET is_archived = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);

    const userId = (req as any).user?.userId || null;
    await logProspectActivity(req.params.id as string, userId, 'archived', `Prospect archived`);

    res.json({ message: 'Prospect archived' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /:id/convert-to-lead — Atomic conversion with history preservation ──
router.post('/:id/convert-to-lead', authMiddleware, requirePermission('crm.prospects', 'convert'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || null;

    const result = await dbTransaction(async (conn) => {
      // 1. Lock and validate prospect
      const [prospectRows] = await conn.execute(
        'SELECT * FROM prospects WHERE id = ? FOR UPDATE', [req.params.id]
      );
      const prospect = prospectRows[0];
      if (!prospect) throw new Error('Prospect not found');
      if (prospect.status === 'converted') throw new Error('Prospect already converted');
      if (prospect.is_archived) throw new Error('Cannot convert an archived prospect');

      // 2. Validate prospect is qualified for conversion
      if (!['qualified', 'contacted', 'new'].includes(prospect.status)) {
        throw new Error(`Cannot convert prospect with status '${prospect.status}'. Must be new, contacted, or qualified.`);
      }

      // 3. Create Lead from prospect data
      const [leadResult] = await conn.execute(`
        INSERT INTO leads (company, contact_name, email, phone, stage, value, probability, source, notes, assigned_to, created_by)
        VALUES (?, ?, ?, ?, 'New', ?, 20, ?, ?, ?, ?)
      `, [
        prospect.company_name,
        prospect.contact_name || null,
        prospect.email || null,
        prospect.phone || null,
        prospect.estimated_value || 0,
        prospect.source || null,
        prospect.notes || null,
        prospect.assigned_to || userId,
        userId
      ]);
      const leadId = (leadResult as any).insertId;

      // 4. Update prospect status to 'converted' — DO NOT DELETE
      await conn.execute(
        `UPDATE prospects SET status = 'converted', converted_to_lead_id = ?, converted_at = NOW(), updated_at = NOW() WHERE id = ?`,
        [leadId, req.params.id]
      );

      return { leadId, company: prospect.company_name, contact_name: prospect.contact_name, email: prospect.email };
    });

    await logProspectActivity(req.params.id as string, userId, 'converted', `Converted to Lead #${result.leadId}`);

    res.json({
      message: 'Prospect converted to Lead successfully',
      data: {
        lead_id: result.leadId,
        company: result.company,
        contact_name: result.contact_name,
        email: result.email,
      }
    });
  } catch (error: any) {
    console.error('Error converting prospect to lead:', error);
    const msg = error.message || 'Failed to convert prospect';
    const status = msg.includes('already converted') || msg.includes('Cannot convert') ? 400 : 500;
    res.status(status).json({ error: msg });
  }
});

export default router;
