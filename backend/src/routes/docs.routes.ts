import { Router, Request, Response } from 'express';
import { dbAll, dbGet, dbRun } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// ===== FILE UPLOAD CONFIG =====
const uploadDir = path.join(__dirname, '../../uploads/documents');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

// GET /api/docs - List documents
router.get('/', authMiddleware, requirePermission('admin.document-control', 'view'), async (req: Request, res: Response) => {
  try {
    const docs = await dbAll('SELECT d.*, u.full_name as uploader_name FROM document_control d LEFT JOIN users u ON d.uploaded_by = u.id ORDER BY d.expiry_date ASC');
    res.json({ data: docs });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// POST /api/docs - Create document (with optional file upload)
router.post('/', authMiddleware, requirePermission('admin.document-control', 'create'), upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { document_name, document_number, document_type, issue_date, expiry_date, reminder_days, status, notes } = req.body;
    const userId = (req as any).user?.userId;
    
    let file_path = null;
    let file_name = null;
    let file_size = null;
    let mime_type = null;

    if (req.file) {
      file_path = '/uploads/documents/' + req.file.filename;
      file_name = req.file.originalname;
      file_size = req.file.size;
      mime_type = req.file.mimetype;
    }

    const result = await dbRun(
      'INSERT INTO document_control (document_name, document_number, document_type, issue_date, expiry_date, reminder_days, file_path, file_name, file_size, mime_type, status, notes, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [document_name, document_number || null, document_type || null, issue_date || null, expiry_date || null, reminder_days || 30, file_path, file_name, file_size, mime_type, status || 'Active', notes || null, userId]
    );

    res.status(201).json({ message: 'Document created successfully', data: { id: result.insertId } });
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// PUT /api/docs/:id - Update document (with optional file upload)
router.put('/:id', authMiddleware, requirePermission('admin.document-control', 'update'), upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { document_name, document_number, document_type, issue_date, expiry_date, reminder_days, status, notes } = req.body;
    const docId = req.params.id;
    
    let updateQuery = 'UPDATE document_control SET document_name = ?, document_number = ?, document_type = ?, issue_date = ?, expiry_date = ?, reminder_days = ?, status = ?, notes = ?';
    let queryParams: any[] = [document_name, document_number || null, document_type || null, issue_date || null, expiry_date || null, reminder_days || 30, status || 'Active', notes || null];

    if (req.file) {
      updateQuery += ', file_path = ?, file_name = ?, file_size = ?, mime_type = ?';
      queryParams.push('/uploads/documents/' + req.file.filename, req.file.originalname, req.file.size, req.file.mimetype);
    }
    
    updateQuery += ' WHERE id = ?';
    queryParams.push(docId);

    await dbRun(updateQuery, queryParams);

    res.json({ message: 'Document updated successfully' });
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// DELETE /api/docs/:id - Delete document
router.delete('/:id', authMiddleware, requirePermission('admin.document-control', 'delete'), async (req: Request, res: Response) => {
  try {
    const docId = req.params.id;
    const doc = await dbGet('SELECT file_path FROM document_control WHERE id = ?', [docId]) as any;
    
    if (doc && doc.file_path) {
      const fullPath = path.join(__dirname, '../../', doc.file_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    await dbRun('DELETE FROM document_control WHERE id = ?', [docId]);
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// GET /api/docs/check-expiry - Check expiries and generate notifications
router.get('/check-expiry', authMiddleware, requirePermission('admin.document-control', 'view'), async (req: Request, res: Response) => {
  try {
    // Find documents that are expiring within reminder_days and have not been 'Renewed' or 'Expired'
    const docs = await dbAll("SELECT * FROM document_control WHERE expiry_date IS NOT NULL AND status NOT IN ('Renewed')");
    
    // Find Admin users to notify
    const admins = await dbAll("SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'Admin'") as any[];
    
    let notificationsCreated = 0;
    const now = new Date();

    for (const doc of docs as any[]) {
      const expiryDate = new Date(doc.expiry_date);
      const reminderDays = doc.reminder_days || 30;
      
      const diffTime = expiryDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= reminderDays) {
        // Automatically update status to Expiring Soon or Expired
        let newStatus = doc.status;
        if (diffDays < 0) {
          newStatus = 'Expired';
        } else if (newStatus === 'Active') {
          newStatus = 'Expiring Soon';
        }
        
        if (newStatus !== doc.status) {
           await dbRun('UPDATE document_control SET status = ? WHERE id = ?', [newStatus, doc.id]);
        }

        // Check if we already sent a notification recently for this document to avoid spam
        // We will just check if a notification exists with related_entity_id = doc.id and created in the last 7 days
        
        for (const admin of admins) {
          const recentNotif = await dbGet(
            "SELECT id FROM notifications WHERE recipient_id = ? AND related_entity_type = 'Document' AND related_entity_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)",
            [admin.id, doc.id]
          );

          if (!recentNotif) {
             const title = diffDays < 0 ? 'Document Expired' : 'Document Expiring Soon';
             const message = `The document "${doc.title}" (${doc.doc_number}) will ${diffDays < 0 ? 'has expired' : `expire in ${diffDays} days`}.`;
             
             await dbRun(
               'INSERT INTO notifications (recipient_id, title, message, type, related_entity_type, related_entity_id, action_url, is_read) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
               [admin.id, title, message, 'alert', 'Document', doc.id, '/admin/document-control']
             );
             notificationsCreated++;
          }
        }
      }
    }
    
    res.json({ message: 'Expiry check completed', notifications_created: notificationsCreated });
  } catch (error) {
    console.error('Error checking expiries:', error);
    res.status(500).json({ error: 'Failed to check expiries' });
  }
});

export default router;
