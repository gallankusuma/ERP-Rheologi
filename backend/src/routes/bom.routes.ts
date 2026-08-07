import { Router, Request, Response } from 'express';
import { dbAll, dbGet, dbRun } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';

const router = Router();

// GET /api/bom - Get all BOM headers
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const boms = await dbAll(`
      SELECT bh.id, bh.product_name, bh.product_id, bh.version, bh.status, bh.notes, 
             bh.created_by, bh.created_at, bh.updated_at,
             bh.approval_status, bh.approved_by_supervisor_id, bh.approved_by_manager_id,
             bh.approved_at_supervisor, bh.approved_at_manager,
             bh.jbox_id, bh.bom_code, bh.qty, bh.unit, bh.process_type, bh.production_line, bh.source,
             sup.full_name as supervisor_name, mgr.full_name as manager_name,
             p.sku
      FROM bom_headers bh
      LEFT JOIN products p ON bh.product_id = p.id
      LEFT JOIN users sup ON bh.approved_by_supervisor_id = sup.id
      LEFT JOIN users mgr ON bh.approved_by_manager_id = mgr.id
      ORDER BY bh.created_at DESC
    `, []);
    res.json({ data: boms });
  } catch (error) {
    console.error('Error fetching BOMs:', error);
    res.status(500).json({ error: 'Failed to fetch BOMs' });
  }
});

// GET /api/bom/:id - Get specific BOM header with details
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const bomHeader = await dbGet(`
      SELECT bh.id, bh.product_name, bh.product_id, bh.version, bh.status, bh.notes, 
             bh.created_by, bh.created_at, bh.updated_at,
             bh.approval_status, bh.approved_by_supervisor_id, bh.approved_by_manager_id,
             bh.approved_at_supervisor, bh.approved_at_manager,
             bh.jbox_id, bh.bom_code, bh.qty, bh.unit, bh.process_type, bh.production_line, bh.source,
             sup.full_name as supervisor_name, mgr.full_name as manager_name
      FROM bom_headers bh
      LEFT JOIN users sup ON bh.approved_by_supervisor_id = sup.id
      LEFT JOIN users mgr ON bh.approved_by_manager_id = mgr.id
      WHERE bh.id = ?
    `, [req.params.id]);
    
    if (!bomHeader) {
      return res.status(404).json({ error: 'BOM not found' });
    }

    // Get BOM details
    const details = await dbAll(`
      SELECT bd.id, bd.bom_header_id, bd.raw_material_id, bd.quantity, bd.unit_of_measure_id,
             bd.sequence, bd.created_at,
             bd.item_code, bd.item_description, bd.unit as detail_unit,
             bd.use_tolerance, bd.pct_tolerance, bd.tolerance_value, bd.remark,
             p.name as material_name, p.sku as material_sku,
             u.code as unit_code, u.name as unit_name
      FROM bom_details bd
      LEFT JOIN products p ON bd.raw_material_id = p.id
      LEFT JOIN uom u ON bd.unit_of_measure_id = u.id
      WHERE bd.bom_header_id = ?
      ORDER BY bd.sequence ASC
    `, [req.params.id]);

    res.json({ data: { ...bomHeader, details } });
  } catch (error) {
    console.error('Error fetching BOM:', error);
    res.status(500).json({ error: 'Failed to fetch BOM' });
  }
});

// POST /api/bom - Create BOM header with details
router.post('/', authMiddleware, requirePermission('master_data.bom', 'create'), async (req: Request, res: Response) => {
  try {
    const { product_id, product_name, notes, details, bom_code, qty, unit, process_type, production_line } = req.body;
    const userId = (req as any).user?.userId;

    if (!product_name) {
      return res.status(400).json({ error: 'product_name is required' });
    }

    // Validate that userId exists in the users table before using it
    let createdBy = null;
    if (userId) {
      try {
        const userExists = await dbGet('SELECT id FROM users WHERE id = ?', [userId]);
        if (userExists) {
          createdBy = parseInt(String(userId), 10);
        }
      } catch (userCheckError) {
        createdBy = null;
      }
    }

    // Create BOM header
    const headerResult = await dbRun(
      `INSERT INTO bom_headers (product_id, product_name, bom_code, qty, unit, process_type, production_line, status, notes, created_by, source) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ERP')`,
      [product_id || null, product_name, bom_code || null, qty || null, unit || null, process_type || null, production_line || null, 'ACTIVE', notes || null, createdBy]
    );

    const bomHeaderId = headerResult.insertId;
    console.log('✅ [BOM POST] Header created with ID:', bomHeaderId);

    // Create BOM details if provided
    if (Array.isArray(details) && details.length > 0) {
      for (let i = 0; i < details.length; i++) {
        const detail = details[i];
        
        if (!detail.quantity) {
          return res.status(400).json({ error: 'Each BOM detail must include quantity' });
        }
        
        await dbRun(
          `INSERT INTO bom_details (bom_header_id, raw_material_id, item_code, item_description, quantity, unit, unit_of_measure_id, sequence, use_tolerance, pct_tolerance, tolerance_value, remark) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            bomHeaderId, detail.raw_material_id || 0, detail.item_code || null, detail.item_description || null,
            detail.quantity, detail.unit || null, detail.unit_of_measure_id || null, i + 1,
            detail.use_tolerance || 'No', detail.pct_tolerance || 0, detail.tolerance_value || 0, detail.remark || null
          ]
        );
      }
    }

    res.status(201).json({
      message: 'BOM created successfully',
      data: { id: bomHeaderId, product_name, notes, details_count: details?.length || 0 },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create BOM';
    console.error('❌ [BOM POST] Error:', message);
    console.error('Stack:', error);
    res.status(500).json({ error: message });
  }
});

// PUT /api/bom/:id - Update BOM header and details
router.put('/:id', authMiddleware, requirePermission('master_data.bom', 'update'), async (req: Request, res: Response) => {
  try {
    const { product_id, product_name, notes, details, status, bom_code, qty, unit, process_type, production_line } = req.body;

    // Update BOM header
    await dbRun(
      `UPDATE bom_headers SET 
        product_id = COALESCE(?, product_id),
        product_name = COALESCE(?, product_name),
        bom_code = COALESCE(?, bom_code),
        qty = COALESCE(?, qty),
        unit = COALESCE(?, unit),
        process_type = COALESCE(?, process_type),
        production_line = COALESCE(?, production_line),
        notes = COALESCE(?, notes), 
        status = COALESCE(?, status), 
        updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [product_id || null, product_name || null, bom_code !== undefined ? bom_code : null, qty !== undefined ? qty : null, unit !== undefined ? unit : null, process_type !== undefined ? process_type : null, production_line !== undefined ? production_line : null, notes !== undefined ? notes : null, status || null, req.params.id]
    );

    // Update BOM details ONLY if details array is provided and non-empty
    if (Array.isArray(details) && details.length > 0) {
      await dbRun('DELETE FROM bom_details WHERE bom_header_id = ?', [req.params.id]);
      
      for (let i = 0; i < details.length; i++) {
        const detail = details[i];
        await dbRun(
          `INSERT INTO bom_details (bom_header_id, raw_material_id, item_code, item_description, quantity, unit, unit_of_measure_id, sequence, use_tolerance, pct_tolerance, tolerance_value, remark) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req.params.id, detail.raw_material_id || 0, detail.item_code || null, detail.item_description || null,
            detail.quantity, detail.unit || null, detail.unit_of_measure_id || null, i + 1,
            detail.use_tolerance || 'No', detail.pct_tolerance || 0, detail.tolerance_value || 0, detail.remark || null
          ]
        );
      }
    }

    res.json({ message: 'BOM updated successfully' });
  } catch (error) {
    console.error('Error updating BOM:', error);
    res.status(500).json({ error: 'Failed to update BOM' });
  }
});

// DELETE /api/bom/:id - Delete BOM (cascade deletes details)
router.delete('/:id', authMiddleware, requirePermission('master_data.bom', 'delete'), async (req: Request, res: Response) => {
  try {
    const bomId = req.params.id;

    // Check if any Work Orders reference this BOM
    const woRefs = await dbAll('SELECT id, wo_number FROM work_orders WHERE bom_id = ?', [bomId]) as any[];
    if (woRefs && woRefs.length > 0) {
      // Nullify bom_id in work_orders first (don't block delete)
      await dbRun('UPDATE work_orders SET bom_id = NULL WHERE bom_id = ?', [bomId]);
    }

    // Delete bom_details first (cascade should handle, but explicit is safer)
    await dbRun('DELETE FROM bom_details WHERE bom_header_id = ?', [bomId]);

    // Delete from bom_headers
    await dbRun('DELETE FROM bom_headers WHERE id = ?', [bomId]);

    res.json({ message: 'BOM deleted successfully' });
  } catch (error) {
    console.error('Error deleting BOM:', error);
    res.status(500).json({ error: 'Failed to delete BOM' });
  }
});

// POST /api/bom/:id/approve - 2-Tier Approval (Supervisor → Manager/Director)
router.post('/:id/approve', authMiddleware, requirePermission('master_data.bom', 'approve_1'), async (req: Request, res: Response) => {
  try {
    const bomId = req.params.id;
    const userId = (req as any).user?.userId;
    const userLevel = (req as any).user?.userLevel || 1;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const bom = await dbGet('SELECT id, approval_status FROM bom_headers WHERE id = ?', [bomId]) as any;
    if (!bom) return res.status(404).json({ error: 'BOM not found' });

    const currentStatus = bom.approval_status || 0;
    const approverRow = await dbGet('SELECT id FROM users WHERE id = ?', [userId]) as { id: number } | undefined;
    const approverId = approverRow ? userId : null;

    // Director / Master (>=4): direct full approval
    if (userLevel >= 4 && currentStatus < 2) {
      await dbRun(
        'UPDATE bom_headers SET approval_status = 2, approved_by_supervisor_id = ?, approved_by_manager_id = ?, approved_at_supervisor = CURRENT_TIMESTAMP, approved_at_manager = CURRENT_TIMESTAMP WHERE id = ?',
        [approverId, approverId, bomId]
      );
      return res.json({ message: 'BOM fully approved (DIRECT)', approval_status: 2 });
    }

    // Supervisor (2): 0 -> 1
    if (userLevel === 2 && currentStatus === 0) {
      await dbRun(
        'UPDATE bom_headers SET approval_status = 1, approved_by_supervisor_id = ?, approved_at_supervisor = CURRENT_TIMESTAMP WHERE id = ?',
        [approverId, bomId]
      );
      return res.json({ message: 'BOM approved by supervisor (1/2)', approval_status: 1 });
    }

    // Manager (3): 1 -> 2
    if (userLevel === 3 && currentStatus === 1) {
      await dbRun(
        'UPDATE bom_headers SET approval_status = 2, approved_by_manager_id = ?, approved_at_manager = CURRENT_TIMESTAMP WHERE id = ?',
        [approverId, bomId]
      );
      return res.json({ message: 'BOM approved by manager (2/2)', approval_status: 2 });
    }

    return res.status(400).json({
      error: 'Cannot approve: insufficient level or invalid status',
      debug: { userLevel, currentStatus, needLevel: currentStatus === 0 ? 2 : 3 }
    });
  } catch (error) {
    console.error('Error approving BOM:', error);
    res.status(500).json({ error: 'Failed to approve BOM' });
  }
});

// POST /api/bom/:id/reject - Reject BOM
router.post('/:id/reject', authMiddleware, requirePermission('master_data.bom', 'approve_1'), async (req: Request, res: Response) => {
  try {
    const bomId = req.params.id;
    const userId = (req as any).user?.userId;
    const userLevel = (req as any).user?.userLevel || 1;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (userLevel < 2) return res.status(403).json({ error: 'Insufficient permission to reject' });

    const bom = await dbGet('SELECT id, approval_status FROM bom_headers WHERE id = ?', [bomId]) as any;
    if (!bom) return res.status(404).json({ error: 'BOM not found' });

    // Reset approval
    await dbRun(
      'UPDATE bom_headers SET approval_status = -1, approved_by_supervisor_id = NULL, approved_by_manager_id = NULL, approved_at_supervisor = NULL, approved_at_manager = NULL WHERE id = ?',
      [bomId]
    );
    return res.json({ message: 'BOM rejected', approval_status: -1 });
  } catch (error) {
    console.error('Error rejecting BOM:', error);
    res.status(500).json({ error: 'Failed to reject BOM' });
  }
});

export default router;
