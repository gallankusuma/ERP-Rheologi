import { Router, Request, Response } from 'express';
import { dbQuery, dbGet, dbAll, dbRun } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Get all projects with client and manager info
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const projects = await dbAll(`
      SELECT 
        p.id, 
        p.project_number, 
        p.project_name as title, 
        p.description, 
        p.status, 
        p.start_date, 
        p.end_date as deadline, 
        p.budget as price, 
        p.created_at,
        c.name as client_name,
        u.full_name as manager_name,
        (SELECT COUNT(*) FROM project_tasks t WHERE t.project_id = p.id AND t.status = 'Done') * 100 / 
        NULLIF((SELECT COUNT(*) FROM project_tasks t WHERE t.project_id = p.id), 0) as progress
      FROM client_projects p
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN users u ON p.assigned_to = u.id
      ORDER BY p.created_at DESC
    `);
    
    // Format numeric values
    const formattedProjects = projects.map((p: any) => ({
      ...p,
      progress: Math.round(p.progress || 0)
    }));
    
    res.json(formattedProjects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get single project details
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const project = await dbGet(`
      SELECT 
        p.*, 
        p.project_name as title,
        p.budget as price,
        c.name as client_name, (SELECT COUNT(*) FROM project_tasks t WHERE t.project_id = p.id AND t.status = 'Done') * 100 / 
        NULLIF((SELECT COUNT(*) FROM project_tasks t WHERE t.project_id = p.id), 0) as progress,
        u.full_name as manager_name
      FROM client_projects p
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN users u ON p.assigned_to = u.id
      WHERE p.id = ?
    `, [req.params.id]);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get members
    const members = await dbAll(`
      SELECT u.id, u.full_name, u.email, pm.role 
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ?
    `, [req.params.id]);

    res.json({ ...project, members });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Create project (Also links to Client)
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { 
      client_id, 
      title, 
      description, 
      status, 
      start_date, 
      deadline, 
      price, 
      priority,
      assigned_to 
    } = req.body;

    const projectNumber = `PRJ-${Date.now()}`; // Simple auto-generation

    const result = await dbRun(`
      INSERT INTO client_projects (
        client_id, project_number, project_name, description, status, 
        start_date, end_date, budget, assigned_to, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      client_id, projectNumber, title, description, status || 'open',
      start_date, deadline, price || 0, assigned_to, (req as any).user.userId
    ]);

    res.status(201).json({ id: result.insertId, message: 'Project created' });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update project
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { 
      title, 
      description, 
      status, 
      start_date, 
      deadline, 
      price, 
      assigned_to 
    } = req.body;

    await dbRun(`
      UPDATE client_projects SET 
        project_name = ?, 
        description = ?, 
        status = ?, 
        start_date = ?, 
        end_date = ?, 
        budget = ?, 
        assigned_to = ?
      WHERE id = ?
    `, [
      title, description, status, start_date, deadline, price, assigned_to, req.params.id
    ]);

    res.json({ message: 'Project updated' });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM client_projects WHERE id = ?', [req.params.id]);
    res.json({ message: 'Project deleted' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// ... Existing routes ...

// --- Task Routes ---

// Get all tasks for a project
router.get('/:id/tasks', authMiddleware, async (req: Request, res: Response) => {
  try {
    const tasks = await dbAll(`
      SELECT 
        t.*,
        u.full_name as assigned_to_name,
        m.title as milestone_title
      FROM project_tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN project_milestones m ON t.milestone_id = m.id
      WHERE t.project_id = ?
      ORDER BY t.created_at DESC
    `, [req.params.id]);
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Create task
router.post('/:id/tasks', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { 
      title, 
      description, 
      status, 
      priority, 
      start_date, 
      due_date, 
      assigned_to,
      milestone_id 
    } = req.body;

    const result = await dbRun(`
      INSERT INTO project_tasks (
        project_id, title, description, status, priority, 
        start_date, due_date, assigned_to, milestone_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      req.params.id, title, description, status || 'To Do', priority || 'Medium',
      start_date, due_date, assigned_to, milestone_id
    ]);

    // Log Activity
    await dbRun(`
      INSERT INTO project_activities (project_id, user_id, action_type, description)
      VALUES (?, ?, 'created_task', ?)
    `, [req.params.id, (req as any).user.userId, `Created task: ${title}`]);

    res.status(201).json({ id: result.insertId, message: 'Task created' });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update task
router.put('/tasks/:taskId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { 
      title, 
      description, 
      status, 
      priority, 
      start_date, 
      due_date, 
      assigned_to, 
      milestone_id 
    } = req.body;

    await dbRun(`
      UPDATE project_tasks SET 
        title = ?, 
        description = ?, 
        status = ?, 
        priority = ?, 
        start_date = ?, 
        due_date = ?, 
        assigned_to = ?, 
        milestone_id = ?
      WHERE id = ?
    `, [
      title, description, status, priority, 
      start_date, due_date, assigned_to, milestone_id, 
      req.params.taskId
    ]);

    res.json({ message: 'Task updated' });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete task
router.delete('/tasks/:taskId', authMiddleware, async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM project_tasks WHERE id = ?', [req.params.taskId]);
    res.json({ message: 'Task deleted' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// ... Existing routes ...

// --- Milestone Routes ---

// Get all milestones for a project
router.get('/:id/milestones', authMiddleware, async (req: Request, res: Response) => {
  try {
    const milestones = await dbAll(`
      SELECT m.*, 
      (SELECT COUNT(*) FROM project_tasks t WHERE t.milestone_id = m.id) as total_tasks,
      (SELECT COUNT(*) FROM project_tasks t WHERE t.milestone_id = m.id AND t.status = 'Done') as completed_tasks
      FROM project_milestones m
      WHERE m.project_id = ?
      ORDER BY m.due_date ASC
    `, [req.params.id]);
    res.json(milestones);
  } catch (error) {
    console.error('Error fetching milestones:', error);
    res.status(500).json({ error: 'Failed to fetch milestones' });
  }
});

// Create milestone
router.post('/:id/milestones', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { title, description, due_date, status, amount } = req.body;
    const result = await dbRun(`
      INSERT INTO project_milestones (project_id, title, description, due_date, status, amount)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [req.params.id, title, description, due_date, status || 'Pending', amount || 0]);

    // Log Activity
    await dbRun(`
      INSERT INTO project_activities (project_id, user_id, action_type, description)
      VALUES (?, ?, 'created_milestone', ?)
    `, [req.params.id, (req as any).user.userId, `Created milestone: ${title}`]);

    res.status(201).json({ id: result.insertId, message: 'Milestone created' });
  } catch (error) {
    console.error('Error creating milestone:', error);
    res.status(500).json({ error: 'Failed to create milestone' });
  }
});

// Update milestone
router.put('/milestones/:milestoneId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { title, description, due_date, status, amount } = req.body;
    await dbRun(`
      UPDATE project_milestones SET 
        title = ?, description = ?, due_date = ?, status = ?, amount = ?
      WHERE id = ?
    `, [title, description, due_date, status, amount, req.params.milestoneId]);

    res.json({ message: 'Milestone updated' });
  } catch (error) {
    console.error('Error updating milestone:', error);
    res.status(500).json({ error: 'Failed to update milestone' });
  }
});

// Delete milestone
router.delete('/milestones/:milestoneId', authMiddleware, async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM project_milestones WHERE id = ?', [req.params.milestoneId]);
    res.json({ message: 'Milestone deleted' });
  } catch (error) {
    console.error('Error deleting milestone:', error);
    res.status(500).json({ error: 'Failed to delete milestone' });
  }
});

// ... Existing routes ...

// --- File Routes ---

// Configure Multer
const uploadDir = path.join(__dirname, '../../uploads/project_files');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Get all files for a project
router.get('/:id/files', authMiddleware, async (req: Request, res: Response) => {
  try {
    const files = await dbAll(`
      Select f.*, u.full_name as uploader_name
      FROM project_files f
      LEFT JOIN users u ON f.uploaded_by = u.id
      WHERE f.project_id = ?
      ORDER BY f.uploaded_at DESC
    `, [req.params.id]);
    res.json(files);
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Upload file
router.post('/:id/files', authMiddleware, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { originalname, filename, size, mimetype } = req.file;
    
    // Determine file type category (for icons)
    let fileType = 'other';
    if (mimetype.startsWith('image/')) fileType = 'image';
    else if (mimetype.includes('pdf')) fileType = 'pdf';
    else if (mimetype.includes('sheet') || mimetype.includes('excel')) fileType = 'excel';
    else if (mimetype.includes('document') || mimetype.includes('word')) fileType = 'word';

    const result = await dbRun(`
      INSERT INTO project_files (project_id, file_name, file_path, file_type, file_size, uploaded_by, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [req.params.id, originalname, filename, fileType, size, (req as any).user.userId]);

    // Log Activity
    await dbRun(`
      INSERT INTO project_activities (project_id, user_id, action_type, description)
      VALUES (?, ?, 'uploaded_file', ?)
    `, [req.params.id, (req as any).user.userId, `Uploaded file: ${originalname}`]);

    res.status(201).json({ 
      id: result.insertId, 
      message: 'File uploaded',
      file: {
        id: result.insertId,
        file_name: originalname,
        file_path: filename,
        file_type: fileType,
        file_size: size,
        uploaded_at: new Date(),
        uploader_name: (req as any).user.name // Assuming user name is available in request or we fetch it
      }
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Delete file
router.delete('/files/:fileId', authMiddleware, async (req: Request, res: Response) => {
  try {
    // Get file info to delete from disk
    const file = await dbGet('SELECT * FROM project_files WHERE id = ?', [req.params.fileId]);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete from DB
    await dbRun('DELETE FROM project_files WHERE id = ?', [req.params.fileId]);

    // Delete from Disk
    const filePath = path.join(uploadDir, file.file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ message: 'File deleted' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// ===== COST CONTROL =====

const generateExpenseNumber = () => {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `EXP-${datePart}-${rand}`;
};

// Get project cost summary (budget vs actual from PR, PO, expenses)
router.get('/:id/cost-summary', authMiddleware, async (req: Request, res: Response) => {
  try {
    const projectId = req.params.id;

    const project = await dbGet(
      'SELECT id, budget, actual_cost FROM client_projects WHERE id = ?',
      [projectId]
    ) as any;
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // PR totals (estimated from items stored in notes JSON)
    const prs = await dbAll(
      `SELECT id, pr_number, status, approval_status, notes, created_at
       FROM purchase_requests WHERE project_id = ?`,
      [projectId]
    );

    let prTotal = 0;
    for (const pr of (prs || [])) {
      try {
        const parsed = JSON.parse(pr.notes || '{}');
        prTotal += parseFloat(parsed.estimatedTotal || 0);
      } catch { /* non-json notes */ }
    }

    // PO totals from line items
    const poSummary = await dbGet(`
      SELECT 
        COUNT(DISTINCT po.id) as po_count,
        COALESCE(SUM(poi.quantity * poi.unit_price), 0) as po_total
      FROM purchase_orders po
      LEFT JOIN purchase_order_items poi ON poi.po_id = po.id
      WHERE po.project_id = ?
    `, [projectId]) as any;

    // PO by status
    const poByStatus = await dbAll(`
      SELECT po.status, po.approval_status,
        COALESCE(SUM(poi.quantity * poi.unit_price), 0) as total
      FROM purchase_orders po
      LEFT JOIN purchase_order_items poi ON poi.po_id = po.id
      WHERE po.project_id = ?
      GROUP BY po.status, po.approval_status
    `, [projectId]);

    // Expense totals
    const expSummary = await dbGet(`
      SELECT 
        COUNT(*) as expense_count,
        COALESCE(SUM(amount), 0) as expense_total
      FROM project_expenses
      WHERE project_id = ? AND status != 'rejected'
    `, [projectId]) as any;

    // Expenses by category
    const expByCategory = await dbAll(`
      SELECT category, COALESCE(SUM(amount), 0) as total, COUNT(*) as count
      FROM project_expenses
      WHERE project_id = ? AND status != 'rejected'
      GROUP BY category ORDER BY total DESC
    `, [projectId]);

    const totalSpent = parseFloat(poSummary?.po_total || 0) + parseFloat(expSummary?.expense_total || 0);
    const budget = parseFloat(project.budget || 0);
    const remaining = budget - totalSpent;
    const usagePercent = budget > 0 ? Math.round((totalSpent / budget) * 100) : 0;

    // Update actual_cost in project
    await dbRun('UPDATE client_projects SET actual_cost = ? WHERE id = ?', [totalSpent, projectId]);

    res.json({
      budget,
      total_spent: totalSpent,
      remaining,
      usage_percent: usagePercent,
      pr: {
        count: (prs || []).length,
        estimated_total: prTotal
      },
      po: {
        count: poSummary?.po_count || 0,
        total: parseFloat(poSummary?.po_total || 0),
        by_status: poByStatus || []
      },
      expenses: {
        count: expSummary?.expense_count || 0,
        total: parseFloat(expSummary?.expense_total || 0),
        by_category: expByCategory || []
      }
    });
  } catch (error) {
    console.error('Error fetching cost summary:', error);
    res.status(500).json({ error: 'Failed to fetch cost summary' });
  }
});

// List project expenses
router.get('/:id/expenses', authMiddleware, async (req: Request, res: Response) => {
  try {
    const expenses = await dbAll(`
      SELECT e.*, v.name as vendor_name, u.full_name as created_by_name,
             ua.full_name as approved_by_name
      FROM project_expenses e
      LEFT JOIN vendors v ON e.vendor_id = v.id
      LEFT JOIN users u ON e.created_by = u.id
      LEFT JOIN users ua ON e.approved_by = ua.id
      WHERE e.project_id = ?
      ORDER BY e.expense_date DESC
    `, [req.params.id]);
    res.json({ data: expenses || [] });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// Create project expense
router.post('/:id/expenses', authMiddleware, async (req: Request, res: Response) => {
  try {
    const projectId = req.params.id;
    const userId = (req as any).user?.userId;
    const { category, description, amount, expense_date, vendor_id, receipt_number, notes } = req.body;

    if (!description || !amount || !expense_date) {
      return res.status(400).json({ error: 'description, amount, and expense_date are required' });
    }

    const expenseNumber = generateExpenseNumber();
    const result = await dbRun(`
      INSERT INTO project_expenses (project_id, expense_number, category, description, amount, expense_date, vendor_id, receipt_number, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [projectId, expenseNumber, category || 'other', description, amount, expense_date, vendor_id || null, receipt_number || null, notes || null, userId || null]);

    res.status(201).json({ message: 'Expense created', data: { id: result.insertId, expense_number: expenseNumber } });
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// Update project expense
router.put('/:id/expenses/:expenseId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { category, description, amount, expense_date, vendor_id, receipt_number, status, notes } = req.body;

    await dbRun(`
      UPDATE project_expenses 
      SET category = ?, description = ?, amount = ?, expense_date = ?, vendor_id = ?, receipt_number = ?, status = ?, notes = ?
      WHERE id = ? AND project_id = ?
    `, [category, description, amount, expense_date, vendor_id || null, receipt_number || null, status || 'draft', notes || null, req.params.expenseId, req.params.id]);

    res.json({ message: 'Expense updated' });
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// Delete project expense
router.delete('/:id/expenses/:expenseId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const expense = await dbGet('SELECT status FROM project_expenses WHERE id = ? AND project_id = ?', [req.params.expenseId, req.params.id]) as any;
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    if (expense.status === 'approved' || expense.status === 'paid') {
      return res.status(400).json({ error: 'Cannot delete approved/paid expenses' });
    }
    await dbRun('DELETE FROM project_expenses WHERE id = ? AND project_id = ?', [req.params.expenseId, req.params.id]);
    res.json({ message: 'Expense deleted' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// List PRs linked to a project
router.get('/:id/purchase-requests', authMiddleware, async (req: Request, res: Response) => {
  try {
    const prs = await dbAll(`
      SELECT pr.*, u.full_name as requester_name
      FROM purchase_requests pr
      LEFT JOIN users u ON pr.requestor_id = u.id
      WHERE pr.project_id = ?
      ORDER BY pr.created_at DESC
    `, [req.params.id]);
    res.json({ data: prs || [] });
  } catch (error) {
    console.error('Error fetching project PRs:', error);
    res.status(500).json({ error: 'Failed to fetch project PRs' });
  }
});

// List POs linked to a project  
router.get('/:id/purchase-orders', authMiddleware, async (req: Request, res: Response) => {
  try {
    const pos = await dbAll(`
      SELECT po.*, v.name as vendor_name, pr.pr_number,
        COALESCE((SELECT SUM(poi.quantity * poi.unit_price) FROM purchase_order_items poi WHERE poi.po_id = po.id), 0) as total_amount
      FROM purchase_orders po
      LEFT JOIN vendors v ON po.vendor_id = v.id
      LEFT JOIN purchase_requests pr ON po.pr_id = pr.id
      WHERE po.project_id = ?
      ORDER BY po.created_at DESC
    `, [req.params.id]);
    res.json({ data: pos || [] });
  } catch (error) {
    console.error('Error fetching project POs:', error);
    res.status(500).json({ error: 'Failed to fetch project POs' });
  }
});

export const projectRoutes = router;
