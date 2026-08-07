import { Router, Request, Response } from 'express';
import { dbAll, dbGet, dbRun } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';

const router = Router();

// GET /api/categories - Get all categories
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const categories = await dbAll('SELECT * FROM categories ORDER BY name ASC', []);
    res.json({ data: categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/categories/:id - Get specific category
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const category = await dbGet('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    
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
router.post('/', authMiddleware, requirePermission('master_data.categories', 'create'), async (req: Request, res: Response) => {
  try {
    const { name, description, active } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const activeValue = active === false ? 0 : 1;
    const result = await dbRun(
      'INSERT INTO categories (name, description, active) VALUES (?, ?, ?)',
      [name, description || null, activeValue]
    );
    const created = await dbGet('SELECT * FROM categories WHERE id = ?', [result.insertId]);

    res.status(201).json({
      message: 'Category created successfully',
      data: created,
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// PUT /api/categories/:id - Update category
router.put('/:id', authMiddleware, requirePermission('master_data.categories', 'update'), async (req: Request, res: Response) => {
  try {
    const { name, description, active } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const activeValue = active === false ? 0 : 1;
    await dbRun(
      'UPDATE categories SET name = ?, description = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, description || null, activeValue, req.params.id]
    );

    res.json({ message: 'Category updated successfully' });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// DELETE /api/categories/:id - Delete category
router.delete('/:id', authMiddleware, requirePermission('master_data.categories', 'delete'), async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM categories WHERE id = ?', [req.params.id]);
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;
