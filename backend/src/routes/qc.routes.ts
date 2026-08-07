import { Router, Request, Response } from 'express';
import { dbAll, dbGet, dbRun } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';

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
    const { name, description } = req.body;
    const result = await dbRun('INSERT INTO qc_parameters (name, description) VALUES (?, ?)', [name, description]);
    res.status(201).json({ success: true, message: 'Parameter created', id: result.insertId });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create parameter' });
  }
});

router.put('/parameters/:id', authMiddleware, requirePermission('quality.qc-master', 'update'), async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    await dbRun('UPDATE qc_parameters SET name=?, description=? WHERE id=?', [name, description, req.params.id]);
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
    const { product_id, qc_type, parameter_id, method_id, standard_value, min_value, max_value, uom } = req.body;
    const result = await dbRun(
      'INSERT INTO qc_specifications (product_id, qc_type, parameter_id, method_id, standard_value, min_value, max_value, uom) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [product_id, qc_type || 'Incoming', parameter_id, method_id || null, standard_value, min_value || null, max_value || null, uom || null]
    );
    res.status(201).json({ success: true, message: 'Spec created', id: result.insertId });
  } catch (error: any) {
    console.error('Spec creation error:', error?.message || error);
    res.status(500).json({ success: false, error: 'Failed to create spec', detail: error?.message });
  }
});

router.put('/specs/:id', authMiddleware, requirePermission('quality.qc-master', 'update'), async (req: Request, res: Response) => {
  try {
    const { parameter_id, method_id, standard_value, min_value, max_value, qc_type, uom } = req.body;
    await dbRun(
      'UPDATE qc_specifications SET parameter_id=?, method_id=?, standard_value=?, min_value=?, max_value=?, qc_type=?, uom=? WHERE id=?',
      [parameter_id, method_id || null, standard_value, min_value || null, max_value || null, qc_type || 'Incoming', uom || null, req.params.id]
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
    const { type, reference_id, reference_number, product_id, sampling_area_id, batch_no, quantity, supplier_id, notes } = req.body;
    const fpa_number = generateFPANumber(type || 'INC');
    const userId = (req as any).user?.userId || null;
    
    const result = await dbRun(
      'INSERT INTO qc_analysis_requests (fpa_number, type, reference_id, reference_number, product_id, sampling_area_id, batch_no, quantity, supplier_id, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [fpa_number, type || 'Incoming', reference_id || null, reference_number || null, product_id, sampling_area_id || null, batch_no || null, quantity || null, supplier_id || null, notes || null, userId]
    );
    
    // Copy specs to analysis results (filter by qc_type)
    const specs = await dbAll(
      'SELECT * FROM qc_specifications WHERE product_id = ? AND (qc_type = ? OR qc_type IS NULL)',
      [product_id, type || 'Incoming']
    );
    for (const spec of specs) {
      await dbRun(
        'INSERT INTO qc_analysis_results (fpa_id, parameter_id, method_id, standard_value, min_value, max_value) VALUES (?, ?, ?, ?, ?, ?)',
        [result.insertId, spec.parameter_id, spec.method_id, spec.standard_value, spec.min_value, spec.max_value]
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
      SELECT f.*, p.name as product_name, a.name as area_name
      FROM qc_analysis_requests f
      LEFT JOIN products p ON f.product_id = p.id
      LEFT JOIN qc_sampling_areas a ON f.sampling_area_id = a.id
      WHERE f.id = ?
    `, [req.params.id]);
    
    if (!fpa) return res.status(404).json({ success: false, error: 'FPA not found' });
    
    const results = await dbAll(`
      SELECT r.*, p.name as parameter_name, i.name as instrument_name,
             s.standard_value, s.min_value, s.max_value, m.name as method_name
      FROM qc_analysis_results r
      JOIN qc_parameters p ON r.parameter_id = p.id
      LEFT JOIN qc_instruments i ON r.instrument_id = i.id
      LEFT JOIN qc_specifications s ON s.product_id = ? AND s.parameter_id = r.parameter_id
      LEFT JOIN qc_methods m ON s.method_id = m.id
      WHERE r.fpa_id = ?
    `, [fpa.product_id, req.params.id]);
    
    res.json({ success: true, data: { ...fpa, results } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch FPA detail' });
  }
});

router.put('/fpa/:id/results', authMiddleware, requirePermission('quality.qc-fpa', 'update'), async (req: Request, res: Response) => {
  try {
    const { results, status, result, notes } = req.body;
    const fpaId = req.params.id;
    
    // Update FPA
    await dbRun(
      'UPDATE qc_analysis_requests SET status=?, result=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [status, result || null, notes || null, fpaId]
    );
    
    // Update individual results
    if (results && Array.isArray(results)) {
      for (const r of results) {
        await dbRun(
          'UPDATE qc_analysis_results SET instrument_id=?, actual_value=?, is_pass=? WHERE id=?',
          [r.instrument_id || null, r.actual_value || null, r.is_pass === undefined ? null : r.is_pass, r.id]
        );
      }
    }

    // Auto-update linked WO QC checkpoint when FPA is Released/Approved
    if (status === 'Released' || status === 'Approved' || result === 'Passed' || result === 'Released') {
      const checkpoint = await dbGet(
        'SELECT id FROM wo_qc_checkpoints WHERE fpa_id = ?', [fpaId]
      ) as any;
      if (checkpoint) {
        const finalStatus = (result === 'Failed' || result === 'Rejected') ? 'failed' : 'passed';
        await dbRun(
          'UPDATE wo_qc_checkpoints SET status = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?',
          [finalStatus, checkpoint.id]
        );
        console.log(`✅ QC checkpoint ${checkpoint.id} updated to ${finalStatus} (FPA #${fpaId})`);
      }
    }

    // Also handle explicit failure
    if (result === 'Failed' || result === 'Rejected') {
      const checkpoint = await dbGet(
        'SELECT id FROM wo_qc_checkpoints WHERE fpa_id = ?', [fpaId]
      ) as any;
      if (checkpoint) {
        await dbRun(
          'UPDATE wo_qc_checkpoints SET status = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?',
          ['failed', checkpoint.id]
        );
      }
    }
    
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

router.put('/fpa/:id/approve', authMiddleware, requirePermission('quality.qc-fpa', 'update'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || null;
    const { review_notes } = req.body;
    await dbRun(
      'UPDATE qc_analysis_requests SET status = "Approved", result = "Pass", reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [userId, review_notes || null, req.params.id]
    );
    // Auto-update batch qc_status if linked
    const fpa = await dbGet('SELECT * FROM qc_analysis_requests WHERE id = ?', [req.params.id]);
    if (fpa && fpa.batch_no) {
      await dbRun('UPDATE batches SET qc_status = "passed" WHERE batch_number = ?', [fpa.batch_no]);
    }
    res.json({ success: true, message: 'FPA approved' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to approve FPA' });
  }
});

router.put('/fpa/:id/reject', authMiddleware, requirePermission('quality.qc-fpa', 'update'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || null;
    const { review_notes } = req.body;
    await dbRun(
      'UPDATE qc_analysis_requests SET status = "Rejected", result = "Fail", reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [userId, review_notes || null, req.params.id]
    );
    const fpa = await dbGet('SELECT * FROM qc_analysis_requests WHERE id = ?', [req.params.id]);
    if (fpa && fpa.batch_no) {
      await dbRun('UPDATE batches SET qc_status = "failed" WHERE batch_number = ?', [fpa.batch_no]);
    }
    res.json({ success: true, message: 'FPA rejected' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to reject FPA' });
  }
});

router.put('/fpa/:id/resample', authMiddleware, requirePermission('quality.qc-fpa', 'update'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || null;
    const { review_notes } = req.body;
    await dbRun(
      'UPDATE qc_analysis_requests SET status = "Resampling", reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [userId, review_notes || null, req.params.id]
    );
    res.json({ success: true, message: 'FPA sent for resampling' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to resample FPA' });
  }
});

export default router;
