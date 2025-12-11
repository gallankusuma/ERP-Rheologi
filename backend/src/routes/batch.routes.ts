import { Router, Request, Response } from 'express';
import db from '../config/database';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/batches - Get all batches with product info
router.get('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const { status, qc_status, product_id } = req.query;
    
    let query = `
      SELECT b.*, p.name as product_name, p.sku, 
             wl.code as location_code
      FROM batches b
      JOIN products p ON b.product_id = p.id
      LEFT JOIN warehouse_locations wl ON b.location_id = wl.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (status) {
      query += ` AND b.status = ?`;
      params.push(status);
    }
    
    if (qc_status) {
      query += ` AND b.qc_status = ?`;
      params.push(qc_status);
    }
    
    if (product_id) {
      query += ` AND b.product_id = ?`;
      params.push(product_id);
    }
    
    query += ` ORDER BY b.mfg_date DESC, b.batch_number DESC`;
    
    const stmt = db.prepare(query);
    const batches = stmt.all(...params);
    
    res.json({ data: batches });
  } catch (error) {
    console.error('Error fetching batches:', error);
    res.status(500).json({ error: 'Failed to fetch batches' });
  }
});

// GET /api/batches/:id - Get batch details with QC results
router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const batchStmt = db.prepare(`
      SELECT b.*, p.name as product_name, p.sku,
             wl.code as location_code
      FROM batches b
      JOIN products p ON b.product_id = p.id
      LEFT JOIN warehouse_locations wl ON b.location_id = wl.id
      WHERE b.id = ?
    `);
    const batch = batchStmt.get(req.params.id);
    
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    
    // Get QC results for this batch
    const qcStmt = db.prepare(`
      SELECT qr.*, qt.name as test_name,
             u1.name as tested_by_name
      FROM qc_results qr
      JOIN qc_tests qt ON qr.test_id = qt.id
      LEFT JOIN users u1 ON qr.tester_id = u1.id
      WHERE qr.batch_id = ?
      ORDER BY qr.tested_at DESC
    `);
    const qcResults = qcStmt.all(req.params.id);
    
    res.json({ 
      data: { 
        ...batch, 
        qc_results: qcResults 
      } 
    });
  } catch (error) {
    console.error('Error fetching batch:', error);
    res.status(500).json({ error: 'Failed to fetch batch' });
  }
});

// POST /api/batches - Create new batch
router.post('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const { 
      batch_number, product_id, work_order_id, quantity, uom,
      mfg_date, exp_date, location_id, status 
    } = req.body;

    if (!batch_number || !product_id || !quantity || !mfg_date) {
      return res.status(400).json({ 
        error: 'batch_number, product_id, quantity, and mfg_date are required' 
      });
    }

    const stmt = db.prepare(`
      INSERT INTO batches (
        batch_number, product_id, work_order_id, quantity, uom,
        mfg_date, exp_date, location_id, status, qc_status
      ) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      batch_number, 
      product_id, 
      work_order_id || null,
      quantity,
      uom || 'KG',
      mfg_date, 
      exp_date || null,
      location_id || null,
      status || 'open',
      'pending'
    );

    res.status(201).json({
      message: 'Batch created successfully',
      data: { id: result.lastInsertRowid, batch_number, product_id },
    });
  } catch (error) {
    console.error('Error creating batch:', error);
    res.status(500).json({ error: 'Failed to create batch' });
  }
});

// PUT /api/batches/:id - Update batch
router.put('/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const { 
      quantity, uom, mfg_date, exp_date, location_id, 
      status, qc_status 
    } = req.body;

    const stmt = db.prepare(`
      UPDATE batches 
      SET quantity = ?, uom = ?, mfg_date = ?, exp_date = ?, 
          location_id = ?, status = ?, qc_status = ?,
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    
    stmt.run(
      quantity, uom, mfg_date, exp_date, 
      location_id, status, qc_status,
      req.params.id
    );

    res.json({ message: 'Batch updated successfully' });
  } catch (error) {
    console.error('Error updating batch:', error);
    res.status(500).json({ error: 'Failed to update batch' });
  }
});

// POST /api/batches/:id/release - Release batch for use (after QC approval)
router.post('/:id/release', authMiddleware, (req: Request, res: Response) => {
  try {
    // Check if batch has passed QC
    const batchStmt = db.prepare(`
      SELECT * FROM batches WHERE id = ?
    `);
    const batch = batchStmt.get(req.params.id);
    
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    
    if (batch.qc_status !== 'passed') {
      return res.status(400).json({ 
        error: 'Cannot release batch - QC status must be "passed"' 
      });
    }
    
    const updateStmt = db.prepare(`
      UPDATE batches 
      SET status = 'released', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    
    updateStmt.run(req.params.id);

    res.json({ message: 'Batch released successfully' });
  } catch (error) {
    console.error('Error releasing batch:', error);
    res.status(500).json({ error: 'Failed to release batch' });
  }
});

// GET /api/batches/expiring/soon - Get batches expiring soon (FEFO alert)
router.get('/expiring/soon', authMiddleware, (req: Request, res: Response) => {
  try {
    const daysAhead = parseInt(req.query.days as string) || 30;
    
    const stmt = db.prepare(`
      SELECT b.*, p.name as product_name, p.sku,
             wl.code as location_code,
             (julianday(b.exp_date) - julianday('now')) as days_to_expiry
      FROM batches b
      JOIN products p ON b.product_id = p.id
      LEFT JOIN warehouse_locations wl ON b.location_id = wl.id
      WHERE b.status IN ('open', 'released')
        AND b.exp_date IS NOT NULL
        AND julianday(b.exp_date) - julianday('now') <= ?
        AND julianday(b.exp_date) - julianday('now') > 0
      ORDER BY b.exp_date ASC
    `);
    
    const batches = stmt.all(daysAhead);
    
    res.json({ data: batches });
  } catch (error) {
    console.error('Error fetching expiring batches:', error);
    res.status(500).json({ error: 'Failed to fetch expiring batches' });
  }
});

export default router;
