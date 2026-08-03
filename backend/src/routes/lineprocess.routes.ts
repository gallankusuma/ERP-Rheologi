import { Router, Request, Response } from 'express';
import { dbAll, dbGet, dbRun } from '../config/database';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/line-processes - Get all line processes with products
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const lines = await dbAll(
      `SELECT lp.*, u.name as unit_name, u.code as unit_code
       FROM line_processes lp
       LEFT JOIN uom u ON lp.capacity_unit_id = u.id
       ORDER BY lp.name ASC`,
      []
    );

    // Fetch products for each line
    for (const line of lines as any[]) {
      const products = await dbAll(
        `SELECT lpp.product_id, p.name as product_name, p.sku
         FROM line_process_products lpp
         JOIN products p ON lpp.product_id = p.id
         WHERE lpp.line_process_id = ?
         ORDER BY p.name ASC`,
        [line.id]
      );
      line.products = products;
    }

    res.json({ data: lines });
  } catch (error) {
    console.error('Error fetching line processes:', error);
    res.status(500).json({ error: 'Failed to fetch line processes' });
  }
});

// GET /api/line-processes/:id - Get specific line process
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const line = await dbGet(
      `SELECT lp.*, u.name as unit_name, u.code as unit_code
       FROM line_processes lp
       LEFT JOIN uom u ON lp.capacity_unit_id = u.id
       WHERE lp.id = ?`,
      [req.params.id]
    );
    if (!line) {
      return res.status(404).json({ error: 'Line process not found' });
    }

    const products = await dbAll(
      `SELECT lpp.product_id, p.name as product_name, p.sku
       FROM line_process_products lpp
       JOIN products p ON lpp.product_id = p.id
       WHERE lpp.line_process_id = ?`,
      [req.params.id]
    );
    (line as any).products = products;

    res.json({ data: line });
  } catch (error) {
    console.error('Error fetching line process:', error);
    res.status(500).json({ error: 'Failed to fetch line process' });
  }
});

// POST /api/line-processes - Create line process
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, code, description, capacity_per_hour, capacity_unit_id, active, product_ids } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const activeValue = active === false ? 0 : 1;
    const result = await dbRun(
      'INSERT INTO line_processes (name, code, description, capacity_per_hour, capacity_unit_id, active) VALUES (?, ?, ?, ?, ?, ?)',
      [name, code || null, description || null, capacity_per_hour || null, capacity_unit_id || null, activeValue]
    );

    const lineId = result.insertId;

    // Insert product associations
    if (product_ids && Array.isArray(product_ids)) {
      for (const pid of product_ids) {
        await dbRun(
          'INSERT IGNORE INTO line_process_products (line_process_id, product_id) VALUES (?, ?)',
          [lineId, pid]
        );
      }
    }

    const created = await dbGet('SELECT * FROM line_processes WHERE id = ?', [lineId]);
    res.status(201).json({
      message: 'Line process created successfully',
      data: created,
    });
  } catch (error) {
    console.error('Error creating line process:', error);
    res.status(500).json({ error: 'Failed to create line process' });
  }
});

// PUT /api/line-processes/:id - Update line process
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, code, description, capacity_per_hour, capacity_unit_id, active, product_ids } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const activeValue = active === false ? 0 : 1;
    await dbRun(
      'UPDATE line_processes SET name = ?, code = ?, description = ?, capacity_per_hour = ?, capacity_unit_id = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, code || null, description || null, capacity_per_hour || null, capacity_unit_id || null, activeValue, req.params.id]
    );

    // Update product associations: delete old, insert new
    if (product_ids && Array.isArray(product_ids)) {
      await dbRun('DELETE FROM line_process_products WHERE line_process_id = ?', [req.params.id]);
      for (const pid of product_ids) {
        await dbRun(
          'INSERT IGNORE INTO line_process_products (line_process_id, product_id) VALUES (?, ?)',
          [req.params.id, pid]
        );
      }
    }

    res.json({ message: 'Line process updated successfully' });
  } catch (error) {
    console.error('Error updating line process:', error);
    res.status(500).json({ error: 'Failed to update line process' });
  }
});

// DELETE /api/line-processes/:id - Delete line process
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM line_processes WHERE id = ?', [req.params.id]);
    res.json({ message: 'Line process deleted successfully' });
  } catch (error) {
    console.error('Error deleting line process:', error);
    res.status(500).json({ error: 'Failed to delete line process' });
  }
});

export default router;
