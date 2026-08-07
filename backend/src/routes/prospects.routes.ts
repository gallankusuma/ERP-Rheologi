import express, { Request, Response } from 'express';
import { dbGet, dbAll, dbRun, dbTransaction } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { requirePermission, checkUserPermission } from '../middleware/permission';

const router = express.Router();

// prospect status flow:
// new -> contacted -> qualified -> (convert endpoint) -> converted
// any active status -> disqualified
// disqualified -> new (reactivate)
const PROSPECT_TRANSITIONS: Record<string, string[]> = {
  'new':          ['contacted', 'disqualified'],
  'contacted':    ['qualified', 'disqualified'],
  'qualified':    ['converted', 'disqualified'],
  'converted':    [],
  'disqualified': ['new'],
};

// these statuses can only be set by specific endpoints, not by generic PUT
const RESERVED_STATUSES = ['converted'];

function validateProspectTransition(currentStatus: string, targetStatus: string): { valid: boolean; error?: string } {
  const allowedTargets = PROSPECT_TRANSITIONS[currentStatus];

  if (!allowedTargets) {
    return {
      valid: false,
      error: `Unknown prospect status '${currentStatus}'`
    };
  }

  if (!allowedTargets.includes(targetStatus)) {
    return {
      valid: false,
      error: `Cannot transition prospect from '${currentStatus}' to '${targetStatus}'. Allowed transitions: [${allowedTargets.join(', ')}]`
    };
  }

  return { valid: true };
}


/**
 * Insert a record into prospect_activities for audit trail.
 * Silently catches errors so it doesn't break the main flow.
 */
const logProspectActivity = async (
  prospectId: number | string,
  userId: number | null,
  action: string,
  details: string
) => {
  try {
    await dbRun(
      'INSERT INTO prospect_activities (prospect_id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [prospectId, userId, action, details]
    );
  } catch (err) {
    console.warn('prospect activity log failed:', err);
  }
};


/**
 * Check for existing prospects with same company name or email.
 * Returns array of potential duplicates with match_type indicator.
 * This is used as a warning, not a blocker.
 */
const checkDuplicate = async (
  companyName: string,
  email?: string | null,
  excludeId?: number
): Promise<any[]> => {
  const duplicates: any[] = [];

  // check by company name first
  if (companyName) {
    let companyQuery = `SELECT id, code, company_name, email, status
      FROM prospects
      WHERE company_name = ? AND is_archived = 0`;
    const companyParams: any[] = [companyName];

    if (excludeId) {
      companyQuery += ' AND id != ?';
      companyParams.push(excludeId);
    }

    const byCompany = await dbAll(companyQuery, companyParams);
    for (const row of byCompany as any[]) {
      duplicates.push({ ...row, match_type: 'company_name' });
    }
  }

  // then check by email
  if (email) {
    let emailQuery = `SELECT id, code, company_name, email, status
      FROM prospects
      WHERE email = ? AND is_archived = 0`;
    const emailParams: any[] = [email];

    if (excludeId) {
      emailQuery += ' AND id != ?';
      emailParams.push(excludeId);
    }

    const byEmail = await dbAll(emailQuery, emailParams);
    for (const row of byEmail as any[]) {
      // avoid adding the same prospect twice if it matched both company and email
      const alreadyAdded = duplicates.some(d => d.id === row.id);
      if (!alreadyAdded) {
        duplicates.push({ ...row, match_type: 'email' });
      }
    }
  }

  return duplicates;
};


/**
 * Generate PSP-XXXX code inside a transaction.
 * Uses FOR UPDATE lock to prevent race conditions on concurrent inserts.
 * Will retry up to 3 times if there's a collision (shouldn't happen normally).
 */
const generateProspectCodeTx = async (conn: any): Promise<string> => {
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // lock the latest prospect row to prevent concurrent code generation
    const [rows] = await conn.execute(
      `SELECT code FROM prospects WHERE code LIKE 'PSP-%' ORDER BY id DESC LIMIT 1 FOR UPDATE`
    );

    let nextNumber = 1;
    if (rows[0]) {
      const currentCode = rows[0].code;
      const numericPart = parseInt(currentCode.replace('PSP-', ''), 10);
      nextNumber = numericPart + 1;
    }

    const generatedCode = `PSP-${String(nextNumber).padStart(4, '0')}`;

    // double check uniqueness before returning
    const [existing] = await conn.execute(
      'SELECT id FROM prospects WHERE code = ?',
      [generatedCode]
    );

    if (existing.length === 0) {
      return generatedCode;
    }

    // collision detected, try next number
    console.warn(`Prospect code collision on ${generatedCode}, retrying (attempt ${attempt + 1})`);
  }

  // fallback: use timestamp to guarantee uniqueness
  return `PSP-${Date.now()}`;
};


// GET / - list prospects with filtering, pagination, and ownership
router.get('/', authMiddleware, requirePermission('crm.prospects', 'view'), async (req: Request, res: Response) => {
  try {
    const {
      search,
      temperature,
      status,
      source,
      assigned_to,
      sort_by = 'created_at',
      sort_dir = 'DESC',
      page = '1',
      limit = '25',
      show_archived
    } = req.query;

    const user = (req as any).user;
    let whereClause = 'p.is_archived = 0';
    const queryParams: any[] = [];

    // optionally include archived records
    if (show_archived === '1' || show_archived === 'true') {
      whereClause = '1=1';
    }

    // users without manage permission can only see their own prospects
    const canManageAll = await checkUserPermission(user.userId, 'crm.prospects', 'manage');
    if (!canManageAll) {
      whereClause += ` AND (p.assigned_to = ? OR p.assigned_to IS NULL OR p.created_by = ?)`;
      queryParams.push(user.userId, user.userId);
    }

    // text search across multiple fields
    if (search) {
      whereClause += ` AND (p.company_name LIKE ? OR p.contact_name LIKE ? OR p.email LIKE ? OR p.code LIKE ?)`;
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // filter by specific fields
    if (temperature) {
      whereClause += ` AND p.temperature = ?`;
      queryParams.push(temperature);
    }
    if (status) {
      whereClause += ` AND p.status = ?`;
      queryParams.push(status);
    }
    if (source) {
      whereClause += ` AND p.source = ?`;
      queryParams.push(source);
    }
    if (assigned_to) {
      whereClause += ` AND p.assigned_to = ?`;
      queryParams.push(assigned_to);
    }

    // get total count for pagination
    const countRow = await dbGet(
      `SELECT COUNT(*) as total FROM prospects p WHERE ${whereClause}`,
      queryParams
    );
    const totalRecords = countRow?.total || 0;

    // validate sort column to prevent SQL injection
    const allowedSortColumns = [
      'created_at', 'updated_at', 'company_name',
      'temperature', 'status', 'estimated_value', 'next_follow_up'
    ];
    const sortColumn = allowedSortColumns.includes(sort_by as string) ? sort_by : 'created_at';
    const sortDirection = (sort_dir as string).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // calculate pagination
    const pageNumber = Math.max(1, parseInt(page as string, 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const offset = (pageNumber - 1) * pageSize;

    const prospects = await dbAll(`
      SELECT p.*,
        u.full_name as assigned_to_name,
        cb.full_name as created_by_name
      FROM prospects p
      LEFT JOIN users u ON p.assigned_to = u.id
      LEFT JOIN users cb ON p.created_by = cb.id
      WHERE ${whereClause}
      ORDER BY p.${sortColumn} ${sortDirection}
      LIMIT ${pageSize} OFFSET ${offset}
    `, queryParams);

    res.json({
      data: prospects,
      pagination: {
        total: totalRecords,
        page: pageNumber,
        limit: pageSize,
        totalPages: Math.ceil(totalRecords / pageSize)
      }
    });
  } catch (error: any) {
    console.error('Error fetching prospects:', error);
    res.status(500).json({ error: error.message });
  }
});


// GET /stats - dashboard statistics for prospects
router.get('/stats', authMiddleware, requirePermission('crm.prospects', 'view'), async (_req: Request, res: Response) => {
  try {
    // temperature breakdown (only active prospects)
    const temperatureStats = await dbAll(`
      SELECT temperature, COUNT(*) as count
      FROM prospects
      WHERE status NOT IN ('converted','disqualified') AND is_archived = 0
      GROUP BY temperature
    `);

    // status breakdown
    const statusStats = await dbAll(`
      SELECT status, COUNT(*) as count
      FROM prospects
      WHERE is_archived = 0
      GROUP BY status
    `);

    // summary numbers
    const summary = await dbGet(`
      SELECT
        SUM(estimated_value) as total_value,
        COUNT(*) as total_count,
        SUM(CASE WHEN status NOT IN ('converted','disqualified') THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted_count,
        SUM(CASE WHEN next_follow_up <= CURDATE() AND status NOT IN ('converted','disqualified') THEN 1 ELSE 0 END) as overdue_followups
      FROM prospects
      WHERE is_archived = 0
    `);

    res.json({
      temperature: temperatureStats,
      status: statusStats,
      summary: summary || {}
    });
  } catch (error: any) {
    console.error('Error fetching prospect stats:', error);
    res.status(500).json({ error: error.message });
  }
});


// GET /activities/:prospectId - activity log for a specific prospect
router.get('/activities/:prospectId', authMiddleware, requirePermission('crm.prospects', 'view'), async (req: Request, res: Response) => {
  try {
    const prospectId = req.params.prospectId;

    const activities = await dbAll(`
      SELECT pa.*, u.full_name as user_name
      FROM prospect_activities pa
      LEFT JOIN users u ON pa.user_id = u.id
      WHERE pa.prospect_id = ?
      ORDER BY pa.created_at DESC
      LIMIT 50
    `, [prospectId]);

    res.json({ data: activities });
  } catch (error: any) {
    console.error('Error fetching prospect activities:', error);
    res.status(500).json({ error: error.message });
  }
});


// GET /:id - get single prospect detail
router.get('/:id', authMiddleware, requirePermission('crm.prospects', 'view'), async (req: Request, res: Response) => {
  try {
    const prospect = await dbGet(`
      SELECT p.*,
        u.full_name as assigned_to_name,
        cb.full_name as created_by_name
      FROM prospects p
      LEFT JOIN users u ON p.assigned_to = u.id
      LEFT JOIN users cb ON p.created_by = cb.id
      WHERE p.id = ?
    `, [req.params.id]);

    if (!prospect) {
      return res.status(404).json({ error: 'Prospect not found' });
    }

    res.json({ data: prospect });
  } catch (error: any) {
    console.error('Error fetching prospect detail:', error);
    res.status(500).json({ error: error.message });
  }
});


// POST / - create a new prospect
router.post('/', authMiddleware, requirePermission('crm.prospects', 'create'), async (req: Request, res: Response) => {
  try {
    const {
      company_name, contact_name, contact_title, email, phone,
      industry, website, address, city, country,
      source, temperature, interest, estimated_value, currency,
      next_follow_up, assigned_to, notes
    } = req.body;

    // company name is the only required field
    if (!company_name) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    // check for potential duplicates (just a warning, doesn't block creation)
    const duplicates = await checkDuplicate(company_name, email);

    const userId = (req as any).user?.userId || null;

    // use transaction for code generation to prevent race conditions
    const result = await dbTransaction(async (conn) => {
      const code = await generateProspectCodeTx(conn);

      const [insertResult] = await conn.execute(`
        INSERT INTO prospects (
          code, company_name, contact_name, contact_title, email, phone,
          industry, website, address, city, country,
          source, temperature, status, interest, estimated_value, currency,
          next_follow_up, assigned_to, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?)
      `, [
        code,
        company_name,
        contact_name || null,
        contact_title || null,
        email || null,
        phone || null,
        industry || null,
        website || null,
        address || null,
        city || null,
        country || 'Indonesia',
        source || 'other',
        temperature || 'cold',
        interest || null,
        estimated_value || 0,
        currency || 'IDR',
        next_follow_up || null,
        assigned_to || null,
        notes || null,
        userId
      ]);

      return { id: (insertResult as any).insertId, code };
    });

    // log the creation
    await logProspectActivity(
      result.id, userId, 'created',
      `Prospect ${result.code} created: ${company_name}`
    );

    const response: any = {
      data: { id: result.id, code: result.code },
      message: 'Prospect created'
    };

    // include duplicate warning if any were found
    if (duplicates.length > 0) {
      response.warnings = {
        duplicates,
        message: `Potential duplicate(s) found: ${duplicates.map(d => d.company_name).join(', ')}`
      };
    }

    res.status(201).json(response);
  } catch (error: any) {
    console.error('Error creating prospect:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Prospect code collision. Please retry.' });
    }

    res.status(500).json({ error: error.message });
  }
});


// PUT /:id - update prospect details
router.put('/:id', authMiddleware, requirePermission('crm.prospects', 'update'), async (req: Request, res: Response) => {
  try {
    const {
      company_name, contact_name, contact_title, email, phone,
      industry, website, address, city, country,
      source, temperature, status, interest, estimated_value, currency,
      next_follow_up, assigned_to, notes
    } = req.body;

    // fetch current state
    const current = await dbGet('SELECT * FROM prospects WHERE id = ?', [req.params.id]);
    if (!current) {
      return res.status(404).json({ error: 'Prospect not found' });
    }

    // only users with manage permission or the assigned/creator user can edit
    const user = (req as any).user;
    const canManageAll = await checkUserPermission(user.userId, 'crm.prospects', 'manage');
    if (
      !canManageAll &&
      current.assigned_to !== user.userId &&
      current.created_by !== user.userId
    ) {
      return res.status(403).json({ error: 'You can only edit your own prospects' });
    }

    // validate status change if provided
    if (status && status !== current.status) {
      // 'converted' can only be set by the convert endpoint
      if (RESERVED_STATUSES.includes(status)) {
        return res.status(400).json({
          error: `Status '${status}' can only be set via the conversion endpoint, not direct update.`
        });
      }

      const transitionCheck = validateProspectTransition(current.status, status);
      if (!transitionCheck.valid) {
        return res.status(400).json({ error: transitionCheck.error });
      }
    }

    const userId = user?.userId || null;

    // update with fallback to current values for unset fields
    await dbRun(`
      UPDATE prospects SET
        company_name = ?,
        contact_name = ?,
        contact_title = ?,
        email = ?,
        phone = ?,
        industry = ?,
        website = ?,
        address = ?,
        city = ?,
        country = ?,
        source = ?,
        temperature = ?,
        status = ?,
        interest = ?,
        estimated_value = ?,
        currency = ?,
        next_follow_up = ?,
        assigned_to = ?,
        notes = ?
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
      currency ?? current.currency ?? 'IDR',
      next_follow_up || current.next_follow_up || null,
      assigned_to ?? current.assigned_to,
      notes ?? current.notes,
      req.params.id
    ]);

    // log assignment changes
    if (assigned_to && assigned_to !== current.assigned_to) {
      await logProspectActivity(
        req.params.id as string, userId, 'assigned',
        `Assigned to user #${assigned_to}`
      );
    }

    // log status changes
    if (status && status !== current.status) {
      await logProspectActivity(
        req.params.id as string, userId, 'status_changed',
        `Status: ${current.status} -> ${status}`
      );
    }

    res.json({ message: 'Prospect updated' });
  } catch (error: any) {
    console.error('Error updating prospect:', error);
    res.status(500).json({ error: error.message });
  }
});


// DELETE /:id - archive prospect (soft delete)
router.delete('/:id', authMiddleware, requirePermission('crm.prospects', 'delete'), async (req: Request, res: Response) => {
  try {
    const prospect = await dbGet('SELECT * FROM prospects WHERE id = ?', [req.params.id]);
    if (!prospect) {
      return res.status(404).json({ error: 'Prospect not found' });
    }

    // don't allow deleting converted prospects - they're part of the conversion history
    if (prospect.status === 'converted') {
      return res.status(400).json({
        error: 'Cannot delete a converted prospect. It is part of the conversion history.'
      });
    }

    // soft delete by setting is_archived flag
    await dbRun(
      'UPDATE prospects SET is_archived = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [req.params.id]
    );

    const userId = (req as any).user?.userId || null;
    await logProspectActivity(req.params.id as string, userId, 'archived', 'Prospect archived');

    res.json({ message: 'Prospect archived' });
  } catch (error: any) {
    console.error('Error archiving prospect:', error);
    res.status(500).json({ error: error.message });
  }
});


// PATCH /:id/restore - restore an archived prospect
router.patch('/:id/restore', authMiddleware, requirePermission('crm.prospects', 'update'), async (req: Request, res: Response) => {
  try {
    const prospect = await dbGet(
      'SELECT * FROM prospects WHERE id = ? AND is_archived = 1',
      [req.params.id]
    );

    if (!prospect) {
      return res.status(404).json({ error: 'Archived prospect not found' });
    }

    await dbRun(
      'UPDATE prospects SET is_archived = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [req.params.id]
    );

    const userId = (req as any).user?.userId || null;
    await logProspectActivity(
      req.params.id as string, userId, 'restored',
      'Prospect restored from archive'
    );

    res.json({ message: 'Prospect restored' });
  } catch (error: any) {
    console.error('Error restoring prospect:', error);
    res.status(500).json({ error: error.message });
  }
});


// POST /:id/convert-to-lead - convert a qualified prospect into a lead
router.post('/:id/convert-to-lead', authMiddleware, requirePermission('crm.prospects', 'convert'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || null;

    const result = await dbTransaction(async (conn) => {
      // lock the prospect row to prevent concurrent conversion attempts
      const [prospectRows] = await conn.execute(
        'SELECT * FROM prospects WHERE id = ? FOR UPDATE',
        [req.params.id]
      );
      const prospect = prospectRows[0];

      if (!prospect) {
        throw new Error('Prospect not found');
      }

      if (prospect.status === 'converted') {
        throw new Error('Prospect already converted');
      }

      if (prospect.is_archived) {
        throw new Error('Cannot convert an archived prospect');
      }

      // only qualified prospects can be converted to leads
      if (prospect.status !== 'qualified') {
        throw new Error(
          `Cannot convert prospect with status '${prospect.status}'. Prospect must be 'qualified' first.`
        );
      }

      // create the lead record
      // carries every Prospect qualification/contact field forward so nothing is lost on conversion
      // (Review.md P1 #6), including currency (Review.md P0-2)
      const [leadResult] = await conn.execute(`
        INSERT INTO leads (
          company, contact_name, email, phone, stage,
          value, currency, probability, source, notes, assigned_to, created_by,
          contact_title, industry, website, address, city, country,
          temperature, interest, next_follow_up
        ) VALUES (?, ?, ?, ?, 'New', ?, ?, 20, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        prospect.company_name,
        prospect.contact_name || null,
        prospect.email || null,
        prospect.phone || null,
        prospect.estimated_value || 0,
        prospect.currency || 'IDR',
        prospect.source || null,
        prospect.notes || null,
        prospect.assigned_to || userId,
        userId,
        prospect.contact_title || null,
        prospect.industry || null,
        prospect.website || null,
        prospect.address || null,
        prospect.city || null,
        prospect.country || null,
        prospect.temperature || null,
        prospect.interest || null,
        prospect.next_follow_up || null
      ]);

      const newLeadId = (leadResult as any).insertId;

      // mark prospect as converted (we keep the record, never delete it)
      await conn.execute(
        `UPDATE prospects
         SET status = 'converted',
             converted_to_lead_id = ?,
             converted_at = NOW(),
             updated_at = NOW()
         WHERE id = ?`,
        [newLeadId, req.params.id]
      );

      return {
        leadId: newLeadId,
        company: prospect.company_name,
        contact_name: prospect.contact_name,
        email: prospect.email
      };
    });

    await logProspectActivity(
      req.params.id as string, userId, 'converted',
      `Converted to Lead #${result.leadId}`
    );

    res.json({
      message: 'Prospect converted to Lead successfully',
      data: {
        lead_id: result.leadId,
        company: result.company,
        contact_name: result.contact_name,
        email: result.email
      }
    });
  } catch (error: any) {
    console.error('Error converting prospect to lead:', error);

    const msg = error.message || 'Failed to convert prospect';
    const statusCode = (
      msg.includes('already converted') ||
      msg.includes('Cannot convert') ||
      msg.includes('must be')
    ) ? 400 : 500;

    res.status(statusCode).json({ error: msg });
  }
});

export default router;
