import { Router, Request, Response } from 'express';
import { dbAll, dbGet, dbRun } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { canReleaseBatch, autoCreateFpa } from '../services/qc.service';

const router = Router();

const generateCode = (prefix: string) => {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${datePart}-${rand}`;
};

// QC Tests (Master Data)
router.get('/tests', authMiddleware, async (req: Request, res: Response) => {
  try {
    const tests = await dbAll(`
      SELECT * FROM qc_tests 
      ORDER BY code
    `, []);
    res.json({ data: tests });
  } catch (error) {
    console.error('Error fetching QC tests:', error);
    res.status(500).json({ error: 'Failed to fetch QC tests' });
  }
});

router.post('/tests', authMiddleware, requirePermission('quality.test-methods', 'create'), async (req: Request, res: Response) => {
  try {
    const { test_code, name, test_type, test_method, acceptance_criteria, product_id } = req.body;

    if (!test_code || !name) {
      return res.status(400).json({ error: 'test_code and name are required' });
    }

    const result = await dbRun(`
      INSERT INTO qc_tests (code, name, product_id, test_type, test_method, acceptance_criteria)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [test_code, name, product_id || null, test_type || null, test_method || null, acceptance_criteria || null]);

    res.status(201).json({
      message: 'QC test created successfully',
      data: { id: result.insertId, test_code, name }
    });
  } catch (error) {
    console.error('Error creating QC test:', error);
    res.status(500).json({ error: 'Failed to create QC test' });
  }
});

// QC Test Definitions (per product)
router.get('/test-definitions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { product_id } = req.query;

    let query = `
      SELECT qtd.*, qt.code as test_code, qt.name as test_name, qt.test_type,
             p.name as product_name, p.sku
      FROM qc_test_definitions qtd
      JOIN qc_tests qt ON qtd.test_id = qt.id
      JOIN products p ON qtd.product_id = p.id
      WHERE 1=1
    `;

    const params: any[] = [];
    if (product_id) {
      query += ` AND qtd.product_id = ?`;
      params.push(product_id);
    }

    const definitions = await dbAll(query, params);

    res.json({ data: definitions });
  } catch (error) {
    console.error('Error fetching test definitions:', error);
    res.status(500).json({ error: 'Failed to fetch test definitions' });
  }
});

router.post('/test-definitions', authMiddleware, requirePermission('quality.test-methods', 'create'), async (req: Request, res: Response) => {
  try {
    const { product_id, test_id, min_value, max_value, target_value, is_required } = req.body;

    if (!product_id || !test_id) {
      return res.status(400).json({ error: 'product_id and test_id are required' });
    }

    const result = await dbRun(`
      INSERT INTO qc_test_definitions (product_id, test_id, min_value, max_value, target_value, is_required)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      product_id, test_id,
      min_value || null, max_value || null, target_value || null,
      is_required !== undefined ? is_required : 1
    ]);

    res.status(201).json({
      message: 'Test definition created successfully',
      data: { id: result.insertId, product_id, test_id }
    });
  } catch (error) {
    console.error('Error creating test definition:', error);
    res.status(500).json({ error: 'Failed to create test definition' });
  }
});

// QC Results
router.get('/results', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { batch_id, status } = req.query;

    let query = `
      SELECT qr.*, qt.code as test_code, qt.name as test_name, qt.test_type,
             b.batch_number, p.name as product_name,
             u1.full_name as tested_by_name
      FROM qc_results qr
      JOIN qc_tests qt ON qr.qc_test_id = qt.id
      LEFT JOIN batches b ON qr.batch_id = b.id
      LEFT JOIN products p ON b.product_id = p.id
      LEFT JOIN users u1 ON qr.tested_by = u1.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (batch_id) {
      query += ` AND qr.batch_id = ?`;
      params.push(batch_id);
    }

    if (status) {
      query += ` AND qr.result_status = ?`;
      params.push(status);
    }

    query += ` ORDER BY qr.test_date DESC`;

    const results = await dbAll(query, params);

    res.json({ data: results });
  } catch (error) {
    console.error('Error fetching QC results:', error);
    res.status(500).json({ error: 'Failed to fetch QC results' });
  }
});

// legacy writable endpoints removed — all QC decisions go through FPA workflow
router.post('/results', authMiddleware, (_req: Request, res: Response) => {
  res.status(410).json({ error: 'Endpoint removed. Use FPA analysis workflow (POST /qc/fpa) to record QC results.' });
});

router.put('/results/:id/approve', authMiddleware, (_req: Request, res: Response) => {
  res.status(410).json({ error: 'Endpoint removed. Use FPA approval workflow (PUT /qc/fpa/:id/approve) instead.' });
});

router.put('/results/:id/reject', authMiddleware, (_req: Request, res: Response) => {
  res.status(410).json({ error: 'Endpoint removed. Use FPA rejection workflow (PUT /qc/fpa/:id/reject) instead.' });
});

// Batches
router.get('/batches', authMiddleware, async (req: Request, res: Response) => {
  try {
    const batches = await dbAll(
      `SELECT b.*, p.sku, p.name as product_name
       FROM batches b
       JOIN products p ON b.product_id = p.id
       ORDER BY b.created_at DESC`, []
    );
    res.json({ data: batches });
  } catch (error) {
    console.error('Error fetching batches:', error);
    res.status(500).json({ error: 'Failed to fetch batches' });
  }
});

router.get('/batches/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const batch = await dbGet(
      `SELECT b.*, p.sku, p.name as product_name
       FROM batches b
       JOIN products p ON b.product_id = p.id
       WHERE b.id = ?`, [req.params.id]
    );
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    res.json({ data: batch });
  } catch (error) {
    console.error('Error fetching batch:', error);
    res.status(500).json({ error: 'Failed to fetch batch' });
  }
});

router.post('/batches', authMiddleware, requirePermission('quality.qc-master', 'create'), async (req: Request, res: Response) => {
  try {
    const { batch_number, product_id, manufacture_date, expiry_date, mfg_date, exp_date, quantity, status } = req.body;
    if (!product_id) return res.status(400).json({ error: 'product_id is required' });
    const number = batch_number || generateCode('BATCH');
    const mfgDate = manufacture_date || mfg_date || null;
    const expDate = expiry_date || exp_date || null;
    const qty = quantity || 0;

    const result = await dbRun('INSERT INTO batches (batch_number, product_id, quantity, manufacture_date, expiry_date, mfg_date, exp_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [number, product_id, qty, mfgDate, expDate, mfgDate, expDate, status || 'open']);

    res.status(201).json({ message: 'Batch created', data: { id: result.insertId, batch_number: number } });
  } catch (error: any) {
    console.error('Error creating batch:', error);
    if (error.message?.includes('UNIQUE')) return res.status(400).json({ error: 'Batch number must be unique' });
    res.status(500).json({ error: 'Failed to create batch' });
  }
});

router.put('/batches/:id', authMiddleware, requirePermission('quality.qc-master', 'update'), async (req: Request, res: Response) => {
  try {
    const { product_id, manufacture_date, expiry_date, status } = req.body;
    await dbRun(
      'UPDATE batches SET product_id = ?, manufacture_date = ?, expiry_date = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [product_id, manufacture_date || null, expiry_date || null, status, req.params.id]
    );
    res.json({ message: 'Batch updated' });
  } catch (error) {
    console.error('Error updating batch:', error);
    res.status(500).json({ error: 'Failed to update batch' });
  }
});

// QC Tests (master)
router.get('/qc-tests', authMiddleware, async (req: Request, res: Response) => {
  try {
    const tests = await dbAll('SELECT * FROM qc_tests ORDER BY name ASC', []);
    res.json({ data: tests });
  } catch (error) {
    console.error('Error fetching QC tests:', error);
    res.status(500).json({ error: 'Failed to fetch QC tests' });
  }
});

router.post('/qc-tests', authMiddleware, requirePermission('quality.results', 'create'), async (req: Request, res: Response) => {
  try {
    const { name, code, description, product_id, test_type, test_method, acceptance_criteria } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const testCode = code || `QC-${Date.now()}`;

    const result = await dbRun(
      'INSERT INTO qc_tests (code, name, product_id, test_type, test_method, acceptance_criteria) VALUES (?, ?, ?, ?, ?, ?)',
      [testCode, name, product_id || null, test_type || null, test_method || description || null, acceptance_criteria || null]
    );
    res.status(201).json({ message: 'QC test created', data: { id: result.insertId, code: testCode, name } });
  } catch (error: any) {
    console.error('Error creating QC test:', error);
    res.status(500).json({ error: 'Failed to create QC test', detail: error?.message });
  }
});

router.put('/qc-tests/:id', authMiddleware, requirePermission('quality.results', 'update'), async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    await dbRun('UPDATE qc_tests SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      name,
      description,
      req.params.id
    ]);
    res.json({ message: 'QC test updated' });
  } catch (error) {
    console.error('Error updating QC test:', error);
    res.status(500).json({ error: 'Failed to update QC test' });
  }
});

router.delete('/qc-tests/:id', authMiddleware, requirePermission('quality.results', 'delete'), async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM qc_tests WHERE id = ?', [req.params.id]);
    res.json({ message: 'QC test deleted' });
  } catch (error) {
    console.error('Error deleting QC test:', error);
    res.status(500).json({ error: 'Failed to delete QC test' });
  }
});

// P0-E: QC Results read-only adapter over canonical FPA analysis data
router.get('/qc-results', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { batch_id } = req.query;
    let query = `
      SELECT ar.id, ar.fpa_id, ar.actual_value, ar.is_pass, ar.min_value, ar.max_value,
             ar.standard_value, ar.uom, ar.param_type, ar.notes, ar.created_at,
             p.name as test_name, p.code as test_code,
             f.batch_no as batch_number, f.fpa_number, f.status as fpa_status,
             prod.name as product_name,
             u.full_name as tested_by_name,
             CASE WHEN ar.is_pass = 1 THEN 'passed' WHEN ar.is_pass = 0 THEN 'failed' ELSE 'pending' END as result_status
      FROM qc_analysis_results ar
      JOIN qc_analysis_requests f ON ar.fpa_id = f.id
      LEFT JOIN qc_parameters p ON ar.parameter_id = p.id
      LEFT JOIN products prod ON f.product_id = prod.id
      LEFT JOIN users u ON ar.analyst_id = u.id`;
    const params: any[] = [];
    if (batch_id) {
      // find batch_number from batch id
      const batch = await dbGet('SELECT batch_number FROM batches WHERE id = ?', [batch_id]) as any;
      if (batch) {
        query += ' WHERE f.batch_no = ?';
        params.push(batch.batch_number);
      }
    }
    query += ' ORDER BY ar.created_at DESC';
    const results = await dbAll(query, params);
    res.json({ data: results });
  } catch (error) {
    console.error('Error fetching QC results:', error);
    res.status(500).json({ error: 'Failed to fetch QC results' });
  }
});

// P0-E: POST/PUT qc-results removed - no manual write path bypassing FPA specs

// ============================================================
// QC Sampling Plans
// ============================================================
router.get('/sampling', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const plans = await dbAll(
      `SELECT sp.*, p.name AS product_name, p.sku,
              qt.name AS test_name, qt.code AS test_code
       FROM qc_sampling_plans sp
       LEFT JOIN products p ON sp.product_id = p.id
       LEFT JOIN qc_tests qt ON sp.test_id = qt.id
       ORDER BY sp.created_at DESC`
    );
    res.json({ success: true, data: plans });
  } catch (error) {
    console.error('Error fetching sampling plans:', error);
    res.status(500).json({ error: 'Failed to fetch sampling plans' });
  }
});

router.post('/sampling', authMiddleware, requirePermission('quality.sampling', 'create'), async (req: Request, res: Response) => {
  try {
    const { product_id, test_id, sample_size, frequency, aql_level, inspection_level, notes } = req.body;
    if (!product_id) return res.status(400).json({ error: 'product_id is required' });

    const result = await dbRun(
      `INSERT INTO qc_sampling_plans (product_id, test_id, sample_size, frequency, aql_level, inspection_level, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [product_id, test_id || null, sample_size || 1, frequency || 'per_batch', aql_level || '1.0', inspection_level || 'normal', notes || null]
    );
    res.status(201).json({ success: true, message: 'Sampling plan created', id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create sampling plan' });
  }
});

router.put('/sampling/:id', authMiddleware, requirePermission('quality.sampling', 'update'), async (req: Request, res: Response) => {
  try {
    const { product_id, test_id, sample_size, frequency, aql_level, inspection_level, notes } = req.body;
    await dbRun(
      `UPDATE qc_sampling_plans SET product_id=?, test_id=?, sample_size=?, frequency=?, aql_level=?, inspection_level=?, notes=? WHERE id=?`,
      [product_id, test_id || null, sample_size, frequency, aql_level, inspection_level, notes || null, req.params.id]
    );
    res.json({ success: true, message: 'Sampling plan updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update sampling plan' });
  }
});

router.delete('/sampling/:id', authMiddleware, requirePermission('quality.sampling', 'delete'), async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM qc_sampling_plans WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Sampling plan deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete sampling plan' });
  }
});

// ============================================================
// Batch Release
// ============================================================
router.get('/batch-release', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const batches = await dbAll(
      `SELECT b.id, b.batch_number, b.quantity, b.manufacture_date, b.expiry_date, b.status,
              p.name AS product_name, p.sku,
              w.name AS warehouse_name,
              fpa.id AS fpa_id, fpa.fpa_number, fpa.status AS fpa_status,
              (SELECT COUNT(*) FROM qc_analysis_results ar WHERE ar.fpa_id = fpa.id) AS total_tests,
              (SELECT SUM(ar.is_pass = 1) FROM qc_analysis_results ar WHERE ar.fpa_id = fpa.id) AS tests_passed,
              (SELECT SUM(ar.is_pass = 0) FROM qc_analysis_results ar WHERE ar.fpa_id = fpa.id) AS tests_failed
       FROM batches b
       JOIN products p ON p.id = b.product_id
       LEFT JOIN warehouses w ON w.id = b.warehouse_id
       LEFT JOIN qc_analysis_requests fpa ON fpa.batch_no = b.batch_number
         AND (fpa.needs_resampling = 0 OR fpa.needs_resampling IS NULL)
         AND fpa.id = (
           SELECT MAX(f2.id) FROM qc_analysis_requests f2
           WHERE f2.batch_no = b.batch_number
             AND (f2.needs_resampling = 0 OR f2.needs_resampling IS NULL)
         )
       ORDER BY b.created_at DESC`
    );
    res.json({ success: true, data: batches });
  } catch (error) {
    console.error('Error fetching batch release data:', error);
    res.status(500).json({ error: 'Failed to fetch batch release data' });
  }
});

router.post('/batch-release/:batchId/release', authMiddleware, requirePermission('quality.batch-release', 'approve_2'), async (req: Request, res: Response) => {
  try {
    const batchId = Number(req.params.batchId);
    const userId = (req as any).user?.userId || null;
    const { notes } = req.body;

    const gate = await canReleaseBatch(batchId);
    if (!gate.allowed && gate.reason !== 'Already released (idempotent)') {
      return res.status(400).json({ success: false, error: gate.reason });
    }

    // idempotent: if already released, return success
    const batch = await dbGet('SELECT status FROM batches WHERE id = ?', [batchId]) as any;
    if (batch && batch.status === 'released') {
      return res.json({ success: true, message: 'Batch already released' });
    }

    await dbRun(
      `UPDATE batches SET status = 'released', released_by = ?, released_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [userId, batchId]
    );
    res.json({ success: true, message: 'Batch released' });
  } catch (error) {
    console.error('Error releasing batch:', error);
    res.status(500).json({ error: 'Failed to release batch' });
  }
});

router.post('/batch-release/:batchId/reject', authMiddleware, requirePermission('quality.batch-release', 'approve_1'), async (req: Request, res: Response) => {
  try {
    const { notes } = req.body;
    await dbRun(
      `UPDATE batches SET status = 'rejected', qc_status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [req.params.batchId]
    );
    res.json({ success: true, message: 'Batch rejected' });
  } catch (error) {
    console.error('Error rejecting batch:', error);
    res.status(500).json({ error: 'Failed to reject batch' });
  }
});

router.post('/batch-release/:batchId/hold', authMiddleware, requirePermission('quality.batch-release', 'approve_1'), async (req: Request, res: Response) => {
  try {
    await dbRun(
      `UPDATE batches SET status = 'on_hold', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [req.params.batchId]
    );
    res.json({ success: true, message: 'Batch put on hold' });
  } catch (error) {
    console.error('Error holding batch:', error);
    res.status(500).json({ error: 'Failed to hold batch' });
  }
});

// ============================================================
// Non-Conformance Reports (NCR)
// ============================================================
router.get('/ncr', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const ncrs = await dbAll(
      `SELECT n.*, p.name AS product_name, b.batch_number,
              COALESCE(u1.full_name, u1.username) AS reported_by_name,
              COALESCE(u2.full_name, u2.username) AS assigned_to_name
       FROM qc_ncr n
       LEFT JOIN products p ON p.id = n.product_id
       LEFT JOIN batches b ON b.id = n.batch_id
       LEFT JOIN users u1 ON u1.id = n.reported_by
       LEFT JOIN users u2 ON u2.id = n.assigned_to
       ORDER BY n.created_at DESC`
    );
    res.json({ success: true, data: ncrs });
  } catch (error) {
    console.error('Error fetching NCRs:', error);
    res.status(500).json({ error: 'Failed to fetch NCRs' });
  }
});

router.get('/ncr/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const ncr = await dbGet(
      `SELECT n.*, p.name AS product_name, b.batch_number,
              COALESCE(u1.full_name, u1.username) AS reported_by_name
       FROM qc_ncr n
       LEFT JOIN products p ON p.id = n.product_id
       LEFT JOIN batches b ON b.id = n.batch_id
       LEFT JOIN users u1 ON u1.id = n.reported_by
       WHERE n.id = ?`,
      [req.params.id]
    );
    if (!ncr) return res.status(404).json({ error: 'NCR not found' });

    const actions = await dbAll(
      `SELECT a.*, COALESCE(u.full_name, u.username) AS action_by_name
       FROM qc_ncr_actions a LEFT JOIN users u ON u.id = a.action_by WHERE a.ncr_id = ? ORDER BY a.created_at ASC`,
      [req.params.id]
    );

    // load source FPA details
    let sourceFpa = null;
    if ((ncr as any).source_fpa_id) {
      sourceFpa = await dbGet(
        `SELECT id, fpa_number, type, status, result, batch_no, created_at
         FROM qc_analysis_requests WHERE id = ?`,
        [(ncr as any).source_fpa_id]
      );
    }

    // load linked rework orders
    const reworks = await dbAll(
      `SELECT r.*, COALESCE(u.full_name, u.username) AS created_by_name,
              f.fpa_number AS retest_fpa_number, f.status AS retest_fpa_status, f.result AS retest_fpa_result
       FROM qc_rework_orders r
       LEFT JOIN users u ON u.id = r.created_by
       LEFT JOIN qc_analysis_requests f ON f.id = r.retest_fpa_id
       WHERE r.ncr_id = ? ORDER BY r.created_at ASC`,
      [req.params.id]
    );

    res.json({ success: true, data: { ...ncr, actions, sourceFpa, reworks } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch NCR' });
  }
});

router.post('/ncr', authMiddleware, requirePermission('quality.ncr', 'create'), async (req: Request, res: Response) => {
  try {
    const { ncr_number, product_id, batch_id, category, severity, description, root_cause, assigned_to } = req.body;
    if (!description) return res.status(400).json({ error: 'description is required' });

    const userId = (req as any).user?.userId;
    const number = ncr_number || generateCode('NCR');

    const result = await dbRun(
      `INSERT INTO qc_ncr (ncr_number, product_id, batch_id, category, severity, description, root_cause, status, reported_by, assigned_to)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
      [number, product_id || null, batch_id || null, category || 'product', severity || 'minor', description, root_cause || null, userId, assigned_to || null]
    );
    res.status(201).json({ success: true, message: 'NCR created', id: result.insertId });
  } catch (error) {
    console.error('Error creating NCR:', error);
    res.status(500).json({ error: 'Failed to create NCR' });
  }
});

router.put('/ncr/:id', authMiddleware, requirePermission('quality.ncr', 'update'), async (req: Request, res: Response) => {
  try {
    const { category, severity, description, root_cause, corrective_action, preventive_action, status, assigned_to } = req.body;
    await dbRun(
      `UPDATE qc_ncr SET category=?, severity=?, description=?, root_cause=?, corrective_action=?, preventive_action=?, status=?, assigned_to=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [category, severity, description, root_cause || null, corrective_action || null, preventive_action || null, status, assigned_to || null, req.params.id]
    );
    res.json({ success: true, message: 'NCR updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update NCR' });
  }
});

router.post('/ncr/:id/actions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { action_type, description, due_date } = req.body;
    const userId = (req as any).user?.userId;
    const result = await dbRun(
      `INSERT INTO qc_ncr_actions (ncr_id, action_type, description, due_date, status, action_by)
       VALUES (?, ?, ?, ?, 'open', ?)`,
      [req.params.id, action_type || 'corrective', description, due_date || null, userId]
    );
    res.status(201).json({ success: true, message: 'Action added', id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add action' });
  }
});

// ============================================================
// Rework Orders
// ============================================================
router.get('/rework', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const reworks = await dbAll(
      `SELECT r.*, n.ncr_number, p.name AS product_name, b.batch_number,
              w.wo_number,
              COALESCE(u.full_name, u.username) AS created_by_name,
              f.fpa_number AS retest_fpa_number, f.status AS retest_fpa_status, f.result AS retest_fpa_result
       FROM qc_rework_orders r
       LEFT JOIN qc_ncr n ON n.id = r.ncr_id
       LEFT JOIN products p ON p.id = r.product_id
       LEFT JOIN batches b ON b.id = r.batch_id
       LEFT JOIN work_orders w ON w.id = r.wo_id
       LEFT JOIN users u ON u.id = r.created_by
       LEFT JOIN qc_analysis_requests f ON f.id = r.retest_fpa_id
       ORDER BY r.created_at DESC`
    );
    res.json({ success: true, data: reworks });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch rework orders' });
  }
});

router.post('/rework', authMiddleware, requirePermission('quality.rework', 'create'), async (req: Request, res: Response) => {
  try {
    const { ncr_id, product_id, batch_id, wo_id, quantity, description, instructions } = req.body;
    const userId = (req as any).user?.userId;
    const reworkNumber = generateCode('RW');

    const result = await dbRun(
      `INSERT INTO qc_rework_orders (rework_number, ncr_id, product_id, batch_id, wo_id, quantity, description, instructions, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [reworkNumber, ncr_id || null, product_id || null, batch_id || null, wo_id || null, quantity || 0, description || null, instructions || null, userId]
    );
    res.status(201).json({ success: true, message: 'Rework order created', id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create rework order' });
  }
});

router.put('/rework/:id/status', authMiddleware, requirePermission('quality.rework', 'update'), async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const reworkId = Number(req.params.id);
    const userId = (req as any).user?.userId || null;
    await dbRun('UPDATE qc_rework_orders SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [status, reworkId]);

    // when rework completed, auto-create re-test FPA
    let retestFpa: { fpaId: number; fpaNumber: string } | null = null;
    if (status === 'completed') {
      try {
        const rework = await dbGet(
          `SELECT r.*, b.batch_number FROM qc_rework_orders r
           LEFT JOIN batches b ON b.id = r.batch_id
           WHERE r.id = ?`,
          [reworkId]
        ) as any;
        if (rework && rework.product_id) {
          retestFpa = await autoCreateFpa({
            type: 'FG',
            productId: rework.product_id,
            batchNo: rework.batch_number || null,
            woId: rework.wo_id || null,
            notes: `Re-test after rework ${rework.rework_number || reworkId}`,
            createdBy: userId,
            quantity: rework.quantity || null
          });
          if (retestFpa) {
            await dbRun('UPDATE qc_rework_orders SET retest_fpa_id = ? WHERE id = ?', [retestFpa.fpaId, reworkId]);
          }
        }
        // update linked NCR status to investigating
        if (rework && rework.ncr_id) {
          await dbRun(
            "UPDATE qc_ncr SET status = 'investigating', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'open'",
            [rework.ncr_id]
          );
        }
      } catch (retestErr: any) {
        console.error('Failed to auto-create re-test FPA on rework complete:', retestErr.message);
      }
    }

    res.json({
      success: true,
      message: 'Rework status updated' + (retestFpa ? `, re-test FPA ${retestFpa.fpaNumber} created` : ''),
      retest_fpa: retestFpa
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update rework status' });
  }
});

// close NCR with verification
router.put('/ncr/:id/close', authMiddleware, requirePermission('quality.ncr', 'update'), async (req: Request, res: Response) => {
  try {
    const ncrId = Number(req.params.id);
    const userId = (req as any).user?.userId || null;
    const { close_notes } = req.body;

    // check all CAPA actions are completed
    const openActions = await dbAll(
      "SELECT id FROM qc_ncr_actions WHERE ncr_id = ? AND status != 'completed'",
      [ncrId]
    ) as any[];

    if (openActions.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot close NCR: ${openActions.length} CAPA action(s) still open`
      });
    }

    await dbRun(
      `UPDATE qc_ncr SET status = 'closed', corrective_action = COALESCE(corrective_action, ''),
       updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [ncrId]
    );
    res.json({ success: true, message: 'NCR closed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to close NCR' });
  }
});

// complete a CAPA action
router.put('/ncr/:ncrId/actions/:actionId/complete', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { actionId } = req.params;
    const userId = (req as any).user?.userId || null;
    await dbRun(
      "UPDATE qc_ncr_actions SET status = 'completed', completed_at = CURRENT_TIMESTAMP, completed_by = ? WHERE id = ?",
      [userId, actionId]
    );
    res.json({ success: true, message: 'Action completed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to complete action' });
  }
});

// ============================================================
// QC Reports — aggregated stats
// ============================================================
router.get('/reports/summary', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const stats = await dbGet(
      `SELECT
         (SELECT COUNT(*) FROM batches) AS total_batches,
         (SELECT COUNT(*) FROM batches WHERE status='released') AS released_batches,
         (SELECT COUNT(*) FROM batches WHERE status='rejected') AS rejected_batches,
         (SELECT COUNT(*) FROM qc_results) AS total_tests,
         (SELECT COUNT(*) FROM qc_results WHERE result_status='passed') AS passed_tests,
         (SELECT COUNT(*) FROM qc_results WHERE result_status='failed') AS failed_tests,
         (SELECT COUNT(*) FROM qc_ncr WHERE status='open') AS open_ncrs`
    );
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch QC report summary' });
  }
});

export default router;
