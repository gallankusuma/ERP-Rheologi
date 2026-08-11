import { Router, Request, Response } from 'express';
import { dbAll, dbGet, dbRun } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { resolveAndSync, evaluateAllResults, evaluateResult, syncCheckpoint } from '../services/qc.service';

const router = Router();

// Utility for generating FPA numbers
const generateFPANumber = (type: string) => {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(100 + Math.random() * 900);
  return `FPA-${type}-${datePart}-${rand}`;
};

// ============================================================
// MASTER DATA
// ============================================================

// --- Parameters ---
router.get('/parameters', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = await dbAll('SELECT * FROM qc_parameters ORDER BY name ASC');
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch parameters' });
  }
});

router.post('/parameters', authMiddleware, requirePermission('quality.qc-master', 'create'), async (req: Request, res: Response) => {
  try {
    const { name, description, code, param_type } = req.body;
    const result = await dbRun(
      'INSERT INTO qc_parameters (name, description, code, param_type) VALUES (?, ?, ?, ?)',
      [name, description || null, code || null, param_type || 'quantitative']
    );
    res.status(201).json({ success: true, message: 'Parameter created', id: result.insertId });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create parameter' });
  }
});

router.put('/parameters/:id', authMiddleware, requirePermission('quality.qc-master', 'update'), async (req: Request, res: Response) => {
  try {
    const { name, description, code, param_type } = req.body;
    await dbRun(
      'UPDATE qc_parameters SET name=?, description=?, code=?, param_type=? WHERE id=?',
      [name, description || null, code || null, param_type || 'quantitative', req.params.id]
    );
    res.json({ success: true, message: 'Parameter updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update parameter' });
  }
});

router.delete('/parameters/:id', authMiddleware, requirePermission('quality.qc-master', 'delete'), async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM qc_parameters WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Parameter deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete parameter' });
  }
});

// --- Methods ---
router.get('/methods', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = await dbAll('SELECT * FROM qc_methods ORDER BY name ASC');
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch methods' });
  }
});

router.post('/methods', authMiddleware, requirePermission('quality.qc-master', 'create'), async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const result = await dbRun('INSERT INTO qc_methods (name, description) VALUES (?, ?)', [name, description]);
    res.status(201).json({ success: true, message: 'Method created', id: result.insertId });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create method' });
  }
});

router.put('/methods/:id', authMiddleware, requirePermission('quality.qc-master', 'update'), async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    await dbRun('UPDATE qc_methods SET name=?, description=? WHERE id=?', [name, description, req.params.id]);
    res.json({ success: true, message: 'Method updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update method' });
  }
});

router.delete('/methods/:id', authMiddleware, requirePermission('quality.qc-master', 'delete'), async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM qc_methods WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Method deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete method' });
  }
});

// --- Instruments ---
router.get('/instruments', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = await dbAll('SELECT * FROM qc_instruments ORDER BY name ASC');
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch instruments' });
  }
});

router.post('/instruments', authMiddleware, requirePermission('quality.qc-master', 'create'), async (req: Request, res: Response) => {
  try {
    const { name, calibration_date } = req.body;
    const result = await dbRun('INSERT INTO qc_instruments (name, calibration_date) VALUES (?, ?)', [name, calibration_date]);
    res.status(201).json({ success: true, message: 'Instrument created', id: result.insertId });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create instrument' });
  }
});

router.put('/instruments/:id', authMiddleware, requirePermission('quality.qc-master', 'update'), async (req: Request, res: Response) => {
  try {
    const { name, calibration_date } = req.body;
    await dbRun('UPDATE qc_instruments SET name=?, calibration_date=? WHERE id=?', [name, calibration_date, req.params.id]);
    res.json({ success: true, message: 'Instrument updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update instrument' });
  }
});

router.delete('/instruments/:id', authMiddleware, requirePermission('quality.qc-master', 'delete'), async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM qc_instruments WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Instrument deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete instrument' });
  }
});

// --- Sampling Areas ---
router.get('/areas', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = await dbAll('SELECT * FROM qc_sampling_areas ORDER BY name ASC');
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch sampling areas' });
  }
});

router.post('/areas', authMiddleware, requirePermission('quality.qc-master', 'create'), async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const result = await dbRun('INSERT INTO qc_sampling_areas (name) VALUES (?)', [name]);
    res.status(201).json({ success: true, message: 'Area created', id: result.insertId });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create area' });
  }
});

router.put('/areas/:id', authMiddleware, requirePermission('quality.qc-master', 'update'), async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    await dbRun('UPDATE qc_sampling_areas SET name=? WHERE id=?', [name, req.params.id]);
    res.json({ success: true, message: 'Area updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update area' });
  }
});

router.delete('/areas/:id', authMiddleware, requirePermission('quality.qc-master', 'delete'), async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM qc_sampling_areas WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Area deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete area' });
  }
});


// ============================================================
// QC SPECIFICATIONS (Per Item)
// ============================================================
router.get('/specs/:product_id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const qcType = req.query.qc_type as string || null;
    let query = `
      SELECT s.*, p.name as parameter_name, m.name as method_name
      FROM qc_specifications s
      JOIN qc_parameters p ON s.parameter_id = p.id
      LEFT JOIN qc_methods m ON s.method_id = m.id
      WHERE s.product_id = ?
    `;
    const params: any[] = [req.params.product_id];
    if (qcType) {
      query += ' AND s.qc_type = ?';
      params.push(qcType);
    }
    query += ' ORDER BY p.name ASC';
    const data = await dbAll(query, params);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch specs' });
  }
});

router.post('/specs', authMiddleware, requirePermission('quality.qc-master', 'create'), async (req: Request, res: Response) => {
  try {
    const { product_id, qc_type, parameter_id, method_id, standard_value, min_value, max_value, uom, is_required } = req.body;
    const safeMin = (min_value !== undefined && min_value !== null && min_value !== '') ? min_value : null;
    const safeMax = (max_value !== undefined && max_value !== null && max_value !== '') ? max_value : null;
    const result = await dbRun(
      'INSERT INTO qc_specifications (product_id, qc_type, parameter_id, method_id, standard_value, min_value, max_value, uom, is_required) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [product_id, qc_type || 'Incoming', parameter_id, method_id || null, standard_value || null, safeMin, safeMax, uom || null, is_required !== undefined ? is_required : 1]
    );
    res.status(201).json({ success: true, message: 'Spec created', id: result.insertId });
  } catch (error: any) {
    console.error('Spec creation error:', error?.message || error);
    res.status(500).json({ success: false, error: 'Failed to create spec', detail: error?.message });
  }
});

router.put('/specs/:id', authMiddleware, requirePermission('quality.qc-master', 'update'), async (req: Request, res: Response) => {
  try {
    const { parameter_id, method_id, standard_value, min_value, max_value, qc_type, uom, is_required } = req.body;
    const safeMin = (min_value !== undefined && min_value !== null && min_value !== '') ? min_value : null;
    const safeMax = (max_value !== undefined && max_value !== null && max_value !== '') ? max_value : null;
    await dbRun(
      'UPDATE qc_specifications SET parameter_id=?, method_id=?, standard_value=?, min_value=?, max_value=?, qc_type=?, uom=?, is_required=? WHERE id=?',
      [parameter_id, method_id || null, standard_value || null, safeMin, safeMax, qc_type || 'Incoming', uom || null, is_required !== undefined ? is_required : 1, req.params.id]
    );
    res.json({ success: true, message: 'Spec updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update spec' });
  }
});

router.delete('/specs/:id', authMiddleware, requirePermission('quality.qc-master', 'delete'), async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM qc_specifications WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Spec deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete spec' });
  }
});

// ============================================================
// ANALYSIS REQUESTS (FPA)
// ============================================================
router.get('/fpa', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = await dbAll(`
      SELECT f.*, p.name as product_name, p.sku as product_sku, a.name as area_name, u.full_name as created_by_name
      FROM qc_analysis_requests f
      LEFT JOIN products p ON f.product_id = p.id
      LEFT JOIN qc_sampling_areas a ON f.sampling_area_id = a.id
      LEFT JOIN users u ON f.created_by = u.id
      ORDER BY f.created_at DESC
    `);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch FPAs' });
  }
});

router.post('/fpa', authMiddleware, requirePermission('quality.qc-fpa', 'create'), async (req: Request, res: Response) => {
  try {
    const { type, reference_id, reference_number, product_id, sampling_area_id, batch_no, quantity, supplier_id, notes, wo_id } = req.body;

    // validate product_id is present and numeric
    if (!product_id || isNaN(Number(product_id))) {
      return res.status(400).json({ success: false, error: 'product_id is required' });
    }

    const fpa_number = generateFPANumber(type || 'INC');
    const userId = (req as any).user?.userId || null;
    
    const result = await dbRun(
      'INSERT INTO qc_analysis_requests (fpa_number, type, reference_id, reference_number, product_id, sampling_area_id, batch_no, quantity, supplier_id, notes, created_by, wo_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [fpa_number, type || 'Incoming', reference_id || null, reference_number || null, product_id || null, sampling_area_id || null, batch_no || null, quantity || null, supplier_id || null, notes || null, userId, wo_id || null]
    );
    
    // snapshot specs into qc_analysis_results with full spec data including is_required and param_type
    const specs = await dbAll(
      `SELECT s.*, p.param_type FROM qc_specifications s
       JOIN qc_parameters p ON s.parameter_id = p.id
       WHERE s.product_id = ? AND (s.qc_type = ? OR s.qc_type IS NULL)`,
      [product_id, type || 'Incoming']
    ) as any[];
    for (const spec of specs) {
      await dbRun(
        `INSERT INTO qc_analysis_results
         (fpa_id, parameter_id, method_id, standard_value, min_value, max_value, uom, qc_type, specification_id, is_required, param_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [result.insertId, spec.parameter_id, spec.method_id || null,
         spec.standard_value || null, spec.min_value ?? null, spec.max_value ?? null,
         spec.uom || null, spec.qc_type || null, spec.id,
         spec.is_required !== undefined ? spec.is_required : 1,
         spec.param_type || 'quantitative']
      );
    }
    
    res.status(201).json({ success: true, message: 'FPA created', id: result.insertId, fpa_number });
  } catch (error: any) {
    console.error('FPA creation error:', error?.message || error);
    res.status(500).json({ success: false, error: 'Failed to create FPA', detail: error?.message });
  }
});

router.get('/fpa/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const fpa = await dbGet(`
      SELECT f.*, p.name as product_name, p.sku as product_sku, a.name as area_name
      FROM qc_analysis_requests f
      LEFT JOIN products p ON f.product_id = p.id
      LEFT JOIN qc_sampling_areas a ON f.sampling_area_id = a.id
      WHERE f.id = ?
    `, [req.params.id]) as any;
    
    if (!fpa) return res.status(404).json({ success: false, error: 'FPA not found' });
    
    // load sampling points: self + children (same parent chain)
    const rootId = fpa.parent_fpa_id || fpa.id;
    const samplingPoints = await dbAll(`
      SELECT sp.*,
             u1.full_name as approver1_name,
             u2.full_name as approver2_name
      FROM qc_analysis_requests sp
      LEFT JOIN users u1 ON sp.approved_by_1 = u1.id
      LEFT JOIN users u2 ON sp.approved_by_2 = u2.id
      WHERE sp.id = ? OR sp.parent_fpa_id = ? OR sp.id = ?
      ORDER BY sp.sampling_run ASC
    `, [rootId, rootId, fpa.id]) as any[];
    
    // load results for each sampling point using snapshot values
    for (const sp of samplingPoints) {
      sp.results = await dbAll(`
        SELECT r.*, p.name as parameter_name, p.code as parameter_code, p.param_type,
               r.standard_value, r.min_value, r.max_value, r.uom,
               m.name as method_name, i.name as instrument_name,
               u.full_name as analyst_name
        FROM qc_analysis_results r
        JOIN qc_parameters p ON r.parameter_id = p.id
        LEFT JOIN qc_methods m ON r.method_id = m.id
        LEFT JOIN qc_instruments i ON r.instrument_id = i.id
        LEFT JOIN users u ON r.analyst_id = u.id
        WHERE r.fpa_id = ?
        ORDER BY p.name ASC
      `, [sp.id]);
    }
    
    // load instruments and analysts for dropdowns
    const instruments = await dbAll('SELECT id, name FROM qc_instruments ORDER BY name ASC');
    const analysts = await dbAll(`
      SELECT DISTINCT u.id, u.full_name as name
      FROM users u
      INNER JOIN qc_user_areas ua ON u.id = ua.user_id
      ORDER BY u.full_name ASC
    `);
    
    // load results for the master FPA itself (backward compat)
    const results = await dbAll(`
      SELECT r.*, p.name as parameter_name, p.code as parameter_code, p.param_type,
             r.standard_value, r.min_value, r.max_value, r.uom,
             m.name as method_name, i.name as instrument_name
      FROM qc_analysis_results r
      JOIN qc_parameters p ON r.parameter_id = p.id
      LEFT JOIN qc_methods m ON r.method_id = m.id
      LEFT JOIN qc_instruments i ON r.instrument_id = i.id
      WHERE r.fpa_id = ?
      ORDER BY p.name ASC
    `, [req.params.id]);
    
    res.json({ success: true, data: { ...fpa, results, samplingPoints, instruments, analysts } });
  } catch (error) {
    console.error('Error fetching FPA detail:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch FPA detail' });
  }
});

router.put('/fpa/:id/results', authMiddleware, requirePermission('quality.qc-fpa', 'update'), async (req: Request, res: Response) => {
  try {
    const { results, status, analysis_notes, data_complete } = req.body;
    const fpaId = Number(req.params.id);
    
    // update FPA status fields
    const updateFields: string[] = [];
    const updateParams: any[] = [];
    if (status !== undefined) { updateFields.push('status = ?'); updateParams.push(status); }
    if (analysis_notes !== undefined) { updateFields.push('analysis_notes = ?'); updateParams.push(analysis_notes); }
    if (data_complete !== undefined) { updateFields.push('data_complete = ?'); updateParams.push(data_complete ? 1 : 0); }
    if (updateFields.length) {
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateParams.push(fpaId);
      await dbRun(`UPDATE qc_analysis_requests SET ${updateFields.join(', ')} WHERE id = ?`, updateParams);
    }
    
    // update individual results with server-side pass/fail evaluation
    if (results && Array.isArray(results)) {
      for (const r of results) {
        // load snapshot values for server-side evaluation (uses pinned data, not live master)
        const existing = await dbGet(
          'SELECT min_value, max_value, standard_value, param_type FROM qc_analysis_results WHERE id = ?', [r.id]
        ) as any;
        
        // use pinned param_type from snapshot
        const paramType = existing?.param_type || 'quantitative';
        
        // compute is_pass server-side
        let isPass = r.is_pass;
        if (existing && r.actual_value !== null && r.actual_value !== undefined && r.actual_value !== '') {
          const serverPass = evaluateResult(
            r.actual_value,
            existing.min_value, existing.max_value,
            existing.standard_value, paramType
          );
          if (serverPass !== null) isPass = serverPass;
        }
        
        await dbRun(
          `UPDATE qc_analysis_results SET instrument_id=?, actual_value=?, is_pass=?,
           saplo=?, duplo=?, analyst_id=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
          [r.instrument_id || null, r.actual_value ?? null,
           isPass === undefined ? null : isPass,
           r.saplo ?? null, r.duplo ?? null,
           r.analyst_id || null, r.notes || null, r.id]
        );
      }
    }

    // resolve canonical status and sync checkpoint
    await resolveAndSync(fpaId);
    
    res.json({ success: true, message: 'FPA updated' });
  } catch (error) {
    console.error('Error updating FPA:', error);
    res.status(500).json({ success: false, error: 'Failed to update FPA' });
  }
});

// --- User Area Sampling ---
router.get('/user-areas', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = await dbAll(`
      SELECT ua.id, ua.user_id, ua.area_id, u.full_name as user_name, a.name as area_name
      FROM qc_user_areas ua
      JOIN users u ON ua.user_id = u.id
      JOIN qc_sampling_areas a ON ua.area_id = a.id
      ORDER BY u.full_name ASC
    `);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch user areas' });
  }
});

router.post('/user-areas', authMiddleware, requirePermission('quality.qc-fpa', 'create'), async (req: Request, res: Response) => {
  try {
    const { user_id, area_ids } = req.body;
    // Delete existing assignments for this user
    await dbRun('DELETE FROM qc_user_areas WHERE user_id = ?', [user_id]);
    // Insert new assignments
    for (const area_id of (area_ids || [])) {
      await dbRun('INSERT INTO qc_user_areas (user_id, area_id) VALUES (?, ?)', [user_id, area_id]);
    }
    res.json({ success: true, message: 'User areas updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update user areas' });
  }
});

router.delete('/user-areas/:id', authMiddleware, requirePermission('quality.qc-fpa', 'delete'), async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM qc_user_areas WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'User area deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete user area' });
  }
});

// --- FPA Approval Workflow ---
router.put('/fpa/:id/submit', authMiddleware, requirePermission('quality.qc-fpa', 'update'), async (req: Request, res: Response) => {
  try {
    await dbRun(
      'UPDATE qc_analysis_requests SET status = "Review", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [req.params.id]
    );
    res.json({ success: true, message: 'FPA submitted for review' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to submit FPA' });
  }
});

// P0-A: approve guards with result evaluation first
router.put('/fpa/:id/approve', authMiddleware, requirePermission('quality.qc-fpa', 'update'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || null;
    const fpaId = Number(req.params.id);
    const { review_notes } = req.body;

    // guard: all required pinned results must pass
    const analysis = await evaluateAllResults(fpaId);
    if (analysis !== 'passed') {
      return res.status(400).json({
        success: false,
        error: `Cannot approve: analysis results are '${analysis}'. All required results must pass.`
      });
    }

    await dbRun(
      `UPDATE qc_analysis_requests SET status = 'Approved', result = 'Passed',
       reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [userId, review_notes || null, fpaId]
    );
    // sync batch qc_status
    const fpa = await dbGet('SELECT * FROM qc_analysis_requests WHERE id = ?', [fpaId]) as any;
    if (fpa && fpa.batch_no) {
      await dbRun('UPDATE batches SET qc_status = ? WHERE batch_number = ?', ['passed', fpa.batch_no]);
    }
    // sync checkpoint explicitly passed
    await syncCheckpoint(fpaId, 'passed');
    res.json({ success: true, message: 'FPA approved' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to approve FPA' });
  }
});

// reject FPA
router.put('/fpa/:id/reject', authMiddleware, requirePermission('quality.qc-fpa', 'update'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || null;
    const fpaId = Number(req.params.id);
    const { review_notes } = req.body;
    await dbRun(
      `UPDATE qc_analysis_requests SET status = 'Rejected', result = 'Failed',
       reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [userId, review_notes || null, fpaId]
    );
    const fpa = await dbGet('SELECT * FROM qc_analysis_requests WHERE id = ?', [fpaId]) as any;
    if (fpa && fpa.batch_no) {
      await dbRun('UPDATE batches SET qc_status = ? WHERE batch_number = ?', ['failed', fpa.batch_no]);
    }
    // explicitly sync failed to checkpoint
    await syncCheckpoint(fpaId, 'failed');

    res.json({ success: true, message: 'FPA rejected' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to reject FPA' });
  }
});

// P0-A: resample explicitly syncs pending
router.put('/fpa/:id/resample', authMiddleware, requirePermission('quality.qc-fpa', 'update'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || null;
    const fpaId = Number(req.params.id);
    const { review_notes } = req.body;
    await dbRun(
      `UPDATE qc_analysis_requests SET status = 'Resampling', needs_resampling = 1,
       reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [userId, review_notes || null, fpaId]
    );
    // explicitly sync pending to checkpoint
    await syncCheckpoint(fpaId, 'pending');
    res.json({ success: true, message: 'FPA sent for resampling' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to resample FPA' });
  }
});

// P0-3: save general FPA fields
router.put('/fpa/:id/general', authMiddleware, requirePermission('quality.qc-fpa', 'update'), async (req: Request, res: Response) => {
  try {
    const { sampling_qty, sampling_unit, sampling_point, process_type, sample_type, specification_doc } = req.body;
    await dbRun(
      `UPDATE qc_analysis_requests SET sampling_qty=?, sampling_unit=?, sampling_point=?,
       process_type=?, sample_type=?, specification_doc=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [sampling_qty ?? null, sampling_unit || null, sampling_point || null,
       process_type || null, sample_type || null, specification_doc || null, req.params.id]
    );
    res.json({ success: true, message: 'General info saved' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to save general info' });
  }
});

// P0-3: receive sample
router.put('/fpa/:id/receive-sample', authMiddleware, requirePermission('quality.qc-fpa', 'update'), async (req: Request, res: Response) => {
  try {
    await dbRun(
      `UPDATE qc_analysis_requests SET status = 'Sample Diterima', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [req.params.id]
    );
    res.json({ success: true, message: 'Sample received' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to receive sample' });
  }
});

// P0-3: approve level 1
router.put('/fpa/:id/approve-1', authMiddleware, requirePermission('quality.qc-fpa', 'update'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || null;
    const fpaId = Number(req.params.id);
    const fpa = await dbGet('SELECT * FROM qc_analysis_requests WHERE id = ?', [fpaId]) as any;
    if (!fpa) return res.status(404).json({ success: false, error: 'FPA not found' });
    if (!fpa.data_complete) return res.status(400).json({ success: false, error: 'Data not complete — cannot approve' });
    
    await dbRun(
      `UPDATE qc_analysis_requests SET approved_by_1 = ?, approved_at_1 = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [userId, fpaId]
    );
    res.json({ success: true, message: 'Approve #1 completed' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to approve #1' });
  }
});

// P0-A: approve level 2 — guards with result evaluation, triggers final resolution
router.put('/fpa/:id/approve-2', authMiddleware, requirePermission('quality.qc-fpa', 'update'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || null;
    const fpaId = Number(req.params.id);
    const fpa = await dbGet('SELECT * FROM qc_analysis_requests WHERE id = ?', [fpaId]) as any;
    if (!fpa) return res.status(404).json({ success: false, error: 'FPA not found' });
    if (!fpa.approved_by_1) return res.status(400).json({ success: false, error: 'Approve #1 must be completed first' });
    
    // P0-A: guard - all required pinned results must pass before final approval
    const analysis = await evaluateAllResults(fpaId);
    if (analysis !== 'passed') {
      return res.status(400).json({
        success: false,
        error: `Cannot approve: analysis results are '${analysis}'. All required results must pass.`
      });
    }
    
    await dbRun(
      `UPDATE qc_analysis_requests SET approved_by_2 = ?, approved_at_2 = CURRENT_TIMESTAMP,
       status = 'Approved', result = 'Passed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [userId, fpaId]
    );
    
    // sync batch and checkpoint explicitly passed
    if (fpa.batch_no) {
      await dbRun('UPDATE batches SET qc_status = ? WHERE batch_number = ?', ['passed', fpa.batch_no]);
    }
    await syncCheckpoint(fpaId, 'passed');
    
    res.json({ success: true, message: 'Approve #2 completed - FPA approved' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to approve #2' });
  }
});

// P0-B: create new resampling run (child FPA) + re-point checkpoint
router.post('/fpa/:id/new-run', authMiddleware, requirePermission('quality.qc-fpa', 'create'), async (req: Request, res: Response) => {
  try {
    const parentId = Number(req.params.id);
    const parent = await dbGet('SELECT * FROM qc_analysis_requests WHERE id = ?', [parentId]) as any;
    if (!parent) return res.status(404).json({ success: false, error: 'Parent FPA not found' });
    
    const userId = (req as any).user?.userId || null;
    const newRun = (parent.sampling_run || 1) + 1;
    const fpaNumber = generateFPANumber(parent.type || 'LP');
    const rootId = parent.parent_fpa_id || parent.id;
    
    // mark parent as needs_resampling
    await dbRun(
      'UPDATE qc_analysis_requests SET needs_resampling = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [parentId]
    );
    
    // create child FPA
    const result = await dbRun(
      `INSERT INTO qc_analysis_requests
       (fpa_number, type, reference_id, reference_number, product_id, sampling_area_id,
        batch_no, quantity, supplier_id, notes, created_by, wo_id, sampling_run, parent_fpa_id,
        specification_doc, sampling_point, sampling_qty, sampling_unit, process_type, sample_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [fpaNumber, parent.type, parent.reference_id, parent.reference_number, parent.product_id,
       parent.sampling_area_id, parent.batch_no, parent.quantity, parent.supplier_id,
       `Resampling run #${newRun} from ${parent.fpa_number}`, userId, parent.wo_id,
       newRun, rootId, parent.specification_doc, parent.sampling_point,
       parent.sampling_qty, parent.sampling_unit, parent.process_type, parent.sample_type]
    );
    
    // P0-F: copy full spec snapshot from parent including is_required and param_type
    const parentResults = await dbAll(
      'SELECT parameter_id, method_id, standard_value, min_value, max_value, uom, qc_type, specification_id, is_required, param_type FROM qc_analysis_results WHERE fpa_id = ?',
      [parentId]
    ) as any[];
    for (const pr of parentResults) {
      await dbRun(
        `INSERT INTO qc_analysis_results
         (fpa_id, parameter_id, method_id, standard_value, min_value, max_value, uom, qc_type, specification_id, is_required, param_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [result.insertId, pr.parameter_id, pr.method_id, pr.standard_value,
         pr.min_value, pr.max_value, pr.uom, pr.qc_type, pr.specification_id,
         pr.is_required !== undefined ? pr.is_required : 1,
         pr.param_type || 'quantitative']
      );
    }
    
    // P0-B: re-point checkpoint from parent/root to new child FPA
    const checkpointRoot = parent.parent_fpa_id || parentId;
    await dbRun(
      `UPDATE wo_qc_checkpoints SET fpa_id = ?, status = 'pending', resolved_at = NULL
       WHERE fpa_id = ?`,
      [result.insertId, checkpointRoot]
    );
    // also check if checkpoint was on direct parent
    if (checkpointRoot !== parentId) {
      await dbRun(
        `UPDATE wo_qc_checkpoints SET fpa_id = ?, status = 'pending', resolved_at = NULL
         WHERE fpa_id = ?`,
        [result.insertId, parentId]
      );
    }
    
    res.status(201).json({ success: true, message: `Resampling run #${newRun} created`, id: result.insertId, fpa_number: fpaNumber });
  } catch (error: any) {
    console.error('Error creating resample:', error);
    res.status(500).json({ success: false, error: 'Failed to create resampling run' });
  }
});

export default router;
