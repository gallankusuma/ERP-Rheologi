import { Router, Request, Response } from 'express';
import { dbAll, dbGet, dbRun, dbTransaction } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// lead stage transition rules
const LEAD_TRANSITIONS: Record<string, string[]> = {
  'New':          ['Qualified', 'Lost'],
  'Qualified':    ['Discussion', 'Lost'],
  'Discussion':   ['Negotiation', 'Lost', 'Qualified'],
  'Negotiation':  ['Won', 'Lost', 'Discussion'],
  'Won':          [],
  'Lost':         ['New'],
};

function validateLeadTransition(current: string, next: string): { valid: boolean; error?: string } {
  const allowed = LEAD_TRANSITIONS[current];
  if (!allowed) return { valid: false, error: `Unknown lead stage '${current}'` };
  if (!allowed.includes(next)) {
    return { valid: false, error: `Cannot transition lead from '${current}' to '${next}'. Allowed: [${allowed.join(', ')}]` };
  }
  return { valid: true };
}

// allowed file types for attachments
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
];
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv'];

const router = Router();

// file upload config
const uploadDir = path.join(__dirname, '../../uploads/lead_attachments');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype) || !ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error(`File type not allowed: ${file.mimetype} (${ext}). Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`));
    }
    cb(null, true);
  }
});

// log lead activity
const logActivity = async (leadId: number | string, userId: number | null, action: string, details: string) => {
  try {
    await dbRun('INSERT INTO lead_activities (lead_id, user_id, action, details) VALUES (?,?,?,?)',
      [leadId, userId, action, details]);
  } catch (e) { console.warn('Activity log error:', e); }
};

// ensure lead_stages table exists
const ensureLeadStagesTable = async () => {
  try {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS lead_stages (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        color VARCHAR(50) DEFAULT '#6b7280',
        sort_order INT DEFAULT 0,
        is_default TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    // Seed defaults if empty
    const count = await dbGet('SELECT COUNT(*) as cnt FROM lead_stages');
    if (!count || count.cnt === 0) {
      const defaults = [
        { name: 'New', color: '#6b7280', order: 0 },
        { name: 'Qualified', color: '#3b82f6', order: 1 },
        { name: 'Discussion', color: '#06b6d4', order: 2 },
        { name: 'Negotiation', color: '#8b5cf6', order: 3 },
        { name: 'Won', color: '#22c55e', order: 4 },
        { name: 'Lost', color: '#ef4444', order: 5 },
      ];
      for (const s of defaults) {
        await dbRun('INSERT INTO lead_stages (name, color, sort_order, is_default) VALUES (?,?,?,1)',
          [s.name, s.color, s.order]);
      }
    console.log('Lead stages seeded');
    }
  } catch (e) { console.error('Lead stages table error:', e); }
};
ensureLeadStagesTable();

// lead stages CRUD

// GET /leads/stages — List all stages ordered
router.get('/stages', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const stages = await dbAll('SELECT * FROM lead_stages ORDER BY sort_order ASC, id ASC');
    res.json({ success: true, data: stages });
  } catch (error) {
    console.error('Stages list error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stages' });
  }
});

// POST /leads/stages — Create a new stage
router.post('/stages', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, color } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Stage name is required' });
    // Get max sort_order
    const max = await dbGet('SELECT MAX(sort_order) as mx FROM lead_stages');
    const nextOrder = (max?.mx ?? -1) + 1;
    const result = await dbRun(
      'INSERT INTO lead_stages (name, color, sort_order) VALUES (?,?,?)',
      [name.trim(), color || '#6b7280', nextOrder]
    );
    res.status(201).json({ success: true, data: { id: result.insertId, name: name.trim(), color: color || '#6b7280', sort_order: nextOrder } });
  } catch (error) {
    console.error('Create stage error:', error);
    res.status(500).json({ success: false, error: 'Failed to create stage' });
  }
});

// PUT /leads/stages/reorder — Reorder stages (must be before /:id)
router.put('/stages/reorder', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { order } = req.body; // array of { id, sort_order }
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order array is required' });
    for (const item of order) {
      await dbRun('UPDATE lead_stages SET sort_order = ? WHERE id = ?', [item.sort_order, item.id]);
    }
    res.json({ success: true, message: 'Stages reordered' });
  } catch (error) {
    console.error('Reorder stages error:', error);
    res.status(500).json({ success: false, error: 'Failed to reorder stages' });
  }
});

// PUT /leads/stages/:id — Update a stage (system stages: color only)
router.put('/stages/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, color } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Stage name is required' });
    const old = await dbGet('SELECT * FROM lead_stages WHERE id = ?', [req.params.id]);
    if (!old) return res.status(404).json({ error: 'Stage not found' });
    
    // System stages cannot be renamed (transition map uses fixed keys)
    if (old.is_system && old.name !== name.trim()) {
      return res.status(400).json({ error: `System stage '${old.name}' cannot be renamed. Only color can be changed.` });
    }
    
    await dbRun('UPDATE lead_stages SET name = ?, color = ? WHERE id = ?',
      [name.trim(), color || '#6b7280', req.params.id]);
    if (old && old.name !== name.trim()) {
      await dbRun('UPDATE leads SET stage = ? WHERE stage = ?', [name.trim(), old.name]);
    }
    res.json({ success: true, message: 'Stage updated' });
  } catch (error) {
    console.error('Update stage error:', error);
    res.status(500).json({ success: false, error: 'Failed to update stage' });
  }
});

// DELETE /leads/stages/:id — Delete a stage (system stages protected)
router.delete('/stages/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const stage = await dbGet('SELECT * FROM lead_stages WHERE id = ?', [req.params.id]) as any;
    if (!stage) return res.status(404).json({ error: 'Stage not found' });
    
    // System stages cannot be deleted
    if (stage.is_system) {
      return res.status(400).json({ error: `System stage '${stage.name}' cannot be deleted.` });
    }
    
    const fallback = await dbGet('SELECT name FROM lead_stages WHERE id != ? ORDER BY sort_order ASC LIMIT 1', [req.params.id]);
    if (fallback) {
      await dbRun('UPDATE leads SET stage = ? WHERE stage = ?', [fallback.name, stage.name]);
    }
    await dbRun('DELETE FROM lead_stages WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Stage deleted' });
  } catch (error) {
    console.error('Delete stage error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete stage' });
  }
});

// lead CRUD endpoints

// GET /leads — List all leads (with label info)
router.get('/', authMiddleware, requirePermission('crm.leads', 'view'), async (req: Request, res: Response) => {
  try {
    const { stage, search, show_archived } = req.query;
    let query = `SELECT l.*, u.full_name as assigned_name, c.name as client_name, c.organization as client_org
      FROM leads l
      LEFT JOIN users u ON l.assigned_to = u.id
      LEFT JOIN clients c ON l.client_id = c.id
      WHERE l.is_archived = 0`;
    
    if (show_archived === '1' || show_archived === 'true') {
      query = query.replace('WHERE l.is_archived = 0', 'WHERE 1=1');
    }
    const params: any[] = [];

    if (stage && stage !== 'all') {
      query += ' AND l.stage = ?';
      params.push(stage);
    }
    if (search) {
      query += ' AND (l.company LIKE ? OR l.contact_name LIKE ? OR l.email LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    query += ' ORDER BY l.updated_at DESC';

    const data = await dbAll(query, params) as any[];

    // Batch-load labels for all leads
    if (data.length > 0) {
      const leadIds = data.map((l: any) => l.id);
      const placeholders = leadIds.map(() => '?').join(',');
      const labelRows = await dbAll(`
        SELECT la.lead_id, ll.id, ll.name, ll.color
        FROM lead_label_assignments la
        JOIN lead_labels ll ON la.label_id = ll.id
        WHERE la.lead_id IN (${placeholders})
      `, leadIds) as any[];

      // Batch-load checklist counts
      const checkCounts = await dbAll(`
        SELECT lc.lead_id,
          COUNT(DISTINCT lci.id) as total_items,
          SUM(CASE WHEN lci.is_checked = 1 THEN 1 ELSE 0 END) as checked_items
        FROM lead_checklists lc
        LEFT JOIN lead_checklist_items lci ON lci.checklist_id = lc.id
        WHERE lc.lead_id IN (${placeholders})
        GROUP BY lc.lead_id
      `, leadIds) as any[];

      // Batch-load comment counts
      const commentCounts = await dbAll(`
        SELECT lead_id, COUNT(*) as count FROM lead_comments WHERE lead_id IN (${placeholders}) GROUP BY lead_id
      `, leadIds) as any[];

      // Batch-load attachment counts
      const attachCounts = await dbAll(`
        SELECT lead_id, COUNT(*) as count FROM lead_attachments WHERE lead_id IN (${placeholders}) GROUP BY lead_id
      `, leadIds) as any[];

      const labelMap: Record<number, any[]> = {};
      for (const r of labelRows) {
        if (!labelMap[r.lead_id]) labelMap[r.lead_id] = [];
        labelMap[r.lead_id].push({ id: r.id, name: r.name, color: r.color });
      }
      const checkMap: Record<number, any> = {};
      for (const r of checkCounts) checkMap[r.lead_id] = { total: r.total_items || 0, checked: r.checked_items || 0 };
      const commentMap: Record<number, number> = {};
      for (const r of commentCounts) commentMap[r.lead_id] = r.count;
      const attachMap: Record<number, number> = {};
      for (const r of attachCounts) attachMap[r.lead_id] = r.count;

      for (const lead of data) {
        (lead as any).labels = labelMap[lead.id] || [];
        (lead as any).checklist_progress = checkMap[lead.id] || { total: 0, checked: 0 };
        (lead as any).comment_count = commentMap[lead.id] || 0;
        (lead as any).attachment_count = attachMap[lead.id] || 0;
      }
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Leads list error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch leads' });
  }
});

// GET /leads/stats/summary — Pipeline stats (must be before /:id)
router.get('/stats/summary', authMiddleware, requirePermission('crm.leads', 'view'), async (req: Request, res: Response) => {
  try {
    const stages = await dbAll(
      'SELECT stage, COUNT(*) as count, COALESCE(SUM(value),0) as total_value FROM leads WHERE is_archived = 0 GROUP BY stage'
    );
    res.json({ success: true, data: stages });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

// GET /leads/labels — List all available labels
router.get('/labels', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const labels = await dbAll('SELECT * FROM lead_labels ORDER BY name');
    res.json(labels);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch labels' });
  }
});

// POST /leads/labels — Create new label
router.post('/labels', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const result = await dbRun('INSERT INTO lead_labels (name, color) VALUES (?,?)', [name, color || '#3b82f6']);
    res.status(201).json({ id: result.insertId, name, color });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create label' });
  }
});

// DELETE /leads/labels/:labelId
router.delete('/labels/:labelId', authMiddleware, async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM lead_labels WHERE id = ?', [req.params.labelId]);
    res.json({ message: 'Label deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete label' });
  }
});

// GET /leads/:id — Get single lead with full detail
router.get('/:id', authMiddleware, requirePermission('crm.leads', 'view'), async (req: Request, res: Response) => {
  try {
    const lead = await dbGet(
      `SELECT l.*, u.full_name as assigned_name, c.name as client_name, c.organization as client_org
       FROM leads l LEFT JOIN users u ON l.assigned_to = u.id LEFT JOIN clients c ON l.client_id = c.id WHERE l.id = ?`,
      [req.params.id]
    ) as any;
    if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });

    // Labels
    const labels = await dbAll(`
      SELECT ll.id, ll.name, ll.color FROM lead_label_assignments la
      JOIN lead_labels ll ON la.label_id = ll.id WHERE la.lead_id = ?
    `, [req.params.id]);
    lead.labels = labels || [];

    res.json({ success: true, data: lead });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch lead' });
  }
});

// POST /leads — Create lead
router.post('/', authMiddleware, requirePermission('crm.leads', 'create'), async (req: Request, res: Response) => {
  try {
    const { company, contact_name, email, phone, stage, value, probability, source, color, notes, assigned_to, client_id, description, due_date } = req.body;
    const userId = (req as any).user?.userId || null;
    const result = await dbRun(
      `INSERT INTO leads (company, contact_name, email, phone, stage, value, probability, source, color, notes, assigned_to, created_by, client_id, description, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [company, contact_name || null, email || null, phone || null, stage || 'New',
       value || 0, probability || 10, source || null, color || null, notes || null,
       assigned_to || null, userId, client_id || null, description || null, due_date || null]
    );
    await logActivity(result.insertId, userId, 'created', `Created lead: ${company}`);
    res.status(201).json({ success: true, message: 'Lead created', id: result.insertId });
  } catch (error) {
    console.error('Create lead error:', error);
    res.status(500).json({ success: false, error: 'Failed to create lead' });
  }
});

// PUT /leads/:id — Update lead (with stage transition validation)
router.put('/:id', authMiddleware, requirePermission('crm.leads', 'update'), async (req: Request, res: Response) => {
  try {
    const { company, contact_name, email, phone, stage, value, probability, source, color, notes, assigned_to, description, due_date } = req.body;
    
    // Load current lead for stage validation
    const current = await dbGet('SELECT * FROM leads WHERE id = ?', [req.params.id]) as any;
    if (!current) return res.status(404).json({ success: false, error: 'Lead not found' });
    
    // Validate stage transition if stage is changing
    const effectiveStage = stage || current.stage;
    if (stage && stage !== current.stage) {
      // Won can only be set by the /convert endpoint
      if (stage === 'Won') {
        return res.status(400).json({ success: false, error: "Stage 'Won' can only be set via the Convert endpoint, not direct update." });
      }
      const transition = validateLeadTransition(current.stage, stage);
      if (!transition.valid) {
        return res.status(400).json({ success: false, error: transition.error });
      }
    }
    
    // client_id and converted_at are protected — only set by /convert endpoint
    await dbRun(
      `UPDATE leads SET company=?, contact_name=?, email=?, phone=?, stage=?, value=?, probability=?, source=?, color=?, notes=?, assigned_to=?, client_id=?, description=?, due_date=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [company || current.company, contact_name || null, email || null, phone || null, effectiveStage, value || 0,
       probability || 10, source || null, color || null, notes || null, assigned_to || null,
       current.client_id, description || null, due_date || null, req.params.id]
    );
    const userId = (req as any).user?.userId || null;
    await logActivity(req.params.id as string, userId, 'updated', `Updated lead: ${company || current.company}`);
    if (stage && stage !== current.stage) {
      await logActivity(req.params.id as string, userId, 'stage_changed', `Stage: ${current.stage} \u2192 ${stage}`);
    }
    res.json({ success: true, message: 'Lead updated' });
  } catch (error: any) {
    console.error('Update lead error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to update lead' });
  }
});

// PATCH /leads/:id/stage — Move lead to new stage (drag-drop)
router.patch('/:id/stage', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { stage } = req.body;
    if (!stage) return res.status(400).json({ success: false, error: 'Stage is required' });

    const old = await dbGet('SELECT * FROM leads WHERE id=?', [req.params.id]) as any;
    if (!old) return res.status(404).json({ success: false, error: 'Lead not found' });

    // State machine validation
    if (old.stage !== stage) {
      const transition = validateLeadTransition(old.stage, stage);
      if (!transition.valid) {
        return res.status(400).json({ success: false, error: transition.error });
      }
    }

    // Won stage requires conversion validation — must have client_id or trigger convert
    if (stage === 'Won' && !old.client_id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot mark as Won without converting to a Client first. Use the Convert action instead.',
        require_conversion: true
      });
    }

    await dbRun('UPDATE leads SET stage=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [stage, req.params.id]);
    const userId = (req as any).user?.userId || null;
    await logActivity(req.params.id as string, userId, 'stage_changed', `Stage: ${old.stage} → ${stage}`);
    res.json({ success: true, message: 'Stage updated' });
  } catch (error: any) {
    console.error('Stage update error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to update stage' });
  }
});

// PATCH /leads/:id/color — Change card color
router.patch('/:id/color', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { color } = req.body;
    await dbRun('UPDATE leads SET color=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [color || null, req.params.id]);
    res.json({ success: true, message: 'Color updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update color' });
  }
});

// PATCH /leads/:id/due-date
router.patch('/:id/due-date', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { due_date } = req.body;
    await dbRun('UPDATE leads SET due_date=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [due_date || null, req.params.id]);
    const userId = (req as any).user?.userId || null;
    await logActivity(req.params.id as string, userId, 'due_date_set', `Due date: ${due_date || 'removed'}`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update due date' });
  }
});

// PATCH /leads/:id/assign
router.patch('/:id/assign', authMiddleware, requirePermission('crm.leads', 'update'), async (req: Request, res: Response) => {
  try {
    const { assigned_to } = req.body;
    await dbRun('UPDATE leads SET assigned_to=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [assigned_to || null, req.params.id]);
    const userId = (req as any).user?.userId || null;
    if (assigned_to) {
      const user = await dbGet('SELECT full_name FROM users WHERE id=?', [assigned_to]) as any;
      await logActivity(req.params.id as string, userId, 'assigned', `Assigned to ${user?.full_name || 'user #' + assigned_to}`);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign' });
  }
});

// PATCH /leads/:id/description
router.patch('/:id/description', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { description } = req.body;
    await dbRun('UPDATE leads SET description=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [description || null, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update description' });
  }
});

// DELETE /leads/:id
router.delete('/:id', authMiddleware, requirePermission('crm.leads', 'delete'), async (req: Request, res: Response) => {
  try {
    const lead = await dbGet('SELECT * FROM leads WHERE id = ?', [req.params.id]) as any;
    if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });

    // Leads with Sales Orders cannot be deleted
    const hasSO = await dbGet('SELECT id FROM sales_orders WHERE lead_id = ?', [req.params.id]);
    if (hasSO) {
      return res.status(400).json({ success: false, error: 'Cannot delete lead with associated Sales Orders. Archive instead.' });
    }

    // Converted leads cannot be deleted
    if (lead.client_id || lead.stage === 'Won') {
      return res.status(400).json({ success: false, error: 'Cannot delete a converted lead. Archive instead.' });
    }

    // Soft delete: set is_archived = 1, KEEP original stage (do NOT change stage)
    await dbRun('UPDATE leads SET is_archived = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);

    const userId = (req as any).user?.userId || null;
    await logActivity(req.params.id as string, userId, 'archived', `Lead archived: ${lead.company}`);

    res.json({ success: true, message: 'Lead archived' });
  } catch (error) {
    console.error('Delete lead error:', error);
    res.status(500).json({ success: false, error: 'Failed to archive lead' });
  }
});

// PATCH /leads/:id/restore — Restore archived lead
router.patch('/:id/restore', authMiddleware, requirePermission('crm.leads', 'update'), async (req: Request, res: Response) => {
  try {
    const lead = await dbGet('SELECT * FROM leads WHERE id = ? AND is_archived = 1', [req.params.id]) as any;
    if (!lead) return res.status(404).json({ success: false, error: 'Archived lead not found' });

    await dbRun('UPDATE leads SET is_archived = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);

    const userId = (req as any).user?.userId || null;
    await logActivity(req.params.id as string, userId, 'restored', `Lead restored: ${lead.company}`);

    res.json({ success: true, message: 'Lead restored' });
  } catch (error) {
    console.error('Restore lead error:', error);
    res.status(500).json({ success: false, error: 'Failed to restore lead' });
  }
});

// checklists

// GET /leads/:id/checklists
router.get('/:id/checklists', authMiddleware, async (req: Request, res: Response) => {
  try {
    const checklists = await dbAll('SELECT * FROM lead_checklists WHERE lead_id=? ORDER BY position, id', [req.params.id]) as any[];
    for (const cl of checklists) {
      cl.items = await dbAll('SELECT * FROM lead_checklist_items WHERE checklist_id=? ORDER BY position, id', [cl.id]);
    }
    res.json(checklists);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch checklists' });
  }
});

// POST /leads/:id/checklists
router.post('/:id/checklists', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { title } = req.body;
    const result = await dbRun('INSERT INTO lead_checklists (lead_id, title) VALUES (?,?)', [req.params.id, title || 'Checklist']);
    res.status(201).json({ id: result.insertId, title: title || 'Checklist', items: [] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create checklist' });
  }
});

// DELETE /leads/checklists/:checklistId
router.delete('/checklists/:checklistId', authMiddleware, async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM lead_checklists WHERE id=?', [req.params.checklistId]);
    res.json({ message: 'Checklist deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete checklist' });
  }
});

// POST /leads/checklists/:checklistId/items
router.post('/checklists/:checklistId/items', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });
    const result = await dbRun('INSERT INTO lead_checklist_items (checklist_id, text) VALUES (?,?)', [req.params.checklistId, text]);
    res.status(201).json({ id: result.insertId, text, is_checked: 0 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// PATCH /leads/checklists/items/:itemId — toggle or edit
router.patch('/checklists/items/:itemId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { is_checked, text } = req.body;
    if (is_checked !== undefined) {
      await dbRun('UPDATE lead_checklist_items SET is_checked=? WHERE id=?', [is_checked ? 1 : 0, req.params.itemId]);
    }
    if (text !== undefined) {
      await dbRun('UPDATE lead_checklist_items SET text=? WHERE id=?', [text, req.params.itemId]);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// DELETE /leads/checklists/items/:itemId
router.delete('/checklists/items/:itemId', authMiddleware, async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM lead_checklist_items WHERE id=?', [req.params.itemId]);
    res.json({ message: 'Item deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// ========================
// LABELS (assign/unassign)
// ========================

// POST /leads/:id/labels — assign label
router.post('/:id/labels', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { label_id } = req.body;
    await dbRun('INSERT IGNORE INTO lead_label_assignments (lead_id, label_id) VALUES (?,?)', [req.params.id, label_id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign label' });
  }
});

// DELETE /leads/:id/labels/:labelId — remove label
router.delete('/:id/labels/:labelId', authMiddleware, async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM lead_label_assignments WHERE lead_id=? AND label_id=?', [req.params.id, req.params.labelId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove label' });
  }
});

// ========================
// COMMENTS
// ========================

// GET /leads/:id/comments
router.get('/:id/comments', authMiddleware, async (req: Request, res: Response) => {
  try {
    const comments = await dbAll(`
      SELECT c.*, u.full_name as user_name FROM lead_comments c
      LEFT JOIN users u ON c.user_id = u.id WHERE c.lead_id=? ORDER BY c.created_at ASC
    `, [req.params.id]);
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// POST /leads/:id/comments
router.post('/:id/comments', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content required' });
    const userId = (req as any).user?.userId || null;
    const result = await dbRun('INSERT INTO lead_comments (lead_id, user_id, content) VALUES (?,?,?)',
      [req.params.id, userId, content.trim()]);
    const comment = await dbGet(`
      SELECT c.*, u.full_name as user_name FROM lead_comments c
      LEFT JOIN users u ON c.user_id = u.id WHERE c.id=?
    `, [result.insertId]);
    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// DELETE /leads/comments/:commentId
router.delete('/comments/:commentId', authMiddleware, async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM lead_comments WHERE id=?', [req.params.commentId]);
    res.json({ message: 'Comment deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// ========================
// ACTIVITY LOG
// ========================

// GET /leads/:id/activities
router.get('/:id/activities', authMiddleware, async (req: Request, res: Response) => {
  try {
    const activities = await dbAll(`
      SELECT a.*, u.full_name as user_name FROM lead_activities a
      LEFT JOIN users u ON a.user_id = u.id WHERE a.lead_id=? ORDER BY a.created_at DESC LIMIT 50
    `, [req.params.id]);
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// ========================
// ATTACHMENTS
// ========================

// GET /leads/:id/attachments
router.get('/:id/attachments', authMiddleware, async (req: Request, res: Response) => {
  try {
    const files = await dbAll(`
      SELECT a.*, u.full_name as uploader_name FROM lead_attachments a
      LEFT JOIN users u ON a.uploaded_by = u.id WHERE a.lead_id=? ORDER BY a.created_at DESC
    `, [req.params.id]);
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch attachments' });
  }
});

// POST /leads/:id/attachments
router.post('/:id/attachments', authMiddleware, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { originalname, filename, size, mimetype } = req.file;
    let fileType = 'other';
    if (mimetype.startsWith('image/')) fileType = 'image';
    else if (mimetype.includes('pdf')) fileType = 'pdf';
    else if (mimetype.includes('sheet') || mimetype.includes('excel')) fileType = 'excel';
    else if (mimetype.includes('document') || mimetype.includes('word')) fileType = 'word';

    const userId = (req as any).user?.userId || null;
    const result = await dbRun(`
      INSERT INTO lead_attachments (lead_id, file_name, file_path, file_type, file_size, uploaded_by) VALUES (?,?,?,?,?,?)
    `, [req.params.id, originalname, filename, fileType, size, userId]);
    await logActivity(req.params.id as string, userId, 'attachment_added', `Uploaded: ${originalname}`);
    res.status(201).json({ id: result.insertId, file_name: originalname, file_path: filename, file_type: fileType, file_size: size });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload' });
  }
});

// DELETE /leads/attachments/:attachmentId
router.delete('/attachments/:attachmentId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const file = await dbGet('SELECT * FROM lead_attachments WHERE id=?', [req.params.attachmentId]) as any;
    if (!file) return res.status(404).json({ error: 'Not found' });
    await dbRun('DELETE FROM lead_attachments WHERE id=?', [req.params.attachmentId]);
    const filePath = path.join(uploadDir, file.file_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ message: 'Attachment deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// ========================
// CONVERT TO CLIENT (with optional SO creation)
// ========================
router.post('/:id/convert', authMiddleware, requirePermission('crm.leads', 'convert'), async (req: Request, res: Response) => {
  try {
    const { create_so, so_items } = req.body;
    const userId = (req as any).user?.userId || null;

    const result = await dbTransaction(async (conn) => {
      // 1. Lock and validate lead
      const [leadRows] = await conn.execute('SELECT * FROM leads WHERE id = ? FOR UPDATE', [req.params.id]);
      const lead = leadRows[0];
      if (!lead) throw new Error('Lead not found');
      if (lead.client_id) throw new Error('Lead already converted to client');

      // Only allow conversion from Negotiation or Discussion stage
      if (!['Negotiation', 'Discussion'].includes(lead.stage)) {
        throw new Error(`Cannot convert lead from stage '${lead.stage}'. Lead must be in 'Discussion' or 'Negotiation' stage.`);
      }

      // 2. Find or create Client (with duplicate check)
      let clientId;
      const [existingClients] = await conn.execute('SELECT id FROM clients WHERE name = ?', [lead.company]);
      if (existingClients[0]) {
        clientId = existingClients[0].id;
      } else {
        // Concurrency-safe client code
        const [lastClient] = await conn.execute("SELECT code FROM clients WHERE code LIKE 'CLI-%' ORDER BY id DESC LIMIT 1 FOR UPDATE");
        let clientCode = 'CLI-0001';
        if (lastClient[0]) {
          const num = parseInt(lastClient[0].code.replace('CLI-', ''), 10);
          clientCode = `CLI-${String(num + 1).padStart(4, '0')}`;
        }
        // carries the Lead's company context forward so it isn't lost on conversion (Review.md P1 #6)
        const [clientResult] = await conn.execute(
          `INSERT INTO clients (code, name, organization, phone, address, city, website, industry, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [clientCode, lead.company, lead.company, lead.phone || null, lead.address || null, lead.city || null, lead.website || null, lead.industry || null]
        );
        clientId = (clientResult as any).insertId;
      }

      // 3. Create contact from lead info (within transaction — no silent ignore)
      if (lead.contact_name || lead.email) {
        const [existingContact] = await conn.execute(
          'SELECT id FROM contacts WHERE client_id = ? AND email = ?', [clientId, lead.email || '']
        );
        if (existingContact.length === 0) {
          await conn.execute(
            `INSERT INTO contacts (client_id, name, email, phone, job_title, is_primary) VALUES (?, ?, ?, ?, ?, 1)`,
            [clientId, lead.contact_name || lead.company, lead.email || null, lead.phone || null, lead.contact_title || null]
          );
        }
      }

      // 4. Update lead status to Won + link client
      await conn.execute(
        'UPDATE leads SET client_id = ?, stage = ?, converted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [clientId, 'Won', req.params.id]
      );

      let soId = null;
      let soNumber = null;

      // 5. Optionally create Sales Order (also in transaction)
      if (create_so) {
        // Concurrency-safe SO number
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const [lastSO] = await conn.execute(
          `SELECT so_number FROM sales_orders WHERE so_number LIKE ? ORDER BY id DESC LIMIT 1 FOR UPDATE`,
          [`SO-${dateStr}-%`]
        );
        let seq = 1;
        if (lastSO[0]) {
          const parts = lastSO[0].so_number.split('-');
          seq = parseInt(parts[parts.length - 1], 10) + 1;
        }
        soNumber = `SO-${dateStr}-${String(seq).padStart(4, '0')}`;
        const soDate = new Date().toISOString().split('T')[0];

        const [soResult] = await conn.execute(
          `INSERT INTO sales_orders (so_number, client_id, lead_id, so_date, status, currency, total_amount, notes)
           VALUES (?, ?, ?, ?, 'draft', 'IDR', ?, ?)`,
          [soNumber, clientId, lead.id, soDate, lead.value || 0, `Created from Lead: ${lead.company}`]
        );
        soId = (soResult as any).insertId;

        // Insert SO items if provided
        if (Array.isArray(so_items) && so_items.length > 0) {
          let total = 0;
          for (const item of so_items) {
            if (!item.product_id || !item.quantity) {
              throw new Error(`Invalid SO item: product_id and quantity are required`);
            }
            const lineTotal = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
            total += lineTotal;
            await conn.execute(
              'INSERT INTO so_items (so_id, product_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)',
              [soId, item.product_id, item.quantity, item.unit_price || 0, lineTotal]
            );
          }
          if (total > 0) {
            await conn.execute('UPDATE sales_orders SET total_amount = ? WHERE id = ?', [total, soId]);
          }
        }
      }

      return { clientId, soId, soNumber, company: lead.company };
    });

    await logActivity(req.params.id as string, userId, 'converted', `Converted to client #${result.clientId}`);
    if (result.soId) {
      await logActivity(req.params.id as string, userId, 'so_created', `Sales Order ${result.soNumber} created`);
    }

    res.json({
      success: true,
      message: result.soId ? 'Lead converted to client + Sales Order created' : 'Lead converted to client',
      client_id: result.clientId,
      so_id: result.soId,
      so_number: result.soNumber
    });
  } catch (error: any) {
    console.error('Convert lead error:', error);
    const msg = error.message || 'Failed to convert lead';
    const status = msg.includes('already converted') || msg.includes('Invalid SO item') ? 400 : 500;
    res.status(status).json({ success: false, error: msg });
  }
});

export default router;
