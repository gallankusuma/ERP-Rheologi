import { Router, Request, Response } from 'express';
import db from '../config/database';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/categories - Get all categories
router.get('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const stmt = db.prepare('SELECT * FROM categories ORDER BY name ASC');
    const categories = stmt.all();
    res.json({ data: categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/categories/:id - Get specific category
router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const stmt = db.prepare('SELECT * FROM categories WHERE id = ?');
    const category = stmt.get(req.params.id);
    
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json({ data: category });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// POST /api/categories - Create category
router.post('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const stmt = db.prepare(
      'INSERT INTO categories (name, description, active) VALUES (?, ?, ?)'
    );
    const result = stmt.run(name, description || null, 1);

    res.status(201).json({
      message: 'Category created successfully',
      data: { id: result.lastInsertRowid, name, description, active: true },
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// PUT /api/categories/:id - Update category
router.put('/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const { name, description, active } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const stmt = db.prepare(
      'UPDATE categories SET name = ?, description = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    );
    stmt.run(name, description || null, active ? 1 : 0, req.params.id);

    res.json({ message: 'Category updated successfully' });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// DELETE /api/categories/:id - Delete category
router.delete('/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const stmt = db.prepare('DELETE FROM categories WHERE id = ?');
    stmt.run(req.params.id);

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;
