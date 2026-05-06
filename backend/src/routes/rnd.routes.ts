import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const router = Router();

// Helper
const authMiddleware = (req: Request, res: Response, next: Function) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'erp-secret-key-2024');
    (req as any).user = decoded;
    next();
  } catch { return res.status(401).json({ error: 'Invalid token' }); }
};

// ==================== R&D PROJECTS ====================

// GET all projects
router.get('/projects', authMiddleware, async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT p.*, u.full_name as leader_name, d.name as department_name
      FROM rnd_projects p
      LEFT JOIN users u ON p.project_leader_id = u.id
      LEFT JOIN departments d ON p.department_id = d.id
      ORDER BY p.created_at DESC
    `);
    res.json({ data: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET single project
router.get('/projects/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT p.*, u.full_name as leader_name, d.name as department_name
       FROM rnd_projects p
       LEFT JOIN users u ON p.project_leader_id = u.id
       LEFT JOIN departments d ON p.department_id = d.id
       WHERE p.id = ?`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ data: rows[0] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST create project
router.post('/projects', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { project_code, name, description, objectives, status, priority, project_leader_id, department_id, start_date, target_end_date, budget, notes } = req.body;
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO rnd_projects (project_code, name, description, objectives, status, priority, project_leader_id, department_id, start_date, target_end_date, budget, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [project_code, name, description, objectives, status || 'draft', priority || 'medium', project_leader_id, department_id, start_date, target_end_date, budget || 0, notes, (req as any).user?.id]
    );
    res.status(201).json({ data: { id: result.insertId }, message: 'Project created' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// PUT update project
router.put('/projects/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { project_code, name, description, objectives, status, priority, project_leader_id, department_id, start_date, target_end_date, actual_end_date, budget, spent, notes } = req.body;
    await pool.query(
      `UPDATE rnd_projects SET project_code=?, name=?, description=?, objectives=?, status=?, priority=?, project_leader_id=?, department_id=?, start_date=?, target_end_date=?, actual_end_date=?, budget=?, spent=?, notes=? WHERE id=?`,
      [project_code, name, description, objectives, status, priority, project_leader_id, department_id, start_date, target_end_date, actual_end_date, budget, spent, notes, req.params.id]
    );
    res.json({ message: 'Project updated' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// DELETE project
router.delete('/projects/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM rnd_projects WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ==================== FORMULATIONS ====================

// GET all formulations
router.get('/formulations', authMiddleware, async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT f.*, p.name as project_name, u.full_name as approved_by_name
      FROM rnd_formulations f
      LEFT JOIN rnd_projects p ON f.project_id = p.id
      LEFT JOIN users u ON f.approved_by = u.id
      ORDER BY f.created_at DESC
    `);
    res.json({ data: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET single formulation with ingredients
router.get('/formulations/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT f.*, p.name as project_name FROM rnd_formulations f
       LEFT JOIN rnd_projects p ON f.project_id = p.id WHERE f.id = ?`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const [ingredients] = await pool.query<RowDataPacket[]>(
      `SELECT fi.*, pr.name as product_name, pr.sku
       FROM rnd_formulation_ingredients fi
       LEFT JOIN products pr ON fi.product_id = pr.id
       WHERE fi.formulation_id = ? ORDER BY fi.sort_order`, [req.params.id]
    );
    res.json({ data: { ...rows[0], ingredients } });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST create formulation
router.post('/formulations', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { formula_code, name, version, project_id, product_type_id, status, target_specs, description, notes, ingredients } = req.body;
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO rnd_formulations (formula_code, name, version, project_id, product_type_id, status, target_specs, description, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [formula_code, name, version || '1.0', project_id, product_type_id, status || 'draft', target_specs, description, notes, (req as any).user?.id]
    );
    // Insert ingredients if provided
    if (ingredients && Array.isArray(ingredients)) {
      for (let i = 0; i < ingredients.length; i++) {
        const ing = ingredients[i];
        await pool.query(
          `INSERT INTO rnd_formulation_ingredients (formulation_id, product_id, ingredient_name, quantity, unit, percentage, function_role, notes, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [result.insertId, ing.product_id, ing.ingredient_name, ing.quantity || 0, ing.unit || 'kg', ing.percentage, ing.function_role, ing.notes, i]
        );
      }
    }
    res.status(201).json({ data: { id: result.insertId }, message: 'Formulation created' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// PUT update formulation
router.put('/formulations/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { formula_code, name, version, project_id, product_type_id, status, target_specs, description, notes, ingredients } = req.body;
    await pool.query(
      `UPDATE rnd_formulations SET formula_code=?, name=?, version=?, project_id=?, product_type_id=?, status=?, target_specs=?, description=?, notes=? WHERE id=?`,
      [formula_code, name, version, project_id, product_type_id, status, target_specs, description, notes, req.params.id]
    );
    // Replace ingredients
    if (ingredients && Array.isArray(ingredients)) {
      await pool.query('DELETE FROM rnd_formulation_ingredients WHERE formulation_id = ?', [req.params.id]);
      for (let i = 0; i < ingredients.length; i++) {
        const ing = ingredients[i];
        await pool.query(
          `INSERT INTO rnd_formulation_ingredients (formulation_id, product_id, ingredient_name, quantity, unit, percentage, function_role, notes, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [req.params.id, ing.product_id, ing.ingredient_name, ing.quantity || 0, ing.unit || 'kg', ing.percentage, ing.function_role, ing.notes, i]
        );
      }
    }
    res.json({ message: 'Formulation updated' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// DELETE formulation
router.delete('/formulations/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM rnd_formulations WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ==================== LAB TESTS ====================

// GET all lab tests
router.get('/lab-tests', authMiddleware, async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT t.*, f.name as formulation_name, f.formula_code,
             p.name as project_name, u.full_name as tester_name
      FROM rnd_lab_tests t
      LEFT JOIN rnd_formulations f ON t.formulation_id = f.id
      LEFT JOIN rnd_projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.tested_by = u.id
      ORDER BY t.created_at DESC
    `);
    res.json({ data: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET single lab test
router.get('/lab-tests/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT t.*, f.name as formulation_name, f.formula_code,
              p.name as project_name, u.full_name as tester_name
       FROM rnd_lab_tests t
       LEFT JOIN rnd_formulations f ON t.formulation_id = f.id
       LEFT JOIN rnd_projects p ON t.project_id = p.id
       LEFT JOIN users u ON t.tested_by = u.id
       WHERE t.id = ?`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ data: rows[0] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST create lab test
router.post('/lab-tests', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { test_code, test_name, formulation_id, project_id, batch_number, test_type, method, equipment, status, test_date, tested_by, parameters, results, conclusion, notes } = req.body;
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO rnd_lab_tests (test_code, test_name, formulation_id, project_id, batch_number, test_type, method, equipment, status, test_date, tested_by, parameters, results, conclusion, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [test_code, test_name, formulation_id, project_id, batch_number, test_type || 'chemical', method, equipment, status || 'scheduled', test_date, tested_by, parameters ? JSON.stringify(parameters) : null, results ? JSON.stringify(results) : null, conclusion || 'pending', notes, (req as any).user?.id]
    );
    res.status(201).json({ data: { id: result.insertId }, message: 'Lab test created' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// PUT update lab test
router.put('/lab-tests/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { test_code, test_name, formulation_id, project_id, batch_number, test_type, method, equipment, status, test_date, tested_by, parameters, results, conclusion, notes } = req.body;
    await pool.query(
      `UPDATE rnd_lab_tests SET test_code=?, test_name=?, formulation_id=?, project_id=?, batch_number=?, test_type=?, method=?, equipment=?, status=?, test_date=?, tested_by=?, parameters=?, results=?, conclusion=?, notes=? WHERE id=?`,
      [test_code, test_name, formulation_id, project_id, batch_number, test_type, method, equipment, status, test_date, tested_by, parameters ? JSON.stringify(parameters) : null, results ? JSON.stringify(results) : null, conclusion, notes, req.params.id]
    );
    res.json({ message: 'Lab test updated' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// DELETE lab test
router.delete('/lab-tests/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM rnd_lab_tests WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ==================== STABILITY STUDIES ====================

// GET all stability studies
router.get('/stability', authMiddleware, async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT s.*, f.name as formulation_name, f.formula_code
      FROM rnd_stability_studies s
      LEFT JOIN rnd_formulations f ON s.formulation_id = f.id
      ORDER BY s.created_at DESC
    `);
    res.json({ data: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET single stability study with checkpoints
router.get('/stability/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.*, f.name as formulation_name, f.formula_code
       FROM rnd_stability_studies s
       LEFT JOIN rnd_formulations f ON s.formulation_id = f.id
       WHERE s.id = ?`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const [checkpoints] = await pool.query<RowDataPacket[]>(
      `SELECT c.*, u.full_name as tester_name FROM rnd_stability_checkpoints c
       LEFT JOIN users u ON c.tested_by = u.id
       WHERE c.study_id = ? ORDER BY c.checkpoint_month`, [req.params.id]
    );
    res.json({ data: { ...rows[0], checkpoints } });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST create stability study
router.post('/stability', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { study_code, name, formulation_id, batch_number, status, storage_condition, duration_months, start_date, end_date, protocol, checkpoints } = req.body;
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO rnd_stability_studies (study_code, name, formulation_id, batch_number, status, storage_condition, duration_months, start_date, end_date, protocol, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [study_code, name, formulation_id, batch_number, status || 'planned', storage_condition || '25°C / 60% RH', duration_months || 12, start_date, end_date, protocol, (req as any).user?.id]
    );
    // Create checkpoints if provided
    if (checkpoints && Array.isArray(checkpoints)) {
      for (const cp of checkpoints) {
        await pool.query(
          `INSERT INTO rnd_stability_checkpoints (study_id, checkpoint_month, scheduled_date, status, parameters) VALUES (?, ?, ?, 'pending', ?)`,
          [result.insertId, cp.checkpoint_month, cp.scheduled_date, cp.parameters ? JSON.stringify(cp.parameters) : null]
        );
      }
    }
    res.status(201).json({ data: { id: result.insertId }, message: 'Stability study created' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// PUT update stability study
router.put('/stability/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { study_code, name, formulation_id, batch_number, status, storage_condition, duration_months, start_date, end_date, protocol, conclusion } = req.body;
    await pool.query(
      `UPDATE rnd_stability_studies SET study_code=?, name=?, formulation_id=?, batch_number=?, status=?, storage_condition=?, duration_months=?, start_date=?, end_date=?, protocol=?, conclusion=? WHERE id=?`,
      [study_code, name, formulation_id, batch_number, status, storage_condition, duration_months, start_date, end_date, protocol, conclusion, req.params.id]
    );
    res.json({ message: 'Study updated' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// PUT update checkpoint
router.put('/stability/:studyId/checkpoints/:cpId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { actual_date, status, results, pass_fail, tested_by, notes } = req.body;
    await pool.query(
      `UPDATE rnd_stability_checkpoints SET actual_date=?, status=?, results=?, pass_fail=?, tested_by=?, notes=? WHERE id=? AND study_id=?`,
      [actual_date, status, results ? JSON.stringify(results) : null, pass_fail, tested_by, notes, req.params.cpId, req.params.studyId]
    );
    res.json({ message: 'Checkpoint updated' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// DELETE stability study
router.delete('/stability/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM rnd_stability_studies WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ==================== DASHBOARD / STATS ====================
router.get('/dashboard', authMiddleware, async (req: Request, res: Response) => {
  try {
    const [projects] = await pool.query<RowDataPacket[]>('SELECT status, COUNT(*) as count FROM rnd_projects GROUP BY status');
    const [formulations] = await pool.query<RowDataPacket[]>('SELECT status, COUNT(*) as count FROM rnd_formulations GROUP BY status');
    const [tests] = await pool.query<RowDataPacket[]>('SELECT status, COUNT(*) as count FROM rnd_lab_tests GROUP BY status');
    const [studies] = await pool.query<RowDataPacket[]>('SELECT status, COUNT(*) as count FROM rnd_stability_studies GROUP BY status');
    res.json({ data: { projects, formulations, tests, studies } });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
