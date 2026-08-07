import { Router, Request, Response } from 'express';
import { dbAll, dbGet, dbRun, dbTransaction } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// ==================== file upload config ====================
const uploadDir = path.join(__dirname, '../../uploads/sample_requests');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
];
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv'];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype) || !ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error(`File type not allowed: ${file.mimetype} (${ext}). Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`));
    }
    cb(null, true);
  }
});

const generateRequestNumber = async (conn: any): Promise<string> => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const [rows]: any = await conn.execute(
    `SELECT request_number FROM sample_requests WHERE request_number LIKE ? ORDER BY id DESC LIMIT 1 FOR UPDATE`,
    [`SR-${dateStr}-%`]
  );
  let seq = 1;
  if (rows[0]) {
    const parts = rows[0].request_number.split('-');
    seq = parseInt(parts[parts.length - 1], 10) + 1;
  }
  return `SR-${dateStr}-${String(seq).padStart(4, '0')}`;
};

// ==================== CRUD ====================

// GET / - list all sample requests
router.get('/', authMiddleware, requirePermission('crm.sample-requests', 'view'), async (_req: Request, res: Response) => {
  try {
    const rows = await dbAll(`
      SELECT sr.*, c.name as client_name, u.full_name as sales_user_name
      FROM sample_requests sr
      LEFT JOIN clients c ON sr.client_id = c.id
      LEFT JOIN users u ON sr.sales_user_id = u.id
      ORDER BY sr.created_at DESC
    `);
    res.json({ data: rows });
  } catch (error: any) {
    console.error('Error fetching sample requests:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /:id - single sample request
router.get('/:id', authMiddleware, requirePermission('crm.sample-requests', 'view'), async (req: Request, res: Response) => {
  try {
    const row = await dbGet(`
      SELECT sr.*, c.name as client_name, u.full_name as sales_user_name
      FROM sample_requests sr
      LEFT JOIN clients c ON sr.client_id = c.id
      LEFT JOIN users u ON sr.sales_user_id = u.id
      WHERE sr.id = ?
    `, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Sample request not found' });
    res.json({ data: row });
  } catch (error: any) {
    console.error('Error fetching sample request:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST / - create sample request (Sales -> R&D)
router.post('/', authMiddleware, requirePermission('crm.sample-requests', 'create'), async (req: Request, res: Response) => {
  try {
    const { client_id, sales_user_id, product_name, specifications, quantity, unit, target_delivery_date } = req.body;
    if (!client_id || !product_name) {
      return res.status(400).json({ error: 'client_id and product_name are required' });
    }
    const userId = (req as any).user?.userId || null;

    const result = await dbTransaction(async (conn) => {
      const requestNumber = await generateRequestNumber(conn);
      const [insertResult]: any = await conn.execute(
        `INSERT INTO sample_requests (request_number, client_id, sales_user_id, product_name, specifications, quantity, unit, target_delivery_date, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Requested', ?)`,
        [requestNumber, client_id, sales_user_id || userId, product_name, specifications || null,
         quantity || 1, unit || 'pcs', target_delivery_date || null, userId]
      );
      return { id: insertResult.insertId, requestNumber };
    });

    res.status(201).json({ message: 'Sample request created', data: { id: result.id, request_number: result.requestNumber } });
  } catch (error: any) {
    console.error('Error creating sample request:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /:id/status - RnD/Sales move the request through its lifecycle
router.put('/:id/status', authMiddleware, requirePermission('crm.sample-requests', 'update'), async (req: Request, res: Response) => {
  try {
    const { status, delivery_tracking } = req.body;
    const current = await dbGet('SELECT * FROM sample_requests WHERE id = ?', [req.params.id]) as any;
    if (!current) return res.status(404).json({ error: 'Sample request not found' });

    // state machine: valid transitions
    const transitions: Record<string, string[]> = {
      'Requested': ['In Progress', 'Cancelled'],
      'In Progress': ['Ready for Delivery', 'Cancelled'],
      'Ready for Delivery': ['Delivered', 'Cancelled'],
      'Delivered': ['Feedback Received'],
      'Feedback Received': [],
      'Cancelled': [],
    };

    if (status && status !== current.status) {
      const allowed = transitions[current.status] || [];
      if (!allowed.includes(status)) {
        return res.status(400).json({
          error: `Invalid status transition: ${current.status} → ${status}`,
          allowed_transitions: allowed,
        });
      }
    }

    await dbRun(
      'UPDATE sample_requests SET status = ?, delivery_tracking = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status || current.status, delivery_tracking ?? current.delivery_tracking, req.params.id]
    );
    res.json({ message: 'Status updated' });
  } catch (error: any) {
    console.error('Error updating sample request status:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /:id/feedback - Sales records the Client's feedback on the delivered sample
router.put('/:id/feedback', authMiddleware, requirePermission('crm.sample-requests', 'update'), async (req: Request, res: Response) => {
  try {
    const { client_feedback } = req.body;
    const current = await dbGet('SELECT * FROM sample_requests WHERE id = ?', [req.params.id]) as any;
    if (!current) return res.status(404).json({ error: 'Sample request not found' });

    await dbRun(
      `UPDATE sample_requests SET status = 'Feedback Received', client_feedback = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [client_feedback || null, req.params.id]
    );
    res.json({ message: 'Feedback recorded' });
  } catch (error: any) {
    console.error('Error recording sample request feedback:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Comments (Sales <-> R&D discussion thread) ====================

router.get('/:id/comments', authMiddleware, requirePermission('crm.sample-requests', 'view'), async (req: Request, res: Response) => {
  try {
    const rows = await dbAll(`
      SELECT c.*, u.full_name as user_name
      FROM sample_request_comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.sample_request_id = ?
      ORDER BY c.created_at ASC
    `, [req.params.id]);
    res.json({ data: rows });
  } catch (error: any) {
    console.error('Error fetching sample request comments:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/comments', authMiddleware, requirePermission('crm.sample-requests', 'update'), async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content is required' });
    const userId = (req as any).user?.userId || null;
    const result = await dbRun(
      'INSERT INTO sample_request_comments (sample_request_id, user_id, content) VALUES (?, ?, ?)',
      [req.params.id, userId, content.trim()]
    );
    res.status(201).json({ message: 'Comment added', data: { id: result.insertId } });
  } catch (error: any) {
    console.error('Error posting sample request comment:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/comments/:commentId', authMiddleware, requirePermission('crm.sample-requests', 'update'), async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM sample_request_comments WHERE id = ?', [req.params.commentId]);
    res.json({ message: 'Comment deleted' });
  } catch (error: any) {
    console.error('Error deleting sample request comment:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Files (Foto / Tanda Terima / COA) ====================

router.get('/:id/files', authMiddleware, requirePermission('crm.sample-requests', 'view'), async (req: Request, res: Response) => {
  try {
    const rows = await dbAll(`
      SELECT f.*, u.full_name as uploader_name
      FROM sample_request_files f
      LEFT JOIN users u ON f.uploaded_by = u.id
      WHERE f.sample_request_id = ?
      ORDER BY f.created_at DESC
    `, [req.params.id]);
    res.json({ data: rows });
  } catch (error: any) {
    console.error('Error fetching sample request files:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/files', authMiddleware, requirePermission('crm.sample-requests', 'update'), upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File is required' });
    const { category } = req.body;
    const userId = (req as any).user?.userId || null;
    const filePath = `/uploads/sample_requests/${req.file.filename}`;

    const result = await dbRun(
      'INSERT INTO sample_request_files (sample_request_id, category, file_name, file_path, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.id, category || 'foto', req.file.originalname, filePath, req.file.size, userId]
    );
    res.status(201).json({ message: 'File uploaded', data: { id: result.insertId } });
  } catch (error: any) {
    console.error('Error uploading sample request file:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/files/:fileId', authMiddleware, requirePermission('crm.sample-requests', 'update'), async (req: Request, res: Response) => {
  try {
    const file = await dbGet('SELECT * FROM sample_request_files WHERE id = ?', [req.params.fileId]) as any;
    if (!file) return res.status(404).json({ error: 'File not found' });

    await dbRun('DELETE FROM sample_request_files WHERE id = ?', [req.params.fileId]);

    const diskPath = path.join(__dirname, '../../', file.file_path.replace(/^\//, ''));
    fs.unlink(diskPath, () => { /* best-effort cleanup */ });

    res.json({ message: 'File deleted' });
  } catch (error: any) {
    console.error('Error deleting sample request file:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
