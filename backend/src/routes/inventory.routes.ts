import { Router, Request, Response } from 'express';
import db from '../config/database';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/inventory
router.get('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const stmt = db.prepare(`
      SELECT i.*, p.name as product_name, p.sku 
      FROM inventory i 
      JOIN products p ON i.product_id = p.id 
      ORDER BY p.name ASC
    `);
    const inventory = stmt.all();
    res.json({ data: inventory });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// GET /api/inventory/:id
router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const stmt = db.prepare(`
      SELECT i.*, p.name as product_name, p.sku 
      FROM inventory i 
      JOIN products p ON i.product_id = p.id 
      WHERE i.id = ?
    `);
    const item = stmt.get(req.params.id);
    
    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }
    
    res.json({ data: item });
  } catch (error) {
    console.error('Error fetching inventory item:', error);
    res.status(500).json({ error: 'Failed to fetch inventory item' });
  }
});

// POST /api/inventory - Create inventory entry
router.post('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const { product_id, quantity_on_hand, location } = req.body;

    if (!product_id) {
      return res.status(400).json({ error: 'product_id is required' });
    }

    // Check if inventory already exists for this product
    const existing = db.prepare('SELECT * FROM inventory WHERE product_id = ?').get(product_id);
    if (existing) {
      return res.status(400).json({ error: 'Inventory already exists for this product' });
    }

    const stmt = db.prepare(`
      INSERT INTO inventory (product_id, quantity_on_hand, quantity_available, location) 
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(product_id, quantity_on_hand || 0, quantity_on_hand || 0, location || null);

    res.status(201).json({
      message: 'Inventory created successfully',
      data: { id: result.lastInsertRowid, product_id, quantity_on_hand },
    });
  } catch (error) {
    console.error('Error creating inventory:', error);
    res.status(500).json({ error: 'Failed to create inventory' });
  }
});

// PUT /api/inventory/:id - Update inventory
router.put('/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const { quantity_on_hand, quantity_reserved, location } = req.body;
    const quantity_available = (quantity_on_hand || 0) - (quantity_reserved || 0);

    const stmt = db.prepare(`
      UPDATE inventory 
      SET quantity_on_hand = ?, quantity_reserved = ?, quantity_available = ?, location = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    stmt.run(quantity_on_hand, quantity_reserved, quantity_available, location, req.params.id);

    res.json({ message: 'Inventory updated successfully' });
  } catch (error) {
    console.error('Error updating inventory:', error);
    res.status(500).json({ error: 'Failed to update inventory' });
  }
});

// POST /api/inventory/:id/transaction - Record inventory transaction
router.post('/:id/transaction', authMiddleware, (req: Request, res: Response) => {
  try {
    const { transaction_type, quantity, reference_type, reference_id, notes } = req.body;

    if (!transaction_type || !quantity) {
      return res.status(400).json({ error: 'transaction_type and quantity are required' });
    }

    const stmt = db.prepare(`
      INSERT INTO inventory_transactions (inventory_id, transaction_type, quantity, reference_type, reference_id, notes) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(req.params.id, transaction_type, quantity, reference_type || null, reference_id || null, notes || null);

    res.status(201).json({
      message: 'Transaction recorded successfully',
      data: { id: result.lastInsertRowid },
    });
  } catch (error) {
    console.error('Error recording transaction:', error);
    res.status(500).json({ error: 'Failed to record transaction' });
  }
});

export default router;
