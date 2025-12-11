import { Router, Request, Response } from 'express';
import db from '../config/database';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/bom - Get all BOMs for a product
router.get('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const product_id = req.query.product_id;
    let stmt;
    
    if (product_id) {
      stmt = db.prepare(`
        SELECT b.*, p.name as component_name, p.sku as component_sku 
        FROM bom b 
        JOIN products p ON b.component_product_id = p.id 
        WHERE b.product_id = ?
        ORDER BY b.created_at DESC
      `);
      const boms = stmt.all(product_id);
      res.json({ data: boms });
    } else {
      stmt = db.prepare(`
        SELECT b.*, p.name as component_name, p.sku as component_sku 
        FROM bom b 
        JOIN products p ON b.component_product_id = p.id 
        ORDER BY b.created_at DESC
      `);
      const boms = stmt.all();
      res.json({ data: boms });
    }
  } catch (error) {
    console.error('Error fetching BOMs:', error);
    res.status(500).json({ error: 'Failed to fetch BOMs' });
  }
});

// GET /api/bom/:id - Get specific BOM
router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const stmt = db.prepare(`
      SELECT b.*, p.name as component_name, p.sku as component_sku 
      FROM bom b 
      JOIN products p ON b.component_product_id = p.id 
      WHERE b.id = ?
    `);
    const bom = stmt.get(req.params.id);
    
    if (!bom) {
      return res.status(404).json({ error: 'BOM not found' });
    }
    
    res.json({ data: bom });
  } catch (error) {
    console.error('Error fetching BOM:', error);
    res.status(500).json({ error: 'Failed to fetch BOM' });
  }
});

// POST /api/bom - Create BOM
router.post('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const { product_id, component_product_id, quantity, unit, notes, loss_percent, is_sub_bom } = req.body;

    if (!product_id || !component_product_id || !quantity) {
      return res.status(400).json({ error: 'product_id, component_product_id, and quantity are required' });
    }

    const stmt = db.prepare(
      'INSERT INTO bom (product_id, component_product_id, quantity, unit, notes, loss_percent, is_sub_bom) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(
      product_id, 
      component_product_id, 
      quantity, 
      unit || null, 
      notes || null, 
      loss_percent || 0, 
      is_sub_bom ? 1 : 0
    );

    res.status(201).json({
      message: 'BOM created successfully',
      data: { id: result.lastInsertRowid, product_id, component_product_id, quantity, unit, notes, loss_percent, is_sub_bom },
    });
  } catch (error) {
    console.error('Error creating BOM:', error);
    res.status(500).json({ error: 'Failed to create BOM' });
  }
});

// DELETE /api/bom/:id - Delete BOM
router.delete('/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const stmt = db.prepare('DELETE FROM bom WHERE id = ?');
    stmt.run(req.params.id);

    res.json({ message: 'BOM deleted successfully' });
  } catch (error) {
    console.error('Error deleting BOM:', error);
    res.status(500).json({ error: 'Failed to delete BOM' });
  }
});

export default router;
