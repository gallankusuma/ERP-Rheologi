import { Router, Request, Response } from 'express';
import db from '../config/database';
import { authMiddleware } from '../middleware/auth';

const router = Router();

const generateCode = (prefix: string) => {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${datePart}-${rand}`;
};

// QC Tests (Master Data)
router.get('/tests', authMiddleware, (req: Request, res: Response) => {
  try {
    const tests = db.prepare(`
      SELECT * FROM qc_tests 
      WHERE is_active = 1
      ORDER BY test_code
    `).all();
    res.json({ data: tests });
  } catch (error) {
    console.error('Error fetching QC tests:', error);
    res.status(500).json({ error: 'Failed to fetch QC tests' });
  }
});

router.post('/tests', authMiddleware, (req: Request, res: Response) => {
  try {
    const { test_code, name, description, product_category, test_type, specification } = req.body;
    
    if (!test_code || !name) {
      return res.status(400).json({ error: 'test_code and name are required' });
    }
    
    const stmt = db.prepare(`
      INSERT INTO qc_tests (test_code, name, description, product_category, test_type, specification, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);
    
    const result = stmt.run(test_code, name, description || null, product_category || null, test_type || null, specification || null);
    
    res.status(201).json({ 
      message: 'QC test created successfully',
      data: { id: result.lastInsertRowid, test_code, name }
    });
  } catch (error) {
    console.error('Error creating QC test:', error);
    res.status(500).json({ error: 'Failed to create QC test' });
  }
});

// QC Test Definitions (per product)
router.get('/test-definitions', authMiddleware, (req: Request, res: Response) => {
  try {
    const { product_id } = req.query;
    
    let query = `
      SELECT qtd.*, qt.test_code, qt.name as test_name, qt.test_type,
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
    
    const stmt = db.prepare(query);
    const definitions = stmt.all(...params);
    
    res.json({ data: definitions });
  } catch (error) {
    console.error('Error fetching test definitions:', error);
    res.status(500).json({ error: 'Failed to fetch test definitions' });
  }
});

router.post('/test-definitions', authMiddleware, (req: Request, res: Response) => {
  try {
    const { product_id, test_id, min_value, max_value, target_value, is_required } = req.body;
    
    if (!product_id || !test_id) {
      return res.status(400).json({ error: 'product_id and test_id are required' });
    }
    
    const stmt = db.prepare(`
      INSERT INTO qc_test_definitions (product_id, test_id, min_value, max_value, target_value, is_required)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      product_id, test_id, 
      min_value || null, max_value || null, target_value || null,
      is_required !== undefined ? is_required : 1
    );
    
    res.status(201).json({ 
      message: 'Test definition created successfully',
      data: { id: result.lastInsertRowid, product_id, test_id }
    });
  } catch (error) {
    console.error('Error creating test definition:', error);
    res.status(500).json({ error: 'Failed to create test definition' });
  }
});

// QC Results
router.get('/results', authMiddleware, (req: Request, res: Response) => {
  try {
    const { batch_id, status } = req.query;
    
    let query = `
      SELECT qr.*, qt.test_code, qt.name as test_name, qt.test_type,
             b.batch_number, p.name as product_name,
             u1.name as tested_by_name,
             u2.name as approved_by_name
      FROM qc_results qr
      JOIN qc_tests qt ON qr.test_id = qt.id
      JOIN batches b ON qr.batch_id = b.id
      JOIN products p ON b.product_id = p.id
      LEFT JOIN users u1 ON qr.tested_by = u1.id
      LEFT JOIN users u2 ON qr.approved_by = u2.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (batch_id) {
      query += ` AND qr.batch_id = ?`;
      params.push(batch_id);
    }
    
    if (status) {
      query += ` AND qr.status = ?`;
      params.push(status);
    }
    
    query += ` ORDER BY qr.tested_at DESC`;
    
    const stmt = db.prepare(query);
    const results = stmt.all(...params);
    
    res.json({ data: results });
  } catch (error) {
    console.error('Error fetching QC results:', error);
    res.status(500).json({ error: 'Failed to fetch QC results' });
  }
});

router.post('/results', authMiddleware, (req: Request, res: Response) => {
  try {
    const { batch_id, test_id, measured_value, result_text, status, notes } = req.body;
    const user_id = (req as any).user?.id;
    
    if (!batch_id || !test_id) {
      return res.status(400).json({ error: 'batch_id and test_id are required' });
    }
    
    const stmt = db.prepare(`
      INSERT INTO qc_results (
        batch_id, test_id, measured_value, result_text, status, 
        tested_by, tested_at, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)
    `);
    
    const result = stmt.run(
      batch_id, test_id,
      measured_value || null, result_text || null,
      status || 'pending',
      user_id,
      notes || null
    );
    
    res.status(201).json({ 
      message: 'QC result recorded successfully',
      data: { id: result.lastInsertRowid, batch_id, test_id }
    });
  } catch (error) {
    console.error('Error recording QC result:', error);
    res.status(500).json({ error: 'Failed to record QC result' });
  }
});

router.put('/results/:id/approve', authMiddleware, (req: Request, res: Response) => {
  try {
    const user_id = (req as any).user?.id;
    const { notes } = req.body;
    
    // Update QC result
    const stmt = db.prepare(`
      UPDATE qc_results 
      SET status = 'passed', 
          approved_by = ?, 
          approved_at = datetime('now'),
          notes = ?
      WHERE id = ?
    `);
    
    stmt.run(user_id, notes || null, req.params.id);
    
    // Check if all required tests for the batch are passed
    const resultStmt = db.prepare(`SELECT batch_id FROM qc_results WHERE id = ?`);
    const qcResult = resultStmt.get(req.params.id) as any;
    
    if (qcResult) {
      const checkStmt = db.prepare(`
        SELECT COUNT(*) as pending_count
        FROM qc_results qr
        JOIN qc_test_definitions qtd ON qr.test_id = qtd.test_id AND qtd.is_required = 1
        WHERE qr.batch_id = ? AND qr.status != 'passed'
      `);
      
      const check = checkStmt.get(qcResult.batch_id) as any;
      
      if (check.pending_count === 0) {
        // All required tests passed - update batch QC status
        const batchStmt = db.prepare(`
          UPDATE batches SET qc_status = 'passed' WHERE id = ?
        `);
        batchStmt.run(qcResult.batch_id);
      }
    }
    
    res.json({ message: 'QC result approved successfully' });
  } catch (error) {
    console.error('Error approving QC result:', error);
    res.status(500).json({ error: 'Failed to approve QC result' });
  }
});

router.put('/results/:id/reject', authMiddleware, (req: Request, res: Response) => {
  try {
    const user_id = (req as any).user?.id;
    const { notes } = req.body;
    
    // Update QC result
    const stmt = db.prepare(`
      UPDATE qc_results 
      SET status = 'failed', 
          approved_by = ?, 
          approved_at = datetime('now'),
          notes = ?
      WHERE id = ?
    `);
    
    stmt.run(user_id, notes || null, req.params.id);
    
    // Update batch QC status to failed
    const resultStmt = db.prepare(`SELECT batch_id FROM qc_results WHERE id = ?`);
    const qcResult = resultStmt.get(req.params.id) as any;
    
    if (qcResult) {
      const batchStmt = db.prepare(`
        UPDATE batches SET qc_status = 'failed', status = 'rejected' WHERE id = ?
      `);
      batchStmt.run(qcResult.batch_id);
    }
    
    res.json({ message: 'QC result rejected successfully' });
  } catch (error) {
    console.error('Error rejecting QC result:', error);
    res.status(500).json({ error: 'Failed to reject QC result' });
  }
});

// Batches
router.get('/batches', authMiddleware, (req: Request, res: Response) => {
  try {
    const batches = db
      .prepare(
        `SELECT b.*, p.sku, p.name as product_name, wo.id as work_order_id
         FROM batches b
         JOIN products p ON b.product_id = p.id
         LEFT JOIN work_orders wo ON b.work_order_id = wo.id
         ORDER BY b.created_at DESC`
      )
      .all();
    res.json({ data: batches });
  } catch (error) {
    console.error('Error fetching batches:', error);
    res.status(500).json({ error: 'Failed to fetch batches' });
  }
});

router.get('/batches/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const batch = db
      .prepare(
        `SELECT b.*, p.sku, p.name as product_name, wo.id as work_order_id
         FROM batches b
         JOIN products p ON b.product_id = p.id
         LEFT JOIN work_orders wo ON b.work_order_id = wo.id
         WHERE b.id = ?`
      )
      .get(req.params.id);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    res.json({ data: batch });
  } catch (error) {
    console.error('Error fetching batch:', error);
    res.status(500).json({ error: 'Failed to fetch batch' });
  }
});

router.post('/batches', authMiddleware, (req: Request, res: Response) => {
  try {
    const { batch_number, product_id, work_order_id, mfg_date, exp_date, status } = req.body;
    if (!product_id) return res.status(400).json({ error: 'product_id is required' });
    const number = batch_number || generateCode('BATCH');

    const result = db
      .prepare('INSERT INTO batches (batch_number, product_id, work_order_id, mfg_date, exp_date, status) VALUES (?, ?, ?, ?, ?, ?)')
      .run(number, product_id, work_order_id || null, mfg_date || null, exp_date || null, status || 'open');

    res.status(201).json({ message: 'Batch created', data: { id: result.lastInsertRowid, batch_number: number } });
  } catch (error: any) {
    console.error('Error creating batch:', error);
    if (error.message?.includes('UNIQUE')) return res.status(400).json({ error: 'Batch number must be unique' });
    res.status(500).json({ error: 'Failed to create batch' });
  }
});

router.put('/batches/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const { product_id, work_order_id, mfg_date, exp_date, status } = req.body;
    db.prepare(
      'UPDATE batches SET product_id = ?, work_order_id = ?, mfg_date = ?, exp_date = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(product_id, work_order_id || null, mfg_date || null, exp_date || null, status, req.params.id);
    res.json({ message: 'Batch updated' });
  } catch (error) {
    console.error('Error updating batch:', error);
    res.status(500).json({ error: 'Failed to update batch' });
  }
});

// QC Tests (master)
router.get('/qc-tests', authMiddleware, (req: Request, res: Response) => {
  try {
    const tests = db.prepare('SELECT * FROM qc_tests ORDER BY name ASC').all();
    res.json({ data: tests });
  } catch (error) {
    console.error('Error fetching QC tests:', error);
    res.status(500).json({ error: 'Failed to fetch QC tests' });
  }
});

router.post('/qc-tests', authMiddleware, (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const result = db.prepare('INSERT INTO qc_tests (name, description) VALUES (?, ?)').run(name, description || null);
    res.status(201).json({ message: 'QC test created', data: { id: result.lastInsertRowid, name } });
  } catch (error) {
    console.error('Error creating QC test:', error);
    res.status(500).json({ error: 'Failed to create QC test' });
  }
});

router.put('/qc-tests/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    db.prepare('UPDATE qc_tests SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
      name,
      description,
      req.params.id
    );
    res.json({ message: 'QC test updated' });
  } catch (error) {
    console.error('Error updating QC test:', error);
    res.status(500).json({ error: 'Failed to update QC test' });
  }
});

router.delete('/qc-tests/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    db.prepare('DELETE FROM qc_tests WHERE id = ?').run(req.params.id);
    res.json({ message: 'QC test deleted' });
  } catch (error) {
    console.error('Error deleting QC test:', error);
    res.status(500).json({ error: 'Failed to delete QC test' });
  }
});

// QC Results
router.get('/qc-results', authMiddleware, (req: Request, res: Response) => {
  try {
    const { batch_id } = req.query;
    let query =
      `SELECT qr.*, b.batch_number, t.name as test_name, u.name as tester_name
       FROM qc_results qr
       JOIN batches b ON qr.batch_id = b.id
       JOIN qc_tests t ON qr.test_id = t.id
       LEFT JOIN users u ON qr.tester_id = u.id`;
    const params: any[] = [];
    if (batch_id) {
      query += ' WHERE qr.batch_id = ?';
      params.push(batch_id);
    }
    query += ' ORDER BY qr.tested_at DESC';
    const results = db.prepare(query).all(...params);
    res.json({ data: results });
  } catch (error) {
    console.error('Error fetching QC results:', error);
    res.status(500).json({ error: 'Failed to fetch QC results' });
  }
});

router.post('/qc-results', authMiddleware, (req: Request, res: Response) => {
  try {
    const { batch_id, test_id, result, status, tested_at, tester_id, notes } = req.body;
    if (!batch_id || !test_id) return res.status(400).json({ error: 'batch_id and test_id are required' });

    const tester = tester_id || (req as any).userId || null;
    const insert = db.prepare(
      'INSERT INTO qc_results (batch_id, test_id, result, status, tested_at, tester_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const resInsert = insert.run(batch_id, test_id, result || null, status || 'pending', tested_at || null, tester, notes || null);

    res.status(201).json({ message: 'QC result recorded', data: { id: resInsert.lastInsertRowid } });
  } catch (error) {
    console.error('Error creating QC result:', error);
    res.status(500).json({ error: 'Failed to create QC result' });
  }
});

router.put('/qc-results/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const { result, status, tested_at, tester_id, notes } = req.body;
    db.prepare(
      'UPDATE qc_results SET result = ?, status = ?, tested_at = COALESCE(?, tested_at), tester_id = COALESCE(?, tester_id), notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(result || null, status, tested_at || null, tester_id || null, notes || null, req.params.id);
    res.json({ message: 'QC result updated' });
  } catch (error) {
    console.error('Error updating QC result:', error);
    res.status(500).json({ error: 'Failed to update QC result' });
  }
});

export default router;
