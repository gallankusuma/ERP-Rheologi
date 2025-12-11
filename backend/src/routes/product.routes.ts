import { Router, Request, Response } from 'express';
import db from '../config/database';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/products
router.get('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const stmt = db.prepare('SELECT * FROM products ORDER BY created_at DESC');
    const products = stmt.all();
    res.json({ data: products });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/products/:id
router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const stmt = db.prepare('SELECT * FROM products WHERE id = ?');
    const product = stmt.get(req.params.id);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json({ data: product });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// POST /api/products
router.post('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const { sku, name, description, unit_of_measure, category } = req.body;

    if (!sku || !name) {
      return res.status(400).json({ error: 'SKU and name are required' });
    }

    const stmt = db.prepare(
      'INSERT INTO products (sku, name, description, unit_of_measure, category) VALUES (?, ?, ?, ?, ?)'
    );
    const result = stmt.run(sku, name, description || null, unit_of_measure || null, category || null);

    res.status(201).json({
      message: 'Product created successfully',
      data: { id: result.lastInsertRowid, sku, name, description, unit_of_measure, category },
    });
  } catch (error: any) {
    console.error('Error creating product:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'SKU already exists' });
    }
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /api/products/:id
router.put('/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const { sku, name, description, unit_of_measure, category, status } = req.body;

    const stmt = db.prepare(
      'UPDATE products SET sku = ?, name = ?, description = ?, unit_of_measure = ?, category = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    );
    stmt.run(sku, name, description, unit_of_measure, category, status, req.params.id);

    res.json({ message: 'Product updated successfully' });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/products/:id
router.delete('/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const stmt = db.prepare('DELETE FROM products WHERE id = ?');
    stmt.run(req.params.id);

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

export default router;
